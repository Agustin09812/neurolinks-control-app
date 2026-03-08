async function renderBackofficeView(serviceDomain, backofficeToken) {
  const panel = document.getElementById("detail-side-panel");
  if (!panel) return;
  panel.dataset.view = "backoffice";

  let url = serviceDomain;
  if (!url.endsWith('/')) url += '/';
  url += 'backoffice';

  // Si tenemos token, podemos intentar pasarlo (dependiendo de cómo lo reciba el backoffice)
  // Generalmente lo guardamos en el iframe o lo pasamos por query si el backoffice lo soporta
  // Para este caso, solo vamos a mostrar la URL, pero el usuario ya tiene el token en su cliente

  panel.innerHTML = `
      <div class="glass-card p-0 border-top border-info border-3 overflow-hidden shadow-lg animate-fade-up"
          style="height: 100%; border-radius: 15px;">

          <div class="d-flex justify-content-between align-items-center p-3
                      bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-20">

              <h5 class="mb-0 text-info fw-bold">
                  <i class="bi bi-shield-lock me-2"></i> Backoffice
              </h5>

              <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-info"
                      onclick="window.api.openExternal('${url}')"
                      title="Abrir en Navegador">
                      <i class="bi bi-box-arrow-up-right"></i>
                  </button>

                  <button class="btn btn-sm btn-outline-light"
                      onclick="closeSidePanel()">
                      <i class="bi bi-x-lg"></i>
                  </button>
              </div>
          </div>

          <div class="p-2 bg-info bg-opacity-10 border-bottom border-info border-opacity-20 flex-shrink-0">
            <div class="d-flex align-items-center justify-content-between px-2">
              <span class="small text-info">
                <i class="bi bi-key-fill me-1"></i> Token: <strong>${backofficeToken || 'No configurado'}</strong>
              </span>
              <button class="btn btn-link btn-sm text-info p-0 text-decoration-none" 
                      onclick="navigator.clipboard.writeText('${backofficeToken || ''}'); showToast('Token copiado', 'info')">
                <i class="bi bi-clipboard"></i> Copiar
              </button>
            </div>
          </div>

          <iframe src="${url}"
              style="width: 100%; height: calc(100% - 95px); border: none; background: #0a0c14;">
          </iframe>

      </div>
  `;
}
