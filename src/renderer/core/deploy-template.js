// --------------------------------------------------
// DEPLOY TEMPLATE SYSTEM
// --------------------------------------------------

let selectedTemplateId = null;
let allTemplates = [];

// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderTemplates(templates) {
  const container = document.getElementById("templates-container");
  if (!container) return;

  if (!templates || templates.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-5 text-dim">No se encontraron templates.</div>`;
    return;
  }

  container.innerHTML = templates.map(template => `
    <div class="col-md-6">
      <div class="template-card" onclick="selectTemplate('${template.id}')">
        <div class="d-flex gap-3">
          <div class="template-icon">
            <i class="bi bi-box"></i>
          </div>
          <div class="flex-grow-1 overflow-hidden">
            <div class="d-flex align-items-start justify-content-between gap-2 mb-1">
              <div class="template-name">${template.name}</div>
              <span class="template-badge">${template.category || 'General'}</span>
            </div>
            <p class="template-desc mb-0">${template.description || 'Sin descripcion disponible.'}</p>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

function filterTemplates(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    renderTemplates(allTemplates);
    return;
  }
  const filtered = allTemplates.filter(t =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q) ||
    (t.category || '').toLowerCase().includes(q)
  );
  renderTemplates(filtered);
}

// --------------------------------------------------
// API
// --------------------------------------------------

async function loadAllTemplates() {
  const container = document.getElementById("templates-container");
  if (!container) return;

  container.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border text-success" role="status"></div><div class="mt-2 text-dim">Cargando templates...</div></div>`;

  try {
    allTemplates = await window.api.searchTemplates("") || [];
    filterTemplates(document.getElementById("template-search-input")?.value || "");
  } catch (error) {
    console.error("Error cargando templates:", error);
    container.innerHTML = `<div class="col-12 text-center py-5 text-danger">Error al conectar con Railway.</div>`;
  }
}

// --------------------------------------------------
// STEP CONTROL
// --------------------------------------------------

function selectTemplate(templateId) {
  const template = allTemplates.find(t => t.id === templateId);
  if (!template) return;

  selectedTemplateId = templateId;

  document.getElementById("deploy-step-1").style.display = "none";
  document.getElementById("deploy-step-2").style.display = "block";

  document.getElementById("confirm-template-name").textContent = template.name;
  document.getElementById("confirm-template-desc").textContent = template.description || "";
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
      alert("Despliegue iniciado. El nuevo proyecto aparecera en la lista de asistentes en unos momentos.");

      const modal = bootstrap.Modal.getInstance(document.getElementById("deployAssistantModal"));
      modal.hide();

      if (typeof loadAssistants === 'function') loadAssistants(false);
    } else {
      alert("Error al desplegar: " + (result.error || "Respuesta desconocida"));
    }
  } catch (error) {
    console.error("Error en confirmDeploy:", error);
    alert("Error critico al intentar desplegar el template.");
  } finally {
    btnConfirm.textContent = originalText;
    btnConfirm.disabled = false;

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
    if (allTemplates.length === 0) loadAllTemplates();
  };

  const inputSearch = document.getElementById("template-search-input");
  if (inputSearch) {
    inputSearch.addEventListener("input", (e) => filterTemplates(e.target.value));
  }
});
