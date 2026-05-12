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

            <!-- Header fijo -->
            <div class="audit-sticky-header">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div class="audit-header-title">
                        <h2 class="fw-bold mb-0">REGISTRO DE ACTIVIDAD</h2>
                    </div>
                    <div class="d-flex gap-2 align-items-center audit-controls">
                        <div class="input-group input-group-sm search-input-group">
                            <span class="input-group-text bg-dark border-secondary text-secondary">
                                <i class="bi bi-search"></i>
                            </span>
                            <input type="text" class="form-control text-main" id="auditSearch" onkeyup="filterAuditLogs()">
                        </div>
                        <button class="btn btn-outline-light btn-sm d-none d-md-inline-flex align-items-center gap-1" id="btnRefreshAudit" onclick="loadAuditLogs()">
                            <i class="bi bi-arrow-clockwise"></i> Actualizar
                        </button>
                        <button class="btn btn-outline-light d-md-none" id="btnRefreshAuditMobile" onclick="loadAuditLogs()">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Área scrolleable -->
            <div class="audit-scroll-area">

                <!-- Desktop: tabla -->
                <div class="glass-card p-0 overflow-hidden rounded d-none d-md-block">
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
                <div id="audit-cards-view" class="d-md-none d-flex flex-column gap-2"></div>

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

    const btnDesktop = document.getElementById("btnRefreshAudit");
    const btnMobile  = document.getElementById("btnRefreshAuditMobile");
    const allBtns = [btnDesktop, btnMobile].filter(Boolean);

    allBtns.forEach(b => { b.disabled = true; b.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'; });

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

        allBtns.forEach(b => { b.innerHTML = '<i class="bi bi-check-lg"></i>'; });
        await new Promise(r => setTimeout(r, 800));

    } catch (err) {

        console.error(err);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-danger">
                    Error al cargar auditoría
                </td>
            </tr>
        `;

    } finally {

        allBtns.forEach(b => { b.disabled = false; });
        if (btnDesktop) btnDesktop.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Actualizar';
        if (btnMobile)  btnMobile.innerHTML  = '<i class="bi bi-arrow-clockwise"></i>';

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
            <div class="fw-bold">${date.toLocaleDateString()}</div>
            <div class="small text-dim">${date.toLocaleTimeString()}</div>
        </td>
        <td>
            <span class="badge ${getActionBadgeClass(log.accion)}">${log.accion}</span>
        </td>
        <td>
            <div>${log.entidad_tipo || '-'}</div>
            <div class="small text-dim">${log.entidad_id || ''}</div>
        </td>
        <td class="small">${log.detalles || ''}</td>
        <td class="text-center small">${log.usuario || 'Sistema'}</td>
    `;
    return tr;
}

function _buildAuditCard(log) {
    const date = new Date(log.created_at);
    const card = document.createElement("div");
    card.dataset.logId = log.id;
    card.className = "glass-card p-3 rounded";
    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <span class="badge ${getActionBadgeClass(log.accion)}">${log.accion}</span>
            <span class="small text-dim">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
        </div>
        ${log.entidad_tipo ? `
        <div class="small mb-1">
            <span class="text-dim">Entidad:</span> ${log.entidad_tipo}
            ${log.entidad_id ? `<span class="text-dim ms-1">(${log.entidad_id})</span>` : ''}
        </div>` : ''}
        ${log.detalles ? `<div class="small text-dim mb-1" style="word-break:break-word;">${log.detalles}</div>` : ''}
        <div class="small text-dim mt-1">
            <i class="bi bi-person me-1"></i>${log.usuario || 'Sistema'}
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
            ? `<tr><td colspan="5" class="text-center py-5 text-dim">Sin registros</td></tr>`
            : "";

        if (!empty) filteredAuditLogs.forEach(log => tbody.appendChild(_buildAuditRow(log)));
    }

    if (cardsView) {
        cardsView.innerHTML = empty
            ? `<div class="text-dim text-center py-5">Sin registros</div>`
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
    if (!action) return 'bg-secondary';
    const a = action.toLowerCase();
    const map = [['delete','bg-danger'],['create','bg-success'],['update','bg-warning'],['deploy','bg-info']];
    return map.find(([k]) => a.includes(k))?.[1] ?? 'bg-secondary';
}