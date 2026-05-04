// Reemplaza el bridge de Electron (preload.js + ipcMain) con fetch() al servidor Express.
// Mantiene exactamente la misma forma que window.api tenia en la version Electron
// para que ningun otro archivo del renderer necesite cambios.

async function _fetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 401) {
    window.location.href = '/admin/login';
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
    throw new Error(err.error || 'Error del servidor');
  }
  return res.json();
}

function _post(path, body) {
  return _fetch(path, { method: 'POST', body: JSON.stringify(body) });
}

window.api = {

  // --------------------------------------------------
  // EXTERNAL (reemplaza shell.openExternal y BrowserWindow)
  // --------------------------------------------------
  openExternal: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },
  openDashboardWindow: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },

  // --------------------------------------------------
  // PROJECTS
  // --------------------------------------------------
  getAssistants: () => _fetch('/api/assistants'),

  updateProjectName: (projectId, newName) =>
    _fetch(`/api/projects/${projectId}/name`, { method: 'PATCH', body: JSON.stringify({ newName }) }),

  deleteProject: (projectId) =>
    _fetch(`/api/projects/${projectId}`, { method: 'DELETE' }),

  getWhatsAppStatus: (projectId) =>
    _fetch(`/api/projects/${projectId}/whatsapp`),

  // --------------------------------------------------
  // TEMPLATES
  // --------------------------------------------------
  searchTemplates: (query) =>
    _fetch(`/api/templates?q=${encodeURIComponent(query || '')}`),

  deployTemplate: (templateId) =>
    _post(`/api/templates/${templateId}/deploy`, {}),

  // --------------------------------------------------
  // SERVICES
  // --------------------------------------------------
  redeployService: (serviceId, environmentId) =>
    _post(`/api/services/${serviceId}/redeploy`, { environmentId }),

  deleteService: (serviceId) =>
    _fetch(`/api/services/${serviceId}`, { method: 'DELETE' }),

  // --------------------------------------------------
  // VARIABLES
  // --------------------------------------------------
  getServiceVariables: (projectId, environmentId, serviceId) =>
    _fetch(`/api/variables?projectId=${projectId}&environmentId=${environmentId}&serviceId=${serviceId}`),

  upsertVariable: (projectId, environmentId, serviceId, name, value) =>
    _post('/api/variables', { projectId, environmentId, serviceId, name, value }),

  deleteVariable: (projectId, environmentId, serviceId, name) =>
    _post('/api/variables/delete', { projectId, environmentId, serviceId, name }),

  // --------------------------------------------------
  // DOMAINS
  // --------------------------------------------------
  getServiceDomains: (projectId, environmentId, serviceId) =>
    _fetch(`/api/domains?projectId=${projectId}&environmentId=${environmentId}&serviceId=${serviceId}`),

  // --------------------------------------------------
  // VERSION (sin auto-update en web)
  // --------------------------------------------------
  getAppVersion: () => Promise.resolve('1.2.4'),
  onLoadVersion: () => {},

  // --------------------------------------------------
  // UPDATES (no-ops — la web no tiene auto-update de Electron)
  // --------------------------------------------------
  onUpdateAvailable: () => {},
  onUpdateProgress: () => {},
  onUpdateDownloaded: () => {},
  startUpdate: () => {},

  // --------------------------------------------------
  // CLIENTS
  // --------------------------------------------------
  getClients: () => _fetch('/api/clients'),

  createClient: (clientData) => _post('/api/clients', clientData),

  updateClient: (id, clientData) =>
    _fetch(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(clientData) }),

  deleteClient: (id) =>
    _fetch(`/api/clients/${id}`, { method: 'DELETE' }),

  linkProjectClient: (railwayProjectId, clientId) =>
    _post('/api/clients/link', { railwayProjectId, clientId }),

  getProjectClient: (railwayProjectId) =>
    _fetch(`/api/projects/${railwayProjectId}/client`),

  getClientProjects: (clientId) =>
    _fetch(`/api/clients/${clientId}/projects`),

  // --------------------------------------------------
  // TICKETS
  // --------------------------------------------------
  getTickets: (filters) => {
    const params = new URLSearchParams(filters || {}).toString();
    return _fetch(`/api/tickets${params ? '?' + params : ''}`);
  },

  createTicket: (ticketData) => _post('/api/tickets', ticketData),

  updateTicket: (id, ticketData) =>
    _fetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(ticketData) }),

  deleteTicket: (id) =>
    _fetch(`/api/tickets/${id}`, { method: 'DELETE' }),

  getClientPendingTickets: (clientId) =>
    _fetch(`/api/clients/${clientId}/pending-tickets`),

  // --------------------------------------------------
  // AUDIT
  // --------------------------------------------------
  getAuditLogs: () => _fetch('/api/audit'),

  unlinkProjectClient: (projectId) =>
    _post(`/api/projects/${projectId}/unlink`, {}),

  // --------------------------------------------------
  // BILLING
  // --------------------------------------------------
  getClientPayments: (clientId) =>
    _fetch(`/api/clients/${clientId}/payments`),

  getAllPayments: () => _fetch('/api/payments'),

  createPayment: (paymentData) => _post('/api/payments', paymentData),

  deletePayment: (id) =>
    _fetch(`/api/payments/${id}`, { method: 'DELETE' }),

  // --------------------------------------------------
  // NAVIGATION (IPC-only en Electron, no-ops en web)
  // --------------------------------------------------
  onSelectProject: () => {},
  requestSelectProject: () => {},

};
