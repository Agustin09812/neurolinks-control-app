let logInterval = null;

async function renderLogsView(deploymentId, serviceName) {

    const panel = document.getElementById("logs-view");
    if (!panel) return;

    // limpiar interval previo
    if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
    }

    // ocultar otras vistas (igual que clients/tickets)
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";
    document.getElementById("billing-view").style.display = "none";
    document.getElementById("audit-view").style.display = "none";

    // mostrar logs
    panel.style.display = "block";

    // render UI
    panel.innerHTML = `
<div class="glass-card p-4 border-top border-info border-3 animate-fade-up d-flex flex-column"
     style="height: calc(100vh - 160px);">

    <!-- HEADER -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-shrink-0">
        <h5 class="mb-0 text-info">
            <i class="bi bi-terminal me-2"></i> Logs: ${serviceName}
        </h5>

        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-info" id="btn-download-integrated-logs">
                <i class="bi bi-download me-1"></i>
            </button>

            <button class="btn btn-sm btn-outline-light" id="btnBackLogs">
                <i class="bi bi-arrow-left"></i>
            </button>
        </div>
    </div>

    <div id="log-terminal"
        class="bg-black text-success p-3 rounded font-monospace small overflow-auto flex-grow-1"
        style="min-height:0; line-height:1.4; border:1px solid #333;">
        <div class="text-secondary">Cargando logs...</div>
    </div>

</div>
`;

    // botón volver
    document.getElementById("btnBackLogs").onclick = () => {

        clearActiveServiceMenu();

        // cortar intervalo
        if (logInterval) {
            clearInterval(logInterval);
            logInterval = null;
        }

        panel.style.display = "none";
        document.getElementById("assistant-detail").style.display = "block";
    };

    // descargar logs
    document.getElementById("btn-download-integrated-logs").onclick = async () => {
        try {
            const res = await window.api.downloadLogs(deploymentId, serviceName);
            if (res.success) {
                showToast(`Logs guardados en: ${res.path}`, "success");
            }
        } catch (err) {
            showToast("Error al descargar logs", "danger");
        }
    };

    // primera carga
    fetchLogs(deploymentId);

    // auto refresh
    logInterval = setInterval(() => fetchLogs(deploymentId), 3000);
}


// --------------------------------------------------
// FETCH LOGS
// --------------------------------------------------

async function fetchLogs(deploymentId) {

    const terminal = document.getElementById("log-terminal");

    // si saliste de la vista → cortar interval
    if (!terminal) {
        if (logInterval) {
            clearInterval(logInterval);
            logInterval = null;
        }
        return;
    }

    try {

        const logs = await window.api.fetchDeploymentLogs(deploymentId);

        if (logs && Array.isArray(logs) && logs.length > 0) {

            const displayLogs = logs.slice(-1000).map(l => {

                const raw = l.message || "";
                const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : '';

                let type = "info";
                let label = "INFO";

                if (raw.includes("ERROR")) {
                    type = "error";
                    label = "ERROR";
                } else if (raw.includes("WARN")) {
                    type = "warn";
                    label = "WARN";
                } else if (raw.includes("DEBUG")) {
                    type = "debug";
                    label = "DEBUG";
                }

                return `
        <div class="log-line log-${type}">
            <span class="log-time">[${time}]</span>
            <span class="log-label">${label}</span>
            <span class="log-msg">${raw}</span>
        </div>
    `;
            }).join('');

            terminal.innerHTML = displayLogs;

            terminal.scrollTop = terminal.scrollHeight;

        } else {

            terminal.innerHTML =
                '<div class="text-secondary italic">No hay logs disponibles.</div>';

        }

    } catch (err) {

        terminal.innerHTML =
            `<div class="text-danger">Error al cargar logs: ${err.message}</div>`;

    }
}