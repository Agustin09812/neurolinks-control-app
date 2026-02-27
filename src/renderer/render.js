let assistants = [];
let selectedProjectId = null;

// --------------------------------------------------
// TOAST NOTIFICATIONS (UNIFICADO)
// --------------------------------------------------
function showToast(message, type = "success") {
  const container = document.querySelector(".toast-container");
  if (!container) {
    // Fallback por si no existe el contenedor (aunque debería estar en index.html)
    alert(message);
    return;
  }

  const toastId = "toast-" + Date.now();
  const icon = type === "success" ? "bi-check-circle-fill" : (type === "warning" ? "bi-exclamation-triangle-fill" : "bi-exclamation-circle-fill");

  // Mapeo de colores bootstrap
  const bgClass = type === 'danger' ? 'bg-danger' : (type === 'warning' ? 'bg-warning text-dark' : 'bg-dark');

  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${icon}"></i>
          <div>${message}</div>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = toastHtml;
  const toastEl = wrapper.firstElementChild;
  container.appendChild(toastEl);

  const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
  bsToast.show();

  toastEl.addEventListener("hidden.bs.toast", () => {
    toastEl.remove();
  });
}


// --------------------------------------------------
// LOAD ASSISTANTS
// --------------------------------------------------

async function loadAssistants(preserveSelection = true) {

  const currentSelected = selectedProjectId;

  assistants = await window.api.getAssistants();

  assistants.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  }); // createdAt orden

  renderSidebar();

  if (preserveSelection && currentSelected) {
    const item = document.querySelector(`[data-id="${currentSelected}"]`);
    if (item) item.click();
  } else if (!selectedProjectId) {
    // Si no hay selección, estamos en el dashboard, refrescarlo con la nueva data de bots
    renderMainDashboard();
  }
}

// --------------------------------------------------
// PUBLIC DOMAIN CAPTURE
// --------------------------------------------------

async function getPublicDomain(service) {

  try {
    const variables = await window.api.getServiceVariables(
      service.projectId,
      service.environmentId,
      service.id
    );

    return variables?.PUBLIC_DOMAIN || null;

  } catch (err) {
    console.error("Error obteniendo PUBLIC_DOMAIN:", err);
    return null;
  }
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function formatDate(dateStr) {
  if (!dateStr) return "Sin deploy";
  const d = new Date(dateStr);
  return d.toLocaleString();
}

function getStatusIcon(status) {
  switch (status) {
    case "online":
      return `<i class="bi bi-check-circle-fill text-success"></i>`;
    case "error":
      return `<i class="bi bi-x-circle-fill text-danger"></i>`;
    case "checking":
      return `<i class="bi bi-arrow-repeat text-warning"></i>`;
    default:
      return `<i class="bi bi-circle text-secondary"></i>`;
  }
}


// --------------------------------------------------
// SIDEBAR
// --------------------------------------------------

function renderSidebar() {
  const list = document.getElementById("assistant-list");
  list.innerHTML = "";

  assistants.forEach(a => {
    const item = document.createElement("div");
    item.className = "assistant-item d-flex align-items-center justify-content-between px-3 py-2 rounded text-light mb-1";
    if (a.id === selectedProjectId) item.classList.add("active-assistant");
    item.style.cursor = "pointer";
    item.dataset.id = a.id;

    item.innerHTML = `
      <div class="d-flex align-items-center justify-content-between w-100">
        <div class="sidebar-name d-flex align-items-center">
          <span class="text-truncate" style="max-width: 140px;">${a.name}</span>
          <span id="badge-${a.id}"></span>
        </div>
        <div class="ms-2">
          ${getStatusIcon(a.status)}
        </div>
      </div>
    `;

    item.onclick = () => {
      selectedProjectId = a.id;
      document.querySelectorAll(".assistant-item").forEach(el => el.classList.remove("active-assistant"));
      item.classList.add("active-assistant");
      renderDetail(a);
    };

    list.appendChild(item);

    // Cargar badges en background
    updateAssistantBadge(a.id);
  });

  // Solo click automático si no hay nada seleccionado Y no estamos en una vista global
  const isDashboardActive = document.getElementById("dashboard-global").style.display === "block";
  const isClientsActive = document.getElementById("clients-view").style.display === "block";
  const isTicketsActive = document.getElementById("tickets-view").style.display === "block";

  if (!selectedProjectId && assistants.length > 0 && !isDashboardActive && !isClientsActive && !isTicketsActive) {
    setTimeout(() => {
      const first = list.querySelector('.assistant-item');
      if (first) first.click();
    }, 100);
  }

  // Actualizar estado del link dashboard en la sidebar
  const btnDash = document.getElementById("btn-reload");
  const btnCli = document.getElementById("btn-open-clients");
  const btnTkt = document.getElementById("btn-open-tickets");

  // Limpiar activos de navegación principal
  [btnDash, btnCli, btnTkt].forEach(b => b?.classList.remove("active"));

  if (!selectedProjectId) {
    const dashGlobal = document.getElementById("dashboard-global").style.display === "block";
    const clientsView = document.getElementById("clients-view").style.display === "block";
    const ticketsView = document.getElementById("tickets-view").style.display === "block";

    if (dashGlobal) btnDash?.classList.add("active");
    if (clientsView) btnCli?.classList.add("active");
    if (ticketsView) btnTkt?.classList.add("active");
  }
}

async function updateAssistantBadge(projectId) {
  try {
    const clientWrapper = await window.api.getProjectClient(projectId);
    if (clientWrapper && clientWrapper.clientes) {
      const count = await window.api.getClientPendingTickets(clientWrapper.clientes.id);
      if (count > 0) {
        const badgeEl = document.getElementById(`badge-${projectId}`);
        if (badgeEl) {
          badgeEl.innerHTML = `<span class="badge-ticket ms-2 animate-fade">${count}</span>`;
        }
      }
    }
  } catch (e) { }
}


// --------------------------------------------------
// DETAIL PANEL
// --------------------------------------------------

async function renderDetail(a) {

  // Ocultar todas las vistas posibles
  document.getElementById("dashboard-global").style.display = "none";
  document.getElementById("clients-view").style.display = "none";
  document.getElementById("tickets-view").style.display = "none";

  const detailPanel = document.getElementById("assistant-detail");
  if (detailPanel) detailPanel.style.display = "block";

  // Limpiar vistas integradas previas
  const oldLog = document.getElementById("integrated-log-container");
  if (oldLog) oldLog.remove();
  const oldVar = document.getElementById("integrated-var-container");
  if (oldVar) oldVar.remove();

  selectedProjectId = a.id;

  // Obtener cliente vinculado
  let linkedClient = null;
  try {
    linkedClient = await window.api.getProjectClient(a.id);
  } catch (err) {
    console.error("Error al obtener cliente del proyecto:", err);
  }

  const detail = document.getElementById("assistant-detail");

  const online = a.services.filter(s => s.status === "online").length;
  const error = a.services.filter(s => s.status === "error").length;
  const building = a.services.filter(s => s.status === "checking").length;

  // Obtener Info de Tickets
  let ticketsBadge = "";
  if (linkedClient && linkedClient.clientes) {
    try {
      const count = await window.api.getClientPendingTickets(linkedClient.clientes.id);
      if (count > 0) {
        ticketsBadge = `
          <div class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 p-2 rounded animate-fade d-flex align-items-center gap-2" 
               style="cursor:pointer" onclick="renderTicketsView('${linkedClient.clientes.id}')">
            <i class="bi bi-ticket-perforated-fill"></i>
            <span>${count} Tickets Pendientes</span>
          </div>
        `;
      } else {
        ticketsBadge = `
          <div class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 p-2 rounded animate-fade d-flex align-items-center gap-2">
            <i class="bi bi-check-circle-fill"></i>
            <span>Sin pendientes</span>
          </div>
        `;
      }
    } catch (e) { }
  }

  // SERVICES HTML
  let servicesHtml = "";
  if (!a.services || a.services.length === 0) {
    servicesHtml = `
      <div class="service-card p-5 rounded d-flex align-items-center justify-content-center text-center"
           style="cursor:pointer; border:1px dashed #444;"
           onclick="window.api.openExternal('${a.railwayUrl}')">
        <div>
          <i class="bi bi-plus-circle fs-1 text-secondary"></i>
          <div class="mt-3 fw-bold text-secondary">Crear Servicio</div>
          <div class="small text-muted mt-1">Crear servicio en Railway</div>
        </div>
      </div>
    `;
  } else {
    servicesHtml = a.services.map(service => `
      <div class="service-card p-4 rounded">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-bold">${service.name}</div>
          ${getStatusIcon(service.status)}
        </div>
        <div class="small text-secondary mb-3">Último deploy: ${formatDate(service.createdAt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <div class="d-flex gap-2">
            <button class="btn btn-outline-info btn-sm" data-bs-toggle="tooltip" title="Logs" ${!service.deploymentId ? "disabled" : ""} onclick="renderLogsView('${service.deploymentId}', '${service.name}')">
              <i class="bi bi-terminal"></i>
            </button>
            <button class="btn btn-outline-warning btn-sm" data-bs-toggle="tooltip" title="Variables" onclick="renderVariablesView('${service.projectId}','${service.environmentId}','${service.id}', '${service.name}')">
              <i class="bi bi-sliders"></i>
            </button>
          </div>
          <div class="d-flex gap-2 align-items-center">
            <button class="btn btn-success btn-sm" data-bs-toggle="tooltip" title="Dashboard" onclick="openDashboard('${service.projectId}','${service.environmentId}','${service.id}')">
              <i class="bi bi-speedometer2"></i>
            </button>
            <button class="btn btn-primary btn-sm" data-bs-toggle="tooltip" title="Webchat" onclick="openWebchat('${service.projectId}','${service.environmentId}','${service.id}')">
              <i class="bi bi-chat-dots"></i>
            </button>
            <div class="dropdown">
              <button class="btn btn-sm btn-outline-light dropdown-toggle" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
              <ul class="dropdown-menu dropdown-menu-dark">
                <li><button class="dropdown-item" onclick="handleRedeploy('${service.id}', '${service.environmentId}')"><i class="bi bi-arrow-clockwise me-2"></i>Redeploy</button></li>
                <li><button class="dropdown-item" ${!service.deploymentId ? "disabled" : ""} onclick="handleDownloadLogs('${service.deploymentId}', \`${a.name}\`)"><i class="bi bi-download me-2"></i>Descargar Logs</button></li>
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item text-danger" onclick="handleDelete('${service.id}')"><i class="bi bi-trash me-2"></i>Remove</button></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  detail.innerHTML = `
    <div class="animate-fade">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="d-flex align-items-center gap-3">
          <div class="d-flex align-items-center gap-2">
            <h2 class="mb-0 fw-bold">${a.name}</h2>
            <button class="btn btn-sm btn-outline-light" onclick="openRenameProject('${a.id}', \`${a.name}\`)" title="Renombrar">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
          <button class="btn btn-sm btn-outline-light" title="Railway" onclick="window.api.openExternal('${a.railwayUrl}')">
            <i class="bi bi-folder2-open"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" title="Eliminar" onclick="handleDeleteProject('${a.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div id="client-badge-container" class="d-flex gap-2">
          ${linkedClient ? `
            <div class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 p-2 d-flex align-items-center gap-2" 
                 style="cursor:pointer" onclick="openLinkClient('${a.id}')">
              <i class="bi bi-person-fill"></i>
              <span>${linkedClient.clientes.nombre}</span>
            </div>
          ` : `
            <button class="btn btn-outline-secondary btn-sm" onclick="openLinkClient('${a.id}')">
              <i class="bi bi-link-45deg"></i> Vincular Cliente
            </button>
          `}
          ${ticketsBadge}
        </div>
      </div>

      <div class="d-flex gap-4 mb-4 small">
        <div><i class="bi bi-check-circle-fill text-success"></i> ${online} Online</div>
        <div><i class="bi bi-x-circle-fill text-danger"></i> ${error} Error</div>
        <div><i class="bi bi-arrow-repeat text-warning"></i> ${building} Building</div>
      </div>

      <div class="d-grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">
        ${servicesHtml}
      </div>
    </div>
  `;

  // Scroll to active item in sidebar
  const activeItem = document.querySelector(`.assistant-item[data-id="${a.id}"]`);
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el, { trigger: 'hover' }));
}


// --------------------------------------------------
// DELETE
// --------------------------------------------------

async function handleDelete(serviceId) {

  const confirmDelete = confirm("¿Eliminar este servicio?");
  if (!confirmDelete) return;

  await window.api.deleteService(serviceId);
  await loadAssistants(true);
}

// --------------------------------------------------
// REDEPLOY
// --------------------------------------------------

async function handleRedeploy(serviceId, environmentId) {

  try {

    await window.api.redeployService(serviceId, environmentId);

    // refresco inmediato
    await loadAssistants(true);

  } catch (error) {
    console.error("Error redeploy:", error);
  }
}

async function handleDownloadLogs(deploymentId, serviceName) {
  try {
    const result = await window.api.downloadLogs(deploymentId, serviceName);
    if (!result.success) {
      if (result.message !== "Cancelado por el usuario") {
        alert("Error: " + result.message);
      }
    }
  } catch (err) {
    alert("Error al descargar logs: " + err.message);
  }
}

// --------------------------------------------------
// RENAME PROJECT
// --------------------------------------------------

function openRenameProject(projectId, currentName) {

  document.getElementById("renameProjectId").value = projectId;
  document.getElementById("renameProjectName").value = currentName;

  const modal = new bootstrap.Modal(
    document.getElementById("renameProjectModal")
  );

  modal.show();
}

document.getElementById("btnSaveRename").onclick = async () => {

  const projectId = document.getElementById("renameProjectId").value;
  const newName = document.getElementById("renameProjectName").value.trim();

  if (!newName) return;

  await window.api.updateProjectName(projectId, newName);

  const modal = bootstrap.Modal.getInstance(
    document.getElementById("renameProjectModal")
  );

  modal.hide();

  await loadAssistants(true);
};

// --------------------------------------------------
// DELETE PROJECT
// --------------------------------------------------

async function handleDeleteProject(projectId) {

  const confirmDelete = confirm(
    "¿Seguro que querés eliminar este proyecto?\n\nEsta acción es irreversible."
  );

  if (!confirmDelete) return;

  await window.api.deleteProject(projectId);

  selectedProjectId = null;

  await loadAssistants(false);
}

// --------------------------------------------------
// LINK CLIENT TO PROJECT
// --------------------------------------------------

async function openLinkClient(projectId) {
  document.getElementById("linkClientIdProject").value = projectId;

  const select = document.getElementById("select-client-list");
  select.innerHTML = '<option value="">Cargando clientes...</option>';

  const modalElement = document.getElementById("linkClientModal");
  const modal = new bootstrap.Modal(modalElement);
  modal.show();

  try {
    const clients = await window.api.getClients();
    if (clients.length === 0) {
      select.innerHTML = '<option value="">No hay clientes registrados</option>';
    } else {
      select.innerHTML = '<option value="">-- Seleccionar --</option>' +
        clients.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
    }
  } catch (err) {
    select.innerHTML = '<option value="">Error al cargar clientes</option>';
  }
}

const btnLink = document.getElementById("btnConfirmLinkClient");
if (btnLink) {
  btnLink.onclick = async () => {
    const projectId = document.getElementById("linkClientIdProject").value;
    const clientId = document.getElementById("select-client-list").value;

    if (!clientId) return alert("Seleccioná un cliente");

    try {
      await window.api.linkProjectClient(projectId, clientId);
      const modal = bootstrap.Modal.getInstance(document.getElementById("linkClientModal"));
      if (modal) modal.hide();

      // Refrescar detalle
      const project = assistants.find(a => a.id === projectId);
      if (project) renderDetail(project);

    } catch (err) {
      alert("Error al vincular cliente: " + err.message);
    }
  };
}

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

async function openDashboard(projectId, environmentId, serviceId) {

  try {

    const domains = await window.api.getServiceDomains(
      projectId,
      environmentId,
      serviceId
    );

    console.log("Domains:", domains);

    let domain = null;

    // Primero intentamos custom domain
    if (domains?.customDomains?.length > 0) {
      domain = domains.customDomains[0].domain;
    }

    // Si no hay custom, usamos railway.app
    else if (domains?.serviceDomains?.length > 0) {
      domain = domains.serviceDomains[0].domain;
    }

    if (!domain) {
      alert("Este servicio no tiene dominio público.");
      return;
    }

    if (!domain.startsWith("http")) {
      domain = "https://" + domain;
    }

    window.api.openExternal(`${domain}/dashboard`);

  } catch (err) {
    console.error("Error abriendo dashboard:", err);
  }
}

// --------------------------------------------------
// WEBCHAT
// --------------------------------------------------

async function openWebchat(projectId, environmentId, serviceId) {

  try {

    const domains = await window.api.getServiceDomains(
      projectId,
      environmentId,
      serviceId
    );

    let domain = null;

    if (domains?.customDomains?.length > 0) {
      domain = domains.customDomains[0].domain;
    }
    else if (domains?.serviceDomains?.length > 0) {
      domain = domains.serviceDomains[0].domain;
    }

    if (!domain) {
      alert("Este servicio no tiene dominio público.");
      return;
    }

    if (!domain.startsWith("http")) {
      domain = "https://" + domain;
    }

    window.api.openExternal(`${domain}/webchat`);

  } catch (err) {
    console.error("Error abriendo webchat:", err);
  }
}


// --------------------------------------------------
// APP TIMER FETCH (SMART)
// --------------------------------------------------

let autoRefreshTimeout = null;
let refreshRate = 30000; // 30s default

async function smartRefresh() {

  await loadAssistants(true);

  const hasBuilding = assistants.some(project =>
    project.services.some(service =>
      service.status === "checking"
    )
  );

  refreshRate = hasBuilding ? 5000 : 30000;

  autoRefreshTimeout = setTimeout(smartRefresh, refreshRate);
}

function startAutoRefresh() {
  if (autoRefreshTimeout) {
    clearTimeout(autoRefreshTimeout);
  }
  smartRefresh();
}

window.addEventListener("focus", () => {
  loadAssistants(true);
});

startAutoRefresh();

document.addEventListener("DOMContentLoaded", async () => {

  const btnReload = document.getElementById("btn-reload");
  if (btnReload) {
    btnReload.addEventListener("click", () => {
      renderMainDashboard();
    });
  }

  const btnOpenClients = document.getElementById("btn-open-clients");
  if (btnOpenClients) {
    btnOpenClients.addEventListener("click", () => {
      renderClientsView();
      renderSidebar();
    });
  }

  const btnOpenTickets = document.getElementById("btn-open-tickets");
  if (btnOpenTickets) {
    btnOpenTickets.addEventListener("click", () => {
      renderTicketsView();
      renderSidebar();
    });
  }
});

/**
 * DASHBOARD MAESTRO (GLOBAL)
 */
async function renderMainDashboard() {
  selectedProjectId = null;
  document.querySelectorAll(".assistant-item").forEach(el => el.classList.remove("active-assistant"));

  document.getElementById("assistant-detail").style.display = "none";
  document.getElementById("clients-view").style.display = "none";
  document.getElementById("tickets-view").style.display = "none";

  const dash = document.getElementById("dashboard-global");
  dash.style.display = "block";
  dash.innerHTML = `
    <div class="d-flex justify-content-center align-items-center h-100">
      <div class="spinner-border text-success" role="status"></div>
    </div>
  `;

  try {
    const clients = await window.api.getClients();
    const activeClients = clients.filter(c => c.plan !== 'Baja');
    const tickets = await window.api.getTickets();
    const pendingTickets = tickets.filter(t => t.estado !== 'Cerrado');

    let totalServices = 0;
    let onlineServices = 0;
    let errorServices = 0;

    assistants.forEach(a => {
      a.services.forEach(s => {
        totalServices++;
        if (s.status === 'online') onlineServices++;
        if (s.status === 'error') errorServices++;
      });
    });

    dash.innerHTML = `
      <div class="animate-fade">
        <h2 class="mb-4 fw-bold">DASHBOARD MAESTRO</h2>
        
        <div class="row g-4 mb-5">
          <!-- CARD BOTS -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100">
              <div class="display-5 fw-bold text-success">${assistants.length}</div>
              <div class="text-secondary text-uppercase small ls-1">Proyectos Totales</div>
              <div class="mt-3 small text-secondary">
                <span class="text-success">${onlineServices} Online</span> / 
                <span class="text-danger">${errorServices} Error</span>
              </div>
            </div>
          </div>

          <!-- CARD CLIENTES -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100" style="cursor:pointer" onclick="renderClientsView()">
              <div class="display-5 fw-bold text-danger">${activeClients.length}</div>
              <div class="text-secondary text-uppercase small ls-1">Clientes Activos</div>
              <div class="mt-3">
                 <button class="btn btn-sm btn-outline-danger">Gestionar Clientes</button>
              </div>
            </div>
          </div>

          <!-- CARD TICKETS -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100" style="cursor:pointer" onclick="renderTicketsView()">
              <div class="display-5 fw-bold text-warning">${pendingTickets.length}</div>
              <div class="text-secondary text-uppercase small ls-1">Tickets Pendientes</div>
              <div class="mt-3">
                 <button class="btn btn-sm btn-outline-warning">Ver Tickets</button>
              </div>
            </div>
          </div>

          <!-- CARD SALUD -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100">
              <div class="display-5 fw-bold ${errorServices > 0 ? 'text-danger' : 'text-success'}">
                 ${errorServices > 0 ? 'ALERTA' : 'OK'}
              </div>
              <div class="text-secondary text-uppercase small ls-1">Estado de Salud</div>
              <div class="mt-3 small text-secondary">
                ${errorServices > 0 ? 'Se detectaron fallos técnicos' : 'Todos los sistemas operativos'}
              </div>
            </div>
          </div>
        </div>

        <div class="row g-4">
          <div class="col-md-6">
            <div class="glass-card p-4">
               <h5 class="mb-3">Último Ticket</h5>
               ${pendingTickets.length > 0 ? `
                  <div class="p-3 border border-secondary rounded bg-dark-hover">
                     <div class="d-flex justify-content-between">
                        <span class="fw-bold">${pendingTickets[0].titulo}</span>
                        <span class="badge bg-warning text-dark">${pendingTickets[0].prioridad}</span>
                     </div>
                     <div class="small text-secondary mt-1">${pendingTickets[0].clientes ? pendingTickets[0].clientes.nombre : 'Sin Cliente'}</div>
                  </div>
               ` : '<div class="text-secondary">No hay tickets pendientes</div>'}
            </div>
          </div>
          <div class="col-md-6">
             <div class="glass-card p-4">
               <h5 class="mb-3">Quick Actions</h5>
               <div class="d-grid gap-2">
                  <button class="btn btn-outline-light text-start btn-sm" onclick="renderClientsView()">
                    <i class="bi bi-person-plus me-2"></i> Nuevo Cliente
                  </button>
                  <button class="btn btn-outline-light text-start btn-sm" onclick="renderTicketsView()">
                    <i class="bi bi-plus-circle me-2"></i> Crear Ticket
                  </button>
                  <button class="btn btn-outline-success text-start btn-sm" id="dashboard-refresh">
                    <i class="bi bi-arrow-clockwise me-2"></i> Actualizar Infraestructura
                  </button>
               </div>
             </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('dashboard-refresh').onclick = () => {
      loadAssistants(false);
      renderMainDashboard();
    };

  } catch (err) {
    console.error("Error cargando dashboard:", err);
    dash.innerHTML = `<div class="alert alert-danger">Error al cargar datos del dashboard</div>`;
  }
}

async function init() {
  const version = await window.api.getAppVersion();
  const el = document.getElementById("app-version");
  if (el) el.textContent = "v" + version;

  // 1. Mostrar dashboard inmediatamente (con spinner interno)
  renderMainDashboard();

  // 2. Cargar datos en segundo plano
  await loadAssistants(false);
}

init();

// --------------------------------------------------
// EXTERNAL SELECTION (MESSAGING FROM OTHER WINDOWS)
// --------------------------------------------------

window.api.onSelectProject((projectId) => {
  console.log("Selecting project:", projectId);
  const project = assistants.find(p => p.id === projectId);
  if (project) {
    // Simular click en el item del sidebar
    const item = document.querySelector(`.assistant-item[data-id="${projectId}"]`);
    if (item) {
      item.click();
    } else {
      renderDetail(project);
    }
  } else {
    console.warn("Project not found in current list:", projectId);
  }
});