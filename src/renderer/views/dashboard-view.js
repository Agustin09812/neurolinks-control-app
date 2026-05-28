async function renderDashboardView(serviceDomain) {

  const panel = document.getElementById("detail-side-panel");
  if (!panel) return;

  let url = serviceDomain;
  if (!url.endsWith('/')) url += '/';
  url += 'dashboard';

  panel.innerHTML = `
        <div class="dashboard-access h-full flex flex-col justify-center items-center text-center px-4 anim-panel-enter">
          <div class="dashboard-icon mb-2">
            <i class="bi bi-speedometer2"></i>
          </div>
          <h5 class="font-bold mb-1">
            Panel del Asistente
          </h5>
          <p class="text-white/50 mb-4 dashboard-desc">
            Accedé al backoffice completo para gestionar conversaciones, variables y configuraciones en tiempo real.
          </p>
          <div class="flex flex-col gap-2 w-full dashboard-actions">
            <button class="btn btn-success w-full" id="btnOpenBackoffice">
              <i class="bi bi-box-arrow-up-right mr-2"></i>
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
