const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  // --------------------------------------------------
  // EXTERNAL
  // --------------------------------------------------

  openExternal: (url) =>
    ipcRenderer.invoke('open-external', url),

  openDashboardWindow: (url) =>
    ipcRenderer.invoke('open-dashboard-window', url),

  // --------------------------------------------------
  // PROJECTS
  // --------------------------------------------------

  getAssistants: () =>
    ipcRenderer.invoke('get-assistants'),

  updateProjectName: (projectId, newName) =>
    ipcRenderer.invoke('update-project-name', projectId, newName),

  deleteProject: (projectId) =>
    ipcRenderer.invoke('delete-project', projectId),

  getWhatsAppStatus: (projectId) =>
    ipcRenderer.invoke('get-whatsapp-status', projectId),

  // --------------------------------------------------
  // TEMPLATES
  // --------------------------------------------------

  searchTemplates: (query) =>
    ipcRenderer.invoke('search-templates', query),

  deployTemplate: (templateId) =>
    ipcRenderer.invoke('deploy-template', templateId),

  // --------------------------------------------------
  // SERVICES
  // --------------------------------------------------

  redeployService: (serviceId, environmentId) =>
    ipcRenderer.invoke('redeploy-service', serviceId, environmentId),

  deployServiceUpdate: (serviceId, environmentId) =>
    ipcRenderer.invoke('deploy-service-update', serviceId, environmentId),

  deleteService: (serviceId) =>
    ipcRenderer.invoke('delete-service', serviceId),

  // --------------------------------------------------
  // LOGS (INTEGRADO)
  // --------------------------------------------------

  fetchDeploymentLogs: (deploymentId) =>
    ipcRenderer.invoke('fetch-deployment-logs', deploymentId),

  downloadLogs: (deploymentId, serviceName) =>
    ipcRenderer.invoke('download-logs', deploymentId, serviceName),

  // --------------------------------------------------
  // VARIABLES (INTEGRADO)
  // --------------------------------------------------

  getServiceVariables: (projectId, environmentId, serviceId) =>
    ipcRenderer.invoke('get-service-variables', projectId, environmentId, serviceId),

  upsertVariable: (projectId, environmentId, serviceId, name, value) =>
    ipcRenderer.invoke('upsert-variable', projectId, environmentId, serviceId, name, value),

  deleteVariable: (projectId, environmentId, serviceId, name) =>
    ipcRenderer.invoke('delete-variable', projectId, environmentId, serviceId, name),

  // --------------------------------------------------
  // SERVICE DOMAINS
  // --------------------------------------------------

  getServiceDomains: (projectId, environmentId, serviceId) =>
    ipcRenderer.invoke('get-service-domains', projectId, environmentId, serviceId),

  // --------------------------------------------------
  // APP VERSION
  // --------------------------------------------------

  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),

  onLoadVersion: (callback) => {
    ipcRenderer.on('set-version', (_, version) => {
      callback(version);
    });
  },

  // --------------------------------------------------
  // UPDATES
  // --------------------------------------------------

  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_, data) => {
      callback(data);
    });
  },

  onUpdateProgress: (callback) => {
    ipcRenderer.on("update-progress", (_, percent) => {
      callback(percent);
    });
  },

  startUpdate: () => {
    ipcRenderer.invoke("start-update");
  },

  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", () => {
      callback();
    });
  },

  // --------------------------------------------------
  // SUPABASE / CRM / CLIENTS (INTEGRADO)
  // --------------------------------------------------

  getClients: () =>
    ipcRenderer.invoke('get-clients'),

  createClient: (clientData) =>
    ipcRenderer.invoke('create-client', clientData),

  updateClient: (id, clientData) =>
    ipcRenderer.invoke('update-client', id, clientData),

  deleteClient: (id) =>
    ipcRenderer.invoke('delete-client', id),

  linkProjectClient: (railwayProjectId, clientId) =>
    ipcRenderer.invoke('link-project-client', railwayProjectId, clientId),

  getProjectClient: (railwayProjectId) =>
    ipcRenderer.invoke('get-project-client', railwayProjectId),

  getClientProjects: (clientId) =>
    ipcRenderer.invoke('get-client-projects', clientId),

  // --------------------------------------------------
  // TICKETS (INTEGRADO)
  // --------------------------------------------------

  getTickets: (filters) =>
    ipcRenderer.invoke('get-tickets', filters),

  createTicket: (ticketData) =>
    ipcRenderer.invoke('create-ticket', ticketData),

  updateTicket: (id, ticketData) =>
    ipcRenderer.invoke('update-ticket', id, ticketData),

  deleteTicket: (id) =>
    ipcRenderer.invoke('delete-ticket', id),

  getClientPendingTickets: (clientId) =>
    ipcRenderer.invoke('get-client-pending-tickets', clientId),

  // --------------------------------------------------
  // AUDIT
  // --------------------------------------------------

  getAuditLogs: () =>
    ipcRenderer.invoke('get-audit-logs'),

  unlinkProjectClient: (projectId) =>
    ipcRenderer.invoke('unlink-project-client', projectId),

  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------

  onSelectProject: (callback) => {
    ipcRenderer.on('select-project', (_, projectId) => {
      callback(projectId);
    });
  },

  requestSelectProject: (projectId) =>
    ipcRenderer.send('request-select-project', projectId),

  // --------------------------------------------------
  // BILLING / PAGOS
  // --------------------------------------------------

  getClientPayments: (clientId) =>
    ipcRenderer.invoke('get-client-payments', clientId),

  getAllPayments: () =>
    ipcRenderer.invoke('get-all-payments'),

  createPayment: (paymentData) =>
    ipcRenderer.invoke('create-payment', paymentData),

  deletePayment: (id) =>
    ipcRenderer.invoke('delete-payment', id),

});