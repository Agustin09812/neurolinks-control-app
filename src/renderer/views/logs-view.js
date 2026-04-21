let logInterval = null;

let logsContext = {
    deploymentId: null
};

let logsBuffer = []; // para streaming incremental

// FIX: Permite que navigate() limpie el interval al cambiar de vista.
// Sin esto, el polling de logs seguía corriendo en background (20 req/min extra).
window.stopLogsStreaming = function () {
    if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
    }
    logsContext.deploymentId = null;
};


// --------------------------------------------------
// RENDER
// --------------------------------------------------

async function renderLogsView(deploymentId, serviceName) {

    logsContext.deploymentId = deploymentId;
    logsBuffer = []; // reset buffer

    const panel = document.getElementById("logs-view");
    if (!panel) return;

    // limpiar interval previo
    if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
    }

    // FIX: Logs se abre desde el menú de servicios, no desde navigate().
    // Necesita ocultar assistant-detail porque lo reemplaza visualmente.
    // Las demás vistas (clients, tickets, etc.) ya las maneja navigate().
    document.getElementById("assistant-detail").style.display = "none";

    // mostrar logs
    panel.style.display = "block";

    panel.innerHTML = `
            <div class="logs-panel animate-fade-up">

                <!-- HEADER -->
                <div class="logs-header">
                    <h5 class="text-info m-0">
                        <i class="bi bi-terminal me-2"></i> Logs: ${serviceName}
                    </h5>

                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-info" id="btn-download-integrated-logs">
                            <i class="bi bi-download"></i>
                        </button>

                        <button class="btn btn-sm btn-outline-light" id="btnBackLogs">
                            <i class="bi bi-arrow-left"></i>
                        </button>
                    </div>
                </div>

                <!-- TERMINAL -->
                <div id="log-terminal" class="logs-terminal">
                    <div class="text-secondary">Cargando logs...</div>
                </div>

            </div>
            `;

    // volver
    document.getElementById("btnBackLogs").onclick = () => {

        clearActiveServiceMenu();

        if (logInterval) {
            clearInterval(logInterval);
            logInterval = null;
        }

        logsContext.deploymentId = null;

        panel.style.display = "none";
        document.getElementById("assistant-detail").style.display = "block";
    };

    // descargar
    document.getElementById("btn-download-integrated-logs").onclick = async () => {
        try {
            const res = await window.api.downloadLogs(deploymentId, serviceName);
            if (res.success) {
                showToast(`Logs guardados en: ${res.path}`, "success");
            }
        } catch {
            showToast("Error al descargar logs", "danger");
        }
    };

    // primera carga
    await fetchLogs(deploymentId);

    // refresh
    logInterval = setInterval(() => fetchLogs(deploymentId), 3000);
}


// --------------------------------------------------
// FETCH LOGS (STREAMING PRO)
// --------------------------------------------------

async function fetchLogs(deploymentId) {

    // cortar si cambió contexto
    if (deploymentId !== logsContext.deploymentId) return;

    try {
        // FIX: Usar variable global `assistants` (de render.js) en vez de llamar
        // a getAssistants() cada 3s. Esto eliminaba ~20 req/min extra a la API.
        const service = assistants
            .flatMap(p => p.services)
            .find(s => s.deploymentId === deploymentId);

        if (service) {
            window.currentDeploymentStatus = service.railwayStatus;
        }
    } catch { }

    const terminal = document.getElementById("log-terminal");

    if (!terminal) {
        if (logInterval) {
            clearInterval(logInterval);
            logInterval = null;
        }
        return;
    }

    try {

        const logs = await window.api.fetchDeploymentLogs(deploymentId);

        // doble check (race condition fix)
        if (deploymentId !== logsContext.deploymentId) return;

        if (!logs || !Array.isArray(logs) || logs.length === 0) {

            if (logsBuffer.length === 0) {

                const status = window.currentDeploymentStatus;

                // DETECTAR DEPLOY
                const isDeploying =
                    status === "BUILDING" ||
                    status === "DEPLOYING";

                const isFailed =
                    status === "FAILED" ||
                    status === "CRASHED";

                if (isDeploying) {

                    terminal.innerHTML = `
                <div class="text-info mb-3">
                <div class="spinner-border spinner-border-sm me-2"></div>
                    <h5 class="fw-bold">Deployment en progreso...</h5><br>
                    Esperando logs del servicio.
                </div>
            `;

                } else if (isFailed) {

                    terminal.innerHTML = `
                <div class="text-danger mb-3">
                <div class="spinner-border spinner-border-sm me-2"></div>
                   <h5 class="fw-bold">Este deployment falló durante el build.</h5><br>
                    Railway no expone estos logs vía API.
                </div>

                <button class="btn btn-sm btn-outline-danger" id="btn-open-railway">
                    <i class="bi bi-box-arrow-up-right me-2"></i>
                    Abrir en Railway
                </button>
            `;

                    document.getElementById("btn-open-railway")?.addEventListener("click", () => {
                        if (window.currentProjectId) {
                            window.api.openExternal(
                                `https://railway.com/project/${window.currentProjectId}`
                            );
                        }
                    });

                } else {

                    terminal.innerHTML = `
                <div class="text-secondary italic">
                    No hay logs disponibles.
                </div>
            `;
                }
            }

            return;
        }

        // detectar logs nuevos
        const newLogs = logs.slice(logsBuffer.length);

        if (newLogs.length === 0) return;

        logsBuffer = logs;

        const fragment = document.createDocumentFragment();

        newLogs.forEach(l => {

            const raw = l.message || "";
            const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : '';

            let type = "info";
            let label = "INFO";

            const msg = raw.toLowerCase();

            if (msg.includes("error") || msg.includes("fail") || msg.includes("exception")) {
                type = "error";
                label = "ERROR";
            } else if (msg.includes("warn")) {
                type = "warn";
                label = "WARN";
            } else if (msg.includes("debug")) {
                type = "debug";
                label = "DEBUG";
            }

            const div = document.createElement("div");
            div.className = `log-line log-${type}`;
            div.innerHTML = `
                <span class="log-time">[${time}]</span>
                <span class="log-label">${label}</span>
                <span class="log-msg">${raw}</span>
            `;

            fragment.appendChild(div);
        });

        // limpiar "Cargando..."
        if (terminal.children.length === 1 && terminal.textContent.includes("Cargando")) {
            terminal.innerHTML = "";
        }

        const isAtBottom =
            terminal.scrollTop + terminal.clientHeight >= terminal.scrollHeight - 10;

        // append logs
        terminal.appendChild(fragment);

        // mantener máximo 1000 líneas
        while (terminal.children.length > 1000) {
            terminal.removeChild(terminal.firstChild);
        }

        // solo scrollea si YA estaba abajo
        if (isAtBottom) {
            terminal.scrollTop = terminal.scrollHeight;
        }

    } catch (err) {

        terminal.innerHTML =
            `<div class="text-danger">Error al cargar logs: ${err.message}</div>`;
    }
}