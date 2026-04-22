let auditLogs = [];
let filteredAuditLogs = [];

async function renderAuditView() {
    // FIX: Ocultamiento de vistas se maneja en navigate()

    ["integrated-log-container", "integrated-var-container"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    const view = document.getElementById("audit-view");
    view.style.display = "block";

    view.innerHTML = `
        <div class="animate-fade">

            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                <div>
                    <h2 class="fw-bold mb-0">REGISTRO DE ACTIVIDAD</h2>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                    <div class="input-group input-group-sm search-input-group">
                        <span class="input-group-text bg-dark border-secondary text-secondary">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="text" class="form-control text-main" id="auditSearch" onkeyup="filterAuditLogs()">
                    </div>
                    <button class="btn btn-outline-light btn-sm" onclick="loadAuditLogs()">
                        <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
                    </button>
                </div>
            </div>

            <div class="glass-card p-0 overflow-hidden rounded">
                <div class="table-responsive audit-table-scroll">
                    <table class="table table-hover mb-0 align-middle">
                        <thead>
                            <tr>
                                <th>Fecha/Hora</th>
                                <th>Acción</th>
                                <th>Entidad</th>
                                <th>Detalles</th>
                                <th class="text-center">Usuario</th>
                            </tr>
                        </thead>
                        <tbody id="audit-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    filteredAuditLogs = [...auditLogs];
    renderAuditLogs();
    loadAuditLogs();
}


// --------------------------------------------------
// LOAD
// --------------------------------------------------

async function loadAuditLogs() {

    const tbody = document.getElementById("audit-table-body");
    if (!tbody) return;

    try {

        auditLogs = await window.api.getAuditLogs() || [];

        auditLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Preservar el filtro de búsqueda activo si hay uno
        const searchEl = document.getElementById("auditSearch");
        if (searchEl?.value) {
            filterAuditLogs();
        } else {
            filteredAuditLogs = [...auditLogs];
            renderAuditLogs();
        }

    } catch (err) {

        console.error(err);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-danger">
                    Error al cargar auditoría
                </td>
            </tr>
        `;
    }
}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderAuditLogs() {

    const tbody = document.getElementById("audit-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (filteredAuditLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-dim">Sin registros</td></tr>`;
        return;
    }

    filteredAuditLogs.forEach(log => {

        const date = new Date(log.created_at);

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <div class="fw-bold">${date.toLocaleDateString()}</div>
                <div class="small text-dim">${date.toLocaleTimeString()}</div>
            </td>

            <td>
                <span class="badge ${getActionBadgeClass(log.accion)}">
                    ${log.accion}
                </span>
            </td>

            <td>
                <div>${log.entidad_tipo || '-'}</div>
                <div class="small text-dim">${log.entidad_id || ''}</div>
            </td>

            <td class="small">${log.detalles || ''}</td>

            <td class="text-center small">
                ${log.usuario || 'Sistema'}
            </td>
        `;

        tbody.appendChild(tr);
    });
}


// --------------------------------------------------
// FILTRO
// --------------------------------------------------

function filterAuditLogs() {

    const query = document.getElementById("auditSearch").value.toLowerCase();

    filteredAuditLogs = auditLogs.filter(log =>
        (log.accion && log.accion.toLowerCase().includes(query)) ||
        (log.entidad_tipo && log.entidad_tipo.toLowerCase().includes(query)) ||
        (log.detalles && log.detalles.toLowerCase().includes(query))
    );

    renderAuditLogs();
}


// --------------------------------------------------
// BADGES
// --------------------------------------------------

function getActionBadgeClass(action) {
    if (!action) return 'bg-secondary';
    const a = action.toLowerCase();
    const map = [['delete','bg-danger'],['create','bg-success'],['update','bg-warning'],['deploy','bg-info']];
    return map.find(([k]) => a.includes(k))?.[1] ?? 'bg-secondary';
}