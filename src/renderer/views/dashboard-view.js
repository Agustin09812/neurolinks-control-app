async function renderDashboardView(serviceDomain) {

  const panel = document.getElementById("detail-side-panel");
  if (!panel) return;

  let url = serviceDomain;
  if (!url.endsWith('/')) url += '/';
  url += 'dashboard';

  panel.innerHTML = `
    <div class="d-flex flex-column justify-content-center align-items-center h-100 text-center">

      <i class="bi bi-speedometer2 text-success" style="font-size:48px;"></i>

      <h4 class="mt-3 text-light">Backoffice</h4>

      <p class="text-secondary mb-4">
        Accedé al panel completo del sistema
      </p>

      <button class="btn btn-success btn-lg px-5" id="btnOpenBackoffice">
        Abrir Backoffice
      </button>

    </div>
  `;

  document.getElementById("btnOpenBackoffice").onclick = () => {
    clearActiveServiceMenu();
    openFullDashboard(url);
  };
}