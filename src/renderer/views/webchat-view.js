
async function renderWebchatView(serviceDomain, serviceName) {
    let chatContainer = document.getElementById("integrated-chat-container");

    // Si ya existe, lo removemos para recargar o simplemente scroll
    if (chatContainer) {
        chatContainer.remove();
    }

    const detailMain = document.getElementById("assistant-detail");
    chatContainer = document.createElement("div");
    chatContainer.id = "integrated-chat-container";
    chatContainer.className = "mt-4 animate-fade-up";
    detailMain.appendChild(chatContainer);

    // Asegurarnos que el dominio sea correcto
    let url = serviceDomain;
    if (!url.endsWith('/')) url += '/';
    url += 'webchat';

    chatContainer.innerHTML = `
        <div class="glass-card p-0 border-top border-primary border-3 overflow-hidden shadow-lg" style="height: 700px; border-radius: 15px;">
            <div class="d-flex justify-content-between align-items-center p-3 bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-20">
                <h5 class="mb-0 text-primary fw-bold">
                    <i class="bi bi-chat-dots me-2"></i> Webchat: ${serviceName}
                </h5>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-info" onclick="window.api.openExternal('${url}')" title="Abrir en Navegador">
                        <i class="bi bi-box-arrow-up-right"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-light" onclick="document.getElementById('integrated-chat-container').remove()">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
            <iframe src="${url}" 
                    style="width: 100%; height: calc(700px - 62px); border: none; background: #f8f9fa;"
                    allow="clipboard-read; clipboard-write; microphone; camera">
            </iframe>
        </div>
    `;

    chatContainer.scrollIntoView({ behavior: 'smooth' });
}
