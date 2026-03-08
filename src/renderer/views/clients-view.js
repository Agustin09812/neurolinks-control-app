
let allClients = [];
let clientsSearchQuery = "";
let clientsPlanFilter = "";

async function renderClientsView() {
    selectedProjectId = null;
    // Hide other views
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";
    document.getElementById("billing-view").style.display = "none";
    document.getElementById("audit-view").style.display = "none";

    // Clear secondary views if any
    const secondary = document.getElementById("integrated-log-container");
    if (secondary) secondary.remove();
    const secondaryVar = document.getElementById("integrated-var-container");
    if (secondaryVar) secondaryVar.remove();
    const secondaryChat = document.getElementById("integrated-chat-container");
    if (secondaryChat) secondaryChat.remove();

    const view = document.getElementById("clients-view");
    view.style.display = "block";
    view.innerHTML = `
    <div class="d-flex justify-content-center align-items-center h-100" id="clients-loading">
                <div class="spinner-border text-light" role="status"></div>
            </div>
        <div class="animate-fade mt-4">
            <div id="clients-content" style="display:none;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="fw-bold mb-0">GESTIÓN DE <span class="text-light">CLIENTES</span></h2>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-light btn-sm" id="btnNuevoCliente" onclick="openNewClientModal()">
                            <i class="bi bi-person-plus me-2"></i> Nuevo Cliente
                        </button>
                        <button class="btn btn-outline-light btn-sm" onclick="exportClientsToCSV()">
                            <i class="bi bi-file-earmark-excel me-2"></i> Exportar
                        </button>
                        <button class="btn btn-outline-light btn-sm" onclick="resetClientsFilters()">
                            <i class="bi bi-person-plus me-2"></i> Actualizar
                        </button>
                    </div>
                </div>
    
                <!-- Filtros -->
                <div class="glass-card p-4 mb-4">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="small text-dim fw-bold mb-2">BUSCAR CLIENTE</label>
                            <div class="input-group">
                                <span class="input-group-text bg-dark border-secondary text-dim">
                                    <i class="bi bi-search text-secondary"></i>
                                </span>
                                <input type="text" class="form-control text-light" id="clientsSearch" onkeyup="handleClientsSearch(this.value)">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="small text-dim fw-bold mb-2">FILTRAR POR PLAN</label>
                            <select class="form-select" id="clientsFilterPlan" onchange="handleClientsFilterPlan(this.value)">
                                <option value="">Todos los planes</option>
                                <option value="Standard">Standard</option>
                                <option value="Premium">Premium</option>
                                <option value="Enterprise">Enterprise</option>
                                <option value="Baja">Baja</option>
                            </select>
                        </div>
                    </div>
                </div>
    
                <!-- Tabla -->
                <div class="glass-card overflow-hidden">
                    <div class="table-responsive">
                        <table class="table align-middle">
                            <thead>
                                <tr>
                                    <th style="color: var(--bg-deep) !important">Cliente</th>
                                    <th style="color: var(--bg-deep) !important">Empresa / Contacto</th>
                                    <th style="color: var(--bg-deep) !important">Plan</th>
                                    <th style="color: var(--bg-deep) !important">Tickets</th>
                                </tr>
                            </thead>
                            <tbody id="clients-table-body">
                                <!-- Clientes dinámicos -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
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
                                <input type="hidden" id="clientAdminUserId">
                                <div class="row g-3">
                                    <div class="col-md-12">
                                        <label class="form-label text-dim small fw-bold required">NOMBRE COMPLETO</label>
                                        <input type="text" class="form-control text-light" id="clientName" required>
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label text-dim small fw-bold">EMPRESA</label>
                                        <input type="text" class="form-control text-light" id="clientCompany">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">EMAIL</label>
                                        <input type="email" class="form-control text-light" id="clientEmail">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">TELÉFONO</label>
                                        <input type="text" class="form-control text-light" id="clientPhone">
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
                                        <label class="form-label text-dim small fw-bold">PRÓX. VENCIMIENTO</label>
                                        <input type="date" class="form-control text-light" id="clientVencimiento">
                                    </div>

                                    <!-- Configuración Backoffice -->
                                    <div class="col-12 mt-4">
                                        <h6 class="text-accent-clients fw-bold small border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                                            <i class="bi bi-shield-lock me-2"></i>CONFIGURACIÓN BACKOFFICE
                                        </h6>
                                    </div>

                                    <div class="col-md-4">
                                        <div class="form-check form-switch mt-2">
                                            <input class="form-check-input" type="checkbox" id="clientBackofficeActivado">
                                            <label class="form-check-label text-dim small fw-bold" for="clientBackofficeActivado">ACTIVADO</label>
                                        </div>
                                    </div>

                                    <div class="col-md-8">
                                        <label class="form-label text-dim small fw-bold">MÉTODO DE ACCESO</label>
                                        <select class="form-select form-select-sm" id="clientBackofficeMetodo">
                                            <option value="token">Token Individual</option>
                                            <option value="fixed">Credencial Fija</option>
                                        </select>
                                    </div>

                                    <div class="col-12" id="token-container">
                                        <label class="form-label text-dim small fw-bold">TOKEN DE ACCESO</label>
                                        <div class="input-group input-group-sm">
                                            <input type="text" class="form-control text-light" id="clientTokenBackoffice" placeholder="Ej: NL-XXXX-XXXX">
                                            <button class="btn btn-outline-secondary" type="button" onclick="generateToken()">
                                                <i class="bi bi-arrow-clockwise"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Datos de Usuario -->
                                    <div class="col-12 mt-4">
                                        <h6 class="text-accent-clients fw-bold small border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                                            <i class="bi bi-person-badge me-2"></i>DATOS DE ACCESO (USUARIO)
                                            <small class="text-dim ms-2 fw-normal">(Opcional para crear el primer acceso)</small>
                                        </h6>
                                    </div>

                                    <div class="col-md-4">
                                        <label class="form-label text-dim small fw-bold">USUARIO</label>
                                        <input type="text" class="form-control text-light form-control-sm" id="clientAdminUser" placeholder="username">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label text-dim small fw-bold">CONTRASEÑA</label>
                                        <input type="password" class="form-control text-light form-control-sm" id="clientAdminPass" placeholder="••••••••">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label text-dim small fw-bold">NOMBRE VISIBLE</label>
                                        <input type="text" class="form-control text-light form-control-sm" id="clientAdminName" placeholder="Ej: Administrador">
                                    </div>

                                    <!-- Funciones Habilitadas -->
                                    <div class="col-12 mt-4">
                                        <h6 class="text-accent-clients fw-bold small border-bottom border-secondary border-opacity-25 pb-2 mb-3">
                                            <i class="bi bi-toggle-on me-2"></i>FUNCIONES Y PERMISOS
                                        </h6>
                                        <div class="row g-3 mt-1">
                                            <div class="col-md-6">
                                                <label class="form-label text-dim small fw-bold" for="func-clientes">CLIENTES</label>
                                                <select class="form-select form-select-sm" id="func-clientes">
                                                    <option value="none">Sin acceso</option>
                                                    <option value="ver_propio" selected>Ver propio</option>
                                                    <option value="ver_todo">Ver todo</option>
                                                    <option value="editar_crear">Editar / Crear</option>
                                                </select>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label text-dim small fw-bold" for="func-tickets">TICKETS</label>
                                                <select class="form-select form-select-sm" id="func-tickets">
                                                    <option value="none">Sin acceso</option>
                                                    <option value="ver_propio" selected>Ver propio</option>
                                                    <option value="ver_todo">Ver todo</option>
                                                    <option value="editar_crear">Editar / Crear</option>
                                                </select>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label text-dim small fw-bold" for="func-agentes">AGENTES</label>
                                                <select class="form-select form-select-sm" id="func-agentes">
                                                    <option value="none">Sin acceso</option>
                                                    <option value="ver_propio" selected>Ver propio</option>
                                                    <option value="ver_todo">Ver todo</option>
                                                    <option value="editar_crear">Editar / Crear</option>
                                                </select>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label text-dim small fw-bold" for="func-facturas">FACTURAS</label>
                                                <select class="form-select form-select-sm" id="func-facturas">
                                                    <option value="none">Sin acceso</option>
                                                    <option value="ver_propio" selected>Ver propio</option>
                                                    <option value="ver_todo">Ver todo</option>
                                                    <option value="editar_crear">Editar / Crear</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer p-3">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-success">Guardar Cliente</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
    
            <!-- MODAL PAGOS -->
            <div class="modal fade" id="paymentsModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content glass-card shadow-lg">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">Historial de Pagos: <span id="paymentClientName" class="text-accent-clients"></span></h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4">
                            <div class="row g-4">
                                <!-- Formulario Nuevo Pago -->
                                <div class="col-md-4">
                                    <h6 class="text-dim small fw-bold mb-3">REGISTRAR PAGO</h6>
                                    <form id="paymentForm">
                                        <input type="hidden" id="paymentClientId">
                                        <div class="mb-3">
                                            <label class="form-label small text-dim">CONCEPTO</label>
                                            <input type="text" class="form-control form-control-sm text-light" id="payConcept" required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label small text-dim">MONTO ($)</label>
                                            <input type="number" step="0.01" class="form-control form-control-sm text-light" id="payAmount" required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label small text-dim">MÉTODO</label>
                                            <select class="form-select form-select-sm" id="payMethod">
                                                <option value="Transferencia">Transferencia</option>
                                                <option value="Efectivo">Efectivo</option>
                                                <option value="Mercado Pago">Mercado Pago</option>
                                                <option value="Cripto">Cripto</option>
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label small text-dim">FECHA</label>
                                            <input type="date" class="form-control form-control-sm text-light" id="payDate" required>
                                        </div>
                                        <button type="submit" class="btn btn-outline-light btn-sm w-100">
                                            <i class="bi bi-plus-circle me-2"></i>Agregar Pago
                                        </button>
                                    </form>
                                </div>
                                <!-- Tabla de Historial -->
                                <div class="col-md-8 border-start border-secondary ps-4">
                                    <h6 class="text-dim small fw-bold mb-3">HISTORIAL RECIENTE</h6>
                                    <div class="table-responsive" style="max-height: 300px;">
                                        <table class="table table-hover table-sm">
                                            <thead>
                                                <tr>
                                                    <th style="color: var(--bg-deep) !important">Fecha</th>
                                                    <th style="color: var(--bg-deep) !important">Concepto</th>
                                                    <th style="color: var(--bg-deep) !important">Monto</th>
                                                    <th style="color: var(--bg-deep) !important" class="text-end"></th>
                                                </tr>
                                            </thead>
                                            <tbody id="payments-table-body">
                                                <!-- Pagos dinámicos -->
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>
            </div>
    `;

    document.getElementById("clientForm").onsubmit = handleClientSubmit;
    document.getElementById("paymentForm").onsubmit = handlePaymentSubmit;
    loadClientsData();
}

async function loadClientsData() {
    const loadingDiv = document.getElementById("clients-loading");
    const contentDiv = document.getElementById("clients-content");

    if (!loadingDiv || !contentDiv) return;

    try {
        allClients = await window.api.getClients() || [];
        renderClientsList();
    } catch (err) {
        console.error("Error loading clients:", err);
        showToast("Error al conectar con la base de datos de clientes", "danger");
    } finally {
        loadingDiv.classList.add("d-none");
        loadingDiv.style.display = "none";
        contentDiv.classList.remove("d-none");
        contentDiv.style.display = "block";
    }
}

function handleClientsSearch(val) {
    clientsSearchQuery = val.toLowerCase();
    renderClientsList();
}

function handleClientsFilterPlan(val) {
    clientsPlanFilter = val;
    renderClientsList();
}

function resetClientsFilters() {
    document.getElementById("clientsSearch").value = "";
    document.getElementById("clientsFilterPlan").value = "";
    clientsSearchQuery = "";
    clientsPlanFilter = "";
    renderClientsList();
}

async function renderClientsList() {
    const tbody = document.getElementById("clients-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
    const funcs = (window.currentUser && window.currentUser.funciones_habilitadas) || {};
    const clientesPerm = isAdmin ? 'editar_crear' : (funcs.clientes || 'none');

    // Si la DB tiene el valor true, lo convertimos
    const permLvl = clientesPerm === true ? 'editar_crear' : clientesPerm;

    // Botón "Nuevo Cliente"
    const btnNuevo = document.getElementById("btnNuevoCliente");
    if (btnNuevo) btnNuevo.style.display = (permLvl === 'editar_crear') ? 'inline-block' : 'none';

    const myClientId = window.currentUser ? window.currentUser.cliente_id : null;

    const filtered = allClients.filter(c => {
        // Filtrar permisos
        if (!isAdmin) {
            if (permLvl === 'none' || permLvl === false) return false;
            if (permLvl === 'ver_propio' && c.id !== myClientId) return false;
        }

        const matchesSearch = c.nombre.toLowerCase().includes(clientsSearchQuery) ||
            (c.empresa && c.empresa.toLowerCase().includes(clientsSearchQuery)) ||
            (c.email && c.email.toLowerCase().includes(clientsSearchQuery));
        const matchesPlan = clientsPlanFilter === "" || c.plan === clientsPlanFilter;
        return matchesSearch && matchesPlan;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-dim py-5">No se encontraron clientes</td></tr>';
        return;
    }

    // Renderizar filas básicas inmediatamente sin esperar a los tickets
    for (const c of filtered) {
        const tr = document.createElement("tr");
        tr.id = `row-${c.id}`;
        tr.style.cursor = "pointer";
        tr.onclick = (e) => {
            if (e.target.closest('button')) return;
            toggleClientDetails(c.id, c.nombre);
        };

        tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center gap-3">
                    <div class="client-avatar">${c.nombre.charAt(0)}</div>
                    <div>
                        <div class="fw-bold">${c.nombre}</div>
                        <div class="small text-dim">${c.email || 'Sin email'}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="fw-bold">${c.empresa || 'Particular'}</div>
                <div class="small text-dim">${c.telefono || '-'}</div>
            </td>
            <td>
                <span class="badge ${c.plan === 'Premium' ? 'bg-danger text-white' : c.plan === 'Enterprise' ? 'bg-warning text-dark' : c.plan === 'Baja' ? 'bg-secondary' : 'border border-secondary text-dim'}">
                    ${c.plan || 'Standard'}
                </span>
                ${(() => {
                if (!c.vencimiento) return '';
                const vDate = new Date(c.vencimiento);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isExpired = vDate < today;
                return `
                        <div class="x-small mt-1 ${isExpired ? 'text-danger fw-bold animate-pulse' : 'text-dim'}">
                            <i class="bi ${isExpired ? 'bi-exclamation-triangle-fill' : 'bi-calendar-event'} me-1"></i>
                            ${new Date(c.vencimiento).toLocaleDateString()}
                            ${isExpired ? '<span class="ms-1">[VENCIDO]</span>' : ''}
                        </div>
                    `;
            })()}
            </td>
            <td id="pending-tickets-${c.id}">
                <div class="spinner-border spinner-border-sm text-dim" style="width: 12px; height: 12px;"></div>
            </td>
        `;
        tbody.appendChild(tr);

        // Bloque de acciones condicionado al rol
        let actionButtonsHtml = '';
        if (permLvl === 'editar_crear') {
            actionButtonsHtml = `
                <button class="btn btn-outline-custom btn-sm text-start" onclick="openClientBackoffice('${c.id}')">
                    <i class="bi bi-box-arrow-in-right me-2 text-info"></i> Acceso Backoffice
                </button>
                <button class="btn btn-outline-custom btn-sm text-start" onclick="openEditClient('${c.id}')">
                    <i class="bi bi-pencil me-2"></i> Editar Perfil
                </button>
                <button class="btn btn-outline-custom btn-sm text-start" onclick="openClientsTickets('${c.id}')">
                    <i class="bi bi-ticket-perforated me-2"></i> Ver Tickets
                </button>
                <button class="btn btn-outline-custom btn-sm text-start" onclick="openPaymentsModal('${c.id}', '${c.nombre}')">
                    <i class="bi bi-credit-card me-2"></i> Pagos/Historial
                </button>
                <hr class="my-1 border-secondary">
                <button class="btn btn-outline-danger btn-sm text-start" onclick="handleDeleteClient('${c.id}')">
                    <i class="bi bi-trash me-2"></i> Eliminar Cliente
                </button>
            `;
        } else {
            actionButtonsHtml = `
                <button class="btn btn-outline-light btn-sm text-start" onclick="openClientsTickets('${c.id}')">
                    <i class="bi bi-ticket-perforated me-2"></i> Ver Tickets
                </button>
                <button class="btn btn-outline-light btn-sm text-start" onclick="openPaymentsModal('${c.id}', '${c.nombre}')">
                    <i class="bi bi-credit-card me-2"></i> Historial de Pagos
                </button>
            `;
        }

        const detailsTr = document.createElement("tr");
        detailsTr.id = `details-${c.id}`;
        detailsTr.className = "details-row";
        detailsTr.innerHTML = `
            <td colspan="4">
                <div class="details-container">
                    <div style="flex: 1;">
                        <h6 class="text-accent-clients fw-bold mb-3"><i class="bi bi-rocket-takeoff me-2"></i>PROYECTOS VINCULADOS</h6>
                        <div id="projects-container-${c.id}" class="d-flex flex-wrap gap-2"></div>
                    </div>
                    <div class="border-start border-secondary ps-4" style="flex: 1;">
                        <h6 class="text-accent-clients fw-bold mb-3"><i class="bi bi-people me-2"></i>USUARIOS VINCULADOS</h6>
                        <div id="users-container-${c.id}" class="d-flex flex-column gap-1">
                            <div class="spinner-border spinner-border-sm text-secondary"></div>
                        </div>
                    </div>
                    <div class="border-start border-secondary ps-4" style="min-width: 200px;">
                        <h6 class="text-accent-clients fw-bold mb-3"><i class="bi bi-gear me-2"></i>ACCIONES RÁPIDAS</h6>
                        <div class="d-grid gap-2">
                            ${actionButtonsHtml}
                        </div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(detailsTr);
    }

    // Cargar los tickets en segundo plano después de renderizar la tabla
    filtered.forEach(async (c) => {
        try {
            const pendingTickets = await window.api.getClientPendingTickets(c.id);
            const td = document.getElementById(`pending-tickets-${c.id}`);
            if (td) {
                td.innerHTML = pendingTickets > 0 ?
                    `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 px-2 py-1 rounded small">${pendingTickets} pendientes</span>` :
                    '<span class="text-dim small">Al día</span>';
            }
        } catch (e) {
            const td = document.getElementById(`pending-tickets-${c.id}`);
            if (td) td.innerHTML = '<span class="text-dim small">-</span>';
        }
    });
}

async function toggleClientDetails(clientId, clientName) {
    const detailsTr = document.getElementById(`details-${clientId}`);
    const isVisible = detailsTr.classList.contains("active");

    document.querySelectorAll(".details-row").forEach(r => r.classList.remove("active"));
    document.querySelectorAll("tr[id^='row-']").forEach(r => r.classList.remove("bg-accent-glass"));

    if (!isVisible) {
        detailsTr.classList.add("active");
        document.getElementById(`row-${clientId}`).classList.add("bg-accent-glass");
        loadClientProjectsInView(clientId);
        loadClientUsersInView(clientId);
    }
}

async function loadClientProjectsInView(clientId) {
    const container = document.getElementById(`projects-container-${clientId}`);
    container.innerHTML = '<div class="spinner-border spinner-border-sm text-accent-clients"></div>';

    try {
        const projectIds = await window.api.getClientProjects(clientId);
        const allProjects = await window.api.getAssistants();
        const myProjects = allProjects.filter(p => projectIds.includes(p.id));

        container.innerHTML = "";
        if (myProjects.length === 0) {
            container.innerHTML = '<div class="text-dim small p-2">No hay proyectos vinculados</div>';
        } else {
            myProjects.forEach(p => {
                const btn = document.createElement("button");
                btn.className = "btn btn-outline-custom btn-sm animate-fade";
                btn.innerHTML = `<i class="bi bi-cpu me-2"></i>${p.name}`;
                btn.onclick = () => {
                    const item = document.querySelector(`.assistant-item[data-id="${p.id}"]`);
                    if (item) item.click();
                };
                container.appendChild(btn);
            });
        }
    } catch (err) {
        container.innerHTML = '<div class="text-danger small">Error cargando proyectos</div>';
    }
}

function openClientsTickets(clientId) {
    renderTicketsView(clientId);
}

/**
 * Intenta abrir el backoffice del cliente.
 * Como admin, busca el primer dominio disponible de sus proyectos.
 */
async function openClientBackoffice(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    showToast("Buscando acceso al backoffice...", "info");

    try {
        const projectIds = await window.api.getClientProjects(clientId);

        if (projectIds.length === 0) {
            showToast("El cliente no tiene proyectos vinculados para acceder.", "warning");
            return;
        }

        // Obtener detalles de proyectos para buscar dominios
        const allAssistants = await window.api.getAssistants();
        const clientProjects = allAssistants.filter(p => projectIds.includes(p.id));

        for (const p of clientProjects) {
            // Intentar obtener dominios de sus servicios
            const service = p.services.find(s => s.name.toLowerCase().includes('bot') || s.name.toLowerCase().includes('main')) || p.services[0];

            if (service) {
                const domains = await window.api.getServiceDomains(p.id, service.environmentId, service.id);

                let domain = null;
                if (domains?.customDomains?.length > 0) {
                    domain = domains.customDomains[0].domain;
                } else if (domains?.serviceDomains?.length > 0) {
                    domain = domains.serviceDomains[0].domain;
                }

                if (domain) {
                    if (!domain.startsWith("http")) {
                        domain = "https://" + domain;
                    }

                    // Navegar a asistentes y mostrar el detalle con el backoffice
                    navigate('assistants');

                    // Esperar un momento a que se rendericen los asistentes
                    setTimeout(async () => {
                        const projectItem = assistants.find(a => a.id === p.id);
                        if (projectItem) {
                            renderDetail(projectItem);
                            // Llamar a openBackoffice de render.js
                            setTimeout(() => {
                                openBackoffice(p.id);
                            }, 500);
                        }
                    }, 300);

                    return;
                }
            }
        }

        showToast("No se encontraron dominios públicos para este cliente.", "warning");
    } catch (err) {
        console.error("Error al abrir backoffice:", err);
        showToast("Error al intentar acceder al backoffice", "danger");
    }
}

function openNewClientModal() {
    document.getElementById("clientForm").reset();
    document.getElementById("clientId").value = "";
    document.getElementById("clientAdminUserId").value = "";
    document.getElementById("clientAdminUser").value = "";
    document.getElementById("clientAdminPass").value = "";
    document.getElementById("clientAdminName").value = "";
    document.getElementById("clientModalTitle").innerText = "Nuevo Cliente";
    new bootstrap.Modal(document.getElementById("clientModal")).show();
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

    // Nuevos campos
    document.getElementById("clientBackofficeActivado").checked = client.backoffice_activado || false;
    document.getElementById("clientBackofficeMetodo").value = client.backoffice_metodo || "token";
    document.getElementById("clientTokenBackoffice").value = client.token_backoffice || "";

    // Cargar datos de usuario (el primero que encontremos para este cliente)
    document.getElementById("clientAdminUserId").value = "";
    document.getElementById("clientAdminUser").value = "";
    document.getElementById("clientAdminPass").value = "";
    document.getElementById("clientAdminName").value = "";

    try {
        const users = await window.api.getUsuariosByCliente(client.id);
        if (users && users.length > 0) {
            // Buscamos preferentemente uno con rol 'cliente' o el primero
            const mainUser = users.find(u => u.rol === 'cliente') || users[0];
            if (mainUser) {
                document.getElementById("clientAdminUserId").value = mainUser.id;
                document.getElementById("clientAdminUser").value = mainUser.usuario;
                document.getElementById("clientAdminPass").value = ""; // No mostramos la pass por seguridad
                document.getElementById("clientAdminName").value = `${mainUser.nombre || ''} ${mainUser.apellido || ''}`.trim();
            }
        }
    } catch (err) {
        console.error("Error al cargar usuario del cliente:", err);
    }

    const funcs = client.funciones_habilitadas || { clientes: "ver_propio", tickets: "ver_propio", agentes: "ver_propio", facturas: "ver_propio" };
    // Mapeo retrocompatible para booleanos antiguos (true -> editar_crear, false -> none)
    const getVal = (v) => v === true ? "editar_crear" : (v === false ? "none" : (v || "ver_propio"));

    document.getElementById("func-clientes").value = getVal(funcs.clientes);
    document.getElementById("func-tickets").value = getVal(funcs.tickets);
    document.getElementById("func-agentes").value = getVal(funcs.agentes);
    document.getElementById("func-facturas").value = getVal(funcs.facturas);

    document.getElementById("clientModalTitle").innerText = "Editar Cliente";

    new bootstrap.Modal(document.getElementById("clientModal")).show();
}

function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = 'NL-';
    for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    token += '-';
    for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    document.getElementById("clientTokenBackoffice").value = token;
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
        vencimiento: document.getElementById("clientVencimiento").value || null,

        // Nuevos campos
        backoffice_activado: document.getElementById("clientBackofficeActivado").checked,
        backoffice_metodo: document.getElementById("clientBackofficeMetodo").value,
        token_backoffice: document.getElementById("clientTokenBackoffice").value,
        funciones_habilitadas: {
            clientes: document.getElementById("func-clientes").value,
            tickets: document.getElementById("func-tickets").value,
            agentes: document.getElementById("func-agentes").value,
            facturas: document.getElementById("func-facturas").value
        }
    };

    const adminUser = document.getElementById("clientAdminUser").value.trim();
    const adminPass = document.getElementById("clientAdminPass").value.trim();
    const adminName = document.getElementById("clientAdminName").value.trim();
    const adminUserId = document.getElementById("clientAdminUserId").value;

    try {
        let savedClient;
        if (id) {
            await window.api.updateClient(id, clientData);
            savedClient = { id, ...clientData };
            showToast("Cliente actualizado", "success");
        } else {
            savedClient = await window.api.createClient(clientData);
            if (!clientData.token_backoffice && savedClient.token_backoffice) {
                alert(`Cliente creado con éxito.\n\nEl token de acceso generado es:\n${savedClient.token_backoffice}\n\nGuarde este token para enviárselo al cliente.`);
            } else {
                showToast("Cliente creado con éxito", "success");
            }
        }

        // Si hay datos de usuario, crear o actualizar
        if (adminUser) {
            const userData = {
                usuario: adminUser,
                nombre: adminName,
                rol: 'cliente',
                cliente_id: savedClient.id
            };
            if (adminPass) userData.contrasena = adminPass;

            if (adminUserId) {
                await window.api.updateUsuario(adminUserId, userData);
                console.log("Usuario administrador actualizado");
            } else {
                // Solo crear si hay password para nuevo usuario
                if (adminPass) {
                    await window.api.createUsuario(userData);
                    console.log("Usuario administrador creado");
                } else {
                    console.warn("No se creó usuario porque no se especificó contraseña");
                }
            }
        }

        bootstrap.Modal.getInstance(document.getElementById("clientModal")).hide();
        loadClientsData();
    } catch (err) {
        showToast("Error al guardar cliente/usuario: " + err.message, "danger");
    }
}

async function handleDeleteClient(id) {
    if (!confirm("¿Deseas eliminar este cliente? Se perderán sus vínculos técnicos.")) return;
    try {
        await window.api.deleteClient(id);
        showToast("Cliente eliminado", "warning");
        loadClientsData();
    } catch (err) {
        showToast("Error al eliminar cliente", "danger");
    }
}

function exportClientsToCSV() {
    if (allClients.length === 0) {
        showToast("No hay clientes para exportar", "warning");
        return;
    }

    const headers = ["ID", "Nombre", "Empresa", "Email", "Teléfono", "Plan", "Vencimiento"];
    const rows = allClients.map(c => [
        c.id,
        c.nombre,
        c.empresa || '-',
        c.email || '-',
        c.telefono || '-',
        c.plan || 'Standard',
        c.vencimiento_plan || '-'
    ]);

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `listado_clientes.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Reporte de clientes generado", "success");
}

// --------------------------------------------------
// MÓDULO DE PAGOS
// --------------------------------------------------

async function openPaymentsModal(clientId, clientName) {
    document.getElementById("paymentClientId").value = clientId;
    document.getElementById("paymentClientName").innerText = clientName;
    document.getElementById("payDate").value = new Date().toISOString().split('T')[0];

    // Abrir modal
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("paymentsModal"));
    modal.show();

    loadPaymentsData(clientId);
}

async function loadPaymentsData(clientId) {
    const tbody = document.getElementById("payments-table-body");
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-light"><div class="spinner-border spinner-border-sm text-dim"></div></td></tr>';

    try {
        const payments = await window.api.getClientPayments(clientId);
        tbody.innerHTML = "";

        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-dim py-3">No hay pagos registrados</td></tr>';
            return;
        }

        payments.forEach(p => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${new Date(p.fecha).toLocaleDateString()}</td>
                <td class="small">${p.concepto}</td>
                <td class="fw-bold">$${p.monto}</td>
                <td class="text-end">
                    <button class="btn btn-link text-danger p-0" onclick="handleDeletePayment('${p.id}', '${clientId}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Error al cargar pagos</td></tr>';
    }
}

async function handlePaymentSubmit(e) {
    e.preventDefault();
    const clientId = document.getElementById("paymentClientId").value;
    const paymentData = {
        cliente_id: clientId,
        concepto: document.getElementById("payConcept").value,
        monto: parseFloat(document.getElementById("payAmount").value),
        metodo: document.getElementById("payMethod").value,
        fecha: document.getElementById("payDate").value
    };

    try {
        await window.api.createPayment(paymentData);
        showToast("Pago registrado con éxito", "success");
        e.target.reset();
        document.getElementById("paymentClientId").value = clientId; // Restaurar ID
        loadPaymentsData(clientId);
    } catch (err) {
        showToast("Error al registrar pago", "danger");
    }
}

async function handleDeletePayment(id, clientId) {
    if (!confirm("¿Eliminar este registro de pago?")) return;
    try {
        await window.api.deletePayment(id);
        showToast("Pago eliminado", "warning");
        loadPaymentsData(clientId);
    } catch (err) {
        showToast("Error al eliminar pago", "danger");
    }
}

async function loadClientUsersInView(clientId) {
    const container = document.getElementById(`users-container-${clientId}`);
    if (!container) return;

    try {
        const users = await window.api.getUsuariosByCliente(clientId);

        // Botón para agregar nuevo usuario directamente a este cliente
        let html = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-dim small fw-bold">GESTIÓN DE ACCESOS</span>
                <button class="btn btn-outline-info btn-xs py-0" style="font-size: 0.7rem;" onclick="openNewUsuarioForClient('${clientId}')">
                    <i class="bi bi-person-plus me-1"></i> Agregar
                </button>
            </div>
        `;

        if (!users || users.length === 0) {
            html += '<div class="text-center p-2 border border-secondary border-dashed rounded"><span class="text-dim small italic">Sin usuarios asociados</span></div>';
            container.innerHTML = html;
            return;
        }

        html += '<div class="list-group list-group-flush bg-transparent">';
        users.forEach(u => {
            html += `
                <div class="list-group-item bg-transparent border-secondary border-opacity-25 px-0 py-2 d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-person-circle text-info opacity-75"></i>
                        <div class="small">
                            <span class="fw-bold text-light">${u.nombre || ''} ${u.apellido || ''}</span>
                            <span class="text-dim opacity-75">(@${u.usuario})</span>
                            <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 ms-2 uppercase-xs" style="font-size:0.6rem;">${u.rol}</span>
                        </div>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-link py-0 text-dim hover-text-info" onclick="openEditUsuarioFromClients('${u.id}')" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-link py-0 text-dim hover-text-danger" onclick="deleteUsuarioFromClients('${u.id}', '${clientId}')" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

    } catch (err) {
        console.error("Error al cargar usuarios del cliente:", err);
        container.innerHTML = '<span class="text-danger small">Error al cargar usuarios</span>';
    }
}
// --------------------------------------------------
// GESTIÓN DE USUARIOS (INTEGRADA)
// --------------------------------------------------

function genUserModalHTML() {
    if (document.getElementById('usuarioModal')) return;

    const modalHtml = `
        <div class="modal fade" id="usuarioModal" tabindex="-1" style="z-index: 1060;">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content glass-card border-secondary border-opacity-25 shadow-lg">
                    <div class="modal-header border-secondary border-opacity-25 bg-black bg-opacity-20">
                        <h5 class="modal-title fw-bold text-accent-clients" id="usuarioModalTitle">Nuevo Usuario</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="usuarioForm">
                            <input type="hidden" id="usuarioId">
                            <input type="hidden" id="usuarioForzadoClienteId">
                            
                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold required">NOMBRE</label>
                                    <input type="text" class="form-control text-light" id="usuarioNombre" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold required">APELLIDO</label>
                                    <input type="text" class="form-control text-light" id="usuarioApellido" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold required">USUARIO (LOGIN)</label>
                                    <input type="text" class="form-control text-light" id="usuarioLogin" required autocomplete="new-username">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold required">CONTRASEÑA <span id="pwdAsterisk">*</span></label>
                                    <input type="password" class="form-control text-light" id="usuarioPass" autocomplete="new-password">
                                    <div class="form-text text-secondary mt-1 small" id="usuarioPassHelp" style="display:none;">
                                        <i class="bi bi-info-circle me-1"></i>Dejá en blanco para no cambiarla.
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold">ROL DEL SISTEMA</label>
                                    <select class="form-select text-light" id="usuarioRol" onchange="syncUserPermsUI()">
                                        <option value="cliente">Cliente (Acceso Restringido)</option>
                                        <option value="admin">Administrador (Control Total)</option>
                                    </select>
                                </div>
                                <div class="col-md-6" id="clientSelectContainer">
                                    <label class="form-label text-dim small fw-bold">CLIENTE ASOCIADO</label>
                                    <select class="form-select text-light" id="usuarioClienteId">
                                        <option value="">-- Sin Cliente --</option>
                                    </select>
                                </div>
                            </div>
                            
                        </form>
                    </div>
                    <div class="modal-footer border-secondary border-opacity-25 p-3">
                        <button type="button" class="btn btn-secondary btn-sm px-4" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-info btn-sm px-4 fw-bold" id="btnSaveUsuarioShared" onclick="submitUserFromClients()">
                            <i class="bi bi-save me-2"></i>GUARDAR USUARIO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function syncUserPermsUI() {
    const rol = document.getElementById("usuarioRol").value;
    const isAdmin = (rol === "admin");
    const container = document.getElementById("clientSelectContainer");
    const clientSelect = document.getElementById("usuarioClienteId");
    if (isAdmin) {
        clientSelect.value = "";
        clientSelect.disabled = true;
    } else {
        clientSelect.disabled = false;
    }
}

async function openNewUsuarioForClient(clientId) {
    genUserModalHTML();

    // Reset Form
    document.getElementById("usuarioForm").reset();
    document.getElementById("usuarioId").value = "";
    document.getElementById("usuarioForzadoClienteId").value = clientId;
    document.getElementById("usuarioModalTitle").innerText = "Nuevo Usuario para Cliente";

    // Pwd required
    document.getElementById("usuarioPass").required = true;
    document.getElementById("usuarioPassHelp").style.display = "none";
    document.getElementById("pwdAsterisk").style.display = "inline";

    // Cargar selector de clientes (aunque vendrá preseleccionado y oculto si es necesario)
    const clientes = await window.api.getClients();
    const select = document.getElementById("usuarioClienteId");
    select.innerHTML = '<option value="">-- Sin Cliente --</option>' + clientes.map(c => `
        <option value="${c.id}">${c.nombre}</option>
    `).join("");
    select.value = clientId;

    syncUserPermsUI();

    new bootstrap.Modal(document.getElementById('usuarioModal')).show();
}

async function openEditUsuarioFromClients(userId) {
    genUserModalHTML();

    try {
        const users = await window.api.getUsuarios();
        const u = users.find(x => x.id === userId);
        if (!u) return;

        document.getElementById("usuarioId").value = u.id;
        document.getElementById("usuarioNombre").value = u.nombre || "";
        document.getElementById("usuarioApellido").value = u.apellido || "";
        document.getElementById("usuarioLogin").value = u.usuario || "";
        document.getElementById("usuarioPass").required = false;
        document.getElementById("usuarioPassHelp").style.display = "block";
        document.getElementById("pwdAsterisk").style.display = "none";
        document.getElementById("usuarioRol").value = u.rol || "cliente";
        document.getElementById("usuarioForzadoClienteId").value = u.cliente_id || "";

        const clientes = await window.api.getClients();
        const select = document.getElementById("usuarioClienteId");
        select.innerHTML = '<option value="">-- Sin Cliente --</option>' + clientes.map(c => `
            <option value="${c.id}">${c.nombre}</option>
        `).join("");
        select.value = u.cliente_id || "";

        syncUserPermsUI();

        document.getElementById("usuarioModalTitle").innerText = "Editar Usuario";
        new bootstrap.Modal(document.getElementById('usuarioModal')).show();

    } catch (err) {
        showToast("Error al cargar los datos del usuario", "danger");
    }
}

async function submitUserFromClients() {
    const form = document.getElementById("usuarioForm");
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const id = document.getElementById("usuarioId").value;
    const pwd = document.getElementById("usuarioPass").value;
    const clientId = document.getElementById("usuarioClienteId").value;

    const userData = {
        nombre: document.getElementById("usuarioNombre").value,
        apellido: document.getElementById("usuarioApellido").value,
        usuario: document.getElementById("usuarioLogin").value,
        rol: document.getElementById("usuarioRol").value,
        cliente_id: clientId || null
    };

    if (userData.rol === 'cliente' && !userData.cliente_id) {
        showToast("Asociación de cliente obligatoria para este rol", "warning");
        return;
    }

    if (pwd) userData.contrasena = pwd;

    // Permisos
    // Los permisos ya no se guardan en el usuario, se heredan del cliente al loguearse
    userData.funciones_habilitadas = null;

    try {
        if (id) {
            await window.api.updateUsuario(id, userData);
            showToast("Usuario actualizado", "success");
        } else {
            await window.api.createUsuario(userData);
            showToast("Usuario creado", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('usuarioModal')).hide();

        // Refresh the list if we have a clientId
        if (userData.cliente_id) {
            loadClientUsersInView(userData.cliente_id);
        } else {
            // General refresh if no client linked (though unlikely from this view)
            loadClientsData();
        }
    } catch (err) {
        showToast("Error al guardar usuario", "danger");
    }
}

async function deleteUsuarioFromClients(userId, clientId) {
    if (!confirm("¿Deseas eliminar este usuario?")) return;
    try {
        await window.api.deleteUsuario(userId);
        showToast("Usuario eliminado", "success");
        loadClientUsersInView(clientId);
    } catch (err) {
        showToast("Error al eliminar usuario", "danger");
    }
}
