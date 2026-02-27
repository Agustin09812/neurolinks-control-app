require('dotenv').config();
const { app, BrowserWindow, shell, ipcMain, Menu, Notification, dialog } = require('electron');
const path = require('path');
const https = require("https");
const fs = require('fs');

const railwayService = require('../services/railwayService');
const supabaseService = require('../services/supabaseService');

let splash;
let mainWindow;
let splashStartTime;

function createSplash() {
  splashStartTime = Date.now();

  splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    icon: path.join(__dirname, "../../assets/icons/icon.ico"),
    alwaysOnTop: true,
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
        "Authorization": "Bearer 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",
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

            const asset = json.assets?.[0];

            return resolve({
              version: remoteVersion,
              url: asset?.browser_download_url
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

// Handler para descarga automática de actualizaciones
ipcMain.on('start-download-update', async (event, downloadUrl) => {
  const tempPath = path.join(app.getPath('temp'), 'update-neurolinks.exe');
  const file = fs.createWriteStream(tempPath);

  https.get(downloadUrl, (response) => {
    // Manejar redirecciones de GitHub
    if (response.statusCode === 302 || response.statusCode === 301) {
      return ipcMain.emit('start-download-update', event, response.headers.location);
    }

    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;

    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (totalSize) {
        const progress = Math.round((downloadedSize / totalSize) * 100);
        event.reply('download-progress', progress);
      }
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close();
      shell.openPath(tempPath).then(() => {
        app.quit();
      });
    });
  }).on('error', (err) => {
    fs.unlink(tempPath, () => { });
    console.error("Error en descarga:", err.message);
  });
});

// =======================================================

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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

  clientsWindow.loadFile(path.join(__dirname, '../renderer/clients.html'));
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

  ticketsWindow.loadFile(path.join(__dirname, '../renderer/tickets.html'));
});


// --------------------------------------------------
// GET ASSISTANTS (Projects + Services + Latest Deployment)
// --------------------------------------------------

ipcMain.handle('get-assistants', async () => {
  return await railwayService.getAssistants();
});


// --------------------------------------------------
// REDEPLOY SERVICE
// --------------------------------------------------

ipcMain.handle('redeploy-service', async (_, serviceId, environmentId) => {
  const result = await railwayService.redeployService(serviceId, environmentId);
  await supabaseService.logAction('Reiniciar Servicio', `Reinicio de servicio ID: ${serviceId}`, 'servicios', serviceId);
  return result;
});


// --------------------------------------------------
// DELETE SERVICE
// --------------------------------------------------

ipcMain.handle('delete-service', async (_, serviceId) => {
  const result = await railwayService.deleteService(serviceId);
  await supabaseService.logAction('Eliminar Servicio', `Eliminación de servicio ID: ${serviceId}`, 'servicios', serviceId);
  return result;
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

  logsWindow.loadFile(path.join(__dirname, '../renderer/logs.html'));

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

  variablesWindow.loadFile(path.join(__dirname, '../renderer/variables.html'));

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
  return await railwayService.updateProjectName(projectId, newName);
});


// --------------------------------------------------
// DELETE PROJECT
// --------------------------------------------------

ipcMain.handle('delete-project', async (_, projectId) => {
  return await railwayService.deleteProject(projectId);
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
  const result = await railwayService.upsertVariable(projectId, environmentId, serviceId, name, value);
  await supabaseService.logAction('Cambio Variable', `Se actualizó la variable ${name}`, 'variables', serviceId || projectId);
  return result;
});

// --------------------------------------------------
// DELETE VARIABLE
// --------------------------------------------------

ipcMain.handle('delete-variable', async (_, projectId, environmentId, serviceId, name) => {
  return await railwayService.deleteVariable(projectId, environmentId, serviceId, name);
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
  return await supabaseService.linkProjectToClient(railwayProjectId, clientId);
});

ipcMain.handle('get-project-client', async (_, railwayProjectId) => {
  return await supabaseService.getProjectClient(railwayProjectId);
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

      assistants.forEach(a => {
        a.services.forEach(s => {
          const key = `${a.id}-${s.id}`;
          const oldStatus = lastAssistantsState.get(key);
          const newStatus = s.status;

          // Si cambia a error y antes no lo estaba
          if (newStatus === 'error' && oldStatus !== 'error') {
            showErrorNotification(a.name, s.name, a.id);
          }

          lastAssistantsState.set(key, newStatus);
        });
      });
    } catch (err) {
      console.error("Error en monitoreo background:", err.message);
    }
  }, 60000);
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