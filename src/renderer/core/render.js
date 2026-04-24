var assistants = [];
var selectedProjectId = null;
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
// ROUTER CENTRAL DE NAVEGACION
// ========================================

async function navigate(view) {

  window.stopLogsStreaming?.();
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';

  localStorage.setItem("activeView", view);

  const viewMap = {
    dashboard: "dashboard-global",
    assistants: "assistants-view",
    clients: "clients-view",
    audit: "audit-view",
  };

  const views = Object.values(viewMap).concat([
    "assistant-detail",
    "logs-view",
    "variables-view",
    "tickets-view",
    "billing-view",
  ]);

  const activeViewEl = document.getElementById(viewMap[view]);

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

  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(`.sidebar-item[data-view="${view}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  switch (view) {

    case "dashboard":
      document.getElementById(viewMap.dashboard).style.display = "block";
      renderDashboard?.();
      break;

    case "assistants": {

      const detail = document.getElementById("assistant-detail");
      if (detail) {
        detail.dataset.initialized = "";
        detail.dataset.projectId = "";
        detail.style.display = "none";
      }

      document.getElementById(viewMap.assistants).style.display = "block";

      if (assistants.length > 0) {
        renderAssistantsGrid?.();
        loadAssistants(false);
      } else {
        const _skCard = `
          <div class="col-xl-3 col-lg-4 col-md-6">
            <div class="glass-card p-4 h-100">
              <div class="d-flex align-items-start gap-3 mb-4">
                <div class="skeleton flex-shrink-0" style="width:44px;height:44px;border-radius:12px"></div>
                <div class="flex-grow-1">
                  <div class="skeleton mb-2" style="height:15px;width:70%"></div>
                  <div class="skeleton" style="height:22px;width:90px;border-radius:20px"></div>
                </div>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                <div class="skeleton" style="height:20px;width:80px;border-radius:10px"></div>
                <div class="skeleton" style="height:20px;width:60px;border-radius:10px"></div>
              </div>
            </div>
          </div>`;
        document.getElementById(viewMap.assistants).innerHTML = `
          <div class="mt-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 class="fw-bold mb-0">MIS ASISTENTES</h2>
                <p class="small mb-0 text-dim">Gestión técnica de proyectos desplegados en Railway</p>
              </div>
            </div>
            <div class="row g-4">${_skCard.repeat(4)}</div>
          </div>`;
        await loadAssistants(false);
      }
      break;
    }

    case "clients":
      document.getElementById(viewMap.clients).style.display = "block";
      renderClientsView?.();
      break;

    case "audit":
      document.getElementById(viewMap.audit).style.display = "block";
      renderAuditView?.();
      break;

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
    // Fallback por si no existe el contenedor
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


// ========================================
// ASISTANTS GRID VIEW
// ========================================

function renderAssistantsGrid() {

  const container = document.getElementById("assistants-view");
  if (!container) return;

  container.innerHTML = `
    <div class="mt-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 class="fw-bold mb-0">MIS ASISTENTES</h2>
          <p class="small mb-0 text-dim">
            Gestión técnica de proyectos desplegados en Railway
          </p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <div class="input-group input-group-sm search-input-group">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input type="text" class="form-control" id="searchAssistants">
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

  assistants.forEach((project, index) => {

    const statusColor = getStatusColor(project.status);

    const col = document.createElement("div");
    col.className = "col-xl-3 col-lg-4 col-md-6";
    const hasUpdate = project.services.some(s => s.isUpdatable);

    col.innerHTML = `
      <div class="glass-card p-4 h-100 assistant-card hover-lift clickable anim-card-enter"
      style="--si:${index}"
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

      // Mensaje vacio
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

    const statusColor = getStatusColor(project.status);

    badge.className = `badge bg-${statusColor} bg-opacity-10 text-${statusColor} border border-${statusColor} border-opacity-25`;

    badge.innerText = project.status.toUpperCase();

    // Sync "Actualización disponible" badge
    const hasUpdate = project.services.some(s => s.isUpdatable);
    const updateBadge = card.querySelector(".badge.bg-warning.text-dark.small");
    if (hasUpdate && !updateBadge) {
      const servicesDiv = card.querySelector(".small.text-dim.gap-2");
      if (servicesDiv) {
        servicesDiv.insertAdjacentHTML('beforeend', `
          <span class="badge bg-warning text-dark small px-2 py-1">
            <i class="bi bi-arrow-repeat"></i> Actualización disponible
          </span>
        `);
      }
    } else if (!hasUpdate && updateBadge) {
      updateBadge.remove();
    }

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

  // Asegura que el panel siempre sea visible (navigate() se esconde cuando cambia de views)
  ["dashboard-global", "clients-view", "tickets-view", "billing-view", "audit-view"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  detailPanel.style.display = "block";

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

  document.getElementById("dashboard-global").style.display = "none";
  document.getElementById("clients-view").style.display = "none";
  document.getElementById("tickets-view").style.display = "none";
  document.getElementById("billing-view").style.display = "none";
  document.getElementById("audit-view").style.display = "none";

  const detail = document.getElementById("assistant-detail");
  detail.style.display = "block";

  detail.innerHTML = `
<div class="anim-slide-right">

  <!-- BOTÓN VOLVER -->
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
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
        <div id="header-badges" class="d-flex gap-2 flex-wrap"></div>

      </div>

      <!-- SERVICIOS -->
      <div id="services-container" class="d-grid gap-3"></div>

    </div>

    <!-- COLUMNA DERECHA -->
    <div class="side-panel-column">
      <div id="detail-side-panel" class="side-panel-placeholder">
        <div class="p-3 d-flex flex-column gap-3">
          <div class="skeleton" style="height:18px;width:48%;border-radius:6px"></div>
          <div class="skeleton" style="height:52px;border-radius:8px"></div>
          <div class="skeleton" style="height:52px;border-radius:8px"></div>
          <div class="skeleton" style="height:38px;border-radius:8px"></div>
        </div>
      </div>
    </div>

  </div>

</div>
`;

  // Eventos header
  document.getElementById("btnRefreshProject")?.addEventListener("click", async () => {

    showToast("Actualizando proyecto...", "info");

    await loadAssistants(true);

  });

  document.getElementById("btnBackToGrid").onclick = async () => {
    selectedProjectId = null;

    detail.dataset.initialized = "";
    detail.dataset.projectId = "";

    detail.classList.add("is-exiting");
    await new Promise(r => setTimeout(r, 180));
    detail.classList.remove("is-exiting");
    detail.style.display = "none";

    const assistantsView = document.getElementById("assistants-view");
    assistantsView.innerHTML = "";
    assistantsView.style.display = "block";
    renderAssistantsGrid();
    loadAssistants(false);
  };

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
  const titleEl = document.getElementById("project-title");

  if (!badgesContainer || !statusContainer) return;

  // =========================
  // TITULO
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

  if (project.id !== selectedProjectId) return;

  const container = document.getElementById("services-container");
  if (!container) return;

  container.innerHTML = "";

  const freshProject = assistants.find(a => a.id === project.id);

  if (!freshProject || !freshProject.services || freshProject.services.length === 0) {
    return;
  }

  freshProject.services.forEach((service, index) => {
    const card = createServiceCard(service, freshProject, index);
    container.appendChild(card);
  });

  const sidePanel = document.getElementById("detail-side-panel");
  if (sidePanel) {
    // Cualquier observador previo: desconectado
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

function createServiceCard(service, project, staggerIndex = 0) {

  const div = document.createElement("div");
  div.className = "service-card p-4 rounded anim-card-enter";
  div.style.setProperty("--si", staggerIndex);
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

// --------------------------------------------------
// RENAME PROJECT
// --------------------------------------------------

function openRenameProject(projectId, currentName) {

  document.getElementById("renameProjectId").value = projectId;
  document.getElementById("renameProjectName").value = currentName;

  const modal = bootstrap.Modal.getOrCreateInstance(
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
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
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
      showToast("Este servicio no tiene dominio público.", "warning");
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

}

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
  let savedView = localStorage.getItem("activeView") || "dashboard";
  if (savedView === "tickets" || savedView === "billing") savedView = "clients";
  navigate(savedView);
  document.body.classList.remove("app-preload");
  startAutoRefresh();

  // btn-updates listener consolidados!!
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
  // BOTON ABOUT
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


// --------------------------------------------------
// EXTERNAL SELECTION (MESSAGING FROM OTHER WINDOWS)
// --------------------------------------------------
window.api.onSelectProject((projectId) => {
  const project = assistants.find(p => p.id === projectId);
  if (project) renderDetail(project);
  else console.warn("Project not found:", projectId);
});