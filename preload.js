const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  // --------------------------------------------------
  // EXTERNAL
  // --------------------------------------------------

  openExternal: (url) =>
    ipcRenderer.invoke('open-external', url),

  // --------------------------------------------------
  // PROJECTS
  // --------------------------------------------------

  getAssistants: () =>
    ipcRenderer.invoke('get-assistants'),

  updateProjectName: (projectId, newName) =>
    ipcRenderer.invoke('update-project-name', projectId, newName),

  deleteProject: (projectId) =>
    ipcRenderer.invoke('delete-project', projectId),

  // --------------------------------------------------
  // SERVICES
  // --------------------------------------------------

  redeployService: (serviceId, environmentId) =>
    ipcRenderer.invoke('redeploy-service', serviceId, environmentId),

  deleteService: (serviceId) =>
    ipcRenderer.invoke('delete-service', serviceId),

  // --------------------------------------------------
  // LOGS
  // --------------------------------------------------

  openLogs: (deploymentId) =>
    ipcRenderer.invoke('open-logs-window', deploymentId),

  fetchDeploymentLogs: (deploymentId) =>
    ipcRenderer.invoke('fetch-deployment-logs', deploymentId),

  onLoadLogs: (callback) => {
    ipcRenderer.on('load-logs', (_, deploymentId) => {
      callback(deploymentId);
    });
  },

  // --------------------------------------------------
  // VARIABLES
  // --------------------------------------------------

  openVariables: (projectId, environmentId, serviceId) =>
    ipcRenderer.invoke('open-variables-window', projectId, environmentId, serviceId),

  getServiceVariables: (projectId, environmentId, serviceId) =>
    ipcRenderer.invoke('get-service-variables', projectId, environmentId, serviceId),

  upsertVariable: (projectId, environmentId, serviceId, name, value) =>
    ipcRenderer.invoke('upsert-variable', projectId, environmentId, serviceId, name, value),

  deleteVariable: (projectId, environmentId, serviceId, name) =>
    ipcRenderer.invoke('delete-variable', projectId, environmentId, serviceId, name),

  onLoadVariables: (callback) => {
    ipcRenderer.on('load-variables', (_, context) => {
      callback(context);
    });
  },

  // --------------------------------------------------
  // GER SERVICE DOMAINS
  // -------------------------------------------------

  getServiceDomains: (projectId, environmentId, serviceId) =>
    ipcRenderer.invoke('get-service-domains', projectId, environmentId, serviceId),

  // --------------------------------------------------
  // APP VERSION
  // -------------------------------------------------

  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),

  onLoadVersion: (callback) => {
    ipcRenderer.on('set-version', (_, version) => {
      callback(version);
    });
  },

});