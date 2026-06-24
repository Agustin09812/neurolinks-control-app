require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const railwayService = require('./src/services/railwayService');
const supabaseService = require('./src/services/supabaseService');

// --------------------------------------------------
// IN-MEMORY CACHE
// --------------------------------------------------

const _cache = new Map(); // key -> { data, expiresAt }

/**
 * Returns cached data if still valid, otherwise calls fn(), caches the result and returns it.
 * @param {string} key - Cache key
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @param {Function} fn - Async function that fetches fresh data
 * @param {boolean} [forceRefresh=false] - If true, bypass cache and fetch fresh
 */
async function withCache(key, ttlMs, fn, forceRefresh = false) {
  if (!forceRefresh) {
    const hit = _cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.data;
    }
  }
  const data = await fn();
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/** Invalidate one or more cache keys immediately */
function invalidateCache(...keys) {
  keys.forEach(k => _cache.delete(k));
}

// --------------------------------------------------
// INPUT SANITIZATION HELPERS
// --------------------------------------------------

function sanitizeStr(val, maxLen = 500) {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

function isValidDate(dateStr) {
  if (!dateStr) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

const VALID_PLANS = ['Standard', 'Premium', 'Enterprise', 'Baja'];
const VALID_TICKET_ESTADOS = ['Abierto', 'En progreso', 'Cerrado'];

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'neurolinks-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' }
}));

// --------------------------------------------------
// AUTH
// --------------------------------------------------

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autorizado' });
  res.redirect('/login');
}

// --------------------------------------------------
// PUBLICO: assets y login
// --------------------------------------------------

app.use('/assets', express.static(path.join(__dirname, 'dist/assets')));

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/sw.js'));
});

app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'dist/login.html'));
});

app.post('/login', async (req, res) => {
  const username = sanitizeStr(req.body.username, 200);
  const password = sanitizeStr(req.body.password, 200);

  if (!password) {
    return res.status(400).json({ ok: false, error: 'Contraseña requerida' });
  }

  // 1. Intentar validar contra la tabla de base de datos
  let isValid = false;
  if (username) {
    isValid = await supabaseService.validateAdminLogin(username, password);
  }

  // 2. Fallback si no es válido (solo permitido en desarrollo local)
  const isLocalDev = process.env.NODE_ENV !== 'production';
  if (!isValid && isLocalDev && username === 'admin' && password === process.env.ADMIN_PASSWORD) {
    isValid = true;
  }

  if (isValid) {
    req.session.authenticated = true;
    req.session.username = username || 'admin';
    if (req.body.rememberMe) {
      req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year (effectively permanent)
    }
    return res.json({ ok: true });
  }

  res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --------------------------------------------------
// PROTEGIDO: app y sus archivos JS
// --------------------------------------------------

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

const router = express.Router();
router.use((req, res, next) => requireAuth(req, res, next));

// --------------------------------------------------
// SSE - TICKETS REALTIME
// --------------------------------------------------

const _sseClients = new Set();

function _broadcastTicketEvent(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of _sseClients) {
    try { res.write(data); } catch (_) { _sseClients.delete(res); }
  }
}

router.get('/tickets/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': connected\n\n');

  _sseClients.add(res);

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(keepAlive); }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    _sseClients.delete(res);
  });
});

// --------------------------------------------------
// SSE - LOGS REALTIME
// --------------------------------------------------

const _sseLogsClients = new Set();
const _sseClientsList = new Set();

function _broadcastClientEvent(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of _sseClientsList) {
    try { res.write(data); } catch (_) { _sseClientsList.delete(res); }
  }
}

router.get('/clients/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': connected\n\n');

  _sseClientsList.add(res);

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(keepAlive); }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    _sseClientsList.delete(res);
  });
});

function _broadcastLogEvent(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of _sseLogsClients) {
    try { res.write(data); } catch (_) { _sseLogsClients.delete(res); }
  }
}

router.get('/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': connected\n\n');

  _sseLogsClients.add(res);

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { clearInterval(keepAlive); }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    _sseLogsClients.delete(res);
  });
});

// Config
router.get('/config/supabase', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  });
});

// Assistants — cached 15s; pass ?refresh=true to force a fresh fetch
router.get('/assistants', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await withCache('assistants', 15_000, () => railwayService.getAssistants(), forceRefresh);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Projects
router.patch('/projects/:id/name', async (req, res) => {
  const newName = sanitizeStr(req.body.newName, 100);
  if (!newName) return res.status(400).json({ error: 'El nombre es requerido' });
  try { res.json(await railwayService.updateProjectName(req.params.id, newName)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/projects/:id', async (req, res) => {
  try { res.json(await railwayService.deleteProject(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/:id/client', async (req, res) => {
  try { res.json(await supabaseService.getProjectClient(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/projects/:id/unlink', async (req, res) => {
  try {
    const result = await supabaseService.unlinkProjectClient(req.params.id);
    await supabaseService.logAction('Desvincular Proyecto', `Se desvinculó el proyecto ${req.params.id} del cliente`, 'clientes', req.params.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/:id/whatsapp', async (req, res) => {
  try { res.json(await supabaseService.getWhatsAppSessionStatus(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Templates
router.get('/templates', async (req, res) => {
  const q = sanitizeStr(req.query.q, 100);
  try { res.json(await railwayService.searchTemplates(q)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/templates/:id/deploy', async (req, res) => {
  try {
    const result = await railwayService.deployTemplate(req.params.id);
    if (result.success) {
      await supabaseService.logAction('Deploy Template', `Nuevo proyecto creado vía template: ${req.params.id}`, 'proyectos', result.projectId);
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Services
router.patch('/services/:id/name', async (req, res) => {
  const newName = sanitizeStr(req.body.newName, 200);
  if (!newName) return res.status(400).json({ error: 'newName requerido' });
  try {
    const result = await railwayService.updateServiceName(req.params.id, newName);
    await supabaseService.logAction('Renombrar Servicio', `Servicio ${req.params.id} renombrado a: ${newName}`, 'servicios', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/services/:id/redeploy', async (req, res) => {
  const environmentId = sanitizeStr(req.body.environmentId, 200);
  try {
    const result = await railwayService.redeployService(req.params.id, environmentId);
    await supabaseService.logAction('Reiniciar Servicio', `Reinicio de servicio ID: ${req.params.id}`, 'servicios', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/projects/:id/update', async (req, res) => {
  const { environmentId, serviceId } = req.body;
  try {
    const result = await railwayService.deployServiceUpdate(req.params.id, environmentId, serviceId);
    await supabaseService.logAction('Actualizar Proyecto', `Actualización de proyecto ID: ${req.params.id}`, 'proyectos', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// Variables
router.get('/variables', async (req, res) => {
  const { projectId, environmentId, serviceId } = req.query;
  try { res.json(await railwayService.getServiceVariables(projectId, environmentId, serviceId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/variables', async (req, res) => {
  const projectId = sanitizeStr(req.body.projectId, 200);
  const environmentId = sanitizeStr(req.body.environmentId, 200);
  const serviceId = sanitizeStr(req.body.serviceId, 200);
  const name = sanitizeStr(req.body.name, 200);
  const value = sanitizeStr(req.body.value, 32768);
  if (!name) return res.status(400).json({ error: 'El nombre de la variable es requerido' });
  try {
    const result = await railwayService.upsertVariable(projectId, environmentId, serviceId, name, value);
    await supabaseService.logAction('Cambio Variable', `Se actualizó la variable ${name}`, 'variables', serviceId || projectId);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/variables/delete', async (req, res) => {
  const projectId = sanitizeStr(req.body.projectId, 200);
  const environmentId = sanitizeStr(req.body.environmentId, 200);
  const serviceId = sanitizeStr(req.body.serviceId, 200);
  const name = sanitizeStr(req.body.name, 200);
  if (!name) return res.status(400).json({ error: 'El nombre de la variable es requerido' });
  try { res.json(await railwayService.deleteVariable(projectId, environmentId, serviceId, name)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Settings (Supabase secundaria)
router.get('/settings/:projectId', async (req, res) => {
  try { res.json(await supabaseService.getSettings(req.params.projectId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings/:projectId', async (req, res) => {
  try {
    const { key, value } = req.body;
    res.json(await supabaseService.updateSetting(req.params.projectId, key, value));
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Domains
router.get('/domains', async (req, res) => {
  const { projectId, environmentId, serviceId } = req.query;
  try { res.json(await railwayService.getServiceDomains(projectId, environmentId, serviceId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Clients — /link debe ir antes de /:id para evitar conflicto de rutas
router.post('/clients/link', async (req, res) => {
  const railwayProjectId = sanitizeStr(req.body.railwayProjectId, 200);
  const clientId = sanitizeStr(req.body.clientId, 200);
  if (!railwayProjectId || !clientId) return res.status(400).json({ error: 'railwayProjectId y clientId son requeridos' });
  try {
    const result = await supabaseService.linkProjectToClient(railwayProjectId, clientId);
    await supabaseService.logAction('Vincular Proyecto', `Se vinculó el proyecto ${railwayProjectId} al cliente ID: ${clientId}`, 'clientes', clientId);
    invalidateCache('clients');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await withCache('clients', 5_000, () => supabaseService.getClients(), forceRefresh);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/clients', async (req, res) => {
  const nombre = sanitizeStr(req.body.nombre, 100);
  const email = sanitizeStr(req.body.email, 200) || null;
  const empresa = sanitizeStr(req.body.empresa, 100) || null;
  const telefono = sanitizeStr(req.body.telefono, 20) || null;
  const plan = VALID_PLANS.includes(req.body.plan) ? req.body.plan : 'Standard';
  const vencimiento = isValidDate(req.body.vencimiento) ? (req.body.vencimiento || null) : null;
  const abono = req.body.abono !== undefined ? (parseFloat(req.body.abono) || 0) : 0;
  const vendedor_user_id = req.body.vendedor_user_id !== undefined ? (req.body.vendedor_user_id || null) : null;

  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Email inválido' });

  const clientData = { nombre, email, empresa, telefono, plan, vencimiento, abono, vendedor_user_id };
  try {
    const result = await supabaseService.createClient(clientData);
    await supabaseService.logAction('Crear Cliente', `Se creó el cliente ${nombre}`, 'clientes', result.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya esta registrado en otro cliente.' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/clients/:id', async (req, res) => {
  const clientData = {};
  if (req.body.nombre !== undefined) {
    clientData.nombre = sanitizeStr(req.body.nombre, 100);
    if (!clientData.nombre) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
  }
  if (req.body.email !== undefined) {
    clientData.email = sanitizeStr(req.body.email, 200) || null;
    if (clientData.email && !isValidEmail(clientData.email)) return res.status(400).json({ error: 'Email inválido' });
  }
  if (req.body.empresa !== undefined) clientData.empresa = sanitizeStr(req.body.empresa, 100) || null;
  if (req.body.telefono !== undefined) clientData.telefono = sanitizeStr(req.body.telefono, 20) || null;
  if (req.body.plan !== undefined) clientData.plan = VALID_PLANS.includes(req.body.plan) ? req.body.plan : 'Standard';
  if (req.body.vencimiento !== undefined) clientData.vencimiento = isValidDate(req.body.vencimiento) ? (req.body.vencimiento || null) : null;
  if (req.body.abono !== undefined) clientData.abono = parseFloat(req.body.abono) || 0;
  if (req.body.vendedor_user_id !== undefined) clientData.vendedor_user_id = req.body.vendedor_user_id || null;

  try {
    const result = await supabaseService.updateClient(req.params.id, clientData);
    await supabaseService.logAction('Actualizar Cliente', `Se actualizaron datos de ${clientData.nombre || 'cliente'}`, 'clientes', req.params.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const result = await supabaseService.deleteClient(req.params.id);
    await supabaseService.logAction('Eliminar Cliente', `Se eliminó el cliente ID: ${req.params.id}`, 'clientes', req.params.id);
    invalidateCache('clients');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients/:id/projects', async (req, res) => {
  try { res.json(await supabaseService.getClientProjects(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients/:id/pending-tickets', async (req, res) => {
  try { res.json(await supabaseService.getClientPendingTickets(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Tickets
// /tickets/meta debe ir ANTES de /tickets/:id para evitar conflicto de rutas
router.get('/tickets/meta', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await withCache('tickets_meta', 5_000, () => supabaseService.getTicketsMeta(), forceRefresh);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tickets/:id', async (req, res) => {
  try { res.json(await supabaseService.getTicketById(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tickets', async (req, res) => {
  const filters = {
    estado:     sanitizeStr(req.query.estado, 50)      || undefined,
    cliente_id: sanitizeStr(req.query.cliente_id, 200) || undefined,
    page:       parseInt(req.query.page)  || 1,
    limit:      parseInt(req.query.limit) || 25,
  };
  Object.keys(filters).forEach(k => filters[k] === undefined && delete filters[k]);
  try { res.json(await supabaseService.getTickets(filters)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tickets', async (req, res) => {
  const titulo = sanitizeStr(req.body.titulo, 200);
  const cliente_id = sanitizeStr(req.body.cliente_id, 200);
  const project_id = sanitizeStr(req.body.project_id, 200) || null;
  if (!titulo) return res.status(400).json({ error: 'El título es requerido' });
  if (!cliente_id) return res.status(400).json({ error: 'El cliente es requerido' });

  const ticketData = {
    titulo,
    cliente_id,
    project_id,
    descripcion: sanitizeStr(req.body.descripcion, 5000) || null,
    estado: 'Abierto',
  };
  try {
    const result = await supabaseService.createTicket(ticketData);
    await supabaseService.logAction('Crear Ticket', `Nuevo ticket: ${titulo}`, 'tickets', result.id);
    invalidateCache('tickets_meta');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/tickets/:id', async (req, res) => {
  const ticketData = {};
  if (req.body.titulo !== undefined) {
    ticketData.titulo = sanitizeStr(req.body.titulo, 200);
    if (!ticketData.titulo) return res.status(400).json({ error: 'El título no puede estar vacío' });
  }
  if (req.body.descripcion !== undefined) ticketData.descripcion = sanitizeStr(req.body.descripcion, 5000) || null;
  if (req.body.cliente_id !== undefined) ticketData.cliente_id = sanitizeStr(req.body.cliente_id, 200);
  if (req.body.project_id !== undefined) ticketData.project_id = sanitizeStr(req.body.project_id, 200) || null;
  if (req.body.estado !== undefined && VALID_TICKET_ESTADOS.includes(req.body.estado)) ticketData.estado = req.body.estado;
  if (req.body.read_admin_count !== undefined) {
    const n = parseInt(req.body.read_admin_count);
    if (!isNaN(n) && n >= 0) ticketData.read_admin_count = n;
  }

  try {
    const result = await supabaseService.updateTicket(req.params.id, ticketData);
    // Solo loguear cambios de estado, no actualizaciones de read_admin_count
    if (ticketData.estado) {
      await supabaseService.logAction('Actualizar Ticket', `Ticket #${req.params.id} actualizado`, 'tickets', req.params.id);
    }
    invalidateCache('tickets_meta');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tickets/:id/chat', async (req, res) => {
  const mensaje = sanitizeStr(req.body.mensaje, 5000);
  const rol = req.body.rol === 'cliente' ? 'cliente' : 'admin';
  
  if (!mensaje) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  
  const chatMsg = {
      id: crypto.randomUUID(),
      rol,
      mensaje,
      fecha: new Date().toISOString()
  };

  try {
      const result = await supabaseService.addTicketMessage(req.params.id, chatMsg);
      res.json(result);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

router.delete('/tickets/:id', async (req, res) => {
  try {
    const result = await supabaseService.deleteTicket(req.params.id);
    invalidateCache('tickets_meta');
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Audit
router.get('/audit', async (req, res) => {
  try { res.json(await supabaseService.getAuditLogs()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Logs
router.get('/logs', async (req, res) => {
  try { res.json(await supabaseService.getSystemLogs(100)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Admins
router.get('/admins', async (req, res) => {
  try { res.json(await supabaseService.getAdmins()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', (req, res) => {
  res.json({ username: req.session.username || 'admin' });
});

app.use('/api', router);

// --------------------------------------------------
// BACKGROUND MONITORING (reemplaza el setInterval de main.js)
// --------------------------------------------------

let lastAssistantsState = new Map();

async function startBackgroundMonitoring() {
  // Initial synchronization for auto-linking and backoffice tokens
  try {
    console.log('[Sync] Running initial database synchronization...');
    const linkCount = await supabaseService.autoLinkClientProjects();
    if (linkCount > 0) console.log(`[Sync] Automatically linked ${linkCount} pending project(s)`);

    const tokenCount = await supabaseService.syncClientsBackofficeTokens();
    if (tokenCount > 0) console.log(`[Sync] Automatically updated tokens for ${tokenCount} client(s)`);

    console.log('[Sync] Initial synchronization completed successfully');
  } catch (syncErr) {
    console.error('[Sync] Error during initial synchronization:', syncErr.message);
  }

  // Supabase Realtime: push INSERT events on tickets to SSE clients
  try {
    const { createClient } = require('@supabase/supabase-js');
    const realtimeClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    realtimeClient
      .channel('tickets-inserts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
        _broadcastTicketEvent({ type: payload.eventType, ticket: payload.new || payload.old });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] tickets channel activo');
      });

    realtimeClient
      .channel('system_logs_inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, payload => {
        _broadcastLogEvent({ type: 'INSERT', log: payload.new });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] logs channel activo');
      });

    realtimeClient
      .channel('clientes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, async payload => {
        _broadcastClientEvent({ type: payload.eventType, client: payload.new || payload.old });
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          try {
            const count = await supabaseService.autoLinkClientProjects();
            if (count > 0) {
              console.log(`[Auto-Link] Realtime triggered: Linked ${count} new project(s) due to client change`);
            }
          } catch (linkErr) {
            console.error('[Auto-Link] Realtime trigger failed:', linkErr.message);
          }
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] clientes channel activo');
      });

    // pagos-ingresos-changes subscription removed as billing system is eradicated
  } catch (e) {
    console.error('[Realtime] Error iniciando suscripcion:', e.message);
  }

  try {
    const assistants = await railwayService.getAssistants();
    assistants.forEach(a => {
      a.services.forEach(s => {
        lastAssistantsState.set(`${a.id}-${s.id}`, s.status);
      });
    });
  } catch (e) {
    console.error('[Monitor] Error inicializando:', e.message);
  }

  setInterval(async () => {
    try {
      const assistants = await railwayService.getAssistants();
      for (const a of assistants) {
        for (const s of a.services) {
          const key = `${a.id}-${s.id}`;
          const oldStatus = lastAssistantsState.get(key);
          const newStatus = s.status;

          if (newStatus === 'error') {
            if (oldStatus !== 'error') {
              console.log(`[Monitor] Error detectado en ${a.name} / ${s.name}`);
            }
            await tryAutoRedeploy(a, s);
          }

          lastAssistantsState.set(key, newStatus);
        }
      }
    } catch (err) {
      console.error('[Monitor] Error en ciclo:', err.message);
    }
  }, 60000);
}

async function tryAutoRedeploy(project, service) {
  try {
    const delay = Math.floor(Math.random() * 5000);
    await new Promise(resolve => setTimeout(resolve, delay));

    const attempts = await supabaseService.getRecentAutoRedeployCount(service.id);

    if (attempts < 2) {
      console.log(`[Auto-Recovery] ${service.name}. Intento #${attempts + 1}`);
      await supabaseService.logAction(
        'Auto-Redeploy',
        `Sistema automático detectó fallo. Iniciando intento #${attempts + 1} de recuperación.`,
        'servicios',
        service.id
      );
      await railwayService.redeployService(service.id, service.environmentId);
    }
  } catch (error) {
    console.error('[Auto-Recovery] Error:', error.message);
  }
}

// --------------------------------------------------
// START
// --------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Neurolinks Control corriendo en puerto ${PORT}`);
  console.log(`Panel: http://localhost:${PORT}/`);
  startBackgroundMonitoring();
});
