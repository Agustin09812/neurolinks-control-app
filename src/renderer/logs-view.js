
let logInterval = null;

async function renderLogsView(deploymentId, serviceName) {
    const detailPanel = document.getElementById("assistant-detail");
    // We don't hide detailPanel because we want logs BELOW it or replacing it if too big?
    // User said "debajo de la tarjeta de datos". 
    // Let's create a dedicated area at the bottom of the detail or use the secondary-view.

    // Actually, let's inject it into a specific div at the end of the detail view to keep it integrated.
    let logContainer = document.getElementById("integrated-log-container");

    if (!logContainer) {
        // If not exists, maybe we are in a state where we should use secondary-view
        // But let's assume we want it INSIDE the project detail flow.
        const detailMain = document.getElementById("assistant-detail");
        logContainer = document.createElement("div");
        logContainer.id = "integrated-log-container";
        logContainer.className = "mt-4 animate-fade-up";
        detailMain.appendChild(logContainer);
    }

    logContainer.innerHTML = `
        <div class="glass-card p-4 border-top border-info border-3">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0 text-info"><i class="bi bi-terminal me-2"></i> Logs: ${serviceName}</h5>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-info" id="btn-download-integrated-logs">
                        <i class="bi bi-download me-1"></i> Descargar
                    </button>
                    <button class="btn btn-sm btn-outline-light" id="btn-close-integrated-logs">
                        <i class="bi bi-x-lg"></i> Cerrar
                    </button>
                </div>
            </div>
            <div id="log-terminal" class="bg-black text-success p-3 rounded font-monospace small overflow-auto" style="height: 400px; line-height: 1.4; border: 1px solid #333;">
                <div class="text-secondary">Cargando logs...</div>
            </div>
        </div>
    `;

    logContainer.scrollIntoView({ behavior: 'smooth' });

    // Botones de acción
    document.getElementById("btn-close-integrated-logs").onclick = () => {
        if (logInterval) clearInterval(logInterval);
        logContainer.remove();
    };

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

    // Initial fetch
    fetchLogs(deploymentId);

    // Poll logs
    if (logInterval) clearInterval(logInterval);
    logInterval = setInterval(() => fetchLogs(deploymentId), 3000);
}

async function fetchLogs(deploymentId) {
    const terminal = document.getElementById("log-terminal");
    if (!terminal) {
        if (logInterval) clearInterval(logInterval);
        return;
    }

    try {
        const logs = await window.api.fetchDeploymentLogs(deploymentId);
        if (logs && Array.isArray(logs) && logs.length > 0) {
            // Formatear logs (Railway devuelve objetos)
            const displayLogs = logs.slice(-1000).map(l => {
                const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : '';
                const severity = l.severity ? `[${l.severity}]` : '';
                return `[${time}] ${severity} ${l.message}`;
            }).join('\n');

            terminal.innerHTML = `<pre class="mb-0" style="white-space: pre-wrap; word-break: break-all;">${displayLogs}</pre>`;
            terminal.scrollTop = terminal.scrollHeight;
        } else if (!logs || logs.length === 0) {
            terminal.innerHTML = '<div class="text-secondary italic">No hay logs disponibles para este despliegue.</div>';
        }
    } catch (err) {
        terminal.innerHTML = `<div class="text-danger">Error al cargar logs: ${err.message}</div>`;
    }
}
