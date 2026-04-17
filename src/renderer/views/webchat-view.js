async function renderWebchatView(serviceDomain, serviceName) {

  let url = serviceDomain;
  if (!url.endsWith('/')) url += '/';
  url += 'webchat';

  // 🔥 ocultar todo
  document.getElementById("assistant-detail").style.display = "none";
  document.getElementById("logs-view").style.display = "none";
  document.getElementById("variables-view").style.display = "none";

  const view = document.getElementById("webchat-view");
  if (!view) return;

  view.style.display = "block";

  view.innerHTML = `
      <div class="animate-fade mt-4">

        <!-- HEADER -->
        <div class="d-flex justify-content-between align-items-center mb-4">

          <h5 class="fw-bold text-info mb-0">
            <i class="bi bi-chat-dots me-2"></i>
            Webchat: ${serviceName}
          </h5>

          <div class="d-flex gap-2">

            <button class="btn btn-outline-info btn-sm"
              onclick="window.api.openExternal('${url}')">
              <i class="bi bi-box-arrow-up-right"></i>
            </button>

            <button class="btn btn-outline-light btn-sm" id="btnBackToDetail">
              <i class="bi bi-arrow-left"></i>
            </button>

          </div>

        </div>

        <!-- IFRAME FULL -->
        <div class="glass-card p-0 overflow-hidden" style="height: calc(100vh - 180px);">

          <iframe 
            src="${url}"
            style="width:100%; height:100%; border:none; background:#0a0c14;"
            allow="clipboard-read; clipboard-write; microphone; camera">
          </iframe>

        </div>

      </div>
    `;

  // volver al detalle
  document.getElementById("btnBackToDetail").onclick = () => {

    clearActiveServiceMenu();

    view.style.display = "none";

    const detail = document.getElementById("assistant-detail");
    detail.style.display = "block";

  };

}