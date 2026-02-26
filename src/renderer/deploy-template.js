// --------------------------------------------------
// DEPLOY TEMPLATE SYSTEM
// --------------------------------------------------

let selectedTemplateLink = null;

const assistantTemplates = [

  // -----------------------------------------
  // META YCLOUD (PRIORIDAD ALTA)
  // -----------------------------------------

  {
    name: "Bot MonoAgente Meta Ycloud",
    description: "Integración Meta + Ycloud (monoagente).",
    link: "https://railway.com/deploy/bot-railway-meta",
    required: [],
    notes: ""
  },

  {
    name: "Bot MultiAgente Meta Ycloud",
    description: "Multiagente con integración Meta + Ycloud.",
    link: "https://railway.com/deploy/bot-railway-multiagente-meta-5",
    required: [],
    notes: ""
  },

  // -----------------------------------------
  // UTILIDAD
  // -----------------------------------------

  {
    name: "Obtener ID Grupo",
    description: "Bot para listar JID de grupos. Responde únicamente al mensaje #LISTAR_GRUPOS#.",
    link: "https://railway.com/deploy/capable-celebration?referralCode=yO-oOz",
    required: [],
    notes: ""
  },

  // -----------------------------------------
  // RESTO DE TEMPLATES
  // -----------------------------------------

  {
    name: "Ejemplo Básico Test",
    description: "Bot para test, funciones básicas estilo Neurolinks. Ideal para pruebas en entorno real.",
    link: "https://railway.com/deploy/pleasant-simplicity?referralCode=yO-oOz",
    required: [
      "ID ASISTENTE",
      "ID ASISTENTE IMAGEN",
      "APIKEY OPENAI",
      "APIKEY OPENAI IMAGEN",
      "JID GRUPO WHATSAPP"
    ],
    notes: "Incluye reconocimiento de imágenes y requiere asistente especializado."
  },

  {
    name: "Ejemplo MultiAgente Test",
    description: "Bot multiagente con recepcionista + 4 asistentes.",
    link: "https://railway.com/deploy/botmultiagente5?referralCode=yO-oOz",
    required: [
      "ID ASISTENTE",
      "APIKEY OPENAI",
      "JID GRUPO WHATSAPP"
    ],
    notes: "Respetar número de asistentes definido en el prompt."
  },

  {
    name: "Ejemplo Analizador de Imágenes",
    description: "Bot con reconocimiento y análisis de imágenes.",
    link: "https://railway.com/deploy/bot-img-test?referralCode=yO-oOz",
    required: [
      "ID ASISTENTE",
      "ID ASISTENTE IMAGEN",
      "APIKEY OPENAI",
      "APIKEY OPENAI IMAGEN",
      "JID GRUPO WHATSAPP"
    ],
    notes: ""
  },

  {
    name: "Bot Restaurant API Riservi",
    description: "Gestiona reservas del restaurante RESTO-TEST.",
    link: "https://railway.com/deploy/bot-restaurant-api-riservi-muestra",
    required: [
      "ID ASISTENTE",
      "APIKEY OPENAI",
      "APIKEY RISERVI"
    ],
    notes: ""
  },

  {
    name: "Bot API Commit",
    description: "Bot para integración con API commit.",
    link: "https://railway.com/deploy/bot-rialway-api-commit",
    required: [],
    notes: ""
  },

  {
    name: "Bot Empresas Agua API SWS",
    description: "Bot para empresas de agua con API SWS.",
    link: "https://railway.com/deploy/bot-apisws",
    required: [],
    notes: ""
  }

];

// --------------------------------------------------
// RENDER TEMPLATES
// --------------------------------------------------

function renderTemplates() {

  const container = document.getElementById("templates-container");
  if (!container) return;

  container.innerHTML = assistantTemplates.map(template => {

    const requiredList = template.required.length > 0
      ? `<ul class="mb-1">${template.required.map(r => `<li>${r}</li>`).join("")}</ul>`
      : `<div class="text-muted">No requiere configuración inicial</div>`;

    return `
      <div class="col-md-6">
        <div class="border border-secondary rounded p-3 h-100 d-flex flex-column">

          <h6 class="fw-bold">${template.name}</h6>

          <p class="small text-secondary">
            ${template.description}
          </p>

          <div class="small mb-2">
            <strong>Datos requeridos:</strong>
            ${requiredList}
          </div>

          ${template.notes ? `<div class="small text-muted mb-3">${template.notes}</div>` : ""}

          <div class="mt-auto">
            <button class="btn btn-success btn-sm w-100"
              onclick="selectTemplate('${template.name}', '${template.link}')">
              Seleccionar
            </button>
          </div>

        </div>
      </div>
    `;

  }).join("");

}

// --------------------------------------------------
// STEP CONTROL
// --------------------------------------------------

function selectTemplate(name, link) {

  selectedTemplateLink = link;

  document.getElementById("deploy-step-1").style.display = "none";
  document.getElementById("deploy-step-2").style.display = "block";

  document.getElementById("confirm-template-name").textContent =
    `Estás por desplegar: ${name}`;
}

function backToSelection() {

  document.getElementById("deploy-step-1").style.display = "block";
  document.getElementById("deploy-step-2").style.display = "none";
}

function confirmDeploy() {

  if (!selectedTemplateLink) return;

  window.api.openExternal(selectedTemplateLink);

  const modal = bootstrap.Modal.getInstance(
    document.getElementById("deployAssistantModal")
  );

  modal.hide();

  selectedTemplateLink = null;

  document.getElementById("deploy-step-1").style.display = "block";
  document.getElementById("deploy-step-2").style.display = "none";
}

// --------------------------------------------------
// OPEN MODAL
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  const btn = document.getElementById("btnDeployAssistant");
  if (!btn) return;

  btn.onclick = () => {

    renderTemplates();

    const modal = new bootstrap.Modal(
      document.getElementById("deployAssistantModal")
    );

    modal.show();
  };

});