async function renderDashboardView(serviceDomain) {

  const panel = document.getElementById("detail-side-panel");
  if (!panel) return;

  let url = serviceDomain;
  if (!url.endsWith('/')) url += '/';
  url += 'dashboard';

  panel.innerHTML = `
        <div class="dashboard-access h-100 d-flex flex-column justify-content-center align-items-center text-center px-3 anim-panel-enter">
          <div class="dashboard-icon mb-2">
            <i class="bi bi-speedometer2"></i>
          </div>
          <h5 class="fw-bold mb-1">
            Panel del Asistente
          </h5>
          <p class="text-secondary mb-3 dashboard-desc">
            Accedé al backoffice completo para gestionar conversaciones, variables y configuraciones en tiempo real.
          </p>
          <div class="d-flex flex-column gap-2 w-100 dashboard-actions">
            <button class="btn btn-success w-100" id="btnOpenBackoffice">
              <i class="bi bi-box-arrow-up-right me-2"></i>
              Abrir Back Office
            </button>
          </div>
        </div>
      `;

  document.getElementById("btnOpenBackoffice").onclick = () => {
    clearActiveServiceMenu();
    openFullDashboard(url);
  };
}