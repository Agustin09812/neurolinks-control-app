require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const railwayService = require('./src/services/railwayService');
const supabaseService = require('./src/services/supabaseService');

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
const VALID_TICKET_TIPOS = ['Soporte', 'Mejora', 'Bugs'];
const VALID_TICKET_ESTADOS = ['Abierto', 'En Progreso', 'En progreso', 'Cerrado'];
const VALID_TICKET_PRIORIDADES = ['Baja', 'Media', 'Alta'];
const VALID_PAYMENT_METODOS = ['Transferencia', 'Efectivo', 'Mercado Pago', 'Crypto', 'Cripto', 'Otro'];

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

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets/sw.js'));
});

app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'src/renderer/login.html'));
});

app.post('/login', (req, res) => {
  const password = sanitizeStr(req.body.password, 200);
  if (!password) return res.status(400).json({ ok: false, error: 'Contraseña requerida' });
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    if (req.body.rememberMe) {
      req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year (effectively permanent)
    }
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --------------------------------------------------
// PROTEGIDO: app y sus archivos JS
// --------------------------------------------------

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'src/renderer/index.html'));
});

app.use('/core', express.static(path.join(__dirname, 'src/renderer/core')));
app.use('/views', express.static(path.join(__dirname, 'src/renderer/views')));

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

const router = express.Router();
router.use((req, res, next) => requireAuth(req, res, next));

// Assistants
router.get('/assistants', async (req, res) => {
  try { res.json(await railwayService.getAssistants()); }
  catch (err) { res.status(500).json({ error: err.message }); }
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
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients', async (req, res) => {
  try { res.json(await supabaseService.getClients()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/clients', async (req, res) => {
  const nombre = sanitizeStr(req.body.nombre, 100);
  const email = sanitizeStr(req.body.email, 200) || null;
  const empresa = sanitizeStr(req.body.empresa, 100) || null;
  const telefono = sanitizeStr(req.body.telefono, 20) || null;
  const plan = VALID_PLANS.includes(req.body.plan) ? req.body.plan : 'Standard';
  const vencimiento = isValidDate(req.body.vencimiento) ? (req.body.vencimiento || null) : null;
  const abono = req.body.abono !== undefined ? (parseFloat(req.body.abono) || 0) : 0;

  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Email inválido' });

  const clientData = { nombre, email, empresa, telefono, plan, vencimiento, abono };
  try {
    const result = await supabaseService.createClient(clientData);
    await supabaseService.logAction('Crear Cliente', `Se creó el cliente ${nombre}`, 'clientes', result.id);
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

  try {
    const result = await supabaseService.updateClient(req.params.id, clientData);
    await supabaseService.logAction('Actualizar Cliente', `Se actualizaron datos de ${clientData.nombre || 'cliente'}`, 'clientes', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const result = await supabaseService.deleteClient(req.params.id);
    await supabaseService.logAction('Eliminar Cliente', `Se eliminó el cliente ID: ${req.params.id}`, 'clientes', req.params.id);
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

router.get('/clients/:id/payments', async (req, res) => {
  try { res.json(await supabaseService.getClientPayments(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Tickets
router.get('/tickets', async (req, res) => {
  const filters = {
    estado: sanitizeStr(req.query.estado, 50) || undefined,
    tipo: sanitizeStr(req.query.tipo, 50) || undefined,
    cliente_id: sanitizeStr(req.query.cliente_id, 200) || undefined,
  };
  Object.keys(filters).forEach(k => filters[k] === undefined && delete filters[k]);
  try { res.json(await supabaseService.getTickets(filters)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tickets', async (req, res) => {
  const titulo = sanitizeStr(req.body.titulo, 200);
  const cliente_id = sanitizeStr(req.body.cliente_id, 200);
  if (!titulo) return res.status(400).json({ error: 'El título es requerido' });
  if (!cliente_id) return res.status(400).json({ error: 'El cliente es requerido' });

  const ticketData = {
    titulo,
    cliente_id,
    descripcion: sanitizeStr(req.body.descripcion, 5000) || null,
    tipo: VALID_TICKET_TIPOS.includes(req.body.tipo) ? req.body.tipo : 'Soporte',
    estado: VALID_TICKET_ESTADOS.includes(req.body.estado) ? req.body.estado : 'Abierto',
    prioridad: VALID_TICKET_PRIORIDADES.includes(req.body.prioridad) ? req.body.prioridad : 'Media',
  };
  try {
    const result = await supabaseService.createTicket(ticketData);
    await supabaseService.logAction('Crear Ticket', `Nuevo ticket: ${titulo}`, 'tickets', result.id);
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
  if (req.body.tipo !== undefined) ticketData.tipo = VALID_TICKET_TIPOS.includes(req.body.tipo) ? req.body.tipo : 'Soporte';
  if (req.body.estado !== undefined) ticketData.estado = VALID_TICKET_ESTADOS.includes(req.body.estado) ? req.body.estado : 'Abierto';
  if (req.body.prioridad !== undefined) ticketData.prioridad = VALID_TICKET_PRIORIDADES.includes(req.body.prioridad) ? req.body.prioridad : 'Media';

  try {
    const result = await supabaseService.updateTicket(req.params.id, ticketData);
    const statusMsg = ticketData.estado ? ` (Estado: ${ticketData.estado})` : "";
    await supabaseService.logAction('Actualizar Ticket', `Ticket #${req.params.id} actualizado${statusMsg}`, 'tickets', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tickets/:id', async (req, res) => {
  try { res.json(await supabaseService.deleteTicket(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Audit
router.get('/audit', async (req, res) => {
  try { res.json(await supabaseService.getAuditLogs()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Payments
router.get('/payments', async (req, res) => {
  try { res.json(await supabaseService.getAllPayments()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', async (req, res) => {
  const cliente_id = sanitizeStr(req.body.cliente_id, 200);
  const concepto = sanitizeStr(req.body.concepto, 200);
  const metodo = VALID_PAYMENT_METODOS.includes(req.body.metodo) ? req.body.metodo : 'Transferencia';
  const fecha = req.body.fecha;
  const monto = parseFloat(req.body.monto);

  if (!cliente_id) return res.status(400).json({ error: 'El cliente es requerido' });
  if (!concepto) return res.status(400).json({ error: 'El concepto es requerido' });
  if (!isValidDate(fecha) || !fecha) return res.status(400).json({ error: 'Fecha inválida' });
  if (isNaN(monto) || monto <= 0) return res.status(400).json({ error: 'Monto inválido' });

  const paymentData = { cliente_id, concepto, metodo, fecha, monto };
  try {
    const result = await supabaseService.createPayment(paymentData);
    await supabaseService.logAction('Registrar Pago', `Pago de $${monto} - ${concepto}`, 'pagos', result.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/payments/:id', async (req, res) => {
  try { res.json(await supabaseService.deletePayment(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', router);

// --------------------------------------------------
// BACKGROUND MONITORING (reemplaza el setInterval de main.js)
// --------------------------------------------------

let lastAssistantsState = new Map();

async function startBackgroundMonitoring() {
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
