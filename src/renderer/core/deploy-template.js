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

function selectTemplate(templateId) {
  const template = currentTemplates.find(t => t.id === templateId);
  if (!template) return;

  selectedTemplateId = templateId;

  document.getElementById("deploy-step-1").style.display = "none";
  document.getElementById("deploy-step-2").style.display = "block";

  document.getElementById("confirm-template-name").innerHTML = `
    <span class="text-success fs-4 fw-bold">${template.name}</span><br>
    <small class="text-secondary">${template.description || ""}</small>
  `;
}

function backToSelection() {
  document.getElementById("deploy-step-1").style.display = "block";
  document.getElementById("deploy-step-2").style.display = "none";
}

async function confirmDeploy() {
  if (!selectedTemplateId) return;

  const btnConfirm = document.querySelector("#deploy-step-2 .btn-success");
  const originalText = btnConfirm.textContent;
  btnConfirm.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Desplegando...`;
  btnConfirm.disabled = true;

  try {
    const result = await window.api.deployTemplate(selectedTemplateId);

    if (result.success) {
      alert("¡Despliegue iniciado correctamente! El nuevo proyecto ha sido creado en Railway. Podrás verlo en la lista de asistentes en unos momentos.");

      const modal = bootstrap.Modal.getInstance(document.getElementById("deployAssistantModal"));
      modal.hide();

      // Recargar lista de asistentes
      if (typeof loadAssistants === 'function') {
        loadAssistants(false);
      }
    } else {
      alert("Error al desplegar: " + (result.error || "Respuesta desconocida"));
    }
  } catch (error) {
    console.error("Error en confirmDeploy:", error);
    alert("Error crítico al intentar desplegar el template.");
  } finally {
    btnConfirm.textContent = originalText;
    btnConfirm.disabled = false;

    // Resetear visualmente para la próxima vez
    selectedTemplateId = null;
    document.getElementById("deploy-step-1").style.display = "block";
    document.getElementById("deploy-step-2").style.display = "none";
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