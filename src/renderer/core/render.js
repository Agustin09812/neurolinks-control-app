let assistants = [];
let selectedProjectId = null;
let lastAssistantsHash = ""; // Hash system for optimized refreshing
let isRefreshing = false; // Avoid glitch while refreshing
let notifications = []; // Notifications system in app
const notificationMemory = new Map(); // Notifications memory
let renderToken = 0;

// Variables globales compartidas entre render.js y logs-view.js
// window.currentDeploymentStatus — estado del deploy actual
// window.currentProjectId       — project ID en Railway
// window.currentServiceId       — service ID en Railway
window.clientsData = []; // Hash para clients
window.ticketsData = []; // Hash para tickets
window.variablesCache = {}; // Hash para variables

// ========================================
// THEME TOGGLE (Light/Dark Mode)
// ========================================

function toggleTheme() {
  const body = document.body;
  const current = body.dataset.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  body.dataset.theme = next;
  localStorage.setItem('theme', next);

  // Actualizar ícono del sidebar
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.className = next === 'light' ? 'bi bi-sun-fill' : 'bi bi-moon-stars';
  }
}

// ========================================
// ROUTER CENTRAL DE NAVEGACIÓN
// ========================================

async function navigate(view) {

  window.stopLogsStreaming?.();

  localStorage.setItem("activeView", view);

  // Mapeo correcto de vistas → IDs reales
  const viewMap = {
    dashboard: "dashboard-global",
    assistants: "assistants-view",
    clients: "clients-view",
    tickets: "tickets-view",
    billing: "billing-view",
    audit: "audit-view",
  };

  const views = Object.values(viewMap).concat([
    "assistant-detail",
    "logs-view",
    "variables-view"
  ]);

  const activeViewEl = document.getElementById(viewMap[view]);

  // Animación
  if (activeViewEl) {
    activeViewEl.classList.add("view-transition");
    setTimeout(() => {
      activeViewEl.classList.remove("view-transition");
    }, 300);
  }

  // Ocultar todas
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Reset active sidebar
  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.classList.remove("active");
  });

  // Activar botón actual
  const activeBtn = document.querySelector(`.sidebar-item[data-view="${view}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  // Render de vista
  switch (view) {

    case "dashboard":
      document.getElementById(viewMap.dashboard).style.display = "block";
      renderDashboard?.();
      break;

    case "assistants":

      // Reset detail panel
      const detail = document.getElementById("assistant-detail");
      if (detail) {
        detail.dataset.initialized = "";
        detail.dataset.projectId = "";
        detail.style.display = "none";
      }

      await loadAssistants(false);

      document.getElementById(viewMap.assistants).style.display = "block";

      renderAssistantsGrid?.();
      break;

    case "clients":

      try {
        const data = await window.api.getClients();
        window.clientsData = data;
      } catch (e) {
        console.error("Error loading clients:", e);
      }

      document.getElementById(viewMap.clients).style.display = "block";
      renderClientsView?.();
      break;

    case "tickets":

      try {
        const data = await window.api.getTickets();
        window.ticketsData = data;
      } catch (e) {
        console.error("Error loading tickets:", e);
      }

      document.getElementById(viewMap.tickets).style.display = "block";
      renderTicketsView?.();
      break;

    case "billing":

      try {
        // FIX: getPayments no existe en preload → usar getAllPayments
        const data = await window.api.getAllPayments?.();
        window.billingData = data || [];
      } catch (e) { }

      document.getElementById(viewMap.billing).style.display = "block";
      renderBillingView?.();
      break;

    case "audit":
      document.getElementById(viewMap.audit).style.display = "block";
      renderAuditView?.();
      break;

    // FIX: Se eliminó case "notifications" — usaba viewMap.notifications
    // que no existe, causando TypeError. Las notificaciones usan offcanvas.

  }

}

// --------------------------------------------------
// FUNCION PARA SACAR ELEMENTO ACTIVE DE MENUS
// --------------------------------------------------

function clearActiveServiceMenu() {
  document
    .querySelectorAll(".service-menu-item.active")
    .forEach(el => el.classList.remove("active"));
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
  const bgClass = type === 'danger' ? 'bg-danger' : (type === 'warning' ? 'bg-warning text-dark' : 'toast-themed');

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

  renderNotificationsPanel?.();
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

function markNotificationAsRead(id) {
  const notif = notifications.find(n => n.id === id);
  if (!notif) return;
  notif.read = true;
  updateNotificationsBadge();
  renderNotificationsPanel();
}

function clearAllNotifications() {
  if (!confirm("¿Seguro que querés eliminar todas las notificaciones?")) return;
  notifications = [];
  updateNotificationsBadge();
  renderNotificationsPanel();
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
  // badge.innerText = unread;
}

// --------------------------------------------------
// NOTIFICATIONS PANEL (OFFCANVAS)
// --------------------------------------------------

function openNotificationsPanel() {

  const canvasEl = document.getElementById("notificationsCanvas");
  if (!canvasEl) return;

  const canvas = bootstrap.Offcanvas.getOrCreateInstance(canvasEl);

  renderNotificationsPanel();

  canvas.show();
}

function renderNotificationsPanel() {

  const container = document.getElementById("notifications-panel-list");
  if (!container) return;

  const list = getNotifications() || [];

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card p-3 text-center text-secondary">
        No hay notificaciones
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(n => `

        <div 
          class="glass-card notification-item ${n.read ? "opacity-50" : ""}" 
          onclick="markNotificationAsRead('${n.id}')"
        >
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-bold">${n.title}</div>
            <div class="small text-secondary">
              ${n.message}
            </div>
          </div>
          <div class="small text-dim text-end min-w-60">
            ${new Date(n.date).toLocaleTimeString()}
          </div>
        </div>
      </div>

  `).join("");

}

// --------------------------------------------------
// LOAD ASSISTANTS
// --------------------------------------------------

async function loadAssistants(preserveSelection = true) {

  const currentSelected = selectedProjectId;

  const data = await window.api.getAssistants();
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

  const gridExists = document.getElementById("assistants-grid");

  if (isAssistantsView) {

    if (!gridExists) {
      renderAssistantsGrid(); // primera vez
    } else {
      patchAssistantsGrid(); // actualiza sin romper input
    }

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
        <div class="d-flex gap-2">
          <div class="input-group input-group-sm search-input-group">
            <span class="input-group-text bg-dark border-secondary text-secondary"><i class="bi bi-search"></i></span>
            <input type="text" class="form-control text-main" id="searchAssistants">
          </div>
          <button class="btn btn-outline-light btn-sm" id="btnRefreshAssistants">
            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
          </button>
        </div>
      </div>
      <div id="assistants-grid" class="row g-4"></div>
    </div>
  `;

  const grid = document.getElementById("assistants-grid");

  document.getElementById("btnRefreshAssistants")?.addEventListener("click", async () => {

    showToast("Actualizando asistentes...", "info");

    await loadAssistants(false);

    renderAssistantsGrid();

  });

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
      <div class="glass-card p-4 h-100 assistant-card hover-lift clickable"
      data-id="${project.id}" 
      data-name="${project.name.toLowerCase()}">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <h5 class="fw-bold mb-0 text-truncate text-truncate-75">
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

  const searchInput = document.getElementById("searchAssistants");

  if (searchInput) {

    searchInput.addEventListener("input", (e) => {

      const value = e.target.value.toLowerCase();

      let visible = 0;

      document.querySelectorAll(".assistant-card").forEach(card => {

        const name = card.dataset.name;
        const col = card.closest("[class*='col-']");

        if (name.includes(value)) {
          col.style.display = "";
          visible++;
        } else {
          col.style.display = "none";
        }

      });

      // Mensaje vacío
      let empty = document.getElementById("empty-search");

      if (visible === 0) {
        if (!empty) {
          document.getElementById("assistants-grid").insertAdjacentHTML("beforeend", `
          <div id="empty-search" class="col-12 text-center text-secondary py-5">
            No se encontraron asistentes
          </div>
        `);
        }
      } else {
        if (empty) empty.remove();
      }

    });

  }
}

function patchAssistantsGrid() {

  const grid = document.getElementById("assistants-grid");
  if (!grid) return;

  assistants.forEach(project => {

    const card = grid.querySelector(`[data-id="${project.id}"]`);
    if (!card) return;

    const badge = card.querySelector(".badge");
    if (!badge) return;

    const statusColor =
      project.status === "online" ? "success" :
        project.status === "error" ? "danger" :
          project.status === "checking" ? "warning" :
            "secondary";

    badge.className = `
      badge bg-${statusColor} bg-opacity-10 text-${statusColor}
      border border-${statusColor} border-opacity-25
    `;

    badge.innerText = project.status.toUpperCase();

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

  // RESET SI CAMBIA PROYECTO
  if (isDifferentProject) {
    detailPanel.dataset.initialized = "";
    detailPanel.dataset.projectId = "";
    detailPanel.innerHTML = "";
  }

  // ===== RENDER INICIAL (NUNCA ABORTAR)
  if (!detailPanel.dataset.initialized) {

    renderDetailStructure(project);

    detailPanel.dataset.initialized = "true";
    detailPanel.dataset.projectId = project.id;

    // SOLO abortar async
    await updateDetailHeader(project);

    if (token !== renderToken) return;

    renderServices(project);

    return;
  }

  // ===== REFRESH
  if (isRefresh) {

    await updateDetailHeader(project);

    if (token !== renderToken) return;

    patchServices(project);

    // FIX: No forzar openDashboard en refreshes.
    // Solo abrir si no hay vista lateral activa (logs, variables, etc.)
    const sidePanel = document.getElementById("detail-side-panel");
    const hasSideContent = sidePanel && sidePanel.innerHTML.trim() !== "";

    if (!hasSideContent && project.services?.length > 0) {

      const s = project.services[0];

      openDashboard(
        s.projectId,
        s.environmentId,
        s.id
      );

    }

  }
}

function renderDetailStructure(project) {

  const servicesContainer = document.getElementById("services-container");

  if (servicesContainer) {
    servicesContainer.innerHTML = `
    <div class="text-center py-4 text-secondary">
      <div class="spinner-border spinner-border-sm"></div>
      Cargando servicios...
    </div>
  `;
  }

  document.getElementById("dashboard-global").style.display = "none";
  document.getElementById("clients-view").style.display = "none";
  document.getElementById("tickets-view").style.display = "none";
  document.getElementById("billing-view").style.display = "none";
  document.getElementById("audit-view").style.display = "none";

  const detail = document.getElementById("assistant-detail");
  detail.style.display = "block";

  detail.innerHTML = `
<div class="animate-fade">

  <!-- BOTÓN VOLVER -->
  <div class="d-flex justify-content-between align-items-center mb-4">
    <button class="btn btn-outline-light btn-sm" id="btnBackToGrid">
      <i class="bi bi-arrow-left me-2"></i> Volver a Asistentes
    </button>

    <button class="btn btn-outline-light btn-sm" id="btnRefreshProject">
      <i class="bi bi-arrow-clockwise"></i> Actualizar
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

          <p id="project-title" class="fw-bold mb-0">${project.name}</p>

          <div class="dropdown">
            <button 
              class="btn btn-outline-light btn-sm"
              data-bs-toggle="dropdown">

              <i class="bi bi-gear"></i>

            </button>

            <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark">

              <li>
                <button class="dropdown-item btn-rename">
                  <i class="bi bi-pencil me-2"></i>
                  Cambiar nombre
                </button>
              </li>

              <li>
                <button class="dropdown-item btn-railway">
                  <i class="bi bi-box-arrow-up-right me-2"></i>
                  Abrir Railway
                </button>
              </li>

              <li><hr class="dropdown-divider"></li>

              <li>
                <button class="dropdown-item text-danger btn-delete-project">
                  <i class="bi bi-trash me-2"></i>
                  Eliminar proyecto
                </button>
              </li>

            </ul>

          </div>

        </div>

        <!-- CONTADORES -->
        <div id="header-status-row"
             class="d-flex gap-4 small align-items-center mb-2">
        </div>

        <!-- BADGES -->
        <div id="header-badges" class="d-flex gap-2 flex-wrap">
          <span class="badge bg-secondary">Cargando...</span>
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

  document.getElementById("btnRefreshProject")?.addEventListener("click", async () => {

    showToast("Actualizando proyecto...", "info");

    await loadAssistants(true);

  });

  document.getElementById("btnBackToGrid").addEventListener("click", async () => {
    selectedProjectId = null;

    detail.dataset.initialized = "";
    detail.dataset.projectId = "";

    detail.style.display = "none";

    document.getElementById("assistants-view").style.display = "block";

    // refresh assistants
    await loadAssistants(false);

    renderAssistantsGrid();
  });

  detail.querySelector(".btn-rename").addEventListener("click", () => {
    openRenameProject(project.id, project.name);
  });

  detail.querySelector(".btn-railway").addEventListener("click", () => {
    window.api.openExternal(project.railwayUrl);
  });

  detail.querySelector(".btn-delete-project").addEventListener("click", () => {
    handleDeleteProject(project.id);
  });

  // BUG-03 FIX: Removed unused `getMainService` declaration
}

async function updateDetailHeader(project) {

  const currentProjectId = project.id;

  const badgesContainer = document.getElementById("header-badges");
  const statusContainer = document.getElementById("header-status-row");
  const titleEl = document.getElementById("project-title");

  if (!badgesContainer || !statusContainer) return;

  // =========================
  // TÍTULO
  // =========================
  if (titleEl && titleEl.textContent !== project.name) {
    titleEl.textContent = project.name;
  }

  // =========================
  // CONTADORES (SYNC)
  // =========================
  const online = project.services.filter(s => s.status === "online").length;
  const error = project.services.filter(s => s.status === "error").length;
  const building = project.services.filter(s => s.status === "checking").length;

  statusContainer.innerHTML = `
    <span><i class="bi bi-check-circle-fill text-success"></i> ${online}</span>
    <span><i class="bi bi-x-circle-fill text-danger"></i> ${error}</span>
    <span><i class="bi bi-arrow-repeat text-warning"></i> ${building}</span>
  `;

  // =========================
  // RENDER BASE (IMPORTANTE)
  // =========================
  badgesContainer.innerHTML = `
    <div class="badges-row">
      <span class="badge bg-secondary">Cargando...</span>
    </div>
  `;

  // =========================
  // CLIENTE
  // =========================
  let clientBadge = "";
  let ticketsBadge = "";
  let linkButton = "";

  try {

    const linkedClient = await window.api.getProjectClient(project.id);
    if (selectedProjectId !== currentProjectId) return;

    if (!linkedClient || !linkedClient.clientes) {

      linkButton = `
        <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 badge-client-btn badge-sm-action">
          <i class="bi bi-link-45deg me-1"></i>
          Vincular cliente
        </span>
      `;

    } else {

      clientBadge = `
        <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 badge-client-btn">
          <i class="bi bi-person-fill me-1"></i>
          ${linkedClient.clientes.nombre}
        </span>
      `;

      const count = await window.api.getClientPendingTickets(linkedClient.clientes.id);
      if (selectedProjectId !== currentProjectId) return;

      if (count > 0) {
        ticketsBadge = `
          <div class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
            <i class="bi bi-ticket-perforated-fill me-1"></i>
            ${count} Tickets
          </div>
        `;
      } else {
        ticketsBadge = `
          <div class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
            <i class="bi bi-check-circle-fill me-1"></i>
            Sin pendientes
          </div>
        `;
      }
    }

  } catch (err) {
    console.error("Client header error:", err);
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
        <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 badge-sm">
          <i class="bi bi-whatsapp me-1"></i>
          Conectado
        </span>
      `;
    } else {
      whatsappBadge = `
        <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 badge-sm">
          <i class="bi bi-whatsapp me-1"></i>
          Desconectado
        </span>
      `;
    }

  } catch (err) {
    console.error("WhatsApp header error:", err);
  }

  // =========================
  // RENDER FINAL (PROTEGIDO)
  // =========================
  if (selectedProjectId !== currentProjectId) return;

  badgesContainer.innerHTML = `
    <div class="badges-row">
      ${clientBadge || linkButton}
      ${ticketsBadge}
      ${whatsappBadge}
    </div>
  `;

  // eventos
  const clientEl = badgesContainer.querySelector(".badge-client-btn");
  if (clientEl) clientEl.onclick = () => openLinkClient(project.id);
}

function renderServices(project) {

  // if (isRefreshing) return;
  // FIX: evitar bloqueo del render inicial por smartRefresh
  // `isRefreshing` podía estar activo cuando se abría el detail,
  // impidiendo renderizar los servicios (panel vacío intermitente).
  // Se elimina esta condición ya que el refresh en background
  // no debe bloquear el render de UI.

  if (project.id !== selectedProjectId) return;

  const container = document.getElementById("services-container");
  if (!container) return;

  container.innerHTML = "";

  const freshProject = assistants.find(a => a.id === project.id);

  if (!freshProject || !freshProject.services || freshProject.services.length === 0) {
    container.innerHTML = `
      <div class="text-center text-secondary py-4">
        Cargando servicios...
      </div>
    `;
    return;
  }

  freshProject.services.forEach(service => {
    const card = createServiceCard(service, freshProject);
    container.appendChild(card);
  });

  // BUG-02 FIX: Single MutationObserver for side panel (instead of per-card)
  const sidePanel = document.getElementById("detail-side-panel");
  if (sidePanel) {
    // Disconnect any previous observer
    if (sidePanel._sidePanelObserver) {
      sidePanel._sidePanelObserver.disconnect();
    }
    const observer = new MutationObserver(() => {
      if (sidePanel.innerHTML.trim() === "") {
        clearActiveServiceMenu();
      }
    });
    observer.observe(sidePanel, { childList: true, subtree: false });
    sidePanel._sidePanelObserver = observer;
  }

  if (freshProject.services.length > 0) {
    const s = freshProject.services[0];
    openDashboard(s.projectId, s.environmentId, s.id);
  }
}

function createServiceCard(service, project) {

  const div = document.createElement("div");
  div.className = "service-card p-4 rounded";
  div.dataset.serviceId = service.id;

  div.innerHTML = `
  <!-- HEADER -->
  <div class="d-flex justify-content-between align-items-center mb-2">

    <div class="fw-bold service-name">
      ${service.name}
    </div>

    <div class="d-flex align-items-center gap-2">

      <span class="service-status-icon">
        ${getStatusIcon(service.status)}
      </span>

      ${service.isUpdatable ? `
        <button 
          class="btn btn-warning btn-sm btn-update-mini"
          title="Actualizar servicio">
          <i class="bi bi-arrow-repeat"></i>
        </button>
      ` : ""}

    </div>

  </div>

  <!-- FECHA -->
  <div class="small text-secondary mb-3 service-date text-center">
    Último deploy: ${formatDate(service.createdAt)}
  </div>

  <div class="service-menu-wrapper">
 <div class="service-menu">

  <div class="service-menu-item btn-logs">
  <i class="bi bi-terminal me-2"></i> Logs</div>
  <hr class="separator-line">
  <div class="service-menu-item btn-vars">
  <i class="bi bi-sliders me-2"></i> Variables</div>
  <hr class="separator-line">
  <div class="service-menu-item btn-redeploy">
  <i class="bi bi-arrow-repeat me-2"></i> Redeploy</div>
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

  // FIX: Se eliminó clearActiveServiceMenu duplicada.
  // Ya existe como función global (línea 144). La local sobreescribía la global.

  // --------------------------------------------------
  // BOTONES DE SERVICIO
  // --------------------------------------------------

  div.querySelector(".btn-logs")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    window.currentDeploymentStatus = service.railwayStatus;
    window.currentProjectId = service.projectId;
    window.currentServiceId = service.id;

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

  div.querySelector(".btn-redeploy")?.addEventListener("click", (e) => {

    setActiveServiceMenu(e.currentTarget);

    handleRedeploy(service.id, service.environmentId);

  });

  div.querySelector(".btn-update-mini")?.addEventListener("click", () => {
    showToast("Abrí Railway para aplicar la actualización", "info");
    window.api.openExternal(project.railwayUrl);
  });

  return div;
}

function patchServices(project) {

  // FIX: Se removió `if (isRefreshing) return;`
  // patchServices se llama DENTRO de smartRefresh donde isRefreshing=true,
  // causando que el patch del DOM NUNCA se aplique durante el auto-refresh.

  if (project.id !== selectedProjectId) return;

  const container = document.getElementById("services-container");
  if (!container) return;

  project.services.forEach(service => {

    const existing = container.querySelector(
      `[data-service-id="${service.id}"]`
    );

    if (!existing) {
      container.appendChild(createServiceCard(service, project));
      return;
    }

    // Actualizar icono
    const statusIcon = existing.querySelector(".service-status-icon");
    if (statusIcon) {
      statusIcon.innerHTML = getStatusIcon(service.status);
    }

    // Actualizar fecha
    const dateEl = existing.querySelector(".service-date");
    if (dateEl) {
      dateEl.textContent =
        "Último deploy: " + formatDate(service.createdAt);
    }

  });
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

function openFullDashboard(url) {

  if (!url) {
    showToast("URL inválida", "danger");
    return;
  }

  window.api.openDashboardWindow(url);

  // Ahora abrimos el backoffice en una ventana externa dentro del programa para mayor comodidad

}

// FIX: Se eliminó openWebchat() — el archivo webchat-view.js no existe.
// renderWebchatView() era undefined, causando crash al ejecutar.


// --------------------------------------------------
// SMART REFRESH AND HASH SYSTEM
// --------------------------------------------------

let autoRefreshTimeout = null;

let refreshRate = 15000;

let userActive = true;
let idleMode = false;
let deepIdleMode = false;

let lastInteraction = Date.now();
let focusDebounceTimer = null;

function registerActivity() {

  lastInteraction = Date.now();

  if (idleMode || deepIdleMode) {
    idleMode = false;
    deepIdleMode = false;
    console.log("Usuario activo nuevamente");

    // Al volver de idle, forzar un refresh inmediato
    if (autoRefreshTimeout) {
      clearTimeout(autoRefreshTimeout);
      autoRefreshTimeout = setTimeout(smartRefresh, 500);
    }
  }

}

["mousemove", "keydown", "click"].forEach(evt => {
  window.addEventListener(evt, registerActivity);
});

function generateAssistantsHash() {

  // -------------------------
  // ASSISTANTS (siempre se recarga)
  // -------------------------
  const assistantsHash = assistants?.map(project =>
    project.services.map(service =>
      `${service.id}-${service.status}-${service.deploymentId || ""}`
    ).join("|")
  ).join("#") || "";

  // -------------------------
  // CLIENTES (solo si se recargaron)
  // -------------------------
  const clientsHash = window.clientsData?.length
    ? window.clientsData.map(c =>
      `${c.id}-${c.updated_at || c.nombre || ""}`
    ).join("|")
    : "";

  // -------------------------
  // TICKETS (solo si se recargaron)
  // -------------------------
  const ticketsHash = window.ticketsData?.length
    ? window.ticketsData.map(t =>
      `${t.id}-${t.estado}-${t.updated_at || ""}`
    ).join("|")
    : "";

  // FIX: Se removió variablesCache del hash.
  // variablesCache no se recarga en smartRefresh, incluirlo
  // generaba falsos positivos de "cambio detectado".

  return `${assistantsHash}||${clientsHash}||${ticketsHash}`;
}

async function smartRefresh() {

  if (isRefreshing) return;

  try {

    isRefreshing = true;

    const previousHash = lastAssistantsHash;
    const activeView = localStorage.getItem("activeView");

    // FIX: usar preserveSelection=true para no romper el detail abierto
    // Cargar en paralelo con datos secundarios según la vista activa
    const needsClients = activeView === "clients" || activeView === "dashboard";
    const needsTickets = activeView === "tickets" || activeView === "dashboard";

    const apiCalls = [loadAssistants(true)];

    if (needsClients) {
      apiCalls.push(
        window.api.getClients()
          .then(c => { window.clientsData = c; })
          .catch(() => { })
      );
    }

    if (needsTickets) {
      apiCalls.push(
        window.api.getTickets()
          .then(t => { window.ticketsData = t; })
          .catch(() => { })
      );
    }

    // Ejecutar todo en paralelo
    await Promise.allSettled(apiCalls);

    const currentHash = generateAssistantsHash();

    if (currentHash !== previousHash) {

      console.log("Cambios detectados en servicios");

      lastAssistantsHash = currentHash;

      // Actualizar grid si está visible
      const isGridVisible = document.getElementById("assistants-view")?.style.display === "block";
      if (isGridVisible) {
        patchAssistantsGrid();
      }

      // Actualizar detail si hay proyecto seleccionado
      if (selectedProjectId) {

        const project = assistants.find(p => p.id === selectedProjectId);

        if (project) {
          patchServices(project);
          updateDetailHeader(project);
        }

      }

    }

    // Notificaciones de error
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

    // -------------------------
    // IDLE MODE TIERS
    // -------------------------
    const now = Date.now();
    const inactiveTime = now - lastInteraction;

    if (inactiveTime > 300000) {
      // 5+ minutos sin actividad → deep idle
      deepIdleMode = true;
      idleMode = true;
    } else if (inactiveTime > 60000) {
      // 1+ minuto sin actividad → idle
      idleMode = true;
      deepIdleMode = false;
    }

    // -------------------------
    // REFRESH RATES
    // Optimizado: real-time sin saturar API
    // -------------------------
    if (deepIdleMode) {
      refreshRate = 60000;      // deep idle: 60s (mínimo consumo)
    } else if (idleMode) {
      refreshRate = 30000;      // idle: 30s
    } else if (hasBuilding) {
      refreshRate = 3000;       // building: 3s (casi real-time)
    } else if (hasError) {
      refreshRate = 5000;       // error: 5s
    } else if (selectedProjectId) {
      refreshRate = 5000;       // detail abierto: 5s
    } else {
      refreshRate = 8000;       // normal (grid/dashboard): 8s
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

// FIX: Debounce en focus para evitar múltiples cargas al alt-tab rápido
window.addEventListener("focus", () => {

  if (focusDebounceTimer) clearTimeout(focusDebounceTimer);

  focusDebounceTimer = setTimeout(async () => {

    console.log("App volvió al foco");

    registerActivity();

    // Solo forzar recarga si no hay un refresh en curso
    if (!isRefreshing) {
      if (autoRefreshTimeout) clearTimeout(autoRefreshTimeout);
      await smartRefresh();
    }

  }, 800);

});

// FIX: No arrancar smartRefresh acá. Se mueve a DOMContentLoaded
// para evitar doble carga inicial (startAutoRefresh + loadAssistants).

document.addEventListener("DOMContentLoaded", async () => {

  const version = await window.api.getAppVersion();
  const el = document.getElementById("app-version");
  if (el) el.textContent = "v" + version;

  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.addEventListener("click", async () => {

      const view = btn.dataset.view;

      if (!view) return;

      if (view === "assistants" && assistants.length === 0) {
        await loadAssistants(false);
        lastAssistantsHash = generateAssistantsHash();
      }

      navigate(view);

    });
  });

  function initTooltips() {

    // eliminar tooltips anteriores (evita duplicados/glitches)
    document.querySelectorAll('.sidebar-item, .has-tooltip').forEach(el => {
      if (el._tooltipInstance) {
        el._tooltipInstance.dispose();
        el._tooltipInstance = null;
      }
    });

    // crear nuevos tooltips
    document.querySelectorAll('.sidebar-item, .has-tooltip').forEach(el => {

      const tooltip = new bootstrap.Tooltip(el, {
        placement: 'right',
        trigger: 'hover',
        delay: { show: 200, hide: 100 }
      });

      // guardar instancia para controlarla después
      el._tooltipInstance = tooltip;

      // aseguramos que se cierre SIEMPRE al salir
      el.addEventListener('mouseleave', () => {
        tooltip.hide();
      });

    });

  }

  initTooltips();

  // Cargar datos iniciales
  await loadAssistants(false);
  lastAssistantsHash = generateAssistantsHash();

  const savedView = localStorage.getItem("activeView") || "dashboard";
  navigate(savedView);

  document.body.classList.remove("app-preload");

  // FIX: Arrancar smartRefresh DESPUÉS de la carga inicial
  // Antes se ejecutaba a nivel top-level, causando doble loadAssistants
  startAutoRefresh();

  // OPT-04: Consolidated btn-updates listener (was in separate DOMContentLoaded)
  const btnUpdates = document.getElementById("btn-updates");
  if (btnUpdates) {
    btnUpdates.addEventListener("click", openUpdateModal);
  }

  // --------------------------------------
  // THEME: Cargar tema guardado
  // --------------------------------------
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.dataset.theme = savedTheme;
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.className = savedTheme === 'light' ? 'bi bi-sun-fill' : 'bi bi-moon-stars';
  }

  const btnToggleTheme = document.getElementById('btn-theme-toggle');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', toggleTheme);
  }

  // --------------------------------------
  // BOTÓN ABOUT
  // --------------------------------------
  const btnAbout = document.getElementById("btn-about");

  if (btnAbout) {
    btnAbout.addEventListener("click", async () => {

      const modalEl = document.getElementById("aboutModal");
      if (!modalEl) {
        console.error("aboutModal no existe");
        return;
      }

      const version = await window.api.getAppVersion();

      const versionEl = document.getElementById("about-version");
      if (versionEl) {
        versionEl.textContent = "v" + version;
      }

      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();

    });
  }

});

// =========================
// DASHBOARD MAESTRO GLOBAL
// =========================
// FIX: asegurar consistencia de datos en dashboard
// `assistants` es estado global y podía estar vacío o desactualizado,
// generando métricas incorrectas (servicios, estados, etc).
// Se fuerza `loadAssistants` antes de renderizar para garantizar datos actuales.
// FIX: evitar render sin datos actualizados
// Los botones llamaban solo a render (sin recargar datos),
// mostrando información vieja en clientes/tickets.
// Se asegura carga previa de datos antes de renderizar la vista.
async function renderDashboard() {

  // OPT-01: Only load if assistants cache is empty
  if (assistants.length === 0) {
    await loadAssistants(false);
  }

  // FIX: selectedProjectId se limpia acá porque renderDashboard
  // se llama tanto desde navigate() como directamente
  selectedProjectId = null;

  // OPT-02: Removed redundant view hiding — navigate() already handles this

  // Limpiar contenedores secundarios
  ["integrated-log-container", "integrated-var-container"].forEach(id => {
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
        <h2 class="mb-4 fw-bold">DASHBOARD</h2>
        
        <div class="row g-4 mb-5">
          <!-- CARD BOTS -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100 rounded">
              <div class="display-5 fw-bold text-success">${assistants.length}</div>
              <div class="text-uppercase small ls-1">Proyectos Totales</div>
              <div class="mt-3 small text-secondary">
                <span class="text-success">${onlineServices} Online</span> / 
                <span class="text-danger">${errorServices} Error</span>
              </div>
            </div>
          </div>

          <!-- CARD CLIENTES -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100 rounded clickable" onclick="navigate('clients')">
              <div class="display-5 fw-bold text-info">${activeClients.length}</div>
              <div class="text-uppercase small ls-1">Clientes Activos</div>
              <div class="mt-3">
                 <button class="btn btn-sm btn-outline-info">Gestionar Clientes</button>
              </div>
            </div>
          </div>

          <!-- CARD TICKETS -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100 rounded clickable" onclick="navigate('tickets')">
              <div class="display-5 fw-bold text-warning">${pendingTickets.length}</div>
              <div class="text-uppercase small ls-1">Tickets Pendientes</div>
              <div class="mt-3">
                 <button class="btn btn-sm btn-outline-warning">Ver Tickets</button>
              </div>
            </div>
          </div>

          <!-- CARD SALUD -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100 rounded">
              <div class="display-5 fw-bold ${errorServices > 0 ? 'text-danger' : 'text-success'}">
                 ${errorServices > 0 ? 'ALERTA' : 'OK'}
              </div>
              <div class="text-uppercase small ls-1">Estado de Salud</div>
              <div class="mt-3 small text-secondary">
                ${errorServices > 0 ? 'Se detectaron fallos técnicos' : 'Todos los sistemas operativos'}
              </div>
            </div>
          </div>
        </div>

        <div class="row g-4">
          <div class="col-md-6">
            <div class="glass-card p-4 rounded">
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
             <div class="glass-card p-4 rounded">
               <h5 class="mb-3">Acciones Rápidas</h5>
               <div class="d-grid gap-2">
                  <button class="btn btn-outline-light text-start btn-sm" onclick="navigate('clients')">
                    <i class="bi bi-person-plus me-2"></i> Nuevo Cliente
                  </button>
                  <button class="btn btn-outline-light text-start btn-sm" onclick="navigate('tickets')">
                    <i class="bi bi-plus-circle me-2"></i> Crear Ticket
                  </button>
                  <button class="btn btn-outline-light text-start btn-sm" id="dashboard-refresh">
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
      renderDashboard();
    };

  } catch (err) {
    console.error("Error cargando dashboard:", err);
    dash.innerHTML = `<div class="alert alert-danger">Error al cargar datos del dashboard</div>`;
  }
}

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

// --------------------------------------------------
// AUTOUPDATE
// --------------------------------------------------

let updateData = null;

// CUANDO HAY UPDATE
window.api.onUpdateAvailable((data) => {

  updateData = data;

  const badge = document.getElementById("updates-badge");
  if (badge) {
    badge.style.display = "inline-block";
    badge.innerText = "1";
  }

});

// --------------------------------------------------
// CUANDO YA SE DESCARGÓ
// --------------------------------------------------

window.api.onUpdateDownloaded(() => {

  const badge = document.getElementById("updates-badge");

  if (badge) {
    badge.style.display = "none";
  }

});

// --------------------------------------------------
// ABRIR MODAL
// --------------------------------------------------

function openUpdateModal() {

  if (!updateData) return;

  const version = document.getElementById("update-modal-version");
  const notes = document.getElementById("update-modal-notes");

  version.textContent = "Versión " + updateData.version;

  const releaseNotes = updateData.notes || [];

  if (Array.isArray(releaseNotes)) {
    notes.innerHTML = releaseNotes.map(n => "• " + n).join("<br>");
  } else {
    notes.textContent = releaseNotes;
  }

  const modal = new bootstrap.Modal(document.getElementById("updateModal"));
  modal.show();

}

// OPT-04: Second DOMContentLoaded eliminated — merged into the main one above


// --------------------------------------------------
// BOTÓN ACTUALIZAR
// --------------------------------------------------

document.getElementById("btnModalUpdate")?.addEventListener("click", () => {

  if (!confirm("¿Descargar e instalar la nueva versión?")) return;

  window.api.startUpdate();

});

// --------------------------------------------------
// PROGRESO
// --------------------------------------------------

window.api.onUpdateProgress((percent) => {

  const progress = document.getElementById("update-progress");
  const bar = document.getElementById("update-progress-bar");

  if (!progress) return;

  progress.classList.remove("d-none");
  bar.style.width = percent + "%";

});