const { app, BrowserWindow, shell, ipcMain, Menu, Notification, dialog } = require('electron');
const path = require('path');
const https = require("https");
const fs = require('fs');
const extract = require('extract-zip');

// HOT FIX PARA COMPILAR 
const isDev = !app.isPackaged;

require('dotenv').config({
  path: isDev
    ? path.join(__dirname, '../../.env')
    : path.join(process.resourcesPath, '.env')
});

const railwayService = require('../services/railwayService');
const supabaseService = require('../services/supabaseService');

let splash;
let mainWindow;
let splashStartTime;
let currentAuditUser = 'admin';

function createSplash() {
  splashStartTime = Date.now();

  splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    alwaysOnTop: false,
    resizable: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splash.loadFile(path.join(__dirname, "../renderer/splash.html"));

  splash.webContents.on('did-finish-load', async () => {
    const version = app.getVersion();
    splash.webContents.send('set-version', version);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    minWidth: 1024,
    minHeight: 768,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once("ready-to-show", () => {

    const elapsed = Date.now() - splashStartTime;
    const minTime = 3000; // Segundos mínimo

    const remaining = Math.max(minTime - elapsed, 0);

    setTimeout(() => {
      if (splash) splash.destroy();

      mainWindow.setOpacity(0);
      mainWindow.show();

      let opacity = 0;
      const fade = setInterval(() => {
        opacity += 0.05;
        mainWindow.setOpacity(opacity);
        if (opacity >= 1) clearInterval(fade);
      }, 20);

      // Iniciar monitoreo en background cuando la ventana principal está lista
      startBackgroundMonitoring();

    }, remaining);

  });
}

// Updates Function (checkForUpdates + isNewerVersion)

async function checkForUpdates() {

  return new Promise((resolve) => {

    const options = {
      hostname: "api.github.com",
      path: "/repos/Agustin09812/neurolinks-control-app/releases/latest",
      method: "GET",
      headers: {
        "User-Agent": "Neurolinks-Control",
        "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json"
      }
    };

    const req = https.request(options, (res) => {

      let data = "";

      res.on("data", chunk => data += chunk);

      res.on("end", () => {

        try {

          const json = JSON.parse(data);

          const remoteVersion = json.tag_name?.replace("v", "");
          const localVersion = app.getVersion();

          if (!remoteVersion) return resolve(null);

          if (isNewerVersion(remoteVersion, localVersion)) {

            const asset = json.assets?.find(a => a.name.endsWith(".zip"));

            if (!asset) return resolve(null);

            return resolve({
              version: remoteVersion,
              url: asset.browser_download_url
            });

          }

          resolve(null);

        } catch {
          resolve(null);
        }

      });

    });

    req.on("error", () => resolve(null));
    req.end();

  });

}

function isNewerVersion(remote, local) {

  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);

  for (let i = 0; i < r.length; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }

  return false;
}

// =======================================================

app.whenReady().then(() => {
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }
  createSplash();

  checkForUpdates().then(update => {

    if (update) {

      splash.webContents.send("update-available", update);

    } else {

      createMainWindow();

    }

  });
});


// --------------------------------------------------
// OPEN EXTERNAL
// --------------------------------------------------

ipcMain.handle('open-external', async (_, url) => {
  return shell.openExternal(url);
});

ipcMain.handle('open-clients-window', async () => {
  const clientsWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  clientsWindow.loadFile(path.join(__dirname, '../renderer/pages/clients.html'));
});

ipcMain.handle('open-tickets-window', async () => {
  const ticketsWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  ticketsWindow.loadFile(path.join(__dirname, '../renderer/pages/tickets.html'));
});


// --------------------------------------------------
// GET ASSISTANTS (Projects + Services + Latest Deployment)
// --------------------------------------------------

ipcMain.handle('get-assistants', async (_, clientId) => {
  try {
    let projectIds = null;
    if (clientId) {
      projectIds = await supabaseService.getClientProjects(clientId);
    }
    return await railwayService.getAssistants(projectIds);
  } catch (error) {
    console.error("Error en get-assistants:", error);
    throw error;
  }
});


// --------------------------------------------------
// TEMPLATES (Search & Deploy)
// --------------------------------------------------

ipcMain.handle('search-templates', async (_, query) => {
  try {
    return await railwayService.searchTemplates(query);
  } catch (error) {
    console.error("Error en search-templates:", error);
    throw error;
  }
});

ipcMain.handle('get-template-variables', async (_, templateId) => {
  try {
    return await railwayService.getTemplateVariables(templateId);
  } catch (error) {
    console.error("Error en get-template-variables:", error);
    throw error;
  }
});

ipcMain.handle('deploy-template', async (_, templateId, variables) => {
  try {
    const result = await railwayService.deployTemplate(templateId, variables);

    if (result.success) {
      const projectId = result.projectId;
      await supabaseService.logAction('Deploy Template', `Nuevo proyecto creado vía template: ${result.templateName || templateId}`, 'proyectos', projectId, currentAuditUser);
      return { success: true, projectId };
    } else {
      return { success: false, error: result.error || "Error desconocido en el despliegue" };
    }
  } catch (error) {
    console.error("Error en deploy-template:", error);
    return { success: false, error: error.message };
  }
});


// --------------------------------------------------
// REDEPLOY SERVICE
// --------------------------------------------------

ipcMain.handle('redeploy-service', async (_, serviceId, environmentId) => {
  try {
    const result = await railwayService.redeployService(serviceId, environmentId);
    await supabaseService.logAction('Reiniciar Servicio', `Reinicio de servicio ID: ${serviceId}`, 'servicios', serviceId, currentAuditUser);
    return result;
  } catch (error) {
    console.error("Error en redeploy-service:", error);
    throw error;
  }
});

ipcMain.handle('deploy-service-update', async (_, serviceId, environmentId) => {
  try {
    const result = await railwayService.deployServiceUpdate(serviceId, environmentId);
    await supabaseService.logAction('Deploy Update', `Deploy de actualización disponible para servicio ID: ${serviceId}`, 'servicios', serviceId, currentAuditUser);
    return result;
  } catch (error) {
    console.error("Error en deploy-service-update:", error);
    throw error;
  }
});


// --------------------------------------------------
// DELETE SERVICE
// --------------------------------------------------

ipcMain.handle('delete-service', async (_, serviceId) => {
  try {
    const result = await railwayService.deleteService(serviceId);
    await supabaseService.logAction('Eliminar Servicio', `Eliminación de servicio ID: ${serviceId}`, 'servicios', serviceId, currentAuditUser);
    return result;
  } catch (error) {
    console.error("Error en delete-service:", error);
    throw error;
  }
});


// --------------------------------------------------
// OPEN LOGS WINDOW
// --------------------------------------------------

ipcMain.handle('open-logs-window', async (_, deploymentId) => {

  const logsWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  logsWindow.loadFile(path.join(__dirname, '../renderer/pages/logs.html'));

  logsWindow.webContents.on('did-finish-load', () => {
    logsWindow.webContents.send('load-logs', deploymentId);
  });

});

// --------------------------------------------------
// OPEN VARIABLES WINDOW
// --------------------------------------------------

ipcMain.handle('open-variables-window', async (_, projectId, environmentId, serviceId) => {

  const variablesWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  variablesWindow.loadFile(path.join(__dirname, '../renderer/pages/variables.html'));

  variablesWindow.webContents.on('did-finish-load', () => {
    variablesWindow.webContents.send('load-variables', {
      projectId,
      environmentId,
      serviceId
    });
  });

});

// --------------------------------------------------
// UPDATE PROJECT
// --------------------------------------------------

ipcMain.handle('update-project-name', async (_, projectId, newName) => {
  try {
    return await railwayService.updateProjectName(projectId, newName);
  } catch (error) {
    console.error("Error en update-project-name:", error);
    throw error;
  }
});


// --------------------------------------------------
// DELETE PROJECT
// --------------------------------------------------

ipcMain.handle('delete-project', async (_, projectId) => {
  try {
    return await railwayService.deleteProject(projectId);
  } catch (error) {
    console.error("Error en delete-project:", error);
    throw error;
  }
});

// --------------------------------------------------
// FETCH DEPLOYMENT LOGS
// --------------------------------------------------

ipcMain.handle('fetch-deployment-logs', async (_, deploymentId) => {
  return await railwayService.fetchDeploymentLogs(deploymentId);
});

// --------------------------------------------------
// GET SERVICE VARIABLES
// --------------------------------------------------

ipcMain.handle('get-service-variables', async (_, projectId, environmentId, serviceId) => {
  return await railwayService.getServiceVariables(projectId, environmentId, serviceId);
});

// --------------------------------------------------
// UPSERT VARIABLE
// --------------------------------------------------

ipcMain.handle('upsert-variable', async (_, projectId, environmentId, serviceId, name, value) => {
  try {
    const result = await railwayService.upsertVariable(projectId, environmentId, serviceId, name, value);
    await supabaseService.logAction('Cambio Variable', `Se actualizó la variable ${name}`, 'variables', serviceId || projectId, currentAuditUser);
    return result;
  } catch (error) {
    console.error("Error en upsert-variable:", error);
    throw error;
  }
});

// --------------------------------------------------
// DELETE VARIABLE
// --------------------------------------------------

ipcMain.handle('delete-variable', async (_, projectId, environmentId, serviceId, name) => {
  try {
    return await railwayService.deleteVariable(projectId, environmentId, serviceId, name);
  } catch (error) {
    console.error("Error en delete-variable:", error);
    throw error;
  }
});

// --------------------------------------------------
// GET SERVICE DOMAINS
// --------------------------------------------------

ipcMain.handle('get-service-domains', async (_, projectId, environmentId, serviceId) => {
  return await railwayService.getServiceDomains(projectId, environmentId, serviceId);
});

// --------------------------------------------------
// LOGS
// --------------------------------------------------

ipcMain.handle('download-logs', async (_, deploymentId, serviceName) => {
  try {
    const logs = await railwayService.fetchDeploymentLogs(deploymentId);
    if (!logs || logs.length === 0) return { success: false, message: "No se encontraron logs." };

    const content = logs.map(l => `[${l.timestamp}] [${l.severity}] ${l.message}`).join('\n');

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar Logs de Servicio',
      defaultPath: `${serviceName}-${new Date().toISOString().split('T')[0]}.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, content);
      return { success: true, path: filePath };
    }
    return { success: false, message: "Cancelado por el usuario" };

  } catch (err) {
    console.error("Error descargando logs:", err);
    return { success: false, message: err.message };
  }
});

// --------------------------------------------------
// APP VERSION
// --------------------------------------------------

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// --------------------------------------------------
// SUPABASE / CRM
// --------------------------------------------------

ipcMain.handle('get-clients', async () => {
  return await supabaseService.getClients();
});

ipcMain.handle('create-client', async (_, clientData) => {
  const result = await supabaseService.createClient(clientData);
  await supabaseService.logAction('Crear Cliente', `Se creó el cliente ${clientData.nombre}`, 'clientes', result.id, currentAuditUser);
  return result;
});

ipcMain.handle('update-client', async (_, id, clientData) => {
  const result = await supabaseService.updateClient(id, clientData);
  await supabaseService.logAction('Actualizar Cliente', `Se actualizaron datos de ${clientData.nombre || 'cliente'}`, 'clientes', id, currentAuditUser);
  return result;
});

ipcMain.handle('delete-client', async (_, id) => {
  const result = await supabaseService.deleteClient(id);
  await supabaseService.logAction('Eliminar Cliente', `Se eliminó el cliente ID: ${id}`, 'clientes', id, currentAuditUser);
  return result;
});

ipcMain.handle('link-project-client', async (_, railwayProjectId, clientId) => {
  try {
    const result = await supabaseService.linkProjectToClient(railwayProjectId, clientId);
    await supabaseService.logAction('Vincular Proyecto', `Se vinculó el proyecto ${railwayProjectId} al cliente ID: ${clientId}`, 'clientes', clientId, currentAuditUser);
    return result;
  } catch (error) {
    console.error("Error en link-project-client:", error);
    throw error;
  }
});

ipcMain.handle('get-project-client', async (_, railwayProjectId) => {
  return await supabaseService.getProjectClient(railwayProjectId);
});

ipcMain.handle('get-whatsapp-status', async (_, railwayProjectId) => {
  return await supabaseService.getWhatsAppSessionStatus(railwayProjectId);
});

ipcMain.handle('get-client-projects', async (_, clientId) => {
  return await supabaseService.getClientProjects(clientId);
});

ipcMain.handle('get-tickets', async (_, filters) => {
  return await supabaseService.getTickets(filters);
});

ipcMain.handle('create-ticket', async (_, ticketData) => {
  const result = await supabaseService.createTicket(ticketData);
  await supabaseService.logAction('Crear Ticket', `Nuevo ticket: ${ticketData.titulo}`, 'tickets', result.id, currentAuditUser);
  return result;
});

ipcMain.handle('update-ticket', async (_, id, ticketData) => {
  const result = await supabaseService.updateTicket(id, ticketData);
  const statusMsg = ticketData.estado ? ` (Estado: ${ticketData.estado})` : "";
  await supabaseService.logAction('Actualizar Ticket', `Ticket #${id} actualizado${statusMsg}`, 'tickets', id, currentAuditUser);
  return result;
});

ipcMain.handle('delete-ticket', async (_, id) => {
  return await supabaseService.deleteTicket(id);
});

ipcMain.handle('get-client-pending-tickets', async (_, clientId) => {
  return await supabaseService.getClientPendingTickets(clientId);
});

ipcMain.handle('get-audit-logs', async () => {
  return await supabaseService.getAuditLogs();
});

// --------------------------------------------------
// BILLING / PAGOS
// --------------------------------------------------

ipcMain.handle('get-client-payments', async (_, clientId) => {
  return await supabaseService.getClientPayments(clientId);
});

ipcMain.handle('get-all-payments', async () => {
  return await supabaseService.getAllPayments();
});


ipcMain.handle('create-payment', async (_, paymentData) => {
  const result = await supabaseService.createPayment(paymentData);
  await supabaseService.logAction('Registrar Pago', `Pago de $${paymentData.monto} - ${paymentData.concepto}`, 'pagos', result.id, currentAuditUser);
  return result;
});

ipcMain.handle('delete-payment', async (_, id) => {
  return await supabaseService.deletePayment(id);
});

// --------------------------------------------------
// USUARIOS
// --------------------------------------------------
ipcMain.handle('get-usuarios', async () => {
  return await supabaseService.getUsuarios();
});

ipcMain.handle('create-usuario', async (_, userData) => {
  return await supabaseService.createUsuario(userData);
});

ipcMain.handle('update-usuario', async (_, id, userData) => {
  return await supabaseService.updateUsuario(id, userData);
});

ipcMain.handle('delete-usuario', async (_, id) => {
  return await supabaseService.deleteUsuario(id);
});

ipcMain.handle('get-usuarios-by-cliente', async (_, clienteId) => {
  return await supabaseService.getUsuariosByCliente(clienteId);
});

// --------------------------------------------------
// AUTH / SESSIONS
// --------------------------------------------------

ipcMain.handle('login-with-token', async (_, token) => {
  try {
    return await supabaseService.loginWithToken(token);
  } catch (error) {
    console.error("Error en login-with-token:", error);
    throw error;
  }
});

ipcMain.handle('login-with-credentials', async (_, { usuario, contrasena }) => {
  try {
    return await supabaseService.loginWithCredentials(usuario, contrasena);
  } catch (error) {
    console.error("Error en login-with-credentials:", error);
    throw error;
  }
});

ipcMain.handle('verify-admin', async (_, password) => {
  try {
    return await supabaseService.verifyAdminShortcut(password);
  } catch (error) {
    console.error("Error en verify-admin:", error);
    throw error;
  }
});

// --------------------------------------------------
// NAVIGATION / MESSAGING
// --------------------------------------------------

ipcMain.on('request-select-project', (_, projectId) => {
  if (mainWindow) {
    mainWindow.webContents.send('select-project', projectId);
    mainWindow.focus();
  }
});

ipcMain.on('set-active-user', (_, userData) => {
  if (!userData) {
    currentAuditUser = 'Sistema';
    return;
  }
  // Formato: Rol / Nombre Apellido
  const rol = (userData.rol || 'usuario').toUpperCase();
  const nombreComp = `${userData.nombre || ''} ${userData.apellido || ''}`.trim();
  const display = nombreComp || userData.usuario || 'Desconocido';

  currentAuditUser = `${rol} / ${display}`;
  console.log("Auditoría configurada para el usuario:", currentAuditUser);
});

/**
 * BACKGROUND MONITORING & NOTIFICATIONS
 */
let lastAssistantsState = new Map();

async function startBackgroundMonitoring() {
  console.log("Iniciando monitoreo de alertas...");

  // Guardar estado inicial
  try {
    const assistants = await railwayService.getAssistants();
    assistants.forEach(a => {
      a.services.forEach(s => {
        lastAssistantsState.set(`${a.id}-${s.id}`, s.status);
      });
    });
  } catch (e) {
    console.error("Error inicializando monitoreo:", e.message);
  }

  // Intervalo de chequeo (cada 1 minuto)
  setInterval(async () => {
    try {
      const assistants = await railwayService.getAssistants();

      assistants.forEach(a => {
        a.services.forEach(async (s) => {
          const key = `${a.id}-${s.id}`;
          const oldStatus = lastAssistantsState.get(key);
          const newStatus = s.status;

          // Si entra en error
          if (newStatus === 'error') {
            // Notificación visual si es la primera vez que lo detectamos
            if (oldStatus !== 'error') {
              showErrorNotification(a.name, s.name, a.id);
            }

            // Intentar auto-recuperación (redeploy automático)
            // Se pasa el objeto proyecto 'a' y servicio 's'
            await tryAutoRedeploy(a, s);
          }

          lastAssistantsState.set(key, newStatus);
        });
      });
    } catch (err) {
      console.error("Error en monitoreo background:", err.message);
    }
  }, 60000);
}

/**
 * Lógica de auto-recuperación coordinada
 */
async function tryAutoRedeploy(project, service) {
  try {
    // 1. Desincronizar ligeramente para evitar colisiones si hay varios usuarios
    const delay = Math.floor(Math.random() * 5000); // 0-5 segundos
    await new Promise(resolve => setTimeout(resolve, delay));

    // 2. Consultar historial global en Supabase
    const attempts = await supabaseService.getRecentAutoRedeployCount(service.id);

    if (attempts < 2) {
      console.log(`[Auto-Recovery] Detectado error en ${service.name}. Intento #${attempts + 1}`);

      // 3. Registrar ANTES para "bloquear" a otros usuarios
      await supabaseService.logAction(
        'Auto-Redeploy',
        `Sistema automático detectó fallo. Iniciando intento #${attempts + 1} de recuperación.`,
        'servicios',
        service.id
      );

      // 4. Disparar redeploy en Railway
      await railwayService.redeployService(service.id, service.environmentId);

      // 5. Notificar éxito del disparo de recuperación
      showAutoRecoveryNotification(project.name, service.name, attempts + 1);
    }
  } catch (error) {
    console.error("Error en proceso de auto-recuperación:", error.message);
  }
}

function showAutoRecoveryNotification(projectName, serviceName, attempt) {
  if (Notification.isSupported()) {
    new Notification({
      title: `🔄 Auto-Recuperación: ${projectName}`,
      body: `Se ha iniciado un re-despliegue automático de "${serviceName}" (Intento ${attempt}/2).`,
      icon: path.join(__dirname, "../../assets/icons/icon.ico"),
      silent: true
    }).show();
  }
}

function showErrorNotification(projectName, serviceName, projectId) {
  if (Notification.isSupported()) {
    const notice = new Notification({
      title: `⚠️ Alerta de Servicio: ${projectName}`,
      body: `El servicio "${serviceName}" ha entrado en estado de ERROR.`,
      icon: path.join(__dirname, "../../assets/icons/icon.ico"),
      silent: false
    });

    notice.onclick = () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send('select-project', projectId);
      }
    };

    notice.show();
  }
}