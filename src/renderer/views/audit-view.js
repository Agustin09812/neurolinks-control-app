
let auditLogs = [];

async function renderAuditView() {
    console.log("Renderizando vista de auditoría...");
    // Hide other views
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";
    document.getElementById("billing-view").style.display = "none";

    // Limpiar contenedores secundarios
    ["integrated-log-container", "integrated-var-container", "integrated-chat-container"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    // Set sidebar active
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const btnAudit = document.getElementById("btn-open-audit");
    if (btnAudit) btnAudit.classList.add('active');

    const view = document.getElementById("audit-view");
    view.style.display = "block";

    view.innerHTML = `
        <div class="animate-fade">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="fw-bold mb-0 text-info">LOGS DE ACTIVIDAD</h2>
                    <p class="text-secondary small mb-0">Auditoría en tiempo real de acciones del sistema</p>
                </div>
                <div class="d-flex gap-2">
                    <div class="input-group input-group-sm" style="width: 250px;">
                        <span class="input-group-text bg-dark border-secondary text-secondary"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" id="auditSearch" placeholder="Buscar acción..." onkeyup="filterAuditLogs()">
                    </div>
                    <button class="btn btn-outline-info btn-sm" onclick="loadAuditLogs()">
                        <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
                    </button>
                </div>
            </div>

            <div class="glass-card p-0 overflow-hidden shadow-lg border-secondary">
                <div class="table-responsive">
                    <table class="table table-dark table-hover mb-0 align-middle">
                        <thead class="bg-dark-light">
                            <tr class="border-secondary">
                                <th class="ps-4">Fecha/Hora</th>
                                <th>Acción</th>
                                <th>Entidad</th>
                                <th>Detalles</th>
                                <th class="text-center">Usuario</th>
                            </tr>
                        </thead>
                        <tbody id="audit-table-body">
                            <tr>
                                <td colspan="5" class="text-center py-5">
                                    <div class="spinner-border text-info" role="status"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    loadAuditLogs();
}

async function loadAuditLogs() {
    const tbody = document.getElementById("audit-table-body");
    try {
        auditLogs = await window.api.getAuditLogs() || [];
        displayAuditLogs(auditLogs);
    } catch (err) {
        console.error("Error loading audit logs:", err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-danger">Error al cargar registros de auditoría</td></tr>';
    }
}

function displayAuditLogs(logs) {
    const tbody = document.getElementById("audit-table-body");
    tbody.innerHTML = "";

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-secondary">No hay registros de actividad</td></tr>';
        return;
    }

    logs.forEach(log => {
        const date = new Date(log.created_at);
        const tr = document.createElement("tr");
        tr.className = "border-secondary x-small";
        tr.innerHTML = `
            <td class="ps-4 text-dim">
                <div class="fw-bold text-white">${date.toLocaleDateString()}</div>
                <div>${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </td>
            <td>
                <span class="badge ${getActionBadgeClass(log.accion)}">${log.accion}</span>
            </td>
            <td>
                <div class="fw-bold">${log.entidad_tipo || '-'}</div>
                <div class="text-dim small opacity-50 font-monospace" style="font-size: 10px;">${log.entidad_id || ''}</div>
            </td>
            <td class="small opacity-75">${log.detalles || ''}</td>
            <td class="text-center">
                <div class="small fw-bold text-info">${log.usuario || 'Sistema'}</div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getActionBadgeClass(action) {
    if (!action) return 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-20';
    const a = action.toLowerCase();
    if (a.includes('delete') || a.includes('remov')) return 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20';
    if (a.includes('create') || a.includes('add')) return 'bg-success bg-opacity-10 text-success border border-success border-opacity-20';
    if (a.includes('update') || a.includes('edit')) return 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-20';
    if (a.includes('restart') || a.includes('redeploy')) return 'bg-info bg-opacity-10 text-info border border-info border-opacity-20';
    return 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-20';
}

function filterAuditLogs() {
    const query = document.getElementById("auditSearch").value.toLowerCase();
    const filtered = auditLogs.filter(log =>
        (log.accion && log.accion.toLowerCase().includes(query)) ||
        (log.entidad_tipo && log.entidad_tipo.toLowerCase().includes(query)) ||
        (log.detalles && log.detalles.toLowerCase().includes(query))
    );
    displayAuditLogs(filtered);
}
