// --------------------------------------------------
// SMART REFRESH AND HASH SYSTEM
// --------------------------------------------------

// lastAssistantsHash and isRefreshing use var so render.js DOMContentLoaded
// can write lastAssistantsHash = generateAssistantsHash() directly.
var lastAssistantsHash = "";
var isRefreshing = false;

let autoRefreshTimeout = null;

let refreshRate = 15000;

let userActive = true;
let idleMode = false;
let deepIdleMode = false;

let lastInteraction = Date.now();
let focusDebounceTimer = null;

function isUserInteracting() {
  const el = document.activeElement;
  if (el && el !== document.body && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  return !!(document.querySelector('.dropdown-menu.show') || document.querySelector('.modal.show'));
}

function registerActivity() {

  lastInteraction = Date.now();

  if (idleMode || deepIdleMode) {
    idleMode = false;
    deepIdleMode = false;
    console.log("Usuario activo nuevamente");

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

  const assistantsHash = assistants?.map(project =>
    project.services.map(service =>
      `${service.id}-${service.status}-${service.deploymentId || ""}`
    ).join("|")
  ).join("#") || "";

  const clientsHash = window.clientsData?.length
    ? window.clientsData.map(c =>
      `${c.id}-${c.updated_at || c.nombre || ""}`
    ).join("|")
    : "";

  const ticketsHash = window.ticketsData?.length
    ? window.ticketsData.map(t =>
      `${t.id}-${t.estado}-${t.updated_at || ""}`
    ).join("|")
    : "";

  // variablesCache excluido: no se recarga en smartRefresh,
  // incluirlo generaba falsos positivos de "cambio detectado".

  return `${assistantsHash}||${clientsHash}||${ticketsHash}`;
}

async function smartRefresh() {

  if (isRefreshing) return;

  try {

    isRefreshing = true;

    const previousHash = lastAssistantsHash;
    const activeView = localStorage.getItem("activeView");
    const isVarsVisible = document.getElementById("variables-view")?.style.display === "block";

    const apiCalls = [loadAssistants(true)];

    if (activeView === "dashboard") {
      apiCalls.push(
        window.api.getClients()
          .then(c => { window.clientsData = c; })
          .catch(() => { })
      );
      apiCalls.push(
        window.api.getTickets()
          .then(t => { window.ticketsData = t; })
          .catch(() => { })
      );
    }

    await Promise.allSettled(apiCalls);

    // Comprobar interacción DESPUÉS del fetch para capturar inputs que se abrieron durante la espera
    const interacting = isUserInteracting();

    const currentHash = generateAssistantsHash();

    if (currentHash !== previousHash && !interacting) {

      console.log("Cambios detectados en servicios");

      lastAssistantsHash = currentHash;

      const isGridVisible = document.getElementById("assistants-view")?.style.display === "block";
      if (isGridVisible) {
        patchAssistantsGrid();
      }

      if (selectedProjectId) {

        const project = assistants.find(p => p.id === selectedProjectId);

        if (project) {
          patchServices(project);
          updateDetailHeader(project);
        }

      }

    }

    if (!interacting) {
      if (activeView === "dashboard") patchDashboard();
      if (activeView === "clients") loadClientsData?.();
      if (activeView === "audit") loadAuditLogs?.();
    }

    // Variables: solo recargar si el panel está abierto, hubo cambios reales, y no hay interacción activa
    if (isVarsVisible && window.currentVarsContext && !interacting) {
      const { projectId, environmentId, serviceId } = window.currentVarsContext;
      window.api.getServiceVariables(projectId, environmentId, serviceId)
        .then(vars => {
          const newHash = JSON.stringify(vars || {});
          if (newHash !== window.lastVarsHash) {
            window.lastVarsHash = newHash;
            window.variablesCache = vars || {};
            loadVariables(projectId, environmentId, serviceId);
          }
        })
        .catch(() => { });
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

    // -------------------------
    // IDLE MODE TIERS
    // -------------------------
    const now = Date.now();
    const inactiveTime = now - lastInteraction;

    if (inactiveTime > 300000) {
      deepIdleMode = true;
      idleMode = true;
    } else if (inactiveTime > 60000) {
      idleMode = true;
      deepIdleMode = false;
    }

    // -------------------------
    // REFRESH RATES
    // -------------------------
    if (deepIdleMode) {
      refreshRate = 60000;      // deep idle: 60s
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

function scheduleImmediateRefresh() {
  if (autoRefreshTimeout) clearTimeout(autoRefreshTimeout);
  autoRefreshTimeout = setTimeout(smartRefresh, 500);
}
window.scheduleImmediateRefresh = scheduleImmediateRefresh;

// FIX: Debounce en focus para evitar múltiples cargas al alt-tab rápido
window.addEventListener("focus", () => {

  if (focusDebounceTimer) clearTimeout(focusDebounceTimer);

  focusDebounceTimer = setTimeout(async () => {

    console.log("App volvió al foco");

    registerActivity();

    if (!isRefreshing) {
      if (autoRefreshTimeout) clearTimeout(autoRefreshTimeout);
      await smartRefresh();
    }

  }, 800);

});

// Remove animation class after first play so smartRefresh never retriggers it
document.addEventListener("animationend", (e) => {
  const t = e.target;
  if (e.animationName === "card-enter")  t.classList.remove("anim-card-enter");
  if (e.animationName === "panel-enter") t.classList.remove("anim-panel-enter");
  if (e.animationName === "slide-from-right") t.classList.remove("anim-slide-right");
}, true);
