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
        <div class="audit-layout">

            <!-- Cabecera flotante -->
            <div class="view-header">
                <div class="view-header-left">
                    <h2 class="view-header-title">REGISTRO DE ACTIVIDAD</h2>
                </div>
                <div class="view-header-controls">
                    <div class="input-group input-group-sm search-input-group">
                        <span class="input-group-text text-dim">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="text" class="form-control text-main" id="auditSearch" onkeyup="filterAuditLogs()">
                    </div>
                    <button class="btn btn-outline-light btn-sm" id="btnRefreshAudit" onclick="loadAuditLogs()">
                        <i class="bi bi-arrow-clockwise btn-refresh-icon mr-2"></i><span class="btn-refresh-label">Actualizar</span>
                    </button>
                </div>
            </div>

            <!-- Área scrolleable -->
            <div class="audit-scroll-area">

                <!-- Desktop: tabla -->
                <div class="glass-card p-0 overflow-hidden rounded hidden md:block">
                    <div class="table-responsive">
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

                <!-- Mobile: cards -->
                <div id="audit-cards-view" class="md:hidden flex flex-col gap-2"></div>

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

    const btn = document.getElementById("btnRefreshAudit");

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'; }

    try {

        const existingIds = new Set(auditLogs.map(l => l.id));
        const fetched = await window.api.getAuditLogs() || [];
        fetched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const newLogs = fetched.filter(l => !existingIds.has(l.id));
        auditLogs = fetched;

        const searchEl = document.getElementById("auditSearch");
        if (searchEl?.value) {
            filterAuditLogs();
        } else {
            filteredAuditLogs = [...auditLogs];
            _patchAuditLogs(newLogs);
        }

        if (btn) btn.innerHTML = '<i class="bi bi-check-lg"></i>';
        await new Promise(r => setTimeout(r, 800));

    } catch (err) {

        console.error(err);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-12 text-red-400">
                    Error al cargar auditoría
                </td>
            </tr>
        `;

    } finally {

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-clockwise btn-refresh-icon mr-2"></i><span class="btn-refresh-label">Actualizar</span>';
        }

    }
}


// --------------------------------------------------
// RENDER / PATCH
// --------------------------------------------------

function _buildAuditRow(log) {
    const date = new Date(log.created_at);
    const tr = document.createElement("tr");
    tr.dataset.logId = log.id;
    tr.innerHTML = `
        <td>
            <div class="font-bold">${date.toLocaleDateString()}</div>
            <div class="text-sm text-dim">${date.toLocaleTimeString()}</div>
        </td>
        <td>
            <span class="badge ${getActionBadgeClass(log.accion)}">${log.accion}</span>
        </td>
        <td>
            <div>${log.entidad_tipo || '-'}</div>
            <div class="text-sm text-dim">${log.entidad_id || ''}</div>
        </td>
        <td class="text-sm">${log.detalles || ''}</td>
        <td class="text-center text-sm">${log.usuario || 'Sistema'}</td>
    `;
    return tr;
}

function _buildAuditCard(log) {
    const date = new Date(log.created_at);
    const card = document.createElement("div");
    card.dataset.logId = log.id;
    card.className = "glass-card p-4 rounded";
    card.innerHTML = `
        <div class="flex justify-between items-start gap-2 mb-2">
            <span class="badge ${getActionBadgeClass(log.accion)}">${log.accion}</span>
            <span class="text-sm text-dim">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
        </div>
        ${log.entidad_tipo ? `
        <div class="text-sm mb-1">
            <span class="text-dim">Entidad:</span> ${log.entidad_tipo}
            ${log.entidad_id ? `<span class="text-dim ml-1">(${log.entidad_id})</span>` : ''}
        </div>` : ''}
        ${log.detalles ? `<div class="text-sm text-dim mb-1" style="word-break:break-word;">${log.detalles}</div>` : ''}
        <div class="text-sm text-dim mt-1">
            <i class="bi bi-person mr-1"></i>${log.usuario || 'Sistema'}
        </div>
    `;
    return card;
}

function _patchAuditLogs(newLogs) {
    const tbody = document.getElementById("audit-table-body");
    const cardsView = document.getElementById("audit-cards-view");
    if (!tbody && !cardsView) return;

    const hasRows = tbody && [...tbody.children].some(r => !r.querySelector('td[colspan]'));

    if (!hasRows) {
        renderAuditLogs();
        return;
    }

    if (newLogs.length === 0) return;

    if (tbody) {
        newLogs.forEach(log => {
            const tr = _buildAuditRow(log);
            tr.classList.add('audit-new-row');
            tbody.prepend(tr);
        });
    }

    if (cardsView && cardsView.querySelector('[data-log-id]')) {
        newLogs.forEach(log => {
            const card = _buildAuditCard(log);
            card.classList.add('audit-new-row');
            cardsView.prepend(card);
        });
    }
}

function renderAuditLogs() {

    const tbody = document.getElementById("audit-table-body");
    const cardsView = document.getElementById("audit-cards-view");

    if (!tbody && !cardsView) return;

    const empty = filteredAuditLogs.length === 0;

    if (tbody) {
        tbody.innerHTML = empty
            ? `<tr><td colspan="5" class="text-center py-12 text-dim">Sin registros</td></tr>`
            : "";

        if (!empty) filteredAuditLogs.forEach(log => tbody.appendChild(_buildAuditRow(log)));
    }

    if (cardsView) {
        cardsView.innerHTML = empty
            ? `<div class="text-dim text-center py-12">Sin registros</div>`
            : "";

        if (!empty) filteredAuditLogs.forEach(log => cardsView.appendChild(_buildAuditCard(log)));
    }
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
    if (!action) return 'badge-status-secondary';
    const a = action.toLowerCase();
    const map = [['delete','badge-status-danger'],['create','badge-status-success'],['update','badge-status-warning'],['deploy','badge-status-info']];
    return map.find(([k]) => a.includes(k))?.[1] ?? 'badge-status-secondary';
}
