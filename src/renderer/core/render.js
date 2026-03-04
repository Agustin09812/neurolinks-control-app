let assistants = [];
let selectedProjectId = null;
let lastAssistantsHash = "" // Hash system for optimized refreshing
let isRefreshing = false; // Avoid glitch while refreshing
let notifications = []; // Notifications system in app
const notificationMemory = new Map(); // Notifications memory
let renderToken = 0;

// ========================================
// ROUTER CENTRAL DE NAVEGACIÓN
// ========================================

async function navigate(view) {

  localStorage.setItem("activeView", view);

  const views = [
    "dashboard-global",
    "assistants-view",
    "assistant-detail",
    "clients-view",
    "tickets-view",
    "billing-view",
    "audit-view",
    "notifications-view"
  ];

  const activeViewEl = document.getElementById(`${view}-view`)
    || document.getElementById("dashboard-global");

  if (activeViewEl) {
    activeViewEl.classList.add("view-transition");
    setTimeout(() => {
      activeViewEl.classList.remove("view-transition");
    }, 300);
  }

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
      document.getElementById("dashboard-global").style.display = "block";
      renderDashboard?.();
      break;

    case "assistants":

      // reset detail panel si estaba abierto
      const detail = document.getElementById("assistant-detail");
      if (detail) {
        detail.dataset.initialized = "";
        detail.dataset.projectId = "";
        detail.style.display = "none";
      }

      await loadAssistants(false);

      document.getElementById("assistants-view").style.display = "block";

      renderAssistantsGrid?.();

      break;

    case "clients":
      document.getElementById("clients-view").style.display = "block";
      renderClientsView?.();
      break;

    case "tickets":
      document.getElementById("tickets-view").style.display = "block";
      renderTicketsView?.();
      break;

    case "billing":
      document.getElementById("billing-view").style.display = "block";
      renderBillingView?.();
      break;

    case "audit":
      document.getElementById("audit-view").style.display = "block";
      renderAuditView?.();
      break;

    case "notifications":
      document.getElementById("notifications-view").style.display = "block";
      renderNotificationsView?.();
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
    <div class="mb-4">
      <button class="btn btn-outline-light btn-sm" id="btnBackToGrid">
        <i class="bi bi-arrow-left me-2"></i> Volver a Asistentes
      </button>
    </div>

    <!-- HEADER -->
    <div class="mb-5">

      <!-- FILA 1: TITULO + BOTONES -->
      <div class="d-flex justify-content-between align-items-center mb-3">

        <!-- IZQUIERDA -->
        <h2 class="fw-bold mb-0">${project.name}</h2>

        <!-- DERECHA -->
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-light btn-rename">
            <i class="bi bi-pencil"></i> Renombrar
          </button>

          <button class="btn btn-sm btn-outline-light btn-railway">
            <i class="bi bi-folder2-open"></i> Abrir Railway
          </button>

          <button class="btn btn-sm btn-outline-danger btn-delete-project">
            <i class="bi bi-trash"></i> Eliminar
          </button>
        </div>

      </div>

      <!-- FILA 2: ESTADOS + BADGES -->
      <div class="d-flex justify-content-between align-items-center">

        <!-- IZQUIERDA: CONTADORES -->
        <div id="header-status-row"
             class="d-flex gap-4 small align-items-center">
        </div>

        <!-- DERECHA: BADGES -->
        <div id="header-badges"
             class="d-flex gap-2 flex-wrap">
        </div>

      </div>

    </div>

    <!-- LAYOUT PRINCIPAL -->
    <div class="detail-layout">

      <div class="services-column">
        <div id="services-container" class="d-grid gap-3"></div>
      </div>

      <div class="side-panel-column">
        <div id="detail-side-panel" class="side-panel-placeholder">
        </div>
      </div>

    </div>

  </div>
`;

  // Eventos header

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
        <button class="btn btn-outline-info btn-sm btn-link-client">
          <i class="bi bi-link-45deg"></i> Vincular Cliente
        </button>
      `;

    } else {

      clientBadge = `
        <button 
          class="badge badge-client-btn bg-info bg-opacity-10 text-info border border-info border-opacity-20 p-2 d-flex align-items-center gap-2">
          <i class="bi bi-person-fill"></i>
          <span>${linkedClient.clientes.nombre}</span>
        </button>
      `;

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
        <div class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 p-2 d-flex align-items-center gap-2">
          <i class="bi bi-whatsapp"></i>
          <span>Conectado</span>
        </div>
      `;
    } else {
      whatsappBadge = `
        <div class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-20 p-2 d-flex align-items-center gap-2">
          <i class="bi bi-whatsapp"></i>
          <span>Desconectado</span>
        </div>
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

function renderServices(project) {

  if (isRefreshing) return;

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

  freshProject.services.forEach(service => {
    const card = createServiceCard(service, freshProject);
    container.appendChild(card);
  });
}

function createServiceCard(service, project) {

  const div = document.createElement("div");
  div.className = "service-card p-4 rounded";
  div.dataset.serviceId = service.id;

  div.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="fw-bold service-name">${service.name}</div>

      <div class="service-status d-flex align-items-center gap-2">

        <span class="service-status-icon">
          ${getStatusIcon(service.status)}
        </span>

        <span class="service-update-container">
          ${service.isUpdatable ? `
            <button 
              class="btn btn-warning btn-sm btn-update-mini"
              title="Actualizar servicio">
              <i class="bi bi-arrow-repeat"></i>
            </button>
          ` : ""}
        </span>

      </div>
    </div>

    <div class="small text-secondary mb-3 service-date">
      Último deploy: ${formatDate(service.createdAt)}
    </div>

    <div class="d-flex justify-content-between align-items-center">

      <div class="d-flex gap-2">
        <button class="btn btn-outline-info btn-sm btn-logs" 
          ${!service.deploymentId ? "disabled" : ""}>
          <i class="bi bi-terminal"></i> Logs
        </button>

        <button class="btn btn-outline-warning btn-sm btn-vars">
          <i class="bi bi-sliders"></i> Variables
        </button>
      </div>

      <div class="d-flex gap-2 align-items-center">

        <button class="btn btn-outline-success btn-sm btn-dashboard">
          <i class="bi bi-speedometer2"></i> Dashboard
        </button>

        <button class="btn btn-outline-primary btn-sm btn-webchat">
          <i class="bi bi-chat-dots"></i> Webchat
        </button>

      </div>
    </div>
  `;

  // Eventos (IMPORTANTE: ahora no usamos onclick inline)

  div.querySelector(".btn-logs")?.addEventListener("click", () => {
    renderLogsView(service.deploymentId, service.name);
  });

  div.querySelector(".btn-vars")?.addEventListener("click", () => {
    renderVariablesView(
      service.projectId,
      service.environmentId,
      service.id,
      service.name
    );
  });

  div.querySelector(".btn-dashboard")?.addEventListener("click", () => {
    openDashboard(
      service.projectId,
      service.environmentId,
      service.id
    );
  });

  div.querySelector(".btn-webchat")?.addEventListener("click", () => {
    openWebchat(
      service.projectId,
      service.environmentId,
      service.id,
      service.name
    );
  });

  div.querySelector(".btn-delete")?.addEventListener("click", () => {
    handleDelete(service.id);
  });

  div.querySelector(".btn-update-mini")?.addEventListener("click", () => {
    handleDeployUpdate(service.id, service.environmentId);
  });

  return div;
}

function patchServices(project) {

  if (isRefreshing) return;

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
async function renderDashboard() {
  selectedProjectId = null;
  document.querySelectorAll(".assistant-item").forEach(el => el.classList.remove("active-assistant"));

  document.getElementById("assistant-detail").style.display = "none";
  document.getElementById("clients-view").style.display = "none";
  document.getElementById("tickets-view").style.display = "none";
  document.getElementById("billing-view").style.display = "none";
  document.getElementById("audit-view").style.display = "none";

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
      <div class="animate-fade mt-4">
        <h2 class="mb-4 fw-bold">DASHBOARD</h2>
        
        <div class="row g-4 mb-5">
          <!-- CARD BOTS -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100">
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
            <div class="glass-card p-4 text-center h-100" style="cursor:pointer" onclick="renderClientsView()">
              <div class="display-5 fw-bold text-info">${activeClients.length}</div>
              <div class="text-uppercase small ls-1">Clientes Activos</div>
              <div class="mt-3">
                 <button class="btn btn-sm btn-outline-info">Gestionar Clientes</button>
              </div>
            </div>
          </div>

          <!-- CARD TICKETS -->
          <div class="col-md-3">
            <div class="glass-card p-4 text-center h-100" style="cursor:pointer" onclick="renderTicketsView()">
              <div class="display-5 fw-bold text-warning">${pendingTickets.length}</div>
              <div class="text-uppercase small ls-1">Tickets Pendientes</div>
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
              <div class="text-uppercase small ls-1">Estado de Salud</div>
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
               <h5 class="mb-3">Acciones Rápidas</h5>
               <div class="d-grid gap-2">
                  <button class="btn btn-outline-light text-start btn-sm" onclick="renderClientsView()">
                    <i class="bi bi-person-plus me-2"></i> Nuevo Cliente
                  </button>
                  <button class="btn btn-outline-light text-start btn-sm" onclick="renderTicketsView()">
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

// async function init() {

//   const version = await window.api.getAppVersion();
//   const el = document.getElementById("app-version");
//   if (el) el.textContent = "v" + version;

//   await loadAssistants(false);

//   navigate("dashboard");
// }

// init();


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