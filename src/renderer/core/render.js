var assistants = [];
var selectedProjectId = null;
let renderToken = 0;

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

  window.onViewChanged?.(view);

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
      await renderDetail(updatedProject, true);
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
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div class="assistants-header-title">
          <h2 class="fw-bold mb-0">MIS ASISTENTES</h2>
          <p class="small mb-0 text-dim">
            Gestión técnica de proyectos desplegados en Railway
          </p>
        </div>
        <div class="d-flex gap-2 align-items-center assistants-controls">
          <div class="input-group input-group-sm search-input-group">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input type="text" class="form-control" id="searchAssistants">
          </div>
          <button class="btn btn-outline-light btn-sm d-none d-md-inline-flex align-items-center gap-1" id="btnRefreshAssistants">
            <i class="bi bi-arrow-clockwise"></i> Actualizar
          </button>
          <button class="btn btn-outline-light d-md-none" id="btnRefreshAssistantsMobile">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>
      <div id="assistants-grid" class="row g-4"></div>
    
  `;

  const grid = document.getElementById("assistants-grid");

  const _onRefreshAssistants = async () => {
    showToast("Actualizando asistentes...", "info");
    await loadAssistants(false);
    renderAssistantsGrid();
  };

  document.getElementById("btnRefreshAssistants")?.addEventListener("click", _onRefreshAssistants);
  document.getElementById("btnRefreshAssistantsMobile")?.addEventListener("click", _onRefreshAssistants);

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
    col.className = "col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3";
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

    const container = document.getElementById("services-container");
    const servicesRendered = container && container.childElementCount > 0;

    if (servicesRendered) {
      patchServices(project);
    } else {
      renderServices(project);
      return;
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

  <!-- TOPBAR -->
  <div class="rw-topbar mb-4">
    <!-- Fila 1: volver (izq) + refresh + ⋮ (der) -->
    <div class="d-flex justify-content-between align-items-center mb-3">
      <button class="btn btn-outline-light" id="btnBackToGrid" title="Volver a Asistentes">
        <i class="bi bi-arrow-left"></i>
      </button>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-light" id="btnRefreshProject" title="Actualizar">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
        <div class="dropdown">
          <button class="btn btn-outline-light" data-bs-toggle="dropdown" title="Opciones">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark">
            <li><button class="dropdown-item btn-rename"><i class="bi bi-pencil me-2"></i>Cambiar nombre</button></li>
            <li><button class="dropdown-item btn-railway"><i class="bi bi-box-arrow-up-right me-2"></i>Abrir Railway</button></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item text-danger btn-delete-project"><i class="bi bi-trash me-2"></i>Eliminar proyecto</button></li>
          </ul>
        </div>
      </div>
    </div>
    <!-- Fila 2: título centrado y grande -->
    <div class="text-center mb-2">
      <h4 class="fw-bold mb-0" id="project-title">${project.name}</h4>
    </div>
    <!-- Fila 3: submenu — counters + badges centrados -->
    <div class="d-flex justify-content-center align-items-center gap-3 flex-wrap pt-2" style="border-top: 1px solid var(--border-soft);">
      <div id="header-status-row" class="d-flex gap-3 small align-items-center"></div>
      <div id="header-badges" class="d-flex gap-2 flex-wrap align-items-center"></div>
    </div>
  </div>

  <!-- SERVICIOS -->
  <div id="services-container" class="d-grid gap-3"></div>

</div>
`;

  // Eventos header
  document.getElementById("btnRefreshProject")?.addEventListener("click", async () => {

    const btn = document.getElementById("btnRefreshProject");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
      await loadAssistants(true);
      btn.innerHTML = '<i class="bi bi-check-lg"></i>';
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error("Error al actualizar:", e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    }

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

    const domainEl = card.querySelector(".svc-domain-val");
    if (domainEl) {
      window.api.getServiceDomains(service.projectId, service.environmentId, service.id)
        .then(domains => {
          const domain = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain;
          domainEl.textContent = domain || 'Sin dominio público';
        })
        .catch(() => { domainEl.textContent = '—'; });
    }
  });
}

function createServiceCard(service, project, staggerIndex = 0) {

  const div = document.createElement("div");
  div.className = "service-card p-4 rounded anim-card-enter";
  div.style.setProperty("--si", staggerIndex);
  div.dataset.serviceId = service.id;

  div.innerHTML = `
  <!-- CARD HEADER -->
  <div class="rw-svc-header px-4 py-3">
    <div class="d-flex align-items-start gap-3">
      <!-- Icono a la izquierda -->
      <div class="rw-svc-icon flex-shrink-0 mt-1">
        <i class="bi bi-cpu-fill"></i>
      </div>
      <!-- Nombre + dominio -->
      <div class="flex-grow-1 min-w-0">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
          <span class="fw-bold service-name text-truncate">${service.name}</span>
          <div class="d-flex align-items-center gap-2 flex-shrink-0">
            <span class="service-status-icon">${getStatusIcon(service.status)}</span>
            ${service.isUpdatable ? `
              <button class="btn btn-warning btn-sm btn-update-mini" title="Actualizar servicio">
                <i class="bi bi-arrow-repeat"></i>
              </button>` : ""}
            <button class="btn btn-sm btn-rename-service p-0 text-dim" title="Renombrar" style="line-height:1;">
              <i class="bi bi-pencil" style="font-size:0.75rem;"></i>
            </button>
          </div>
        </div>
        <div class="x-small text-dim rw-svc-domain">
          <i class="bi bi-globe2 me-1"></i><span class="svc-domain-val">—</span>
        </div>
      </div>
    </div>
  </div>

  <!-- DEPLOY INFO -->
  <div class="rw-svc-meta px-4 py-2 d-flex align-items-center justify-content-between">
    <div class="x-small text-dim service-date">
      <i class="bi bi-clock me-1"></i> Último deploy: ${formatDate(service.createdAt)}
    </div>
  </div>

  <!-- ACTION TABS -->
  <div class="rw-svc-actions d-flex">
    <div class="service-menu-item btn-backoffice flex-fill text-center py-2">
      <i class="bi bi-box-arrow-up-right me-1"></i> Backoffice
    </div>
    <div class="rw-sep"></div>
    <div class="service-menu-item btn-logs flex-fill text-center py-2">
      <i class="bi bi-terminal me-1"></i> Logs
    </div>
    <div class="rw-sep"></div>
    <div class="service-menu-item btn-vars flex-fill text-center py-2">
      <i class="bi bi-sliders me-1"></i> Variables
    </div>
    <div class="rw-sep"></div>
    <div class="service-menu-item btn-redeploy flex-fill text-center py-2">
      <i class="bi bi-arrow-repeat me-1"></i> Redeploy
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

  div.querySelector(".btn-backoffice")?.addEventListener("click", async (e) => {

    setActiveServiceMenu(e.currentTarget);

    try {
      const domains = await window.api.getServiceDomains(service.projectId, service.environmentId, service.id);
      let domain = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain;
      if (!domain) { showToast("Este servicio no tiene dominio público", "warning"); clearActiveServiceMenu(); return; }
      if (!domain.startsWith("http")) domain = "https://" + domain;
      window.api.openDashboardWindow(domain);
    } catch {
      showToast("Error al obtener URL del servicio", "danger");
    }

  });

  div.querySelector(".btn-logs")?.addEventListener("click", () => {

    const url = `https://railway.com/project/${service.projectId}/logs?environmentId=${service.environmentId}&timeFrame=30d`;

    window.api.openDashboardWindow(url);

  });

  div.querySelector(".btn-rename-service")?.addEventListener("click", () => {

    const isMobile = window.innerWidth < 992;

    if (isMobile) {
      // Modal en mobile/tablet
      const existing = document.getElementById("renameServiceModal");
      if (existing) existing.remove();

      const modal = document.createElement("div");
      modal.className = "modal fade";
      modal.id = "renameServiceModal";
      modal.setAttribute("tabindex", "-1");
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content glass-card shadow-lg">
            <div class="modal-header border-secondary">
              <h5 class="modal-title fw-bold">Renombrar servicio</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <input type="text" class="form-control text-main" id="rename-svc-modal-input" value="${service.name.replace(/"/g, '&quot;')}">
            </div>
            <div class="modal-footer border-secondary p-3">
              <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-sm btn-success" id="btn-svc-modal-save">Guardar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();

      requestAnimationFrame(() => {
        const input = document.getElementById("rename-svc-modal-input");
        if (input) { input.focus(); input.select(); }
      });

      modal.querySelector("#btn-svc-modal-save").onclick = async () => {
        const newName = document.getElementById("rename-svc-modal-input")?.value.trim();
        if (!newName || newName === service.name) { bsModal.hide(); return; }
        window.showActionSpinner("Renombrando servicio...");
        try {
          await window.api.renameService(service.id, newName);
          service.name = newName;
          const nameEl = div.querySelector(".service-name");
          if (nameEl) nameEl.textContent = newName;
          showToast("Servicio renombrado", "success");
        } catch {
          showToast("Error al renombrar servicio", "danger");
        } finally {
          window.hideActionSpinner();
          bsModal.hide();
        }
      };

      modal.addEventListener("hidden.bs.modal", () => modal.remove());

    } else {
      // Inline en desktop
      const nameEl = div.querySelector(".service-name");
      if (!nameEl) return;
      const currentName = service.name;

      const inputWrapper = document.createElement("div");
      inputWrapper.className = "d-flex align-items-center gap-1 flex-grow-1 min-w-0";
      inputWrapper.innerHTML = `
        <input type="text" class="form-control form-control-sm svc-rename-input" style="max-width:160px;">
        <button class="btn btn-success btn-sm btn-svc-save px-2"><i class="bi bi-check-lg"></i></button>
        <button class="btn btn-outline-secondary btn-sm btn-svc-cancel px-2"><i class="bi bi-x-lg"></i></button>
      `;
      inputWrapper.querySelector(".svc-rename-input").value = currentName;

      const restoreName = () => {
        const restored = document.createElement("span");
        restored.className = "fw-bold service-name text-truncate";
        restored.textContent = service.name;
        inputWrapper.replaceWith(restored);
      };

      nameEl.replaceWith(inputWrapper);
      inputWrapper.querySelector(".svc-rename-input").focus();
      inputWrapper.querySelector(".svc-rename-input").select();

      inputWrapper.querySelector(".btn-svc-cancel").onclick = restoreName;
      inputWrapper.querySelector(".svc-rename-input").onkeydown = (e) => {
        if (e.key === "Enter") inputWrapper.querySelector(".btn-svc-save").click();
        if (e.key === "Escape") restoreName();
      };

      inputWrapper.querySelector(".btn-svc-save").onclick = async () => {
        const newName = inputWrapper.querySelector(".svc-rename-input").value.trim();
        if (!newName) return;
        if (newName === currentName) { restoreName(); return; }
        window.showActionSpinner("Renombrando servicio...");
        try {
          await window.api.renameService(service.id, newName);
          service.name = newName;
          showToast("Servicio renombrado", "success");
        } catch {
          showToast("Error al renombrar servicio", "danger");
        } finally {
          window.hideActionSpinner();
          restoreName();
        }
      };
    }

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

  window.showActionSpinner("Reiniciando servicio...");
  try {

    await window.api.redeployService(serviceId, environmentId);

    showToast("Reinicio solicitado correctamente", "success");

    await window.waitForNextChannelRun("services");

  } catch (error) {

    console.error("Error redeploy:", error);

    addNotification(
      "deploy-error",
      "Error al reiniciar servicio",
      `No se pudo reiniciar el servicio`,
      `redeploy-error-${serviceId}`
    );

    showToast("Error al solicitar reinicio", "danger");

  } finally {

    window.hideActionSpinner();

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

  window.showActionSpinner("Renombrando proyecto...");
  try {

    await window.api.updateProjectName(projectId, newName);

    bootstrap.Modal.getInstance(document.getElementById("renameProjectModal"))?.hide();

    await window.waitForNextChannelRun("services");

    showToast("Proyecto renombrado", "success");

  } catch (err) {

    showToast("Error al renombrar el proyecto", "danger");

  } finally {

    window.hideActionSpinner();

  }
};

// --------------------------------------------------
// DELETE PROJECT
// --------------------------------------------------

async function handleDeleteProject(projectId) {

  const confirmDelete = confirm(
    "¿Seguro que querés eliminar este proyecto?\n\nEsta acción es irreversible."
  );

  if (!confirmDelete) return;

  window.showActionSpinner("Eliminando proyecto...");
  try {

    await window.api.deleteProject(projectId);

    selectedProjectId = null;

    const detail = document.getElementById("assistant-detail");
    if (detail) {
      detail.dataset.initialized = "";
      detail.dataset.projectId = "";
      detail.style.display = "none";
    }

    navigate("assistants");

    await window.waitForNextChannelRun("services");

    showToast("Proyecto eliminado", "success");

  } catch (err) {

    showToast("Error al eliminar el proyecto", "danger");

  } finally {

    window.hideActionSpinner();

  }
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

  const panel = document.getElementById("detail-side-panel");

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
      // Clear skeleton so hasSideContent stays false and refresh can retry/show this state
      if (panel) panel.innerHTML = `
        <div class="p-4 text-center text-secondary small">
          <i class="bi bi-globe2 d-block mb-2 fs-4"></i>
          Este servicio no tiene dominio publico
        </div>`;
      return;
    }

    if (!domain.startsWith("http")) {
      domain = "https://" + domain;
    }

    renderDashboardView(domain);

  } catch (err) {
    console.error("Error abriendo dashboard:", err);
    // Clear skeleton so hasSideContent returns false and SmartRefresh retries on next tick
    if (panel) panel.innerHTML = "";
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

});



