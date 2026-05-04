require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const railwayService = require('./src/services/railwayService');
const supabaseService = require('./src/services/supabaseService');

const app = express();

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'neurolinks-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));

// --------------------------------------------------
// AUTH
// --------------------------------------------------

function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'No autorizado' });
  res.redirect('/admin/login');
}

// --------------------------------------------------
// PUBLICO: assets y login
// --------------------------------------------------

app.use('/admin/assets', express.static(path.join(__dirname, 'assets')));

app.get('/admin/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'src/renderer/login.html'));
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// --------------------------------------------------
// PROTEGIDO: app y sus archivos JS
// --------------------------------------------------

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'src/renderer/index.html'));
});

app.use('/admin/core', requireAuth, express.static(path.join(__dirname, 'src/renderer/core')));
app.use('/admin/views', requireAuth, express.static(path.join(__dirname, 'src/renderer/views')));

app.get('/', (req, res) => res.redirect('/admin'));

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
  try { res.json(await railwayService.updateProjectName(req.params.id, req.body.newName)); }
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
  try { res.json(await railwayService.searchTemplates(req.query.q || '')); }
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
router.post('/services/:id/redeploy', async (req, res) => {
  try {
    const result = await railwayService.redeployService(req.params.id, req.body.environmentId);
    await supabaseService.logAction('Reiniciar Servicio', `Reinicio de servicio ID: ${req.params.id}`, 'servicios', req.params.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/services/:id', async (req, res) => {
  try {
    const result = await railwayService.deleteService(req.params.id);
    await supabaseService.logAction('Eliminar Servicio', `Eliminación de servicio ID: ${req.params.id}`, 'servicios', req.params.id);
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
  const { projectId, environmentId, serviceId, name, value } = req.body;
  try {
    const result = await railwayService.upsertVariable(projectId, environmentId, serviceId, name, value);
    await supabaseService.logAction('Cambio Variable', `Se actualizó la variable ${name}`, 'variables', serviceId || projectId);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/variables/delete', async (req, res) => {
  const { projectId, environmentId, serviceId, name } = req.body;
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
  const { railwayProjectId, clientId } = req.body;
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
  try {
    const result = await supabaseService.createClient(req.body);
    await supabaseService.logAction('Crear Cliente', `Se creó el cliente ${req.body.nombre}`, 'clientes', result.id);
    res.json(result);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya esta registrado en otro cliente.' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/clients/:id', async (req, res) => {
  try {
    const result = await supabaseService.updateClient(req.params.id, req.body);
    await supabaseService.logAction('Actualizar Cliente', `Se actualizaron datos de ${req.body.nombre || 'cliente'}`, 'clientes', req.params.id);
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
  try { res.json(await supabaseService.getTickets(req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tickets', async (req, res) => {
  try {
    const result = await supabaseService.createTicket(req.body);
    await supabaseService.logAction('Crear Ticket', `Nuevo ticket: ${req.body.titulo}`, 'tickets', result.id);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/tickets/:id', async (req, res) => {
  try {
    const result = await supabaseService.updateTicket(req.params.id, req.body);
    const statusMsg = req.body.estado ? ` (Estado: ${req.body.estado})` : "";
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
  try {
    const result = await supabaseService.createPayment(req.body);
    await supabaseService.logAction('Registrar Pago', `Pago de $${req.body.monto} - ${req.body.concepto}`, 'pagos', result.id);
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
  console.log(`Panel: http://localhost:${PORT}/admin`);
  startBackgroundMonitoring();
});
