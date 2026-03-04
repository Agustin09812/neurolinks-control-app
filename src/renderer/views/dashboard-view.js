async function renderDashboardView(serviceDomain) {

  const panel = document.getElementById("detail-side-panel");
  if (!panel) return;

  let url = serviceDomain;
  if (!url.endsWith('/')) url += '/';
  url += 'dashboard';

  panel.innerHTML = `
      <div class="glass-card p-0 border-top border-success border-3 overflow-hidden shadow-lg animate-fade-up"
          style="height: 100%; border-radius: 15px;">

          <div class="d-flex justify-content-between align-items-center p-3
                      bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-20">

              <h5 class="mb-0 text-success fw-bold">
                  <i class="bi bi-speedometer2 me-2"></i> Dashboard
              </h5>

              <div class="d-flex gap-2">

                  <button class="btn btn-sm btn-outline-info"
                      onclick="window.api.openExternal('${url}')"
                      title="Abrir en Navegador">
                      <i class="bi bi-box-arrow-up-right"></i>
                  </button>

                  <button class="btn btn-sm btn-outline-light"
                      onclick="document.getElementById('detail-side-panel').innerHTML = ''">
                      <i class="bi bi-x-lg"></i>
                  </button>

              </div>
          </div>

          <iframe src="${url}"
              style="width: 100%; height: calc(100% - 62px); border: none; background: #0a0c14;">
          </iframe>

      </div>
  `;
}