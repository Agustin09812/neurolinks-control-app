const { app, BrowserWindow, shell, ipcMain, Menu, Notification, dialog } = require('electron');
const path = require('path');
const fs = require("fs");

// HOT FIX PARA COMPILAR
const isDev = !app.isPackaged;

// .ENV
require('dotenv').config({
  path: isDev
    ? path.join(__dirname, '../../.env')
    : path.join(process.resourcesPath, '.env')
});

const { autoUpdater } = require("electron-updater");

// TOKEN GITHUB
autoUpdater.requestHeaders = {
  authorization: `token ${process.env.GITHUB_TOKEN}`
};

// AUTOUPDATER CONFIG
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

const railwayService = require('../services/railwayService');
const supabaseService = require('../services/supabaseService');

let splash;
let mainWindow;
let splashStartTime;
let updateInfo = null;
let dashboardWindows = new Map();


// ======================================================
// SAFE WINDOW CREATION
// ======================================================

function safeCreateMainWindow() {

  if (mainWindow && !mainWindow.isDestroyed()) return;
  createMainWindow();

}


// ======================================================
// SPLASH
// ======================================================

function createSplash() {

  splashStartTime = Date.now();

  splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    resizable: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splash.loadFile(path.join(__dirname, "../renderer/splash.html"));

  splash.webContents.on('did-finish-load', () => {

    const version = app.getVersion();
    splash.webContents.send('set-version', version);

  });

}


// ======================================================
// MAIN WINDOW
// ======================================================

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

  mainWindow.once("ready-to-show", () => {

    const elapsed = Date.now() - splashStartTime;
    const minTime = 3000;
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

      startBackgroundMonitoring();

    }, remaining);

  });


  mainWindow.webContents.once("did-finish-load", () => {

    if (updateInfo) {
      mainWindow.webContents.send("update-available", {
        version: updateInfo.version,
        notes: updateInfo.notes

      });
    }

  });

}


// ======================================================
// APP READY
// ======================================================

app.whenReady().then(() => {

  Menu.setApplicationMenu(null);
  createSplash();

  if (isDev) {

    console.log("Modo desarrollo → no se chequean updates");
    setTimeout(() => {
      safeCreateMainWindow();
    }, 2000);

  } else {
    autoUpdater.checkForUpdates();
  }

});



// ======================================================
// AUTO UPDATE
// ======================================================

autoUpdater.on("update-available", (info) => {

  console.log("Nueva actualización detectada:", info.version);

  updateInfo = {
    version: info.version,
    notes: [
      "Mejoras y optimizaciones",
      "Correcciones y arreglos de bugs",
      "Actualizá a la última versión para tener las mejoras más recientes"
    ]
  };

  if (splash) {

    splash.webContents.send("update-available", {
      version: updateInfo.version,
      notes: updateInfo.notes
    });

  }

  setTimeout(() => {
    safeCreateMainWindow();
  }, 1500);

});


autoUpdater.on("update-not-available", () => {
  safeCreateMainWindow();
});


autoUpdater.on("download-progress", (progress) => {

  const percent = Math.floor(progress.percent);
  if (mainWindow) {
    mainWindow.webContents.send("update-progress", percent);
  }

});


autoUpdater.on("update-downloaded", () => {

  // avisar al renderer
  if (mainWindow) {
    mainWindow.webContents.send("update-downloaded");
  }

  dialog.showMessageBox({
    type: "info",
    buttons: ["Reiniciar ahora"],
    title: "Actualización lista",
    message: "La nueva versión está lista para instalar."
  }).then(() => {
    autoUpdater.quitAndInstall();
  });

});


autoUpdater.on("error", (err) => {
  console.error("Updater error:", err);
  safeCreateMainWindow();
});


// ======================================================
// START UPDATE
// ======================================================

ipcMain.handle("start-update", () => {
  autoUpdater.downloadUpdate();
});


// --------------------------------------------------
// --------------------------------------------------

// --------------------------------------------------
// OPEN EXTERNAL
// --------------------------------------------------

ipcMain.handle('open-external', async (_, url) => {
  return shell.openExternal(url);
});

ipcMain.handle('open-dashboard-window', async (_, url) => {

  if (dashboardWindows.has(url)) {
    const existing = dashboardWindows.get(url);
    if (!existing.isDestroyed()) {
      existing.focus();
      return;
    }
  }

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadURL(url);
  win.maximize();

  dashboardWindows.set(url, win);

  // limpiar cuando se cierra
  win.on('closed', () => {
    dashboardWindows.delete(url);
  });

});


// --------------------------------------------------
// GET ASSISTANTS (Projects + Services + Latest Deployment)
// --------------------------------------------------

ipcMain.handle('get-assistants', async () => {
  try {
    return await railwayService.getAssistants();
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

ipcMain.handle('deploy-template', async (_, templateId) => {
  try {
    const result = await railwayService.deployTemplate(templateId);

    if (result.success) {
      const projectId = result.projectId;
      await supabaseService.logAction('Deploy Template', `Nuevo proyecto creado vía template: ${result.templateName || templateId}`, 'proyectos', projectId);
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
    await supabaseService.logAction('Reiniciar Servicio', `Reinicio de servicio ID: ${serviceId}`, 'servicios', serviceId);
    return result;
  } catch (error) {
    console.error("Error en redeploy-service:", error);
    throw error;
  }
});




// --------------------------------------------------
// DELETE SERVICE
// --------------------------------------------------

ipcMain.handle('delete-service', async (_, serviceId) => {
  try {
    const result = await railwayService.deleteService(serviceId);
    await supabaseService.logAction('Eliminar Servicio', `Eliminación de servicio ID: ${serviceId}`, 'servicios', serviceId);
    return result;
  } catch (error) {
    console.error("Error en delete-service:", error);
    throw error;
  }
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
  try {
    return await railwayService.fetchDeploymentLogs(deploymentId);
  } catch (error) {
    console.error("Error en fetch-deployment-logs:", error);
    throw error;
  }
});

// --------------------------------------------------
// GET SERVICE VARIABLES
// --------------------------------------------------

ipcMain.handle('get-service-variables', async (_, projectId, environmentId, serviceId) => {
  try {
    return await railwayService.getServiceVariables(projectId, environmentId, serviceId);
  } catch (error) {
    console.error("Error en get-service-variables:", error);
    throw error;
  }
});

// --------------------------------------------------
// UPSERT VARIABLE
// --------------------------------------------------

ipcMain.handle('upsert-variable', async (_, projectId, environmentId, serviceId, name, value) => {
  try {
    const result = await railwayService.upsertVariable(projectId, environmentId, serviceId, name, value);
    await supabaseService.logAction('Cambio Variable', `Se actualizó la variable ${name}`, 'variables', serviceId || projectId);
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
  try {
    return await railwayService.getServiceDomains(projectId, environmentId, serviceId);
  } catch (error) {
    console.error("Error en get-service-domains:", error);
    throw error;
  }
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
  await supabaseService.logAction('Crear Cliente', `Se creó el cliente ${clientData.nombre}`, 'clientes', result.id);
  return result;
});

ipcMain.handle('update-client', async (_, id, clientData) => {
  const result = await supabaseService.updateClient(id, clientData);
  await supabaseService.logAction('Actualizar Cliente', `Se actualizaron datos de ${clientData.nombre || 'cliente'}`, 'clientes', id);
  return result;
});

ipcMain.handle('delete-client', async (_, id) => {
  const result = await supabaseService.deleteClient(id);
  await supabaseService.logAction('Eliminar Cliente', `Se eliminó el cliente ID: ${id}`, 'clientes', id);
  return result;
});

ipcMain.handle('link-project-client', async (_, railwayProjectId, clientId) => {
  try {
    const result = await supabaseService.linkProjectToClient(railwayProjectId, clientId);
    await supabaseService.logAction('Vincular Proyecto', `Se vinculó el proyecto ${railwayProjectId} al cliente ID: ${clientId}`, 'clientes', clientId);
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
  await supabaseService.logAction('Crear Ticket', `Nuevo ticket: ${ticketData.titulo}`, 'tickets', result.id);
  return result;
});

ipcMain.handle('update-ticket', async (_, id, ticketData) => {
  const result = await supabaseService.updateTicket(id, ticketData);
  const statusMsg = ticketData.estado ? ` (Estado: ${ticketData.estado})` : "";
  await supabaseService.logAction('Actualizar Ticket', `Ticket #${id} actualizado${statusMsg}`, 'tickets', id);
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

// funcion para desvincular asistente
ipcMain.handle('unlink-project-client', async (_, projectId) => {
  try {

    const result = await supabaseService.unlinkProjectClient(projectId);

    await supabaseService.logAction(
      'Desvincular Proyecto',
      `Se desvinculó el proyecto ${projectId} del cliente`,
      'clientes',
      projectId
    );

    return result;

  } catch (error) {
    console.error("Error en unlink-project-client:", error);
    throw error;
  }
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
  await supabaseService.logAction('Registrar Pago', `Pago de $${paymentData.monto} - ${paymentData.concepto}`, 'pagos', result.id);
  return result;
});

ipcMain.handle('delete-payment', async (_, id) => {
  return await supabaseService.deletePayment(id);
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

      // OPT-03b FIX: Use for...of instead of async forEach to properly await
      for (const a of assistants) {
        for (const s of a.services) {
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
            await tryAutoRedeploy(a, s);
          }

          lastAssistantsState.set(key, newStatus);
        }
      }
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