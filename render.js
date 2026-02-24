let assistants = [];
let selectedProjectId = null;


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

    item.className =
      "assistant-item d-flex align-items-center justify-content-between px-2 py-2 rounded text-light";

    item.style.cursor = "pointer";
    item.dataset.id = a.id;

    item.innerHTML = `
      <div class="d-flex align-items-center justify-content-between w-100">
        <div class="sidebar-name">
          ${a.name}
        </div>
        <div class="ms-2">
          ${getStatusIcon(a.status)}
        </div>
      </div>
    `;

    item.onclick = () => {

      selectedProjectId = a.id;

      document.querySelectorAll(".assistant-item").forEach(el => {
        el.classList.remove("active-assistant");
      });

      item.classList.add("active-assistant");
      renderDetail(a);
    };

    list.appendChild(item);
  });

  if (!selectedProjectId && assistants.length > 0) {
    list.firstChild.click();
  }
}


// --------------------------------------------------
// DETAIL PANEL
// --------------------------------------------------

function renderDetail(a) {

  selectedProjectId = a.id;

  const detail = document.getElementById("assistant-detail");

  const online = a.services.filter(s => s.status === "online").length;
  const error = a.services.filter(s => s.status === "error").length;
  const building = a.services.filter(s => s.status === "checking").length;

  // --------------------------------------------------
  // SERVICES HTML
  // --------------------------------------------------

  let servicesHtml = "";

  if (!a.services || a.services.length === 0) {

    servicesHtml = `
      <div class="service-card p-5 rounded d-flex align-items-center justify-content-center text-center"
           style="cursor:pointer; border:2px dashed #444;"
           onclick="window.api.openExternal('${a.railwayUrl}')">

        <div>
          <i class="bi bi-plus-circle fs-1 text-secondary"></i>
          <div class="mt-3 fw-bold text-secondary">
            Crear Servicio
          </div>
          <div class="small text-muted mt-1">
            Crear servicio en Railway
          </div>
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

    <div class="small text-secondary mb-3">
      Último deploy: ${formatDate(service.createdAt)}
    </div>

    <div class="d-flex justify-content-between align-items-center">

      <!-- Grupo izquierdo (acciones técnicas) -->
      <div class="d-flex gap-2">

        <button class="btn btn-outline-info btn-sm"
          data-bs-toggle="tooltip"
          title="Logs"
          ${!service.deploymentId ? "disabled" : ""}
          onclick="window.api.openLogs('${service.deploymentId}')">
          <i class="bi bi-terminal"></i>
        </button>

        <button class="btn btn-outline-warning btn-sm"
          data-bs-toggle="tooltip"
          title="Variables"
          onclick="window.api.openVariables(
            '${service.projectId}',
            '${service.environmentId}',
            '${service.id}'
          )">
          <i class="bi bi-sliders"></i>
        </button>

      </div>

      <!-- Grupo derecho (acciones de producto + menú) -->
      <div class="d-flex gap-2 align-items-center">

        <button class="btn btn-success btn-sm"
          data-bs-toggle="tooltip"
          title="Dashboard"
          onclick="openDashboard(
            '${service.projectId}',
            '${service.environmentId}',
            '${service.id}'
          )">
          <i class="bi bi-speedometer2"></i>
        </button>

        <button class="btn btn-primary btn-sm"
          data-bs-toggle="tooltip"
          title="Webchat"
          onclick="openWebchat(
            '${service.projectId}',
            '${service.environmentId}',
            '${service.id}'
          )">
          <i class="bi bi-chat-dots"></i>
        </button>

        <div class="dropdown">
          <button class="btn btn-sm btn-outline-light dropdown-toggle"
            data-bs-toggle="dropdown">
            <i class="bi bi-three-dots-vertical"></i>
          </button>

          <ul class="dropdown-menu dropdown-menu-dark">

            <li>
              <button class="dropdown-item"
                onclick="handleRedeploy('${service.id}', '${service.environmentId}')">
                <i class="bi bi-arrow-clockwise me-2"></i>Redeploy
              </button>
            </li>

            <li><hr class="dropdown-divider"></li>

            <li>
              <button class="dropdown-item text-danger"
                onclick="handleDelete('${service.id}')">
                <i class="bi bi-trash me-2"></i>Remove
              </button>
            </li>

          </ul>
        </div>

      </div>

    </div>

  </div>

`).join("");

  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  detail.innerHTML = `

    <div class="d-flex align-items-center justify-content-between mb-4">

      <div class="d-flex align-items-center gap-3">

  <div class="d-flex align-items-center gap-2">
    <h3 class="mb-0">${a.name}</h3>

    <button class="btn btn-sm btn-outline-light"
      onclick="openRenameProject('${a.id}', \`${a.name}\`)"
      title="Renombrar proyecto">
      <i class="bi bi-pencil"></i>
    </button>
  </div>

  <button class="btn btn-sm btn-outline-light"
    title="Abrir proyecto en Railway"
    onclick="window.api.openExternal('${a.railwayUrl}')">
    <i class="bi bi-folder2-open"></i>
  </button>

  <button class="btn btn-sm btn-outline-light"
    title="Refrescar estado"
    onclick="loadAssistants(true)">
    <i class="bi bi-arrow-repeat"></i>
  </button>

  <button class="btn btn-sm btn-outline-danger"
    title="Eliminar proyecto"
    onclick="handleDeleteProject('${a.id}')">
    <i class="bi bi-trash"></i>
  </button>

</div>

    </div>

    <div class="d-flex gap-4 mb-4 small">
      <div><i class="bi bi-check-circle-fill text-success"></i> ${online} Online</div>
      <div><i class="bi bi-x-circle-fill text-danger"></i> ${error} Error</div>
      <div><i class="bi bi-arrow-repeat text-warning"></i> ${building} Building</div>
    </div>

    <div class="d-grid gap-3"
         style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
      ${servicesHtml}
    </div>

  `;

  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );

  tooltipTriggerList.forEach(el => {

    const tooltip = new bootstrap.Tooltip(el, {
      trigger: 'hover'
    });

    // Forzar ocultado al hacer click
    el.addEventListener('click', () => {
      tooltip.hide();
    });

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

  try {

    await window.api.redeployService(serviceId, environmentId);

    // refresco inmediato
    await loadAssistants(true);

  } catch (error) {
    console.error("Error redeploy:", error);
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

// --------------------------------------------------
// INIT
// --------------------------------------------------

loadAssistants();