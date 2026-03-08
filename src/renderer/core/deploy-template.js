// --------------------------------------------------
// DEPLOY TEMPLATE SYSTEM
// --------------------------------------------------

let selectedTemplateId = null;
let currentTemplates = [];

// --------------------------------------------------
// RENDER TEMPLATES
// --------------------------------------------------

function renderTemplates(templates) {

  const container = document.getElementById("templates-container");
  if (!container) return;

  if (!templates || templates.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-5 text-secondary">No se encontraron templates. Intentá con otra búsqueda.</div>`;
    return;
  }

  currentTemplates = templates;

  container.innerHTML = templates.map(template => {

    return `
      <div class="col-md-6">
        <div class="border border-secondary rounded p-3 h-100 d-flex flex-column bg-dark">

          <h6 class="fw-bold text-success">${template.name}</h6>

          <p class="small text-secondary mb-3" style="min-height: 40px;">
            ${template.description || "Sin descripción disponible."}
          </p>

          <div class="small mb-3">
             <span class="badge bg-secondary">${template.category || "Desconocido"}</span>
          </div>

          <div class="mt-auto">
            <button class="btn btn-outline-success btn-sm w-100"
              onclick="selectTemplate('${template.id}')">
              Seleccionar
            </button>
          </div>

        </div>
      </div>
    `;

  }).join("");

}

// --------------------------------------------------
// API ACTIONS
// --------------------------------------------------

async function performSearch() {
  const input = document.getElementById("template-search-input");
  const query = input ? input.value : "";

  const container = document.getElementById("templates-container");
  container.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border text-success" role="status"></div><div class="mt-2">Buscando en Railway...</div></div>`;

  try {
    const results = await window.api.searchTemplates(query);
    renderTemplates(results);
  } catch (error) {
    console.error("Error buscando templates:", error);
    container.innerHTML = `<div class="col-12 text-center py-5 text-danger">Error al conectar con Railway.</div>`;
  }
}

// --------------------------------------------------
// STEP CONTROL
// --------------------------------------------------

async function selectTemplate(templateId) {
  const template = currentTemplates.find(t => t.id === templateId);
  if (!template) return;

  selectedTemplateId = templateId;

  document.getElementById("deploy-step-1").style.display = "none";
  const step2 = document.getElementById("deploy-step-2");
  step2.style.display = "block";

  // Mostrar info del template
  document.getElementById("confirm-template-name").innerHTML = `
    <span class="text-success fs-4 fw-bold">${template.name}</span><br>
    <small class="text-secondary">${template.description || ""}</small>
  `;

  // --- SELECCIÓN DE CLIENTE (SOLO ADMINS) ---
  const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
  const clientSelectorContainer = document.createElement('div');
  clientSelectorContainer.id = "deploy-client-selector";
  clientSelectorContainer.className = "mb-4 text-start bg-dark p-3 rounded border border-info border-opacity-25";

  // Limpiar selector previo si existe
  const existingSelector = document.getElementById("deploy-client-selector");
  if (existingSelector) existingSelector.remove();

  if (isAdmin) {
    clientSelectorContainer.innerHTML = `<div class="text-center py-2"><div class="spinner-border spinner-border-sm text-info"></div><div class="small mt-2">Cargando clientes...</div></div>`;
    step2.querySelector('.text-center').prepend(clientSelectorContainer);

    try {
      const clients = await window.api.getClients();
      window.deployTemplateClients = clients; // Guardar temporalmente
      if (clients && clients.length > 0) {
        let options = clients.map(c => `<option value="${c.id}">${c.nombre} (${c.email || 'Sin email'})</option>`).join('');
        clientSelectorContainer.innerHTML = `
          <label class="form-label small fw-bold text-info"><i class="bi bi-person-plus-fill me-2"></i> Asignar a Cliente</label>
          <select id="deploy-selected-client" class="form-select form-select-sm bg-dark text-light border-secondary" onchange="handleDeployClientChange(this.value)">
            <option value="">-- Seleccionar Cliente --</option>
            ${options}
          </select>
          <div class="form-text mt-1 text-secondary" style="font-size: 0.7rem;">
            El proyecto se vinculará automáticamente a este cliente al finalizar.
          </div>
        `;
      } else {
        clientSelectorContainer.innerHTML = `<div class="alert alert-warning py-1 small mb-0">No hay clientes registrados en el CRM.</div>`;
      }
    } catch (err) {
      console.error("Error al cargar clientes para deploy:", err);
      clientSelectorContainer.innerHTML = `<div class="alert alert-danger py-1 small mb-0">Error al cargar clientes.</div>`;
    }
  }

  // --- VARIABLES DEL TEMPLATE ---
  const varsContainer = document.createElement('div');
  varsContainer.id = "template-vars-form";
  varsContainer.className = "mt-4 text-start bg-black bg-opacity-25 p-3 rounded border border-secondary border-opacity-25";
  varsContainer.innerHTML = `<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-success"></div><div class="small mt-2">Cargando variables requeridas...</div></div>`;

  // Reemplazar o insertar contenedor de variables
  const existingVars = document.getElementById("template-vars-form");
  if (existingVars) existingVars.remove();

  const confirmText = step2.querySelector('p.text-secondary');
  confirmText.parentNode.insertBefore(varsContainer, confirmText);

  try {
    const variables = await window.api.getTemplateVariables(templateId);
    console.log("Template Variables:", variables);

    if (variables && Array.isArray(variables) && variables.length > 0) {
      let html = `<h6 class="mb-3 text-info small fw-bold text-uppercase"><i class="bi bi-gear-fill me-2"></i> Configuración Inicial</h6>`;

      // Agrupar por servicio para mejor UI
      const services = [...new Set(variables.map(v => v.serviceName))];

      services.forEach(serviceName => {
        const serviceVars = variables.filter(v => v.serviceName === serviceName);
        html += `<div class="mb-3 fw-bold small text-secondary border-bottom border-secondary border-opacity-25 pb-1">${serviceName}</div>`;

        serviceVars.forEach(v => {
          const defaultValue = v.defaultValue || "";
          html += `
            <div class="mb-3">
              <label class="form-label small mb-0 d-flex justify-content-between">
                <span>${v.name}</span>
                ${v.defaultValue ? `<span class="text-secondary" style="font-size: 0.65rem;">Default: ${v.defaultValue}</span>` : ''}
              </label>
              <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary template-var-input" 
                data-name="${v.name}" 
                data-service="${serviceName}"
                placeholder="${v.description || ''}" 
                value="${defaultValue}">
              ${v.description ? `<div class="form-text mt-1 text-secondary" style="font-size: 0.7rem;">${v.description}</div>` : ''}
            </div>
          `;
        });
      });
      varsContainer.innerHTML = html;
    } else {
      varsContainer.innerHTML = `<div class="text-center py-2 text-secondary small">Este template no tiene variables precargadas configurables. Podrás añadirlas luego del despliegue.</div>`;
    }
  } catch (error) {
    console.error("Error al obtener variables del template:", error);
    varsContainer.innerHTML = `<div class="alert alert-warning py-2 small">No pudimos obtener la lista de variables, pero podés intentar el despliegue de todas formas.</div>`;
  }
}

function handleDeployClientChange(clientId) {
  if (!clientId || !window.deployTemplateClients) return;
  const client = window.deployTemplateClients.find(c => c.id === clientId);
  if (!client || !client.token_backoffice) return;

  // Buscar inputs de variables de template que contengan 'BACKOFFICE' y 'TOKEN' en su nombre y autocompletarlos
  const inputs = document.querySelectorAll('.template-var-input');
  inputs.forEach(input => {
    const name = input.getAttribute('data-name').toUpperCase();
    if (name.includes('BACKOFFICE') || name.includes('BACK_OFFICE') || name.includes('TOKEN_CLIENTE') || name.includes('NL_TOKEN')) {
      input.value = client.token_backoffice;
      // Añadir un pequeño efecto visual para indicar que se autocompletó
      input.classList.add('border-success');
      setTimeout(() => input.classList.remove('border-success'), 1500);
    }
  });
}

function backToSelection() {
  document.getElementById("deploy-step-1").style.display = "block";
  document.getElementById("deploy-step-2").style.display = "none";
}

async function confirmDeploy() {
  if (!selectedTemplateId) return;

  // Recolectar variables agrupadas por servicio
  const variables = {};
  const inputs = document.querySelectorAll(".template-var-input");

  inputs.forEach(input => {
    const name = input.getAttribute("data-name");
    const service = input.getAttribute("data-service");
    const value = input.value.trim();

    if (value) {
      if (!variables[service]) variables[service] = {};
      variables[service][name] = value;
    }
  });

  // Client ID para auto-vinculación
  let targetClientId = null;
  const clientSelect = document.getElementById("deploy-selected-client");
  if (clientSelect) {
    targetClientId = clientSelect.value;
  } else if (window.currentUser && window.currentUser.cliente_id) {
    targetClientId = window.currentUser.cliente_id;
  }

  const btnConfirm = document.querySelector("#deploy-step-2 .btn-success");
  const originalHtml = btnConfirm.innerHTML;
  btnConfirm.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Desplegando...`;
  btnConfirm.disabled = true;

  try {
    const result = await window.api.deployTemplate(selectedTemplateId, variables);

    if (result.success) {
      // ✅ Vincular automáticamente si hay cliente definido
      if (targetClientId) {
        try {
          await window.api.linkProjectClient(result.projectId, targetClientId);
          console.log("Auto-vinculación exitosa con cliente:", targetClientId);
        } catch (linkErr) {
          console.error("Error en auto-vinculación:", linkErr);
        }
      }

      alert(`¡Despliegue iniciado correctamente! El nuevo proyecto ha sido creado en Railway. ID: ${result.projectId}`);

      const modal = bootstrap.Modal.getInstance(document.getElementById("deployAssistantModal"));
      modal.hide();

      // Recargar lista de asistentes
      if (typeof loadAssistants === 'function') {
        setTimeout(() => loadAssistants(false), 2000);
      }
    } else {
      alert("Error al desplegar: " + (result.error || "Respuesta desconocida"));
    }
  } catch (error) {
    console.error("Error en confirmDeploy:", error);
    alert("Error crítico al intentar desplegar el template.");
  } finally {
    btnConfirm.innerHTML = originalHtml;
    btnConfirm.disabled = false;

    // Resetear visualmente para la próxima vez
    selectedTemplateId = null;
    document.getElementById("deploy-step-1").style.display = "block";
    document.getElementById("deploy-step-2").style.display = "none";
    const varsContainer = document.getElementById("template-vars-form");
    if (varsContainer) varsContainer.remove();
    const clientSelector = document.getElementById("deploy-client-selector");
    if (clientSelector) clientSelector.remove();
  }
}

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnDeployAssistant");
  if (!btn) return;

  btn.onclick = () => {
    const modal = new bootstrap.Modal(document.getElementById("deployAssistantModal"));
    modal.show();

    // Auto-búsqueda inicial si no hay resultados
    if (currentTemplates.length === 0) {
      performSearch();
    }
  };

  const btnSearch = document.getElementById("btn-search-templates");
  if (btnSearch) {
    btnSearch.onclick = performSearch;
  }

  const inputSearch = document.getElementById("template-search-input");
  if (inputSearch) {
    inputSearch.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch();
    });
  }
});