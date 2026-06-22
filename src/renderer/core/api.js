async function _fetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 401) {
    window.location.href = '/login';
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
  // EXTERNAL
  // --------------------------------------------------
  openExternal: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },
  openDashboardWindow: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(); },

  // --------------------------------------------------
  // CONFIG
  // --------------------------------------------------
  getConfigSupabase: () => _fetch('/api/config/supabase'),

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
  renameService: (serviceId, newName) =>
    _fetch(`/api/services/${serviceId}/name`, { method: 'PATCH', body: JSON.stringify({ newName }) }),

  redeployService: (serviceId, environmentId) =>
    _post(`/api/services/${serviceId}/redeploy`, { environmentId }),

  updateService: (projectId, environmentId, serviceId) =>
    _post(`/api/projects/${projectId}/update`, { environmentId, serviceId }),

  // --------------------------------------------------
  // SETTINGS (Supabase)
  // --------------------------------------------------
  getSettings: (projectId) => _fetch(`/api/settings/${projectId}`),
  updateSetting: (projectId, key, value) => _fetch(`/api/settings/${projectId}`, { method: 'PUT', body: JSON.stringify({ key, value }) }),

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
  // VERSION
  // --------------------------------------------------
  getAppVersion: () => Promise.resolve('1.2.4'),

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
  // Listado paginado SIN chats_adjuntos — para vistas de lista
  getTickets: (filters) => {
    const params = new URLSearchParams(filters || {}).toString();
    return _fetch(`/api/tickets${params ? '?' + params : ''}`);
  },

  // Solo metadatos de tickets abiertos — para SmartRefresh background
  getTicketsMeta: () => _fetch('/api/tickets/meta'),

  // Ticket completo con chats_adjuntos — solo al abrir el chat
  getTicketById: (id) => _fetch(`/api/tickets/${id}`),

  createTicket: (ticketData) => _post('/api/tickets', ticketData),

  updateTicket: (id, ticketData) =>
    _fetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(ticketData) }),

  addTicketMessage: (id, messageData) =>
    _post(`/api/tickets/${id}/chat`, messageData),

  deleteTicket: (id) =>
    _fetch(`/api/tickets/${id}`, { method: 'DELETE' }),

  getClientPendingTickets: (clientId) =>
    _fetch(`/api/clients/${clientId}/pending-tickets`),

  // --------------------------------------------------
  // AUDIT
  // --------------------------------------------------
  getAuditLogs: () => _fetch('/api/audit'),
  getLogs: () => _fetch('/api/logs'),

  unlinkProjectClient: (projectId) =>
    _post(`/api/projects/${projectId}/unlink`, {}),

  // --------------------------------------------------
  // BILLING & ADMINS
  // --------------------------------------------------
  getAdmins: () => _fetch('/api/admins'),
  getCurrentUser: () => _fetch('/api/me'),

  getClientPayments: (clientId) =>
    _fetch(`/api/clients/${clientId}/payments`),

  getAllPayments: () => _fetch('/api/payments'),

  createPayment: (paymentData) => _post('/api/payments', paymentData),

  assignPaymentAdmin: (id, adminId) =>
    _fetch(`/api/payments/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ adminId }) }),

  deletePayment: (id) =>
    _fetch(`/api/payments/${id}`, { method: 'DELETE' }),

};
