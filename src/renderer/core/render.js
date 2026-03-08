let assistants = [];
let selectedProjectId = null;
let selectedProjectClient = null;
let lastAssistantsHash = "" // Hash system for optimized refreshing
let isRefreshing = false; // Avoid glitch while refreshing
let notifications = []; // Notifications system in app
const notificationMemory = new Map(); // Notifications memory
let renderToken = 0;
window.currentUser = null;

// ========================================
// ROUTER CENTRAL DE NAVEGACIÓN
// ========================================

async function navigate(view) {
  console.log("Navigating to:", view);
  localStorage.setItem("activeView", view);

  const views = [
    "dashboard-global",
    "assistants-view",
    "assistant-detail",
    "clients-view",
    "tickets-view",
    "billing-view",
    "audit-view",
    "notifications-view",
    "config-view"
  ];

  // Reglas de Acceso por Rol
  if (window.currentUser?.rol === 'client') {
    const forbiddenForClients = ['clients', 'audit', 'billing'];
    if (forbiddenForClients.includes(view)) {
      console.warn("Access denied for view:", view);
      showToast("No tienes permiso para acceder a esta sección", "danger");
      return;
    }
  }

  const activeViewEl = document.getElementById(`${view}-view`)
    || document.getElementById("dashboard-global");

  console.log("Active view element:", activeViewEl?.id);

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Reset active state del navbar
  document.querySelectorAll(".nav-top").forEach(btn => {
    btn.classList.remove("active");
  });

  // Activar botón correcto
  const activeBtn = document.querySelector(`.nav-top[data-view="${view}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  // Mostrar vista correcta
  switch (view) {
    case "dashboard":
      console.log("Showing dashboard-global");
      const d = document.getElementById("dashboard-global");
      if (d) d.style.display = "block";
      renderDashboard().catch(e => console.error("Error in renderDashboard:", e));
      break;

    case "assistants":
      console.log("Showing assistants-view");
      const detail = document.getElementById("assistant-detail");
      if (detail) {
        detail.dataset.initialized = "";
        detail.dataset.projectId = "";
        detail.style.display = "none";
      }
      await loadAssistants(false);
      const av = document.getElementById("assistants-view");
      if (av) av.style.display = "block";
      renderAssistantsGrid?.();
      break;

    case "clients":
      const cv = document.getElementById("clients-view");
      if (cv) cv.style.display = "block";
      renderClientsView?.();
      break;

    case "tickets":
      const tv = document.getElementById("tickets-view");
      if (tv) tv.style.display = "block";
      renderTicketsView?.();
      break;

    case "billing":
      const bv = document.getElementById("billing-view");
      if (bv) bv.style.display = "block";
      renderBillingView?.();
      break;

    case "audit":
      const adv = document.getElementById("audit-view");
      if (adv) adv.style.display = "block";
      renderAuditView?.();
      break;

    case "admins":
      const usrv = document.getElementById("usuarios-view");
      if (usrv) usrv.style.display = "block";
      renderUsuariosView?.();
      break;

    case "notifications":
      const nv = document.getElementById("notifications-view");
      if (nv) nv.style.display = "block";
      renderNotificationsView?.();
      break;

    case "config":
      const cfgv = document.getElementById("config-view");
      if (cfgv) cfgv.style.display = "block";
      renderConfigView?.();
      break;

    case "assistant-detail":
      const ad = document.getElementById("assistant-detail");
      if (ad) ad.style.display = "block";
      break;
  }

}

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
// NOTIFICATIONS IN APP
// --------------------------------------------------

const NOTIFICATION_TTL = 60000; // 60 segundos

function addNotification(type, title, message, key = null) {

  const notificationKey = key || `${type}-${message}`;

  if (notificationMemory.has(notificationKey)) {

    const lastTime = notificationMemory.get(notificationKey);

    if (Date.now() - lastTime < NOTIFICATION_TTL) {
      return;
    }

  }

  notificationMemory.set(notificationKey, Date.now());

  const notification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    date: new Date(),
    read: false
  };

  notifications.unshift(notification);

  updateNotificationsBadge();

  showNotificationToast(notification);

  console.log("Nueva notificación:", notification);
}

function showNotificationToast(notification) {

  const icon =
    notification.type === "ticket" ? "bi-ticket-perforated" :
      notification.type === "deploy" ? "bi-arrow-repeat" :
        notification.type === "deploy-error" ? "bi-exclamation-triangle-fill" :
          notification.type === "error" ? "bi-exclamation-triangle-fill" :
            "bi-bell";

  showToast(
    `<i class="bi ${icon} me-2"></i>${notification.title}`,
    "info"
  );

}

function getNotifications() {
  return notifications;
}

function markAllNotificationsRead() {
  notifications.forEach(n => n.read = true);
  updateNotificationsBadge();
}

function updateNotificationsBadge() {

  const badge = document.getElementById("notifications-badge");

  if (!badge) return;

  const unread = notifications.filter(n => !n.read).length;

  if (unread === 0) {
    badge.style.display = "none";
    return;
  }

  badge.style.display = "block";
  badge.innerText = unread;
}

// --------------------------------------------------
// LOAD ASSISTANTS
// --------------------------------------------------

async function loadAssistants(preserveSelection = true) {

  const currentSelected = selectedProjectId;

  const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
  const funcs = (window.currentUser && window.currentUser.funciones_habilitadas) || {};
  let permLvl = isAdmin ? 'editar_crear' : (funcs.agentes || 'none');
  if (permLvl === true) permLvl = 'editar_crear';

  if (permLvl === 'none' || permLvl === false) {
    assistants = [];
    if (document.getElementById("assistants-view")?.style.display === "block") {
      renderAssistantsGrid();
    }
    return;
  }

  const clientIdFilter = (permLvl === 'ver_propio') ? window.currentUser?.cliente_id : null;
  const data = await window.api.getAssistants(clientIdFilter);

  if (!Array.isArray(data)) return;

  data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  assistants = data;

  const detailEl = document.getElementById("assistant-detail");
  const isDetailOpen = detailEl && detailEl.style.display === "block";

  if (isDetailOpen && preserveSelection && currentSelected) {

    const updatedProject = assistants.find(p => p.id === currentSelected);
    if (updatedProject) {
      renderDetail(updatedProject, true);
      return;
    }
  }

  const isAssistantsView = document.getElementById("assistants-view").style.display === "block";

  if (isAssistantsView) {
    renderAssistantsGrid();
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

// ========================================
// ASISTANTS GRID VIEW
// ========================================

function renderAssistantsGrid() {

  const container = document.getElementById("assistants-view");
  if (!container) return;

  container.innerHTML = `
    <div class="mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 class="fw-bold text-light mb-0">MIS ASISTENTES</h2>
          <p class="text-secondary small mb-0">
            Gestión técnica de proyectos desplegados en Railway
          </p>
        </div>
      </div>
  
      <div id="assistants-grid" class="row g-4"></div>
    </div>
  `;

  const grid = document.getElementById("assistants-grid");

  let filteredAssistants = assistants;
  if (currentUser?.rol === 'client' && currentUser.cliente_id) {
    // Filtrar asistentes vinculados a este cliente
    // Necesitaremos que el backend nos de esa información o filtrarla aquí si la tenemos
    // Por ahora asumimos que assistants ya vienen filtrados o usaremos window.api.getClientProjects
  }

  if (!assistants.length) {
    grid.innerHTML = `
      <div class="col-12 text-center text-secondary py-5">
        No hay asistentes desplegados.
      </div>
    `;
    return;
  }

  assistants.forEach(project => {

    const statusColor =
      project.status === "online" ? "success" :
        project.status === "error" ? "danger" :
          project.status === "checking" ? "warning" :
            "secondary";

    const col = document.createElement("div");
    col.className = "col-xl-3 col-lg-4 col-md-6";
    const hasUpdate = project.services.some(s => s.isUpdatable);

    col.innerHTML = `
      <div class="glass-card p-4 h-100 assistant-card hover-lift" style="cursor:pointer;">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <h5 class="fw-bold mb-0 text-truncate" style="max-width: 75%;">
            ${project.name}
          </h5>
          <span class="badge bg-${statusColor} bg-opacity-10 text-${statusColor} 
            border border-${statusColor} border-opacity-25">
            ${project.status.toUpperCase()}
          </span>
        </div>

        <div class="small text-secondary mb-3">
          ID: ${project.id.substring(0, 8)}
        </div>

        <div class="small text-dim gap-2">
          Servicios: ${project.services.length}

           ${hasUpdate ? `
          <span class="badge bg-warning text-dark small px-2 py-1">
           <i class="bi bi-arrow-repeat"></i> Actualización disponible
             </span>
           ` : ""}
        </div>
        
      </div>
    `;

    col.querySelector(".assistant-card").addEventListener("click", async () => {

      selectedProjectId = project.id;

      document.getElementById("assistants-view").style.display = "none";

      // fetch fresh data
      await loadAssistants(true);

      const fresh = assistants.find(a => a.id === project.id);

      if (!fresh) return;

      renderDetail(fresh);
    });

    grid.appendChild(col);
  });
}

// --------------------------------------------------
// DETAIL PANEL
// --------------------------------------------------

async function renderDetail(project, isRefresh = false) {

  const detailPanel = document.getElementById("assistant-detail");
  if (!detailPanel) return;

  const token = ++renderToken;

  const isDifferentProject =
    detailPanel.dataset.projectId &&
    detailPanel.dataset.projectId !== project.id;

  selectedProjectId = project.id;
  if (!isRefresh) {
    navigate('assistant-detail');
  }

  const sidePanel = document.getElementById("detail-side-panel");

  // RESET SI CAMBIA PROYECTO
  if (isDifferentProject) {
    detailPanel.dataset.initialized = "";
    detailPanel.dataset.projectId = "";
    detailPanel.innerHTML = "";
    selectedProjectClient = null; // Clear client info
    if (sidePanel) sidePanel.dataset.view = "default";
  }

  // Fetch client info once for the project
  if (!selectedProjectClient || isDifferentProject || isRefresh) {
    try {
      selectedProjectClient = await window.api.getProjectClient(project.id);
    } catch (err) {
      console.error("Error fetching project client:", err);
      selectedProjectClient = null;
    }
  }

  // ===== RENDER INICIAL (NUNCA ABORTAR)
  if (!detailPanel.dataset.initialized) {

    renderDetailStructure(project);

    detailPanel.dataset.initialized = "true";
    detailPanel.dataset.projectId = project.id;

    // SOLO abortar async
    await updateDetailHeader(project);

    if (token !== renderToken) return;

    await renderServices(project);
    updateSidePanel(project); // <-- Nueva función

    return;
  }

  // ===== REFRESH
  if (isRefresh) {

    await updateDetailHeader(project);

    if (token !== renderToken) return;

    patchServices(project);
    updateSidePanel(project); // <-- Actualizar también en refresh
  }
}

function renderDetailStructure(project) {
  const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
  const funcs = (window.currentUser && window.currentUser.funciones_habilitadas) || {};
  let permLvl = isAdmin ? 'editar_crear' : (funcs.agentes || 'none');
  if (permLvl === true) permLvl = 'editar_crear';
  const canEdit = permLvl === 'editar_crear';

  const detail = document.getElementById("assistant-detail");
  if (!detail) return;

  const servicesContainer = document.getElementById("services-container");

  if (servicesContainer) {
    servicesContainer.innerHTML = `
    <div class="text-center py-4 text-secondary">
      <div class="spinner-border spinner-border-sm"></div>
      Cargando servicios...
    </div>
  `;
  }

  // Construir opciones aseguradas...
  let dropdownItems = `
      <li>
        <button class="dropdown-item btn-railway">
          <i class="bi bi-box-arrow-up-right me-2"></i>
          Abrir Railway
        </button>
      </li>
  `;

  if (canEdit) {
    dropdownItems = `
      <li>
        <button class="dropdown-item btn-rename">
          <i class="bi bi-pencil me-2"></i>
          Cambiar nombre
        </button>
      </li>
      ${dropdownItems}
      <li>
        <hr class="dropdown-divider">
      </li>
      <li>
        <button class="dropdown-item text-danger btn-delete-project">
          <i class="bi bi-trash me-2"></i>
          Eliminar proyecto
        </button>
      </li>
    `;
  }

  detail.innerHTML = `
<div class="animate-fade mt-4">

  <!-- BOTÓN VOLVER -->
  <div class="mb-4">
    <button class="btn btn-outline-light btn-sm" id="btnBackToGrid">
      <i class="bi bi-arrow-left me-2"></i> Volver a Asistentes
    </button>
  </div>

  <!-- GRID PRINCIPAL -->
  <div class="detail-layout">

    <!-- COLUMNA IZQUIERDA -->
    <div class="services-column">

      <!-- HEADER -->
      <div class="mb-4">

        <!-- TITULO + SETTINGS -->
        <div class="d-flex justify-content-between align-items-center mb-2">

          <p class="fw-bold mb-0">${project.name}</p>

          <div class="dropdown">
            <button 
              class="btn btn-outline-light btn-sm"
              data-bs-toggle="dropdown">

              <i class="bi bi-gear"></i>

            </button>

            <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark">
              ${dropdownItems}
            </ul>

          </div>

        </div>

        <!-- CONTADORES -->
        <div id="header-status-row"
             class="d-flex gap-4 small align-items-center mb-2">
        </div>


        <!-- BADGES -->
        <div id="header-badges"
             class="d-flex gap-2 flex-wrap">
        </div>

      </div>

      <!-- SERVICIOS -->
      <div id="services-container" class="d-grid gap-3"></div>

    </div>

    <!-- COLUMNA DERECHA -->
    <div class="side-panel-column">
      <div id="detail-side-panel" class="side-panel-placeholder"></div>
    </div>

  </div>

</div>
`;

  // Eventos header

  document.getElementById("btnBackToGrid").addEventListener("click", async () => {
    selectedProjectId = null;
    selectedProjectClient = null; // Clear client info

    navigate('assistants');

    // refresh assistants
    await loadAssistants(false);

    renderAssistantsGrid();
  });

  const btnRename = detail.querySelector(".btn-rename");
  if (btnRename) {
    btnRename.addEventListener("click", () => {
      openRenameProject(project.id, project.name);
    });
  }

  detail.querySelector(".btn-railway").addEventListener("click", () => {
    window.api.openExternal(project.railwayUrl);
  });

  const btnDelete = detail.querySelector(".btn-delete-project");
  if (btnDelete) {
    btnDelete.addEventListener("click", () => {
      handleDeleteProject(project.id);
    });
  }

}

async function updateDetailHeader(project) {

  const currentProjectId = project.id;

  const badgesContainer = document.getElementById("header-badges");
  const statusContainer = document.getElementById("header-status-row");
  const titleEl = document.querySelector("#assistant-detail h2");

  if (!badgesContainer || !statusContainer) return;

  // =========================
  // ACTUALIZAR TÍTULO (SI CAMBIÓ)
  // =========================
  if (titleEl && titleEl.textContent !== project.name) {
    titleEl.textContent = project.name;
  }

  // =========================
  // CONTADORES
  // =========================
  const online = project.services.filter(s => s.status === "online").length;
  const error = project.services.filter(s => s.status === "error").length;
  const building = project.services.filter(s => s.status === "checking").length;

  statusContainer.innerHTML = `
    <span><i class="bi bi-check-circle-fill text-success"></i> ${online}</span>
    <span><i class="bi bi-x-circle-fill text-danger"></i> ${error}</span>
    <span><i class="bi bi-arrow-repeat text-warning"></i> ${building}</span>
  `;

  const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
  const funcs = (window.currentUser && window.currentUser.funciones_habilitadas) || {};
  let permLvl = isAdmin ? 'editar_crear' : (funcs.agentes || 'none');
  if (permLvl === true) permLvl = 'editar_crear';
  const canEdit = permLvl === 'editar_crear';

  // =========================
  // CLIENTE
  // =========================
  let clientBadge = "";
  let ticketsBadge = "";
  let linkButton = "";

  // Use the globally fetched selectedProjectClient
  const linkedClient = selectedProjectClient;

  if (!linkedClient || !linkedClient.clientes) {

    if (canEdit) {
      linkButton = `
            <span 
              class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 badge-client-btn"
              style="cursor:pointer;font-size:11px;padding:4px 8px;">
  
              <i class="bi bi-link-45deg me-1"></i>
              Vincular cliente
  
            </span>
          `;
    } else {
      linkButton = `
            <span 
              class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25"
              style="font-size:11px;padding:4px 8px;">

              <i class="bi bi-person-x me-1"></i>
              Sin vincular

            </span>
          `;
    }

  } else {

    if (canEdit) {
      clientBadge = `
            <span 
              class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 badge-client-btn"
              style="cursor:pointer;font-size:11px;padding:4px 8px;">

              <i class="bi bi-person-fill me-1"></i>
              ${linkedClient.clientes.nombre}

            </span>
          `;
    } else {
      clientBadge = `
            <span 
              class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25"
              style="font-size:11px;padding:4px 8px;">

              <i class="bi bi-person-fill me-1"></i>
              ${linkedClient.clientes.nombre}

            </span>
          `;
    }

    const count = await window.api.getClientPendingTickets(linkedClient.clientes.id);
    if (selectedProjectId !== currentProjectId) return;

    if (count > 0) {
      ticketsBadge = `
          <div class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 p-2 d-flex align-items-center gap-2">
            <i class="bi bi-ticket-perforated-fill"></i>
            <span>${count} Tickets</span>
          </div>
        `;
    } else {
      ticketsBadge = `
          <div class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 p-2 d-flex align-items-center gap-2">
            <i class="bi bi-check-circle-fill"></i>
            <span>Sin pendientes</span>
          </div>
        `;
    }
  }

  // =========================
  // WHATSAPP
  // =========================
  let whatsappBadge = "";

  try {
    const wsStatus = await window.api.getWhatsAppStatus(project.id);
    if (selectedProjectId !== currentProjectId) return;

    if (wsStatus?.connected) {
      whatsappBadge = `
        <span 
          class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"
          style="font-size:11px;padding:4px 8px;">

          <i class="bi bi-whatsapp me-1"></i>
          Conectado

        </span>
      `;
    } else {
      whatsappBadge = `
        <span 
          class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25"
          style="font-size:11px;padding:4px 8px;">

          <i class="bi bi-whatsapp me-1"></i>
          Desconectado

        </span>
      `;
    }

  } catch (err) {
    console.error("WhatsApp header error:", err);
  }

  // =========================
  // RENDER FINAL
  // =========================
  badgesContainer.innerHTML = `
    ${linkButton}
    ${clientBadge}
    ${ticketsBadge}
    ${whatsappBadge}

  `;

  // Re-attach eventos después de render
  const linkBtn = badgesContainer.querySelector(".btn-link-client");
  if (linkBtn) linkBtn.onclick = () => openLinkClient(project.id);

  const clientEl = badgesContainer.querySelector(".badge-client-btn");
  if (clientEl) clientEl.onclick = () => openLinkClient(project.id);
}

// --------------------------------------------------
// SIDE PANEL UPDATES (QUICK ACTIONS & ACCESS)
// --------------------------------------------------
async function updateSidePanel(project) {
  const panel = document.getElementById("detail-side-panel");
  if (!panel) return;

  const currentProjectId = project.id;

  try {
    // Use the globally fetched selectedProjectClient
    const linked = selectedProjectClient;

    // Si el panel está mostrando Logs, Variables, etc, no sobreescribir con Información del Proyecto
    if (panel.dataset.view && panel.dataset.view !== "default") return;
    if (selectedProjectId !== currentProjectId) return;

    let backofficeCard = '';
    if (linked && linked.clientes) {
      const client = linked.clientes;
      backofficeCard = `
        <div class="glass-card p-3 mb-3 border-info border-opacity-10">
          <div class="d-flex align-items-center mb-2">
            <div class="bg-info bg-opacity-10 p-2 rounded me-2">
              <i class="bi bi-key-fill text-info"></i>
            </div>
            <h6 class="mb-0 small fw-bold text-uppercase">Acceso Backoffice</h6>
          </div>
          <p class="text-secondary" style="font-size: 0.75rem;">
            El cliente puede gestionar su asistente usando el siguiente token:
          </p>
          <div class="bg-black bg-opacity-50 p-2 rounded border border-secondary border-opacity-25 d-flex justify-content-between align-items-center mb-2">
            <code class="text-info small">${client.token_backoffice || 'No generado'}</code>
            <button class="btn btn-link btn-sm p-0 text-secondary" onclick="navigator.clipboard.writeText('${client.token_backoffice}')">
              <i class="bi bi-clipboard"></i>
            </button>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <span class="small text-secondary">Estado:</span>
            <span class="badge ${client.backoffice_activado ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${client.backoffice_activado ? 'text-success' : 'text-danger'}">
              ${client.backoffice_activado ? 'Activo' : 'Desactivo'}
            </span>
          </div>
        </div>
      `;
    } else {
      backofficeCard = `
        <div class="glass-card p-3 mb-3 border-secondary border-opacity-10 opacity-50">
          <div class="d-flex align-items-center mb-2">
            <div class="bg-secondary bg-opacity-10 p-2 rounded me-2">
              <i class="bi bi-key-fill text-secondary"></i>
            </div>
            <h6 class="mb-0 small fw-bold text-uppercase">Acceso Backoffice</h6>
          </div>
          <p class="text-secondary mb-0" style="font-size: 0.75rem;">
            <i class="bi bi-exclamation-triangle me-1"></i>
            Vinculá un cliente para habilitar el acceso.
          </p>
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="animate-fade">
        ${backofficeCard}
        
        <div class="glass-card p-3 mb-3">
          <h6 class="mb-3 small fw-bold text-uppercase">Información del Proyecto</h6>
          <ul class="list-unstyled mb-0" style="font-size: 0.75rem;">
            <li class="mb-2 d-flex justify-content-between">
              <span class="text-secondary">ID Railway:</span>
              <span class="text-light">${project.id.substring(0, 8)}...</span>
            </li>
            <li class="mb-2 d-flex justify-content-between">
              <span class="text-secondary">Creado:</span>
              <span class="text-light">${new Date(project.createdAt).toLocaleDateString()}</span>
            </li>
            <li class="d-flex justify-content-between">
              <span class="text-secondary">Servicios:</span>
              <span class="text-light">${project.services.length}</span>
            </li>
          </ul>
        </div>
      </div>
    `;

  } catch (err) {
    console.error("Error updating side panel:", err);
  }
}

function closeSidePanel() {
  const panel = document.getElementById("detail-side-panel");
  if (!panel) return;

  panel.innerHTML = "";
  panel.dataset.view = "default";

  // Intentar restaurar la info del proyecto
  if (selectedProjectId) {
    const project = assistants.find(p => p.id === selectedProjectId);
    if (project) updateSidePanel(project);
  }
}

async function renderServices(project) {
  if (project.id !== selectedProjectId) return;

  const container = document.getElementById("services-container");
  if (!container) return;

  container.innerHTML = "";

  const freshProject = assistants.find(a => a.id === project.id);

  if (!freshProject || !freshProject.services) {
    container.innerHTML = `
      <div class="text-center text-secondary py-4">
        Cargando servicios...
      </div>
    `;
    return;
  }

  // Obtener cliente una sola vez para pasárselo a las tarjetas
  // This is now handled globally in renderDetail
  // selectedProjectClient = null;
  // try {
  //   selectedProjectClient = await window.api.getProjectClient(project.id);
  // } catch (err) {}

  freshProject.services.forEach(service => {
    const card = createServiceCard(service, freshProject, selectedProjectClient);
    container.appendChild(card);
  });
}

function patchServices(project) {
  if (project.id !== selectedProjectId) return;

  const container = document.getElementById("services-container");
  if (!container) return;

  const freshProject = assistants.find(a => a.id === project.id);
  if (!freshProject || !freshProject.services) return;

  freshProject.services.forEach(service => {
    const existingCard = container.querySelector(`[data-service-id="${service.id}"]`);
    if (existingCard) {
      // Update status dot
      const statusDot = existingCard.querySelector(".status-dot");
      if (statusDot) {
        statusDot.classList.remove("status-online", "status-offline");
        statusDot.classList.add(service.status === 'SUCCESS' ? 'status-online' : 'status-offline');
      }
      // Update status text
      const statusText = existingCard.querySelector(".small.text-secondary");
      if (statusText) {
        statusText.textContent = service.status || 'UNKNOWN';
      }
      // Update last deploy date
      const serviceDate = existingCard.querySelector(".service-date");
      if (serviceDate) {
        serviceDate.textContent = `Último deploy: ${formatDate(service.createdAt)}`;
      }
    } else {
      // If a service is new, create and append it
      const card = createServiceCard(service, freshProject, selectedProjectClient);
      container.appendChild(card);
    }
  });

  // Remove services that no longer exist
  const currentServiceIds = new Set(freshProject.services.map(s => s.id));
  container.querySelectorAll(".service-card").forEach(card => {
    if (!currentServiceIds.has(card.dataset.serviceId)) {
      card.remove();
    }
  });
}

function createServiceCard(service, project, client = null) {
  const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
  const funcs = (window.currentUser && window.currentUser.funciones_habilitadas) || {};
  let permLvl = isAdmin ? 'editar_crear' : (funcs.agentes || 'none');
  if (permLvl === true) permLvl = 'editar_crear';
  const canEdit = permLvl === 'editar_crear';

  const backofficeActivado = client && client.clientes && client.clientes.backoffice_activado;
  const showBackoffice = isAdmin || backofficeActivado;

  const div = document.createElement("div");
  div.className = "service-card p-4 rounded";
  div.dataset.serviceId = service.id;

  div.innerHTML = `
  <!-- HEADER -->
  <div class="d-flex justify-content-between align-items-center mb-2">

    <div class="fw-bold service-name">
      ${service.name}
    </div>

    <!-- STATUS DOT -->
    <div class="d-flex align-items-center">
       <span class="status-dot ${service.status === 'SUCCESS' ? 'status-online' : 'status-offline'} me-2"></span>
       <span class="small text-secondary">${service.status || 'UNKNOWN'}</span>
    </div>

  </div>

  <!-- FECHA -->
  <div class="small text-secondary mb-3 service-date text-center">
    Último deploy: ${formatDate(service.createdAt)}
  </div>

  <!-- MENU -->
  <div class="service-menu-wrapper">

    <div class="service-menu">

      <div class="service-menu-item btn-logs">
        <i class="bi bi-terminal me-2"></i> Logs
      </div>
      
      ${canEdit ? `
        <hr>
        <div class="service-menu-item btn-vars">
          <i class="bi bi-sliders me-2"></i> Variables
        </div>
      ` : ''}

      <hr>

      <div class="service-menu-item btn-dashboard">
        <i class="bi bi-speedometer2 me-2"></i> Dashboard
      </div>

      <hr>

      <div class="service-menu-item btn-webchat">
        <i class="bi bi-chat-dots me-2"></i> Webchat
      </div>

      ${showBackoffice ? `
        <hr>
        <div class="service-menu-item btn-backoffice">
          <i class="bi bi-key-fill me-2"></i> Backoffice
        </div>
      ` : ''}

      ${canEdit ? `
        <hr>
        <div class="service-menu-item btn-redeploy">
          <i class="bi bi-arrow-repeat me-2"></i> Redeploy
        </div>
      ` : ''}

    </div>

  </div>
`;

  function setActiveServiceMenu(el) {

    const container = el.closest(".service-menu");

    if (!container) return;

    container.querySelectorAll(".service-menu-item")
      .forEach(i => i.classList.remove("active"));

    el.classList.add("active");

  }

  function clearActiveServiceMenu() {

    document
      .querySelectorAll(".service-menu-item.active")
      .forEach(el => el.classList.remove("active"));

  }

  // --------------------------------------------------
  // BOTONES DE SERVICIO
  // --------------------------------------------------

  div.querySelector(".btn-logs")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    renderLogsView(service.deploymentId, service.name);

  });

  div.querySelector(".btn-vars")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    renderVariablesView(
      service.projectId,
      service.environmentId,
      service.id,
      service.name
    );

  });

  div.querySelector(".btn-dashboard")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    openDashboard(
      service.projectId,
      service.environmentId,
      service.id
    );

  });

  div.querySelector(".btn-webchat")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    openWebchat(
      service.projectId,
      service.environmentId,
      service.id,
      service.name
    );

  });

  div.querySelector(".btn-redeploy")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    handleRedeploy(service.id, service.environmentId);

  });

  div.querySelector(".btn-backoffice")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    openBackoffice(service.projectId);

  });

  // --------------------------------------------------
  // OBSERVAR CUANDO SE CIERRA EL SIDE PANEL
  // --------------------------------------------------

  const sidePanel = document.getElementById("detail-side-panel");

  if (sidePanel) {

    const observer = new MutationObserver(() => {

      if (sidePanel.innerHTML.trim() === "") {
        clearActiveServiceMenu();
      }

    });

    observer.observe(sidePanel, {
      childList: true,
      subtree: false
    });

  }

  div.querySelector(".btn-delete")?.addEventListener("click", () => {
    handleDelete(service.id);
  });

  div.querySelector(".btn-update-mini")?.addEventListener("click", () => {
    handleDeployUpdate(service.id, service.environmentId);
  });

  return div;
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

  if (!confirm("¿Deseas reiniciar este servicio?")) return;

  addNotification(
    "deploy",
    "Reinicio solicitado",
    `Se solicitó reinicio del servicio`,
    `redeploy-${serviceId}`
  );

  try {

    await window.api.redeployService(serviceId, environmentId);

    showToast("Reinicio solicitado correctamente", "success");

    await loadAssistants(true);

  } catch (error) {

    console.error("Error redeploy:", error);

    addNotification(
      "deploy-error",
      "Error al reiniciar servicio",
      `No se pudo reiniciar el servicio`,
      `redeploy-error-${serviceId}`
    );

    showToast("Error al solicitar reinicio", "danger");

  }
}

async function handleDeployUpdate(serviceId, environmentId) {

  if (!confirm("¿Deseas aplicar la nueva versión disponible para este servicio?")) return;

  addNotification(
    "deploy",
    "Deploy iniciado",
    `Se inició actualización del servicio`,
    `deploy-${serviceId}`
  );

  try {

    const res = await window.api.deployServiceUpdate(serviceId, environmentId);

    if (res.data?.serviceInstanceDeployV2) {

      showToast("Deploy iniciado correctamente", "success");

      await loadAssistants(true);

    } else {

      addNotification(
        "deploy-error",
        "Error en deploy",
        `No se pudo iniciar el deploy`,
        `deploy-error-${serviceId}`
      );

      showToast("Error al iniciar actualización", "danger");

    }

  } catch (error) {

    console.error("Error deploy update:", error);

    addNotification(
      "deploy-error",
      "Error de conexión",
      `Railway no respondió`,
      `deploy-error-${serviceId}`
    );

    showToast("Error de conexión al Railway", "danger");

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

  // reset detail panel
  const detail = document.getElementById("assistant-detail");
  if (detail) {
    detail.dataset.initialized = "";
    detail.dataset.projectId = "";
    detail.style.display = "none";
  }

  // refrescar lista
  await loadAssistants(false);

  // ir a vista asistentes
  navigate("assistants");

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

    renderDashboardView(domain);

  } catch (err) {
    console.error("Error abriendo dashboard:", err);
  }
}

// --------------------------------------------------
// WEBCHAT
// --------------------------------------------------

async function openWebchat(projectId, environmentId, serviceId, serviceName) {

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
      showToast("Este servicio no tiene dominio público.", "warning");
      return;
    }

    if (!domain.startsWith("http")) {
      domain = "https://" + domain;
    }

    // Usar el nuevo componente integrado
    renderWebchatView(domain, serviceName);

  } catch (err) {
    console.error("Error abriendo webchat:", err);
    showToast("Error al cargar webchat", "danger");
  }
}

// --------------------------------------------------
// BACKOFFICE
// --------------------------------------------------

async function openBackoffice(projectId) {
  try {
    const linked = await window.api.getProjectClient(projectId);
    if (!linked || !linked.clientes) {
      showToast("Este proyecto no está vinculado a un cliente.", "warning");
      return;
    }

    const client = linked.clientes;
    const project = assistants.find(a => a.id === projectId);

    // Buscar el servicio principal para el dominio (normalmente el de webchat/dashboard)
    const service = project.services.find(s => s.name.toLowerCase().includes('bot') || s.name.toLowerCase().includes('main')) || project.services[0];

    if (!service) {
      showToast("No se encontró un servicio para este proyecto.", "warning");
      return;
    }

    const domains = await window.api.getServiceDomains(
      projectId,
      service.environmentId,
      service.id
    );

    let domain = null;
    if (domains?.customDomains?.length > 0) {
      domain = domains.customDomains[0].domain;
    } else if (domains?.serviceDomains?.length > 0) {
      domain = domains.serviceDomains[0].domain;
    }

    if (!domain) {
      showToast("Este servicio no tiene dominio público.", "warning");
      return;
    }

    if (!domain.startsWith("http")) {
      domain = "https://" + domain;
    }

    renderBackofficeView(domain, client.token_backoffice);

  } catch (err) {
    console.error("Error abriendo backoffice:", err);
    showToast("Error al acceder al backoffice", "danger");
  }
}


// --------------------------------------------------
// SMART REFRESH AND HASH SYSTEM
// --------------------------------------------------

let autoRefreshTimeout = null;

let refreshRate = 30000;

let userActive = true;
let idleMode = false;

let lastInteraction = Date.now();

function registerActivity() {

  lastInteraction = Date.now();

  if (idleMode) {
    idleMode = false;
    console.log("Usuario activo nuevamente");
  }

}

["mousemove", "keydown", "click"].forEach(evt => {
  window.addEventListener(evt, registerActivity);
});

function generateAssistantsHash() {

  if (!assistants) return ""

  return assistants.map(project =>

    project.services.map(service =>
      `${service.id}-${service.status}-${service.deploymentId || ""}`
    ).join("|")

  ).join("#")

}

async function smartRefresh() {

  if (isRefreshing) return;

  try {

    isRefreshing = true;

    const previousHash = lastAssistantsHash;

    await loadAssistants(true);

    const currentHash = generateAssistantsHash();

    if (currentHash !== previousHash) {

      console.log("Cambios detectados en servicios");

      lastAssistantsHash = currentHash;

      if (selectedProjectId) {

        const project = assistants.find(p => p.id === selectedProjectId);

        if (project) {
          patchServices(project);
        }

      }

    }

    const hasBuilding = assistants.some(project =>
      project.services.some(service => service.status === "checking")
    );

    const hasError = assistants.some(project =>
      project.services.some(service => service.status === "error")
    );

    assistants.forEach(project => {
      project.services.forEach(service => {



        if (service.status === "error") {
          addNotification(
            "deploy-error",
            "Error en deploy",
            `El servicio ${service.name} falló`,
            `deploy-error-${service.id}`
          );
        }

      });
    });

    const now = Date.now();
    const inactiveTime = now - lastInteraction;

    if (inactiveTime > 60000) {
      idleMode = true;
    }

    if (idleMode) {
      refreshRate = 10000;
    } else if (hasBuilding) {
      refreshRate = 2000;
    } else if (hasError) {
      refreshRate = 3000;
    } else if (selectedProjectId) {
      refreshRate = 3000;
    } else {
      refreshRate = 4000;
    }

  } catch (err) {

    console.error("Smart refresh error:", err);

  } finally {

    isRefreshing = false;

    autoRefreshTimeout = setTimeout(smartRefresh, refreshRate);

  }
}

function startAutoRefresh() {
  if (autoRefreshTimeout) {
    clearTimeout(autoRefreshTimeout);
  }
  smartRefresh();
}

window.addEventListener("focus", async () => {

  console.log("App volvió al foco");

  idleMode = false;

  await loadAssistants(true);

});

startAutoRefresh();

document.addEventListener("DOMContentLoaded", async () => {

  const version = await window.api.getAppVersion();
  const el = document.getElementById("app-version");
  if (el) el.textContent = "v" + version;

  document.querySelectorAll(".nav-top").forEach(btn => {
    btn.addEventListener("click", async () => {
      const view = btn.dataset.view;

      if (view === "assistants" && assistants.length === 0) {
        await loadAssistants(false);
        lastAssistantsHash = generateAssistantsHash(); // Al cargar la app, inicializamos el HASH
      }

      navigate(view);
    });
  });

  // Cargar datos iniciales
  await loadAssistants(false);

  const savedView = localStorage.getItem("activeView") || "dashboard";
  navigate(savedView);

  document.body.classList.remove("app-preload");

});

// =========================
// DASHBOARD MAESTRO GLOBAL
// =========================
async function renderConfigView() {
  const container = document.getElementById("config-view");
  container.innerHTML = `
    <div class="row">
      <div class="col-12 mb-4">
        <h2 class="fw-bold"><i class="bi bi-gear-fill me-2"></i>Configuración de Usuario</h2>
        <p class="text-secondary">Gestiona tu perfil y permisos de acceso.</p>
      </div>

      <div class="col-md-5">
        <div class="glass-card p-4 h-100">
          <h5 class="mb-4">Información del Perfil</h5>
          <div class="text-center mb-4">
            <div class="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 80px; height: 80px;">
              <i class="bi bi-person-fill text-white fs-1"></i>
            </div>
            <h4>${currentUser.nombre}</h4>
            <span class="badge bg-info text-dark">${currentUser.rol.toUpperCase()}</span>
          </div>
          
          <ul class="list-group list-group-flush bg-transparent">
            <li class="list-group-item bg-transparent text-white border-secondary px-0">
              <div class="small text-secondary">ID de Cliente</div>
              <div>${currentUser.cliente_id || 'N/A'}</div>
            </li>
            <li class="list-group-item bg-transparent text-white border-secondary px-0">
              <div class="small text-secondary">Correo Electrónico</div>
              <div>${currentUser.email || 'No especificado'}</div>
            </li>
          </ul>
        </div>
      </div>

      <div class="col-md-7">
        <div class="glass-card p-4 h-100">
          <h5 class="mb-4">Permisos y Funciones</h5>
          <div class="alert alert-info py-2 small">
            <i class="bi bi-info-circle me-2"></i>
            Las funciones habilitadas dependen de tu contrato activo y rol asignado.
          </div>

          <div class="mt-4">
            <div class="mb-3 d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold">Visualización de Asistentes</div>
                <div class="small text-secondary">${currentUser.rol === 'admin' ? 'Ver todos los proyectos del equipo' : 'Ver proyectos vinculados a mi cuenta'}</div>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" checked disabled>
              </div>
            </div>

            <div class="mb-3 d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold">Gestión de Tickets</div>
                <div class="small text-secondary">Crear y responder tickets de soporte</div>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" ${currentUser.rol === 'admin' ? 'checked' : 'checked'} disabled>
              </div>
            </div>

            <div class="mb-3 d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold">Acceso a Facturación</div>
                <div class="small text-secondary">Ver y descargar comprobantes de pago</div>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" ${currentUser.rol === 'admin' ? 'checked' : 'checked'} disabled>
              </div>
            </div>

            <div class="mb-3 d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold">Operaciones Críticas (Despliegue)</div>
                <div class="small text-secondary">Reiniciar servicios y desplegar actualizaciones</div>
              </div>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" ${currentUser.rol === 'admin' ? 'checked' : 'checked'} disabled>
              </div>
            </div>
            
            ${currentUser.rol === 'admin' ? `
             <div class="mt-4 pt-3 border-top border-secondary">
                <h6>Opciones de Administrador</h6>
                <button class="btn btn-sm btn-outline-warning mt-2 w-100" onclick="navigate('admins')">
                  <i class="bi bi-shield-lock me-2"></i> Administrar Usuarios Admin
                </button>
             </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderDashboard() {
  selectedProjectId = null;
  document.querySelectorAll(".assistant-item").forEach(el => el.classList.remove("active-assistant"));

  document.getElementById("assistant-detail").style.display = "none";
  document.getElementById("clients-view").style.display = "none";
  document.getElementById("tickets-view").style.display = "none";
  document.getElementById("billing-view").style.display = "none";
  document.getElementById("audit-view").style.display = "none";
  document.getElementById("config-view").style.display = "none";

  // Limpiar contenedores secundarios
  ["integrated-log-container", "integrated-var-container", "integrated-chat-container"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  const dash = document.getElementById("dashboard-global");
  dash.style.display = "block";
  dash.innerHTML = `
    <div class="d-flex justify-content-center align-items-center h-100">
      <div class="spinner-border text-light" role="status"></div>
    </div>
  `;

  try {
    const isAdmin = window.currentUser?.rol === 'admin';
    const cliId = isAdmin ? null : window.currentUser?.cliente_id;

    // Fetch relevant data
    const tickets = await window.api.getTickets(cliId ? { cliente_id: cliId } : {});
    const pendingTickets = tickets.filter(t => t.estado !== 'Cerrado');

    let clientsCount = 0;
    if (isAdmin) {
      try {
        const clients = await window.api.getClients();
        clientsCount = clients.filter(c => c.plan !== 'Baja').length;
      } catch (e) { console.warn("Admin could not fetch clients:", e); }
    }

    let onlineServices = 0;
    let errorServices = 0;
    assistants.forEach(a => {
      a.services.forEach(s => {
        if (s.status === 'online') onlineServices++;
        if (s.status === 'error') errorServices++;
      });
    });

    dash.innerHTML = `
      <div class="animate-fade mt-4">
        <h2 class="mb-4 fw-bold">DASHBOARD ${!isAdmin ? `- ${window.currentUser.nombre.toUpperCase()}` : ''}</h2>
        
        <div class="row g-4 mb-5">
          <!-- CARD BOTS -->
          <div class="col-md-${isAdmin ? '3' : '4'}">
            <div class="glass-card p-4 text-center h-100" style="cursor:pointer" onclick="navigate('assistants')">
              <div class="display-5 fw-bold text-success">${assistants.length}</div>
              <div class="text-uppercase small ls-1">Proyectos</div>
              <div class="mt-3 small text-secondary">
                <span class="text-success">${onlineServices} Online</span> / 
                <span class="text-danger">${errorServices} Error</span>
              </div>
            </div>
          </div>

          ${isAdmin ? `
          <!-- CARD CLIENTES (Admin only) -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100" style="cursor:pointer" onclick="navigate('clients')">
              <div class="display-5 fw-bold text-info">${clientsCount}</div>
              <div class="text-uppercase small ls-1">Clientes Activos</div>
              <div class="mt-3">
                 <button class="btn btn-sm btn-outline-info">Gestionar</button>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- CARD TICKETS -->
          <div class="col-md-${isAdmin ? '3' : '4'}">
            <div class="glass-card p-4 text-center h-100" style="cursor:pointer" onclick="navigate('tickets')">
              <div class="display-5 fw-bold text-warning">${pendingTickets.length}</div>
              <div class="text-uppercase small ls-1">Tickets Pendientes</div>
              <div class="mt-3">
                 <button class="btn btn-sm btn-outline-warning">Ver Tickets</button>
              </div>
            </div>
          </div>

          <!-- CARD SALUD -->
          <div class="col-md-${isAdmin ? '3' : '4'}">
            <div class="glass-card p-4 text-center h-100">
              <div class="display-5 fw-bold ${errorServices > 0 ? 'text-danger' : 'text-success'}">
                 ${errorServices > 0 ? 'ALERTA' : 'OK'}
              </div>
              <div class="text-uppercase small ls-1">Estado General</div>
              <div class="mt-3 small text-secondary">
                ${errorServices > 0 ? 'Se detectaron fallos' : 'Sistemas estables'}
              </div>
            </div>
          </div>
        </div>

        <div class="row g-4">
          <div class="col-md-6">
            <div class="glass-card p-4">
               <h5 class="mb-3">Último Ticket</h5>
               ${pendingTickets.length > 0 ? `
                  <div class="p-3 border border-secondary rounded bg-dark-hover" style="cursor:pointer" onclick="navigate('packets')">
                     <div class="d-flex justify-content-between">
                        <span class="fw-bold">${pendingTickets[0].titulo}</span>
                        <span class="badge bg-warning text-dark">${pendingTickets[0].prioridad}</span>
                     </div>
                     <div class="small text-secondary mt-1">${pendingTickets[0].clientes ? pendingTickets[0].clientes.nombre : 'Sin Cliente'}</div>
                  </div>
               ` : '<div class="text-secondary small">No hay tickets pendientes</div>'}
            </div>
          </div>
          <div class="col-md-6">
             <div class="glass-card p-4">
               <h5 class="mb-3">Acciones Rápidas</h5>
               <div class="d-grid gap-2">
                  ${isAdmin ? `
                    <button class="btn btn-outline-light text-start btn-sm" onclick="navigate('clients')">
                      <i class="bi bi-person-plus me-2"></i> Nuevo Cliente
                    </button>
                    <button class="btn btn-outline-light text-start btn-sm" onclick="navigate('billing')">
                      <i class="bi bi-receipt me-2"></i> Revisar Facturación
                    </button>
                  ` : ''}
                  <button class="btn btn-outline-light text-start btn-sm" onclick="navigate('tickets')">
                    <i class="bi bi-chat-dots me-2"></i> Crear Nuevo Ticket
                  </button>
                  <button class="btn btn-outline-light text-start btn-sm" id="dashboard-refresh">
                    <i class="bi bi-arrow-repeat me-2"></i> Actualizar Tablero
                  </button>
               </div>
             </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("dashboard-refresh").onclick = () => {
      loadAssistants();
      renderDashboard();
    };

  } catch (error) {
    console.error("Error al renderizar Dashboard:", error);
    dash.innerHTML = `<div class="alert alert-danger m-4">Error al cargar datos del tablero.</div>`;
  }
}

// --------------------------------------------------
// INIT APP & AUTH LOGIC
// --------------------------------------------------

async function initApp() {
  console.log("initApp started");
  const version = await window.api.getAppVersion();
  console.log("App version:", version);
  const el = document.getElementById("app-version");
  if (el) el.textContent = "v" + version;

  const session = localStorage.getItem("session");
  if (session) {
    console.log("Session found");
    try {
      window.currentUser = JSON.parse(session);
      showApp();
    } catch (e) {
      console.error("Error parsing session:", e);
      showLogin();
    }
  } else {
    console.log("No session, showing login");
    showLogin();
  }

  console.log("Setting up auth listeners...");
  setupAuthListeners();
  console.log("initApp finished");
}

function showLogin() {
  const loginView = document.getElementById("login-view");
  const appWrapper = document.getElementById("app-wrapper");
  if (loginView) {
    loginView.classList.remove("d-none");
    loginView.classList.add("d-flex");
  }
  if (appWrapper) {
    appWrapper.classList.add("d-none");
    appWrapper.classList.remove("d-flex");
  }
}

function showApp() {
  console.log("showApp called");
  try {
    const loginView = document.getElementById("login-view");
    const appWrapper = document.getElementById("app-wrapper");

    if (loginView) {
      loginView.classList.add("d-none");
      loginView.classList.remove("d-flex");
    }
    if (appWrapper) {
      appWrapper.classList.remove("d-none");
      appWrapper.classList.add("d-flex");
      console.log("app-wrapper shown using d-flex");
    }

    if (window.currentUser) {
      console.log("Current user:", window.currentUser);
      const userDisplay = document.getElementById("user-display-name");
      if (userDisplay) {
        userDisplay.textContent = window.currentUser.nombre || window.currentUser.rol.toUpperCase();
      }

      console.log("Applying permissions...");
      applyPermissions();

      console.log("Loading assistants (background)...");
      loadAssistants(false).catch(err => console.error("Error loading assistants:", err));

      console.log("Navigating to dashboard...");
      navigate("dashboard").catch(err => console.error("Error navigating to dashboard:", err));

      // Notificar al proceso principal para auditoría
      window.api.setActiveUser(window.currentUser);
    } else {
      console.warn("showApp called but no currentUser found");
    }
  } catch (err) {
    console.error("Critical error in showApp:", err);
  }
}

function applyPermissions() {
  if (!window.currentUser) return;
  const isAdmin = window.currentUser.rol === 'admin';
  const funcs = window.currentUser.funciones_habilitadas || {};

  const isVisible = (moduleName) => {
    if (isAdmin) return true;
    const perm = funcs[moduleName];
    // Retrocompatibilidad con booleanos: true -> visible
    // String: si es 'none' -> oculto, sino visible
    if (typeof perm === 'boolean') return perm;
    return perm && perm !== 'none';
  };

  // Mostrar/Ocultar vistas en la navegación
  // Módulo -> data-view(s)
  const navRules = [
    { mod: 'clientes', views: ['clients'] },
    { mod: 'tickets', views: ['tickets'] },
    { mod: 'agentes', views: ['assistants'] }, // Mapeando asistentes a agentes
    { mod: 'facturas', views: ['billing'] }
  ];

  navRules.forEach(rule => {
    const visible = isVisible(rule.mod);
    rule.views.forEach(view => {
      const btn = document.querySelector(`.nav-top[data-view="${view}"]`);
      if (btn) btn.style.display = visible ? 'inline-block' : 'none';
    });
  });

  // Algunas secciones exclusivas de admin
  const adminOnlyViews = ['audit', 'config', 'usuarios'];
  adminOnlyViews.forEach(view => {
    const btn = document.querySelector(`.nav-top[data-view="${view}"]`);
    if (btn) btn.style.display = isAdmin ? 'inline-block' : 'none';
  });

  // Botón Nuevo Asistente
  const btnDeploy = document.getElementById("btnDeployAssistant");
  if (btnDeploy) {
    let permLvl = isAdmin ? 'editar_crear' : (funcs.agentes || 'none');
    if (permLvl === true) permLvl = 'editar_crear';
    btnDeploy.style.display = (permLvl === 'editar_crear') ? 'inline-block' : 'none';
  }

  // Otros elementos genéricos
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? 'block' : 'none';
  });
}

function setupAuthListeners() {
  // Toggle Admin Access
  document.getElementById("btnAdminAccess").onclick = () => {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("admin-login-form").style.display = "block";
    document.getElementById("token-login-form").style.display = "none";
  };

  document.getElementById("btnTokenAccess").onclick = () => {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("admin-login-form").style.display = "none";
    document.getElementById("token-login-form").style.display = "block";
  };

  document.getElementById("btnBackToLogin").onclick = () => {
    document.getElementById("login-form").style.display = "block";
    document.getElementById("admin-login-form").style.display = "none";
    document.getElementById("token-login-form").style.display = "none";
  };

  document.getElementById("btnBackToLoginFromToken").onclick = () => {
    document.getElementById("login-form").style.display = "block";
    document.getElementById("admin-login-form").style.display = "none";
    document.getElementById("token-login-form").style.display = "none";
  };

  // Login con Usuario y Contraseña
  document.getElementById("btnLogin").onclick = async () => {
    console.log("btnLogin click");
    const user = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value;

    if (!user || !pass) {
      console.warn("Faltan credenciales");
      return showToast("Ingresá usuario y contraseña", "warning");
    }

    try {
      console.log("Iniciando loginWithCredentials para:", user);
      const result = await window.api.loginWithCredentials(user, pass);
      console.log("Resultado login:", result);

      if (result) {
        window.currentUser = result.user;
        localStorage.setItem("session", JSON.stringify(window.currentUser));
        showToast(`Bienvenido, ${window.currentUser.nombre}`);
        showApp();
      } else {
        showToast("Credenciales inválidas", "danger");
      }
    } catch (err) {
      console.error("Error en click btnLogin:", err);
      showToast("Error al validar credenciales", "danger");
    }
  };

  // Login con Token
  document.getElementById("btnLoginToken").onclick = async () => {
    const token = document.getElementById("login-token").value.trim();
    if (!token) return showToast("Ingresá un token", "warning");

    try {
      const result = await window.api.loginWithToken(token);
      if (result) {
        window.currentUser = result.user;
        localStorage.setItem("session", JSON.stringify(window.currentUser));
        showToast(`Bienvenido, ${window.currentUser.nombre}`);
        showApp();
      } else {
        showToast("Token inválido o inactivo", "danger");
      }
    } catch (err) {
      showToast("Error al validar token", "danger");
    }
  };

  // Login Admin
  document.getElementById("btnLoginAdmin").onclick = async () => {
    const pass = document.getElementById("admin-pass").value;
    if (!pass) return showToast("Ingresá la contraseña", "warning");

    try {
      const result = await window.api.verifyAdmin(pass);
      if (result) {
        window.currentUser = result.user;
        localStorage.setItem("session", JSON.stringify(window.currentUser));
        showToast("Acceso Administrador concedido");
        showApp();
      } else {
        showToast("Contraseña incorrecta", "danger");
      }
    } catch (err) {
      showToast("Error de autenticación", "danger");
    }
  };

  // Logout
  document.getElementById("btnLogout").onclick = () => {
    window.currentUser = null;
    localStorage.removeItem("session");
    window.api.setActiveUser(null);
    showLogin();
  };
}

// Inicializar
initApp();


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