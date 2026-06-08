
let allClients = [];
let clientsSearchQuery = "";
let clientsPlanFilter = "";
let currentClientDetailId = null;

const _clientsWithTickets = new Set();
function _updateClientsSidebarDot() {
    const has = _clientsWithTickets.size > 0;
    ['clients-ticket-badge', 'clients-ticket-badge-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = has ? 'block' : 'none';
    });
}

async function renderClientsView() {
    const secondary = document.getElementById("integrated-log-container");
    if (secondary) secondary.remove();
    const secondaryVar = document.getElementById("integrated-var-container");
    if (secondaryVar) secondaryVar.remove();

    clientsPlanFilter = "";
    clientsSearchQuery = "";

    const view = document.getElementById("clients-view");
    view.style.display = "block";
    const isListView = localStorage.getItem("clientsView") === "list";
    view.innerHTML = `
        <div class="animate-fade" id="clients-main">

            <!-- GRID PANEL -->
            <div id="clients-grid-panel">

                <!-- Cabecera flotante -->
                <div class="view-header">
                    <div class="view-header-left">
                        <h2 class="view-header-title">CLIENTES</h2>
                    </div>
                    <div class="view-header-controls">
                        <div class="input-group input-group-sm search-input-group">
                            <span class="input-group-text text-dim">
                                <i class="bi bi-search"></i>
                            </span>
                            <input type="text" class="form-control text-main" id="clients-search-input"
                                placeholder="Buscar cliente...">
                        </div>
                        <select class="form-select form-select-sm clients-plan-select" id="plan-filter-select">
                            <option value="">Todos los planes</option>
                            <option value="Standard">Standard</option>
                            <option value="Premium">Premium</option>
                            <option value="Enterprise">Enterprise</option>
                            <option value="Baja">Baja</option>
                        </select>
                        <div class="flex gap-2 clients-toolbar-btns">
                            <button class="btn btn-outline-light btn-sm" id="btn-toggle-clients-view"
                                title="${isListView ? 'Vista cuadrícula' : 'Vista lista'}"
                                data-bs-toggle="tooltip" data-bs-placement="bottom">
                                <i class="bi bi-${isListView ? 'grid' : 'list-ul'}"></i>
                            </button>
                            <button class="btn btn-outline-light btn-sm" onclick="exportClientsToCSV()">
                                <i class="bi bi-file-earmark-excel btn-clients-icon"></i><span class="btn-clients-label"> Exportar</span>
                            </button>
                            <button class="btn btn-outline-light btn-sm" id="btn-new-client">
                                <i class="bi bi-person-plus btn-clients-icon"></i><span class="btn-clients-label"> Nuevo Cliente</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Grid de cards -->
                <div id="clients-cards-grid" class="${isListView ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}"></div>
            </div>

            <!-- DETAIL PANEL -->
            <div id="clients-detail-panel" style="display:none;"></div>

        </div>

        <!-- MODAL CLIENTE -->
        <div class="modal fade" id="clientModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content glass-card shadow-lg">
                    <div class="modal-header">
                        <h5 class="modal-title font-bold" id="clientModalTitle">Nuevo Cliente</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="clientForm">
                        <div class="modal-body p-6">
                            <input type="hidden" id="clientId">
                            <div class="grid gap-4">
                                <div class="">
                                    <label class="form-label text-dim text-sm font-bold required">NOMBRE COMPLETO</label>
                                    <input type="text" class="form-control text-main" id="clientName" required>
                                </div>
                                <div class="">
                                    <label class="form-label text-dim text-sm font-bold">EMPRESA</label>
                                    <input type="text" class="form-control text-main" id="clientCompany">
                                </div>
                                <div class="">
                                    <label class="form-label text-dim text-sm font-bold required">ABONO MENSUAL ($)</label>
                                    <input type="number" step="0.01" min="0" class="form-control text-main" id="clientAbono" required>
                                </div>
                                <div class="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="form-label text-dim text-sm font-bold">EMAIL</label>
                                        <input type="email" class="form-control text-main" id="clientEmail">
                                    </div>
                                    <div>
                                        <label class="form-label text-dim text-sm font-bold">TELEFONO</label>
                                        <input type="text" class="form-control text-main" id="clientPhone">
                                    </div>
                                </div>
                                <div class="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="form-label text-dim text-sm font-bold">PLAN CONTRATADO</label>
                                        <select class="form-select" id="clientPlan">
                                            <option value="Standard">Standard</option>
                                            <option value="Premium">Premium</option>
                                            <option value="Enterprise">Enterprise</option>
                                            <option value="Baja">Baja</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="form-label text-dim text-sm font-bold">PROX. VENCIMIENTO</label>
                                        <input type="date" class="form-control text-main" id="clientVencimiento">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer p-4">
                            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-sm btn-success">Guardar Cliente</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById("clientForm").onsubmit = handleClientSubmit;

    document.getElementById("clients-search-input").addEventListener("input", (e) => {
        clientsSearchQuery = e.target.value.toLowerCase();
        renderClientCards();
    });

    document.getElementById("plan-filter-select").addEventListener("change", (e) => {
        clientsPlanFilter = e.target.value;
        renderClientCards();
    });

    document.getElementById("btn-new-client").addEventListener("click", openNewClientModal);

    const toggleClientsBtn = document.getElementById("btn-toggle-clients-view");
    toggleClientsBtn?.addEventListener("click", () => {
        const newView = localStorage.getItem("clientsView") === "list" ? "grid" : "list";
        localStorage.setItem("clientsView", newView);
        const isNowList = newView === "list";
        const grid = document.getElementById("clients-cards-grid");
        if (grid) {
            grid.className = isNowList ? "flex flex-col gap-2" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
            grid.innerHTML = "";
        }
        toggleClientsBtn.querySelector("i").className = `bi bi-${isNowList ? 'grid' : 'list-ul'}`;
        const tt = bootstrap.Tooltip.getInstance(toggleClientsBtn);
        if (tt) tt.dispose();
        toggleClientsBtn.setAttribute("title", isNowList ? 'Vista cuadrícula' : 'Vista lista');
        new bootstrap.Tooltip(toggleClientsBtn, { placement: 'bottom', trigger: 'hover', delay: { show: 200, hide: 100 } });
        renderClientCards();
    });
    if (toggleClientsBtn && window.bootstrap) {
        new bootstrap.Tooltip(toggleClientsBtn, { placement: 'bottom', trigger: 'hover', delay: { show: 200, hide: 100 } });
    }

    allClients = window.clientsData || [];
    if (allClients.length > 0) {
        renderClientCards();
    } else {
        const _sk = `
            <div class="">
                <div class="glass-card p-4 h-full">
                    <div class="flex items-center gap-4">
                        <div class="skeleton shrink-0" style="width:52px;height:52px;border-radius:14px"></div>
                        <div class="grow min-w-0">
                            <div class="skeleton mb-2" style="height:14px;width:70%"></div>
                            <div class="skeleton mb-2" style="height:12px;width:50%"></div>
                            <div class="skeleton" style="height:20px;width:55px;border-radius:10px"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        document.getElementById("clients-cards-grid").innerHTML = _sk.repeat(8);
    }
    loadClientsData();
}

async function loadClientsData() {
    try {
        allClients = await window.api.getClients() || [];
        window.clientsData = allClients;
        renderClientCards();
    } catch (err) {
        console.error("Error loading clients:", err);
        showToast("Error al conectar con la base de datos de clientes", "danger");
    }
}

function getFilteredClients() {
    const s = clientsSearchQuery;
    return allClients.filter(c =>
        (c.nombre.toLowerCase().includes(s) ||
            (c.empresa?.toLowerCase().includes(s)) ||
            (c.email?.toLowerCase().includes(s))) &&
        (!clientsPlanFilter || c.plan === clientsPlanFilter)
    );
}

function getPlanBadgeClass(plan) {
    return {
        'Premium': 'badge-plan-premium',
        'Enterprise': 'badge-plan-enterprise',
        'Baja': 'badge-plan-baja',
        'Standard': 'badge-plan-standard',
    }[plan] || 'badge-plan-standard';
}

function _buildClientCol(c, isNew, index) {
    const initials = c.nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const col = document.createElement("div");
    col.className = "";
    const isList = localStorage.getItem("clientsView") === "list";

    if (isList) {
        col.innerHTML = `
            <div class="glass-card px-4 py-3 hover-lift clickable client-card flex items-center gap-3${isNew ? " anim-card-enter" : ""}"
            ${isNew ? `style="--si:${index}"` : ""} data-id="${c.id}">
                <div class="client-avatar shrink-0">${initials}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold truncate client-name text-sm">${escapeHtml(c.nombre)}</div>
                    <div class="text-xs text-dim truncate client-empresa">${escapeHtml(c.empresa || 'Particular')}</div>
                </div>
                <span class="badge client-plan ${getPlanBadgeClass(c.plan)} shrink-0">${escapeHtml(c.plan || 'Standard')}</span>
                <div class="flex items-center gap-2 shrink-0 text-xs text-dim">
                    <span id="ast-count-${c.id}"><i class="bi bi-robot"></i></span>
                    <span id="ticket-count-${c.id}" style="display:none" class="text-red-400 font-semibold"><i class="bi bi-ticket-perforated-fill mr-1"></i><span class="tc-val"></span></span>
                </div>
            </div>
        `;
    } else {
        col.innerHTML = `
            <div class="glass-card p-4 h-full hover-lift clickable client-card${isNew ? " anim-card-enter" : ""}"
            ${isNew ? `style="--si:${index}"` : ""} data-id="${c.id}">
                <div class="flex items-center gap-4">
                    <div class="client-avatar-lg shrink-0">${initials}</div>
                    <div class="grow min-w-0 overflow-hidden">
                        <div class="font-bold truncate client-name">${escapeHtml(c.nombre)}</div>
                        <div class="text-sm text-dim truncate client-empresa">${escapeHtml(c.empresa || 'Particular')}</div>
                        <div class="text-sm text-dim truncate client-abono">$${escapeHtml(String(c.abono ?? 0))}/mes</div>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="badge client-plan ${getPlanBadgeClass(c.plan)}">${escapeHtml(c.plan || 'Standard')}</span>
                            <span class="text-sm text-dim" id="ast-count-${c.id}"><i class="bi bi-robot"></i></span>
                            <span class="text-sm text-red-400 font-semibold" id="ticket-count-${c.id}" style="display:none"><i class="bi bi-ticket-perforated-fill mr-1"></i><span class="tc-val"></span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    col.querySelector(".client-card").addEventListener("click", () => {
        openClientDetail(c.id);
    });
    return col;
}

function renderClientCards() {
    const grid = document.getElementById("clients-cards-grid");
    if (!grid) return;

    const filtered = getFilteredClients();

    // Map of id -> card element currently in DOM
    const rendered = new Map(
        [...grid.querySelectorAll(".client-card[data-id]")].map(el => [el.dataset.id, el.parentElement])
    );

    // Clear skeleton placeholders before first real render
    if (rendered.size === 0 && grid.children.length > 0) grid.innerHTML = "";

    const filteredIds = new Set(filtered.map(c => c.id));

    // Remove cards no longer in filtered list
    rendered.forEach((col, id) => {
        if (!filteredIds.has(id)) col.remove();
    });

    if (filtered.length === 0) {
        if (!grid.querySelector(".no-clients-msg")) {
            grid.innerHTML = `<div class="text-center text-white/50 py-12 no-clients-msg">No se encontraron clientes</div>`;
        }
        return;
    }

    // Remove empty-state if present
    grid.querySelector(".no-clients-msg")?.remove();

    filtered.forEach((c, index) => {
        const existingCol = rendered.get(c.id);

        if (existingCol) {
            // Patch fields in place — preserves ast-count and event listeners
            const card = existingCol.querySelector(".client-card");
            const nameEl = card.querySelector(".client-name");
            const empresaEl = card.querySelector(".client-empresa");
            const abonoEl = card.querySelector(".client-abono");
            const planEl = card.querySelector(".client-plan");

            if (nameEl) nameEl.textContent = c.nombre;
            if (empresaEl) empresaEl.textContent = c.empresa || 'Particular';
            if (abonoEl) abonoEl.textContent = `$${c.abono ?? 0}/mes`;
            if (planEl) {
                planEl.className = `badge client-plan ${getPlanBadgeClass(c.plan)}`;
                planEl.textContent = c.plan || 'Standard';
            }
        } else {
            const col = _buildClientCol(c, true, index);
            grid.appendChild(col);
            window.api.getClientProjects(c.id).then(ids => {
                const el = document.getElementById(`ast-count-${c.id}`);
                if (el) {
                    const activeCount = assistants.filter(p => ids.includes(p.id)).length;
                    el.innerHTML = `<i class="bi bi-robot"></i> ${activeCount}`;
                }
            }).catch(() => {});
            window.api.getClientPendingTickets(c.id).then(count => {
                const el = document.getElementById(`ticket-count-${c.id}`);
                if (el) {
                    if (count > 0) {
                        el.querySelector('.tc-val').textContent = count;
                        el.style.display = '';
                    } else {
                        el.style.display = 'none';
                    }
                }
                if (count > 0) _clientsWithTickets.add(c.id);
                else _clientsWithTickets.delete(c.id);
                _updateClientsSidebarDot();
            }).catch(() => {});
        }
    });
}

// -----------------------------------------------
// DETAIL PANEL
// -----------------------------------------------

async function openClientDetail(clientId) {
    currentClientDetailId = clientId;
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById("clients-grid-panel").style.display = "none";
    const detailPanel = document.getElementById("clients-detail-panel");
    detailPanel.style.display = "block";

    renderClientDetailStructure(client);
    loadClientFullDetail(client);
}

function renderClientDetailStructure(client) {
    const initials = client.nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const detailPanel = document.getElementById("clients-detail-panel");

    detailPanel.innerHTML = `
        <div class="anim-slide-right">
            <!-- HEADER -->
            <div class="mb-6">
                <button class="btn btn-outline-light btn-sm" id="btn-back-to-grid" title="Volver">
                    <i class="bi bi-arrow-left mr-2"></i>Volver
                </button>
            </div>

            <!-- DETAIL BODY -->
            <div id="client-detail-body"></div>
        </div>
    `;

    document.getElementById("btn-back-to-grid").addEventListener("click", async () => {
        currentClientDetailId = null;
        const dp = document.getElementById("clients-detail-panel");
        const inner = dp.firstElementChild;
        if (inner) {
            inner.classList.add("is-exiting");
            await new Promise(r => setTimeout(r, 180));
            inner.classList.remove("is-exiting");
        }
        dp.style.display = "none";
        document.getElementById("clients-grid-panel").style.display = "block";
    });
}

// -----------------------------------------------
// DETAIL BODY (single-page layout)
// -----------------------------------------------

async function loadClientFullDetail(client) {
    const body = document.getElementById("client-detail-body");
    if (!body) return;

    const initials = client.nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const vencimiento = client.vencimiento ? new Date(client.vencimiento) : null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isExpired = vencimiento && vencimiento < today;

    body.innerHTML = `
        <!-- DATOS DEL CLIENTE -->
        <div class="glass-card px-6 py-4 rounded mb-6">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div class="flex items-center gap-2">
                    <div class="client-avatar shrink-0">${initials}</div>
                    <div>
                        <div class="font-bold">${escapeHtml(client.nombre)}</div>
                        <span class="badge ${getPlanBadgeClass(client.plan)}">${escapeHtml(client.plan || 'Standard')}</span>
                    </div>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button class="btn btn-outline-light btn-sm" id="btn-ver-pagos">
                        <i class="bi bi-credit-card mr-1"></i>Pagos
                    </button>
                    <button class="btn btn-outline-light btn-sm btn-edit-perfil">
                        <i class="bi bi-pencil mr-1"></i>Editar
                    </button>
                    <button class="btn btn-outline-danger btn-sm btn-delete-perfil">
                        <i class="bi bi-trash mr-1"></i>Eliminar
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div class="">
                    <div class="x-small text-dim font-bold mb-1">EMPRESA</div>
                    <div class="text-sm">${escapeHtml(client.empresa || '-')}</div>
                </div>
                <div class="">
                    <div class="x-small text-dim font-bold mb-1">ABONO MENSUAL</div>
                    <div class="text-sm font-bold">$${escapeHtml(String(client.abono ?? 0))}</div>
                </div>
                <div class="">
                    <div class="x-small text-dim font-bold mb-1">EMAIL</div>
                    <div class="text-sm truncate">${escapeHtml(client.email || '-')}</div>
                </div>
                <div class="">
                    <div class="x-small text-dim font-bold mb-1">TELEFONO</div>
                    <div class="text-sm">${escapeHtml(client.telefono || '-')}</div>
                </div>
                <div class="">
                    <div class="x-small text-dim font-bold mb-1">VENCIMIENTO</div>
                    <div class="text-sm ${isExpired ? 'text-red-400 font-bold' : ''}">
                        ${vencimiento ? vencimiento.toLocaleDateString() : '-'}
                        ${isExpired ? '<span class="badge badge-status-danger ml-1">VENCIDO</span>' : ''}
                    </div>
                </div>
            </div>
        </div>

        <!-- ASISTENTES VINCULADOS -->
        <div class="mb-6">
            <h6 class="text-dim text-sm font-bold mb-4">ASISTENTES VINCULADOS</h6>
            <div id="detail-assistants-container">
                <div class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-dim"></div>
                </div>
            </div>
        </div>

        <!-- TICKETS -->
        <div id="client-tickets-container" class="mb-6"></div>
    `;

    body.querySelector(".btn-edit-perfil").onclick = () => openEditClient(client.id);
    body.querySelector(".btn-delete-perfil").onclick = () => handleDeleteClient(client.id);
    document.getElementById("btn-ver-pagos").onclick = () => openBillingModal(client.id);

    loadClientAssistantSection(client.id);

    const ticketsContainer = document.getElementById("client-tickets-container");
    if (ticketsContainer) renderClientTicketsTab(client.id, ticketsContainer, client.telefono);
}

// -----------------------------------------------
// BILLING MODAL
// -----------------------------------------------

function openBillingModal(clientId) {
    const existing = document.getElementById("billingModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "billingModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content glass-card">
                <div class="modal-header">
                    <h5 class="modal-title">Facturación</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="grid md:grid-cols-3 gap-6">
                        <div class="">
                            <div class="glass-card p-6 rounded">
                                <h6 class="text-dim text-sm font-bold mb-4">REGISTRAR PAGO</h6>
                                <form id="detail-payment-form">
                                    <input type="hidden" id="detail-pay-client-id" value="${clientId}">
                                    <div class="mb-4">
                                        <label class="form-label text-sm text-dim">CONCEPTO</label>
                                        <input type="text" class="form-control form-control-sm" id="detail-pay-concept" required>
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label text-sm text-dim">MONTO ($)</label>
                                        <input type="number" step="0.01" class="form-control form-control-sm" id="detail-pay-amount" required>
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label text-sm text-dim">METODO</label>
                                        <select class="form-select form-select-sm" id="detail-pay-method">
                                            <option value="Transferencia">Transferencia</option>
                                            <option value="Efectivo">Efectivo</option>
                                            <option value="Mercado Pago">Mercado Pago</option>
                                            <option value="Cripto">Cripto</option>
                                        </select>
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label text-sm text-dim">FECHA</label>
                                        <input type="date" class="form-control form-control-sm" id="detail-pay-date" required>
                                    </div>
                                    <button type="submit" class="btn btn-outline-light btn-sm w-full">
                                        <i class="bi bi-plus-circle mr-2"></i>Agregar Pago
                                    </button>
                                </form>
                            </div>
                        </div>
                        <div class="md:col-span-2">
                            <div class="glass-card p-6 rounded">
                                <h6 class="text-dim text-sm font-bold mb-4">HISTORIAL DE PAGOS</h6>
                                <!-- Desktop: tabla -->
                                <div class="overflow-x-auto hidden md:block">
                                    <table class="table table-sm table-hover mb-0">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Concepto</th>
                                                <th>Monto</th>
                                                <th>Metodo</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody id="detail-payments-tbody"></tbody>
                                    </table>
                                </div>
                                <!-- Mobile: cards -->
                                <div id="detail-payments-cards" class="md:hidden flex flex-col gap-2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    const dateInput = document.getElementById("detail-pay-date");
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    document.getElementById("detail-payment-form").onsubmit = async (e) => {
        e.preventDefault();
        const paymentData = {
            cliente_id: clientId,
            concepto: document.getElementById("detail-pay-concept").value,
            monto: parseFloat(document.getElementById("detail-pay-amount").value),
            metodo: document.getElementById("detail-pay-method").value,
            fecha: document.getElementById("detail-pay-date").value
        };
        try {
            await window.api.createPayment(paymentData);
            showToast("Pago registrado con exito", "success");
            e.target.reset();
            document.getElementById("detail-pay-client-id").value = clientId;
            document.getElementById("detail-pay-date").value = new Date().toISOString().split('T')[0];
            loadDetailPayments(clientId);
        } catch {
            showToast("Error al registrar pago", "danger");
        }
    };

    loadDetailPayments(clientId);
    modal.addEventListener("hidden.bs.modal", () => modal.remove());
}

async function loadDetailPayments(clientId) {
    const tbody = document.getElementById("detail-payments-tbody");
    const cardsView = document.getElementById("detail-payments-cards");

    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-dim"></div></td></tr>';
    if (cardsView) cardsView.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-dim"></div></div>';

    const deletePayment = async (id) => {
        if (!confirm("¿Eliminar este registro de pago?")) return;
        try {
            await window.api.deletePayment(id);
            showToast("Pago eliminado", "warning");
            loadDetailPayments(clientId);
        } catch {
            showToast("Error al eliminar", "danger");
        }
    };

    try {
        const payments = await window.api.getClientPayments(clientId);

        if (tbody) tbody.innerHTML = "";
        if (cardsView) cardsView.innerHTML = "";

        if (payments.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-dim py-4">No hay pagos registrados</td></tr>';
            if (cardsView) cardsView.innerHTML = '<div class="text-dim text-center py-4">No hay pagos registrados</div>';
            return;
        }

        payments.forEach(p => {
            // Fila de tabla (desktop)
            if (tbody) {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${new Date(p.fecha).toLocaleDateString()}</td>
                    <td class="text-sm">${escapeHtml(p.concepto)}</td>
                    <td class="font-bold">$${escapeHtml(String(p.monto))}</td>
                    <td class="text-sm text-dim">${escapeHtml(p.metodo)}</td>
                    <td class="text-right">
                        <button class="btn btn-link text-danger p-0"><i class="bi bi-trash"></i></button>
                    </td>
                `;
                tr.querySelector("button").onclick = () => deletePayment(p.id);
                tbody.appendChild(tr);
            }

            // Card (mobile)
            if (cardsView) {
                const card = document.createElement("div");
                card.className = "glass-card p-4 rounded";
                card.innerHTML = `
                    <div class="flex justify-between items-start gap-2">
                        <div class="grow min-w-0">
                            <div class="flex items-center justify-between mb-1">
                                <span class="font-bold">$${escapeHtml(String(p.monto))}</span>
                                <span class="text-sm text-dim">${new Date(p.fecha).toLocaleDateString()}</span>
                            </div>
                            <div class="text-sm mb-1">${escapeHtml(p.concepto)}</div>
                            <div class="text-sm text-dim">${escapeHtml(p.metodo)}</div>
                        </div>
                        <button class="btn btn-link text-red-400 p-0 shrink-0 ml-2 btn-del-payment">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;
                card.querySelector(".btn-del-payment").onclick = () => deletePayment(p.id);
                cardsView.appendChild(card);
            }
        });
    } catch {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-400 py-4">Error al cargar pagos</td></tr>';
        if (cardsView) cardsView.innerHTML = '<div class="text-red-400 text-center py-4">Error al cargar pagos</div>';
    }
}

// -----------------------------------------------
// ASSISTANT SECTION
// -----------------------------------------------

function refreshAstCount(clientId) {
    window.api.getClientProjects(clientId).then(ids => {
        const el = document.getElementById(`ast-count-${clientId}`);
        if (el) {
            const activeCount = assistants.filter(p => ids.includes(p.id)).length;
            el.innerHTML = `<i class="bi bi-robot"></i> ${activeCount}`;
        }
    }).catch(() => {});
}

async function loadClientAssistantSection(clientId) {
    const wrap = document.getElementById("detail-assistants-container");
    if (!wrap) return;

    try {
        const projectIds = await window.api.getClientProjects(clientId);
        const linked = assistants.filter(p => projectIds.includes(p.id));

        if (linked.length === 0) {
            wrap.innerHTML = `
                <div class="link-assistant-card flex flex-col items-center justify-center p-6 rounded" id="btn-show-link-assistant">
                    <i class="bi bi-plus-circle fs-3 mb-2 text-dim"></i>
                    <div class="font-semibold">Vincular asistente</div>
                    <div class="text-sm text-dim mt-1">Asociar un asistente a este cliente</div>
                </div>
            `;
            document.getElementById("btn-show-link-assistant").onclick = () => openLinkAssistantModal(clientId);
            return;
        }

        wrap.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4" id="assistant-cards-row"></div>';
        const row = document.getElementById("assistant-cards-row");

        linked.forEach(p => {
            (p.services?.length ? p.services : [null]).forEach((svc) => {
                const col = document.createElement("div");
                col.className = "";

                if (!svc) {
                    col.innerHTML = `
                        <div class="service-card p-4 rounded h-full">
                            <div class="font-bold mb-1">${escapeHtml(p.name)}</div>
                            <div class="text-sm text-dim">Sin servicios</div>
                        </div>`;
                    row.appendChild(col);
                    return;
                }

                const card = document.createElement("div");
                card.className = "service-card p-4 rounded h-full";
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <div class="font-bold">${escapeHtml(svc.name)}</div>
                        <span class="service-status-icon">${getStatusIcon(svc.status)}</span>
                    </div>
                    <div class="x-small text-dim mb-4">Último deploy: ${formatDate(svc.createdAt)}</div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div class="">
                            <button class="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2 btn-ca-backoffice">
                                <i class="bi bi-box-arrow-up-right mb-1"></i>
                                <span style="font-size:0.65rem;">Backoffice</span>
                            </button>
                        </div>
                        <div class="">
                            <button class="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2 btn-ca-logs">
                                <i class="bi bi-terminal mb-1"></i>
                                <span style="font-size:0.65rem;">Logs</span>
                            </button>
                        </div>
                        <div class="">
                            <button class="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2 btn-ca-vars">
                                <i class="bi bi-sliders mb-1"></i>
                                <span style="font-size:0.65rem;">Variables</span>
                            </button>
                        </div>
                        <div class="">
                            <button class="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2 btn-ca-redeploy">
                                <i class="bi bi-arrow-repeat mb-1"></i>
                                <span style="font-size:0.65rem;">Redeploy</span>
                            </button>
                        </div>
                        <div class="">
                            <button class="btn btn-svc-tile btn-danger-tile btn-sm w-full flex flex-col items-center py-2 btn-ca-unlink">
                                <i class="bi bi-dash-circle mb-1"></i>
                                <span style="font-size:0.65rem;">Desvincular</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex justify-between items-center mt-3 pt-2" style="border-top: 1px solid var(--border-soft);">
                        <span class="text-sm text-dim"><i class="bi bi-eye mr-2"></i>system-config visible</span>
                        <label class="sysconfig-toggle" onclick="event.stopPropagation()">
                            <input type="checkbox" class="btn-ca-sysconfig">
                            <span class="sysconfig-thumb">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="12" height="12" class="icon-off"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="12" height="12" class="icon-on"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                            </span>
                        </label>
                    </div>
                `;

                card.querySelector(".btn-ca-backoffice").onclick = async () => {
                    try {
                        const domains = await window.api.getServiceDomains(svc.projectId, svc.environmentId, svc.id);
                        let domain = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain;
                        if (!domain) { showToast("No se encontró URL para este servicio", "warning"); return; }
                        if (!domain.startsWith("http")) domain = "https://" + domain;
                        window.api.openDashboardWindow(domain);
                    } catch { showToast("Error al obtener URL del servicio", "danger"); }
                };

                card.querySelector(".btn-ca-logs").onclick = () => {
                    window.api.openDashboardWindow(`https://railway.com/project/${svc.projectId}/logs?environmentId=${svc.environmentId}&timeFrame=30d`);
                };

                card.querySelector(".btn-ca-vars").onclick = () => {
                    document.getElementById("clients-view").style.display = "none";
                    renderVariablesView(svc.projectId, svc.environmentId, svc.id, svc.name);
                    const btnBack = document.getElementById("btnBackVars");
                    if (btnBack) {
                        btnBack.onclick = () => {
                            window.currentVarsContext = null;
                            window.lastVarsHash = null;
                            clearActiveServiceMenu();
                            document.getElementById("variables-view").style.display = "none";
                            document.getElementById("assistant-detail").style.display = "none";
                            document.getElementById("clients-view").style.display = "block";
                        };
                    }
                };

                card.querySelector(".btn-ca-redeploy").onclick = () => handleRedeploy(svc.id, svc.environmentId);

                // Load SYSTEM_CONFIG_VISIBLE state
                window.api.getSettings(svc.projectId).then(settings => {
                    const val = settings?.find(s => s.key === "SYSTEM_CONFIG_VISIBLE")?.value;
                    const cb = card.querySelector(".btn-ca-sysconfig");
                    if (cb) cb.checked = val === "true" || val === true;
                }).catch(() => {});

                card.querySelector(".btn-ca-sysconfig").addEventListener("change", async (e) => {
                    const newVal = e.target.checked ? "true" : "false";
                    const label = e.target.closest(".sysconfig-toggle");
                    e.target.disabled = true;
                    if (label) label.style.opacity = "0.5";
                    try {
                        await window.api.updateSetting(svc.projectId, "SYSTEM_CONFIG_VISIBLE", newVal);
                        showToast(`system-config ${e.target.checked ? "activado" : "desactivado"} - guardado en Supabase`, "success");
                    } catch {
                        showToast("Error al actualizar configuración", "danger");
                        e.target.checked = !e.target.checked;
                    } finally {
                        e.target.disabled = false;
                        if (label) label.style.opacity = "";
                    }
                });

                card.querySelector(".btn-ca-unlink").onclick = async () => {
                    if (!confirm("¿Desvincular este asistente?")) return;
                    try {
                        await window.api.unlinkProjectClient(p.id);
                        showToast("Asistente desvinculado", "warning");
                        loadClientAssistantSection(clientId);
                        refreshAstCount(clientId);
                    } catch { showToast("Error al desvincular", "danger"); }
                };

                col.appendChild(card);
                row.appendChild(col);
            });
        });

        const addCol = document.createElement("div");
        addCol.className = "";
        addCol.innerHTML = `
            <div class="link-assistant-card flex flex-col items-center justify-center p-4 rounded btn-show-link-assistant" style="height:100%;">
                <i class="bi bi-plus-circle fs-4 mb-1 text-dim"></i>
                <div class="font-semibold text-sm">Vincular asistente</div>
            </div>
        `;
        addCol.querySelector(".btn-show-link-assistant").onclick = () => openLinkAssistantModal(clientId);
        row.appendChild(addCol);
    } catch {
        wrap.innerHTML = '<div class="text-red-400 text-sm">Error cargando asistentes</div>';
    }
}

function openLinkAssistantModal(clientId) {
    const existing = document.getElementById("linkAssistantModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "linkAssistantModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content glass-card">
                <div class="modal-header">
                    <h5 class="modal-title">Vincular Asistente</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="input-group input-group-sm mb-4">
                        <span class="input-group-text text-dim">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="text" id="link-assistant-search" class="form-control text-main" placeholder="Buscar asistente...">
                    </div>
                    <div id="link-assistant-list" class="flex flex-col gap-2 scrollable-list"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    renderLinkAssistantList(clientId, bsModal);

    document.getElementById("link-assistant-search").addEventListener("input", (e) => {
        renderLinkAssistantList(clientId, bsModal, e.target.value.toLowerCase());
    });

    modal.addEventListener("hidden.bs.modal", () => modal.remove());
}

async function renderLinkAssistantList(clientId, bsModal, search = "") {
    const list = document.getElementById("link-assistant-list");
    if (!list) return;

    const iconColors = { success: 'text-emerald-400', danger: 'text-red-400', warning: 'text-yellow-400', secondary: 'text-white/40' };

    try {
        const projectIds = await window.api.getClientProjects(clientId);
        const available = assistants.filter(p =>
            !projectIds.includes(p.id) &&
            (!search || p.name.toLowerCase().includes(search))
        );

        if (available.length === 0) {
            list.innerHTML = '<div class="text-dim text-sm text-center py-4">No hay asistentes disponibles</div>';
            return;
        }

        list.innerHTML = "";
        available.forEach(p => {
            const statusColor = getStatusColor(p.status);
            const item = document.createElement("div");
            item.className = "flex items-center justify-between p-2 glass-card rounded";
            item.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="bi bi-cpu ${iconColors[statusColor] || 'text-white/40'}"></i>
                    <span class="font-semibold text-sm">${escapeHtml(p.name)}</span>
                    <span class="badge badge-status-${statusColor}">
                        ${escapeHtml(p.status.toUpperCase())}
                    </span>
                </div>
                <button class="btn btn-outline-success btn-sm btn-link-assistant">
                    <i class="bi bi-plus mr-1"></i>Vincular
                </button>
            `;
            item.querySelector(".btn-link-assistant").onclick = async () => {
                try {
                    await window.api.linkProjectClient(p.id, clientId);
                    showToast("Asistente vinculado", "success");
                    bsModal.hide();
                    loadClientAssistantSection(clientId);
                    refreshAstCount(clientId);
                } catch {
                    showToast("Error al vincular", "danger");
                }
            };
            list.appendChild(item);
        });
    } catch {
        list.innerHTML = '<div class="text-red-400 text-sm text-center py-4">Error al cargar asistentes</div>';
    }
}

function openClientAssistantDetail(project, clientId) {
    renderDetail(project);

    requestAnimationFrame(() => {
        const btn = document.getElementById("btnBackToGrid");
        if (!btn) return;
        btn.innerHTML = '<i class="bi bi-arrow-left mr-2"></i>Volver al cliente';
        btn.onclick = () => {
            navigate("clients");
            requestAnimationFrame(() => openClientDetail(clientId));
        };
    });
}

// -----------------------------------------------
// MODAL NUEVO / EDITAR CLIENTE
// -----------------------------------------------

function openNewClientModal() {
    document.getElementById("clientForm").reset();
    document.getElementById("clientId").value = "";
    document.getElementById("clientModalTitle").innerText = "Nuevo Cliente";
    bootstrap.Modal.getOrCreateInstance(document.getElementById("clientModal")).show();
}

async function openEditClient(id) {
    const client = allClients.find(c => c.id === id);
    if (!client) return;

    document.getElementById("clientId").value = client.id;
    document.getElementById("clientName").value = client.nombre;
    document.getElementById("clientCompany").value = client.empresa || "";
    document.getElementById("clientAbono").value = client.abono ?? "";
    document.getElementById("clientEmail").value = client.email || "";
    document.getElementById("clientPhone").value = client.telefono || "";
    document.getElementById("clientPlan").value = client.plan || "Standard";
    document.getElementById("clientVencimiento").value = client.vencimiento || "";
    document.getElementById("clientModalTitle").innerText = "Editar Cliente";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("clientModal")).show();
}

async function handleClientSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("clientId").value;
    const clientData = {
        nombre: document.getElementById("clientName").value,
        empresa: document.getElementById("clientCompany").value,
        abono: parseFloat(document.getElementById("clientAbono").value) || 0,
        email: document.getElementById("clientEmail").value,
        telefono: document.getElementById("clientPhone").value,
        plan: document.getElementById("clientPlan").value,
        vencimiento: document.getElementById("clientVencimiento").value || null
    };

    window.showActionSpinner(id ? "Actualizando cliente..." : "Creando cliente...");
    try {
        if (id) {
            await window.api.updateClient(id, clientData);
            showToast("Cliente actualizado", "success");
        } else {
            await window.api.createClient(clientData);
            showToast("Cliente creado con exito", "success");
        }
        bootstrap.Modal.getInstance(document.getElementById("clientModal")).hide();
        await loadClientsData();
        if (id && currentClientDetailId === id) {
            const updated = allClients.find(c => c.id === id);
            if (updated) openClientDetail(id);
        }
    } catch (err) {
        showToast(err?.message || "Error al guardar cliente", "danger");
    } finally {
        window.hideActionSpinner();
    }
}

async function handleDeleteClient(id) {
    if (!confirm("¿Deseas eliminar este cliente? Se perderan sus vinculos tecnicos.")) return;
    window.showActionSpinner("Eliminando cliente...");
    try {
        await window.api.deleteClient(id);
        showToast("Cliente eliminado", "warning");
        if (currentClientDetailId === id) {
            currentClientDetailId = null;
            document.getElementById("clients-detail-panel").style.display = "none";
            document.getElementById("clients-grid-panel").style.display = "block";
        }
        await loadClientsData();
    } catch {
        showToast("Error al eliminar cliente", "danger");
    } finally {
        window.hideActionSpinner();
    }
}

function exportClientsToCSV() {
    if (allClients.length === 0) {
        showToast("No hay clientes para exportar", "warning");
        return;
    }

    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = ["ID", "Nombre", "Empresa", "Email", "Telefono", "Plan", "Vencimiento"];
    const rows = allClients.map(c => [
        escapeCSV(c.id),
        escapeCSV(c.nombre),
        escapeCSV(c.empresa || '-'),
        escapeCSV(c.email || '-'),
        escapeCSV(c.telefono || '-'),
        escapeCSV(c.plan || 'Standard'),
        escapeCSV(c.vencimiento || '-')
    ]);

    let csvContent = "data:text/csv;charset=utf-8,﻿"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "listado_clientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reporte de clientes generado", "success");
}
