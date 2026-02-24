const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
const path = require('path');

// let mainWindow;

const RAILWAY_TOKEN = "937da46e-60c4-45a0-86c8-90f535213289";
const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

let splash;
let mainWindow;
let splashStartTime;

function createSplash() {
  splashStartTime = Date.now();

  splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true
  });

  splash.loadFile("splash.html");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

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

    }, remaining);

  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createSplash();
  createMainWindow();
});


// --------------------------------------------------
// OPEN EXTERNAL
// --------------------------------------------------

ipcMain.handle('open-external', async (_, url) => {
  return shell.openExternal(url);
});


// --------------------------------------------------
// GET ASSISTANTS (Projects + Services + Latest Deployment)
// query como string + variables
// --------------------------------------------------

ipcMain.handle('get-assistants', async () => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          query {
            projects {
              edges {
                node {
                  id
                  name
                  createdAt
                  environments {
                    edges {
                      node {
                        id
                        name
                      }
                    }
                  }
                  services {
                    edges {
                      node {
                        id
                        name
                        deployments(first: 1) {
                          edges {
                            node {
                              id
                              status
                              createdAt
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `
      })
    });

    const result = await response.json();

    if (!result.data?.projects) {
      console.error("Respuesta inválida de Railway:", result);
      return [];
    }

    // 👇 ESTA LÍNEA ES CLAVE
    const projects = result.data.projects.edges.map(edge => edge.node);

    return projects.map(project => {

      const services = (project.services?.edges || []).map(serviceEdge => {

        const service = serviceEdge.node;
        const deployment = service.deployments?.edges[0]?.node;

        const deployStatus = deployment?.status || "UNKNOWN";
        const createdAt = deployment?.createdAt || null;

        const defaultEnvironment = project.environments?.edges[0]?.node?.id || null;

        let status = "offline";

        if (deployStatus === "SUCCESS") status = "online";
        else if (deployStatus === "FAILED" || deployStatus === "CRASHED") status = "error";
        else if (deployStatus === "BUILDING" || deployStatus === "DEPLOYING") status = "checking";

        return {
          id: service.id,
          name: service.name,
          railwayStatus: deployStatus,
          status,
          createdAt,
          deploymentId: deployment?.id || null,
          projectId: project.id,
          environmentId: defaultEnvironment
        };
      });

      // ----------------------------------
      // Estado del proyecto
      // ----------------------------------

      const hasError = services.some(s => s.status === "error");
      const hasBuilding = services.some(s => s.status === "checking");
      const hasOnline = services.some(s => s.status === "online");

      let projectStatus = "offline";

      if (hasError) projectStatus = "error";
      else if (hasBuilding) projectStatus = "checking";
      else if (hasOnline) projectStatus = "online";

      // ----------------------------------

      return {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        services: services || [],
        railwayUrl: `https://railway.com/project/${project.id}`,
        status: projectStatus
      };
    });

  } catch (error) {
    console.error("Error consultando Railway API:", error);
    return [];
  }
});


// --------------------------------------------------
// REDEPLOY SERVICE
// serviceInstanceRedeploy requiere serviceId + environmentId
// --------------------------------------------------

ipcMain.handle('redeploy-service', async (_, serviceId, environmentId) => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          mutation serviceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
            serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
          }
        `,
        variables: {
          serviceId,
          environmentId
        }
      })
    });

    return await response.json();

  } catch (error) {
    console.error("Error en redeploy:", error);
    return null;
  }
});


// --------------------------------------------------
// DELETE SERVICE
// mutation serviceDelete($id: String!)
// --------------------------------------------------

ipcMain.handle('delete-service', async (_, serviceId) => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          mutation serviceDelete($id: String!) {
            serviceDelete(id: $id)
          }
        `,
        variables: {
          id: serviceId
        }
      })
    });

    return await response.json();

  } catch (error) {
    console.error("Error deleting service:", error);
    return null;
  }
});


// --------------------------------------------------
// OPEN LOGS WINDOW
// --------------------------------------------------

ipcMain.handle('open-logs-window', async (_, deploymentId) => {

  const logsWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  logsWindow.loadFile('logs.html');

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  variablesWindow.loadFile('variables.html');

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
    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          mutation projectUpdate($id: String!, $input: ProjectUpdateInput!) {
            projectUpdate(id: $id, input: $input) {
              id
              name
            }
          }
        `,
        variables: {
          id: projectId,
          input: {
            name: newName
          }
        }
      })
    });

    return await response.json();

  } catch (error) {
    console.error("Error updating project:", error);
    return null;
  }
});


// --------------------------------------------------
// DELETE PROJECT
// --------------------------------------------------

ipcMain.handle('delete-project', async (_, projectId) => {

  try {
    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          mutation projectDelete($id: String!) {
            projectDelete(id: $id)
          }
        `,
        variables: {
          id: projectId
        }
      })
    });

    return await response.json();

  } catch (error) {
    console.error("Error deleting project:", error);
    return null;
  }
});

// --------------------------------------------------
// FETCH DEPLOYMENT LOGS
// query deploymentLogs($deploymentId: String!, $limit: Int)
// --------------------------------------------------

ipcMain.handle('fetch-deployment-logs', async (_, deploymentId) => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          query deploymentLogs($deploymentId: String!, $limit: Int) {
            deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
              timestamp
              message
              severity
            }
          }
        `,
        variables: {
          deploymentId,
          limit: 500
        }
      })
    });

    const result = await response.json();

    if (!result.data?.deploymentLogs) {
      console.error("Respuesta inválida logs:", result);
      return [];
    }

    return result.data.deploymentLogs;

  } catch (error) {
    console.error("Error fetching deployment logs:", error);
    return [];
  }
});

// --------------------------------------------------
// GET SERVICE VARIABLES
// query variables($projectId, $environmentId, $serviceId)
// --------------------------------------------------

ipcMain.handle('get-service-variables', async (_, projectId, environmentId, serviceId) => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          query variables($projectId: String!, $environmentId: String!, $serviceId: String) {
            variables(
              projectId: $projectId
              environmentId: $environmentId
              serviceId: $serviceId
            )
          }
        `,
        variables: {
          projectId,
          environmentId,
          serviceId
        }
      })
    });

    const result = await response.json();

    if (!result.data?.variables) {
      console.error("Respuesta inválida variables:", result);
      return {};
    }

    return result.data.variables;

  } catch (error) {
    console.error("Error fetching variables:", error);
    return {};
  }
});

// --------------------------------------------------
// UPSERT VARIABLE
// mutation variableUpsert
// --------------------------------------------------

ipcMain.handle('upsert-variable', async (_, projectId, environmentId, serviceId, name, value) => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          mutation variableUpsert($input: VariableUpsertInput!) {
            variableUpsert(input: $input)
          }
        `,
        variables: {
          input: {
            projectId,
            environmentId,
            serviceId,
            name,
            value,
            skipDeploys: true
          }
        }
      })
    });

    return await response.json();

  } catch (error) {
    console.error("Error upserting variable:", error);
    return null;
  }
});

// --------------------------------------------------
// DELETE VARIABLE
// mutation variableDelete
// --------------------------------------------------

ipcMain.handle('delete-variable', async (_, projectId, environmentId, serviceId, name) => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          mutation variableDelete($input: VariableDeleteInput!) {
            variableDelete(input: $input)
          }
        `,
        variables: {
          input: {
            projectId,
            environmentId,
            serviceId,
            name,
            skipDeploys: true
          }
        }
      })
    });

    return await response.json();

  } catch (error) {
    console.error("Error deleting variable:", error);
    return null;
  }
});

// --------------------------------------------------
// GET SERVICE DOMAINS
// --------------------------------------------------

ipcMain.handle('get-service-domains', async (_, projectId, environmentId, serviceId) => {

  try {

    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({
        query: `
          query domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
            domains(
              projectId: $projectId
              environmentId: $environmentId
              serviceId: $serviceId
            ) {
              serviceDomains {
                id
                domain
              }
              customDomains {
                id
                domain
              }
            }
          }
        `,
        variables: {
          projectId,
          environmentId,
          serviceId
        }
      })
    });

    const result = await response.json();

    return result.data?.domains || null;

  } catch (error) {
    console.error("Error fetching domains:", error);
    return null;
  }
});