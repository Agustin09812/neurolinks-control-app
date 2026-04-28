
let allClients = [];
let clientsSearchQuery = "";
let clientsPlanFilter = "";
let currentClientDetailId = null;

async function renderClientsView() {
    const secondary = document.getElementById("integrated-log-container");
    if (secondary) secondary.remove();
    const secondaryVar = document.getElementById("integrated-var-container");
    if (secondaryVar) secondaryVar.remove();

    const view = document.getElementById("clients-view");
    view.style.display = "block";
    view.innerHTML = `
        <div class="animate-fade" id="clients-main">

            <!-- GRID PANEL -->
            <div id="clients-grid-panel">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                    <h2 class="fw-bold mb-0">CLIENTES</h2>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-outline-light btn-sm" id="btn-new-client">
                            <i class="bi bi-person-plus me-2"></i>Nuevo Cliente
                        </button>
                        <button class="btn btn-outline-light btn-sm" onclick="exportClientsToCSV()">
                            <i class="bi bi-file-earmark-excel me-2"></i>Exportar
                        </button>
                    </div>
                </div>

                <!-- Busqueda + filtro de plan -->
                <div class="d-flex gap-2 mb-4 align-items-center flex-wrap">
                    <div class="input-group input-group-sm search-input-group">
                        <span class="input-group-text bg-dark border-secondary text-dim">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="text" class="form-control text-main" id="clients-search-input"
                            placeholder="Buscar cliente...">
                    </div>
                    <div class="d-flex gap-1 flex-wrap" id="plan-filter-pills">
                        <button class="btn btn-sm btn-outline-secondary active" data-plan="">Todos</button>
                        <button class="btn btn-sm btn-outline-info" data-plan="Standard">Standard</button>
                        <button class="btn btn-sm btn-outline-danger" data-plan="Premium">Premium</button>
                        <button class="btn btn-sm btn-outline-warning" data-plan="Enterprise">Enterprise</button>
                        <button class="btn btn-sm btn-outline-secondary" data-plan="Baja">Baja</button>
                    </div>
                </div>

                <!-- Grid de cards -->
                <div id="clients-cards-grid" class="row g-3"></div>
            </div>

            <!-- DETAIL PANEL -->
            <div id="clients-detail-panel" style="display:none;"></div>

        </div>

        <!-- MODAL CLIENTE -->
        <div class="modal fade" id="clientModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content glass-card shadow-lg">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold" id="clientModalTitle">Nuevo Cliente</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="clientForm">
                        <div class="modal-body p-4">
                            <input type="hidden" id="clientId">
                            <div class="row g-3">
                                <div class="col-md-12">
                                    <label class="form-label text-dim small fw-bold required">NOMBRE COMPLETO</label>
                                    <input type="text" class="form-control text-main" id="clientName" required>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label text-dim small fw-bold">EMPRESA</label>
                                    <input type="text" class="form-control text-main" id="clientCompany">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold">EMAIL</label>
                                    <input type="email" class="form-control text-main" id="clientEmail">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold">TELEFONO</label>
                                    <input type="text" class="form-control text-main" id="clientPhone">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold">PLAN CONTRATADO</label>
                                    <select class="form-select" id="clientPlan">
                                        <option value="Standard">Standard</option>
                                        <option value="Premium">Premium</option>
                                        <option value="Enterprise">Enterprise</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold">PROX. VENCIMIENTO</label>
                                    <input type="date" class="form-control text-main" id="clientVencimiento">
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer p-3">
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

    document.getElementById("plan-filter-pills").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-plan]");
        if (!btn) return;
        document.querySelectorAll("#plan-filter-pills [data-plan]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        clientsPlanFilter = btn.dataset.plan;
        renderClientCards();
    });

    document.getElementById("btn-new-client").addEventListener("click", openNewClientModal);

    allClients = window.clientsData || [];
    if (allClients.length > 0) {
        renderClientCards();
    } else {
        const _sk = `
            <div class="col-xl-3 col-lg-4 col-md-6">
                <div class="glass-card p-3 h-100">
                    <div class="d-flex align-items-center gap-3">
                        <div class="skeleton flex-shrink-0" style="width:52px;height:52px;border-radius:14px"></div>
                        <div class="flex-grow-1 min-w-0">
                            <div class="skeleton mb-2" style="height:14px;width:70%"></div>
                            <div class="skeleton mb-2" style="height:12px;width:50%"></div>
                            <div class="skeleton" style="height:20px;width:55px;border-radius:10px"></div>
                        </div>
                        <div class="skeleton flex-shrink-0" style="width:30px;height:30px;border-radius:6px"></div>
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
        'Premium': 'bg-danger text-white',
        'Enterprise': 'bg-warning text-dark',
        'Baja': 'bg-secondary text-white',
        'Standard': 'bg-info text-dark',
    }[plan] || 'bg-secondary text-white';
}

function renderClientCards() {
    const grid = document.getElementById("clients-cards-grid");
    if (!grid) return;

    const filtered = getFilteredClients();

    // Capture IDs already rendered before clearing — skip entrance animation for them
    const existingIds = new Set(
        [...grid.querySelectorAll(".client-card[data-id]")].map(el => el.dataset.id)
    );

    grid.innerHTML = "";

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center text-secondary py-5">
                No se encontraron clientes
            </div>
        `;
        return;
    }

    filtered.forEach((c, index) => {
        const initials = c.nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
        const isNew = !existingIds.has(c.id);
        const col = document.createElement("div");
        col.className = "col-xl-3 col-lg-4 col-md-6";

        col.innerHTML = `
            <div class="glass-card p-3 h-100 hover-lift clickable client-card${isNew ? " anim-card-enter" : ""}"
            ${isNew ? `style="--si:${index}"` : ""} data-id="${c.id}">
                <div class="d-flex align-items-center gap-3">
                    <div class="client-avatar-lg flex-shrink-0">${initials}</div>
                    <div class="flex-grow-1 min-w-0 overflow-hidden">
                        <div class="fw-bold text-truncate">${c.nombre}</div>
                        <div class="small text-dim text-truncate">${c.empresa || 'Particular'}</div>
                        <div class="d-flex align-items-center gap-2 mt-1">
                            <span class="badge ${getPlanBadgeClass(c.plan)}">${c.plan || 'Standard'}</span>
                            <span class="small text-dim" id="ast-count-${c.id}"><i class="bi bi-robot"></i></span>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-light flex-shrink-0 btn-edit-client" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                </div>
            </div>
        `;

        col.querySelector(".client-card").addEventListener("click", (e) => {
            if (e.target.closest(".btn-edit-client")) return;
            openClientDetail(c.id);
        });

        col.querySelector(".btn-edit-client").addEventListener("click", (e) => {
            e.stopPropagation();
            openEditClient(c.id);
        });

        grid.appendChild(col);

        window.api.getClientProjects(c.id).then(ids => {
            const el = document.getElementById(`ast-count-${c.id}`);
            if (el) el.innerHTML = `<i class="bi bi-robot"></i> ${ids.length}`;
        }).catch(() => {});
    });
}

// -----------------------------------------------
// DETAIL PANEL
// -----------------------------------------------

async function openClientDetail(clientId, defaultTab = "perfil") {
    currentClientDetailId = clientId;
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById("clients-grid-panel").style.display = "none";
    const detailPanel = document.getElementById("clients-detail-panel");
    detailPanel.style.display = "block";

    renderClientDetailStructure(client);

    if (defaultTab !== "perfil") {
        document.querySelectorAll("#client-detail-tabs .nav-link").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === defaultTab);
        });
    }

    loadClientDetailTab(defaultTab, client);
}

function renderClientDetailStructure(client) {
    const initials = client.nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const detailPanel = document.getElementById("clients-detail-panel");

    detailPanel.innerHTML = `
        <div class="anim-slide-right">
            <!-- HEADER -->
            <div class="d-flex align-items-center gap-3 mb-4">
                <button class="btn btn-outline-light btn-sm" id="btn-back-to-grid">
                    <i class="bi bi-arrow-left me-2"></i>Volver
                </button>
                <div class="client-avatar-lg flex-shrink-0">${initials}</div>
                <div>
                    <h4 class="fw-bold mb-1">${client.nombre}</h4>
                    <span class="badge ${getPlanBadgeClass(client.plan)}">${client.plan || 'Standard'}</span>
                </div>
            </div>

            <!-- TABS -->
            <ul class="nav nav-tabs mb-4" id="client-detail-tabs">
                <li class="nav-item">
                    <button class="nav-link active" data-tab="perfil">
                        <i class="bi bi-person me-2"></i>Perfil
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="facturacion">
                        <i class="bi bi-credit-card me-2"></i>Facturacion
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="tickets">
                        <i class="bi bi-ticket-perforated me-2"></i>Tickets
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="asistente">
                        <i class="bi bi-robot me-2"></i>Asistente
                    </button>
                </li>
            </ul>

            <!-- TAB CONTENT -->
            <div id="client-tab-content"></div>
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

    document.getElementById("client-detail-tabs").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tab]");
        if (!btn) return;
        document.querySelectorAll("#client-detail-tabs .nav-link").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const client = allClients.find(c => c.id === currentClientDetailId);
        loadClientDetailTab(btn.dataset.tab, client);
    });
}

function loadClientDetailTab(tab, client) {
    const container = document.getElementById("client-tab-content");
    if (!container) return;
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border spinner-border-sm text-dim"></div>
        </div>
    `;

    switch (tab) {
        case "perfil": renderPerfilTab(client, container); break;
        case "facturacion": renderFacturacionTab(client.id, container); break;
        case "tickets": renderClientTicketsTab(client.id, container); break;
        case "asistente": renderClientAssistantTab(client.id, container); break;
    }
    container.firstElementChild?.classList.add("anim-panel-enter");
}

// -----------------------------------------------
// TAB: PERFIL
// -----------------------------------------------

function renderPerfilTab(client, container) {
    const vencimiento = client.vencimiento ? new Date(client.vencimiento) : null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isExpired = vencimiento && vencimiento < today;

    container.innerHTML = `
        <div class="row g-4">
            <div class="col-md-6">
                <div class="glass-card p-4 rounded h-100">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h5 class="fw-bold mb-0">Datos del Cliente</h5>
                        <button class="btn btn-outline-light btn-sm btn-edit-perfil">
                            <i class="bi bi-pencil me-2"></i>Editar
                        </button>
                    </div>
                    <div class="d-flex flex-column gap-3">
                        <div>
                            <div class="small text-dim fw-bold mb-1">NOMBRE</div>
                            <div>${client.nombre}</div>
                        </div>
                        <div>
                            <div class="small text-dim fw-bold mb-1">EMPRESA</div>
                            <div>${client.empresa || '-'}</div>
                        </div>
                        <div>
                            <div class="small text-dim fw-bold mb-1">EMAIL</div>
                            <div>${client.email || '-'}</div>
                        </div>
                        <div>
                            <div class="small text-dim fw-bold mb-1">TELEFONO</div>
                            <div>${client.telefono || '-'}</div>
                        </div>
                        <div>
                            <div class="small text-dim fw-bold mb-1">PLAN</div>
                            <span class="badge ${getPlanBadgeClass(client.plan)}">${client.plan || 'Standard'}</span>
                        </div>
                        <div>
                            <div class="small text-dim fw-bold mb-1">VENCIMIENTO</div>
                            <div class="${isExpired ? 'text-danger fw-bold' : ''}">
                                ${vencimiento ? vencimiento.toLocaleDateString() : '-'}
                                ${isExpired ? ' <span class="badge bg-danger ms-1">VENCIDO</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="glass-card p-4 rounded h-100">
                    <h5 class="fw-bold mb-4">Zona de Peligro</h5>
                    <div class="d-grid gap-2">
                        <button class="btn btn-outline-danger btn-sm btn-delete-perfil">
                            <i class="bi bi-trash me-2"></i>Eliminar Cliente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.querySelector(".btn-edit-perfil").onclick = () => openEditClient(client.id);
    container.querySelector(".btn-delete-perfil").onclick = () => handleDeleteClient(client.id);
}

// -----------------------------------------------
// TAB: FACTURACION
// -----------------------------------------------

async function renderFacturacionTab(clientId, container) {
    container.innerHTML = `
        <div class="row g-4">
            <div class="col-md-4">
                <div class="glass-card p-4 rounded">
                    <h6 class="text-dim small fw-bold mb-3">REGISTRAR PAGO</h6>
                    <form id="detail-payment-form">
                        <input type="hidden" id="detail-pay-client-id" value="${clientId}">
                        <div class="mb-3">
                            <label class="form-label small text-dim">CONCEPTO</label>
                            <input type="text" class="form-control form-control-sm text-light" id="detail-pay-concept" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small text-dim">MONTO ($)</label>
                            <input type="number" step="0.01" class="form-control form-control-sm text-light" id="detail-pay-amount" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small text-dim">METODO</label>
                            <select class="form-select form-select-sm" id="detail-pay-method">
                                <option value="Transferencia">Transferencia</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Mercado Pago">Mercado Pago</option>
                                <option value="Cripto">Cripto</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small text-dim">FECHA</label>
                            <input type="date" class="form-control form-control-sm text-light" id="detail-pay-date" required>
                        </div>
                        <button type="submit" class="btn btn-outline-light btn-sm w-100">
                            <i class="bi bi-plus-circle me-2"></i>Agregar Pago
                        </button>
                    </form>
                </div>
            </div>
            <div class="col-md-8">
                <div class="glass-card p-4 rounded">
                    <h6 class="text-dim small fw-bold mb-3">HISTORIAL DE PAGOS</h6>
                    <div class="table-responsive">
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
                </div>
            </div>
        </div>
    `;

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
}

async function loadDetailPayments(clientId) {
    const tbody = document.getElementById("detail-payments-tbody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3"><div class="spinner-border spinner-border-sm text-dim"></div></td></tr>';

    try {
        const payments = await window.api.getClientPayments(clientId);
        tbody.innerHTML = "";

        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-dim py-3">No hay pagos registrados</td></tr>';
            return;
        }

        payments.forEach(p => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${new Date(p.fecha).toLocaleDateString()}</td>
                <td class="small">${p.concepto}</td>
                <td class="fw-bold">$${p.monto}</td>
                <td class="small text-dim">${p.metodo}</td>
                <td class="text-end">
                    <button class="btn btn-link text-danger p-0">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tr.querySelector("button").onclick = async () => {
                if (!confirm("¿Eliminar este registro de pago?")) return;
                try {
                    await window.api.deletePayment(p.id);
                    showToast("Pago eliminado", "warning");
                    loadDetailPayments(clientId);
                } catch {
                    showToast("Error al eliminar", "danger");
                }
            };
            tbody.appendChild(tr);
        });
    } catch {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-3">Error al cargar pagos</td></tr>';
    }
}

// -----------------------------------------------
// TAB: ASISTENTE
// -----------------------------------------------

async function renderClientAssistantTab(clientId, container) {
    container.innerHTML = `
        <div class="glass-card p-4 rounded">
            <h6 class="text-dim small fw-bold mb-4">ASISTENTE VINCULADO</h6>
            <div id="detail-assistants-container">
                <div class="text-center py-3">
                    <div class="spinner-border spinner-border-sm text-dim"></div>
                </div>
            </div>
        </div>
    `;

    const wrap = document.getElementById("detail-assistants-container");

    try {
        const projectIds = await window.api.getClientProjects(clientId);
        const linked = assistants.filter(p => projectIds.includes(p.id));

        if (linked.length === 0) {
            wrap.innerHTML = `
                <div class="link-assistant-card d-flex flex-column align-items-center justify-content-center p-4 rounded" id="btn-show-link-assistant">
                    <i class="bi bi-plus-circle fs-3 mb-2 text-dim"></i>
                    <div class="fw-semibold">Vincular asistente</div>
                    <div class="small text-dim mt-1">Asociar un asistente a este cliente</div>
                </div>
            `;
            document.getElementById("btn-show-link-assistant").onclick = () => openLinkAssistantModal(clientId, container);
            return;
        }

        wrap.innerHTML = '<div class="row g-3" id="assistant-cards-row"></div>';
        const row = document.getElementById("assistant-cards-row");

        linked.forEach(p => {
            const statusColor = getStatusColor(p.status);
            const servCount = p.services?.length ?? 0;
            const card = document.createElement("div");
            card.className = "col-md-6 col-lg-4";
            card.innerHTML = `
                <div class="glass-card p-3 rounded d-flex flex-column gap-3 h-100">
                    <div class="d-flex align-items-center gap-3 min-w-0">
                        <div class="assistant-tab-icon bg-${statusColor} bg-opacity-10 border border-${statusColor} border-opacity-25">
                            <i class="bi bi-cpu text-${statusColor}"></i>
                        </div>
                        <div class="flex-grow-1 min-w-0 overflow-hidden">
                            <div class="fw-bold text-truncate">${p.name}</div>
                            <span class="badge bg-${statusColor} bg-opacity-10 text-${statusColor} border border-${statusColor} border-opacity-25 small">
                                ${p.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <span class="small text-dim">
                            <i class="bi bi-layers me-1"></i>${servCount} servicio${servCount !== 1 ? 's' : ''}
                        </span>
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-danger btn-sm btn-unlink-assistant" title="Desvincular">
                                <i class="bi bi-dash-circle"></i>
                            </button>
                            <button class="btn btn-outline-light btn-sm btn-open-assistant" title="Ver detalle">
                                <i class="bi bi-arrow-right me-1"></i><span class="d-none d-xl-inline">Ver detalle</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            card.querySelector(".btn-open-assistant").onclick = () => openClientAssistantDetail(p, clientId);
            card.querySelector(".btn-unlink-assistant").onclick = async () => {
                if (!confirm("¿Desvincular este asistente?")) return;
                try {
                    await window.api.unlinkProjectClient(p.id);
                    showToast("Asistente desvinculado", "warning");
                    renderClientAssistantTab(clientId, container);
                } catch {
                    showToast("Error al desvincular", "danger");
                }
            };
            row.appendChild(card);
        });

        const addCard = document.createElement("div");
        addCard.className = "col-md-6 col-lg-4";
        addCard.innerHTML = `
            <div class="link-assistant-card d-flex flex-column align-items-center justify-content-center p-4 rounded h-100 btn-show-link-assistant">
                <i class="bi bi-plus-circle fs-3 mb-2 text-dim"></i>
                <div class="fw-semibold">Vincular asistente</div>
                <div class="small text-dim mt-1">Asociar un asistente a este cliente</div>
            </div>
        `;
        addCard.querySelector(".btn-show-link-assistant").onclick = () => openLinkAssistantModal(clientId, container);
        row.appendChild(addCard);
    } catch {
        wrap.innerHTML = '<div class="text-danger small">Error cargando asistentes</div>';
    }
}

function openLinkAssistantModal(clientId, container) {
    const existing = document.getElementById("linkAssistantModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "linkAssistantModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content glass-card">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title">Vincular Asistente</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="input-group input-group-sm mb-3">
                        <span class="input-group-text bg-dark border-secondary text-dim">
                            <i class="bi bi-search"></i>
                        </span>
                        <input type="text" id="link-assistant-search" class="form-control text-main border-secondary" placeholder="Buscar asistente...">
                    </div>
                    <div id="link-assistant-list" class="d-flex flex-column gap-2 scrollable-list"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    renderLinkAssistantList(clientId, container, bsModal);

    document.getElementById("link-assistant-search").addEventListener("input", (e) => {
        renderLinkAssistantList(clientId, container, bsModal, e.target.value.toLowerCase());
    });

    modal.addEventListener("hidden.bs.modal", () => modal.remove());
}

async function renderLinkAssistantList(clientId, container, bsModal, search = "") {
    const list = document.getElementById("link-assistant-list");
    if (!list) return;

    try {
        const projectIds = await window.api.getClientProjects(clientId);
        const available = assistants.filter(p =>
            !projectIds.includes(p.id) &&
            (!search || p.name.toLowerCase().includes(search))
        );

        if (available.length === 0) {
            list.innerHTML = '<div class="text-dim small text-center py-3">No hay asistentes disponibles</div>';
            return;
        }

        list.innerHTML = "";
        available.forEach(p => {
            const statusColor = getStatusColor(p.status);
            const item = document.createElement("div");
            item.className = "d-flex align-items-center justify-content-between p-2 glass-card rounded";
            item.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-cpu text-${statusColor}"></i>
                    <span class="fw-semibold small">${p.name}</span>
                    <span class="badge bg-${statusColor} bg-opacity-10 text-${statusColor} border border-${statusColor} border-opacity-25">
                        ${p.status.toUpperCase()}
                    </span>
                </div>
                <button class="btn btn-outline-success btn-sm btn-link-assistant">
                    <i class="bi bi-plus me-1"></i>Vincular
                </button>
            `;
            item.querySelector(".btn-link-assistant").onclick = async () => {
                try {
                    await window.api.linkProjectClient(p.id, clientId);
                    showToast("Asistente vinculado", "success");
                    bsModal.hide();
                    renderClientAssistantTab(clientId, container);
                } catch {
                    showToast("Error al vincular", "danger");
                }
            };
            list.appendChild(item);
        });
    } catch {
        list.innerHTML = '<div class="text-danger small text-center py-3">Error al cargar asistentes</div>';
    }
}

function openClientAssistantDetail(project, clientId) {
    renderDetail(project);

    // Sobreescribir el boton volver para que regrese al cliente
    requestAnimationFrame(() => {
        const btn = document.getElementById("btnBackToGrid");
        if (!btn) return;
        btn.innerHTML = '<i class="bi bi-arrow-left me-2"></i>Volver al cliente';
        btn.onclick = () => {
            navigate("clients");
            requestAnimationFrame(() => openClientDetail(clientId, "asistente"));
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
