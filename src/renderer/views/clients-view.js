
let allClients = [];
let clientsSearchQuery = "";
let clientsPlanFilter = "";
// PAGINACIÓN
let currentClientsPage = 1;
const CLIENTS_PER_PAGE = 5;

async function renderClientsView() {
    // FIX: selectedProjectId se limpia en navigate(), no acá

    // Clear secondary views if any
    const secondary = document.getElementById("integrated-log-container");
    if (secondary) secondary.remove();
    const secondaryVar = document.getElementById("integrated-var-container");
    if (secondaryVar) secondaryVar.remove();

    const view = document.getElementById("clients-view");
    view.style.display = "block";
    view.innerHTML = `
    <div class="d-flex justify-content-center align-items-center h-100" id="clients-loading">
                <div class="spinner-border text-light" role="status"></div>
            </div>
        <div class="animate-fade">
            <div id="clients-content" style="display:none;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="fw-bold mb-0">GESTIÓN DE <span class="text-light">CLIENTES</span></h2>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-light btn-sm" onclick="openNewClientModal()">
                            <i class="bi bi-person-plus me-2"></i> Nuevo Cliente
                        </button>
                        <button class="btn btn-outline-light btn-sm" onclick="exportClientsToCSV()">
                            <i class="bi bi-file-earmark-excel me-2"></i> Exportar
                        </button>
                        <button class="btn btn-outline-light btn-sm" onclick="resetClientsFilters()">
                            <i class="bi bi-arrow-clockwise me-2"></i> Actualizar
                        </button>
                    </div>
                </div>
    
                <!-- Filtros COMPACTOS -->
                <div class="glass-card p-2 mb-3 rounded">
                    <div class="row g-2">

                        <div class="col-md-6">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text bg-dark border-secondary text-dim">
                                    <i class="bi bi-search text-secondary"></i>
                                </span>
                                <input type="text"
                                    class="form-control form-control-sm text-light"
                                    placeholder="Buscar cliente..."
                                    onkeyup="handleClientsSearch(this.value)">
                            </div>
                        </div>

                        <div class="col-md-6">
                            <select class="form-select form-select-sm"
                                onchange="handleClientsFilterPlan(this.value)">
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
                <div class="glass-card overflow-hidden rounded">
                    <div class="table-responsive">
                        <table class="table align-middle">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Empresa / Contacto</th>
                                    <th>Plan</th>
                                    <th>Tickets</th>
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
                                        <label class="form-label text-dim small fw-bold">TELÉFONO</label>
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
                                        <label class="form-label text-dim small fw-bold">PRÓX. VENCIMIENTO</label>
                                        <input type="date" class="form-control text-main" id="clientVencimiento">
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
                                    <div class="table-responsive payment-table-scroll">
                                        <table class="table table-hover table-sm">
                                            <thead>
                                                <tr>
                                                    <th class="th-dark">Fecha</th>
                                                    <th class="th-dark">Concepto</th>
                                                    <th class="th-dark">Monto</th>
                                                    <th class="th-dark text-end"></th>
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
        window.clientsData = allClients || []; // Hash para clients
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
    currentClientsPage = 1; // reset
    renderClientsList();
}

function handleClientsFilterPlan(val) {
    clientsPlanFilter = val;
    currentClientsPage = 1; // reset
    renderClientsList();
}

function resetClientsFilters() {
    // FIX: Los inputs no tenían IDs "clientsSearch"/"clientsFilterPlan".
    // Usar querySelector sobre el contenido dinámico en su lugar.
    const searchInput = document.querySelector('#clients-view input[type="text"]');
    const planSelect = document.querySelector('#clients-view select');
    if (searchInput) searchInput.value = "";
    if (planSelect) planSelect.value = "";
    clientsSearchQuery = "";
    clientsPlanFilter = "";
    currentClientsPage = 1;
    renderClientsList();
}

async function renderClientsList() {
    const tbody = document.getElementById("clients-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const filtered = allClients.filter(c => {
        const matchesSearch =
            c.nombre.toLowerCase().includes(clientsSearchQuery) ||
            (c.empresa && c.empresa.toLowerCase().includes(clientsSearchQuery)) ||
            (c.email && c.email.toLowerCase().includes(clientsSearchQuery));

        const matchesPlan =
            clientsPlanFilter === "" || c.plan === clientsPlanFilter;

        return matchesSearch && matchesPlan;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-dim py-5">No se encontraron clientes</td></tr>';

        // eliminar paginación si no hay resultados
        const old = document.getElementById("clients-pagination");
        if (old) old.remove();

        return;
    }

    // ----------------------
    // PAGINACIÓN DATA
    // ----------------------
    const totalPages = Math.ceil(filtered.length / CLIENTS_PER_PAGE);
    const start = (currentClientsPage - 1) * CLIENTS_PER_PAGE;
    const pageData = filtered.slice(start, start + CLIENTS_PER_PAGE);

    // ----------------------
    // RENDER FILAS
    // ----------------------
    for (const c of pageData) {
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
                <span class="badge ${c.plan === 'Premium' ? 'bg-danger text-white' :
                c.plan === 'Enterprise' ? 'bg-warning text-dark' :
                    c.plan === 'Baja' ? 'bg-secondary' :
                        'border border-secondary text-dim'
            }">
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
                <div class="spinner-border spinner-border-sm text-dim spinner-xs"></div>
            </td>
        `;
        tbody.appendChild(tr);

        const detailsTr = document.createElement("tr");
        detailsTr.id = `details-${c.id}`;
        detailsTr.className = "details-row";

        detailsTr.innerHTML = `
            <td colspan="4">
                <div class="details-container">
                    <div>
                        <h6 class="text-accent-clients fw-bold mb-3">
                            <i class="bi bi-rocket-takeoff me-2"></i>PROYECTOS VINCULADOS
                        </h6>
                        <div id="projects-container-${c.id}" class="d-flex flex-wrap gap-2"></div>
                    </div>
                    <div class="border-start border-secondary ps-4">
                        <h6 class="text-accent-clients fw-bold mb-3">
                            <i class="bi bi-gear me-2"></i>ACCIONES RÁPIDAS
                        </h6>
                        <div class="d-grid gap-2">
                            <button class="btn btn-outline-light btn-sm text-start" onclick="openEditClient('${c.id}')">
                                <i class="bi bi-pencil me-2"></i> Editar Perfil
                            </button>
                            <button class="btn btn-outline-light btn-sm text-start" onclick="openClientsTickets('${c.id}')">
                                <i class="bi bi-ticket-perforated me-2"></i> Ver Tickets
                            </button>
                            <button class="btn btn-outline-light btn-sm text-start" onclick="openPaymentsModal('${c.id}', '${c.nombre}')">
                                <i class="bi bi-credit-card me-2"></i> Pagos/Historial
                            </button>
                            <hr class="my-1 border-secondary">
                            <button class="btn btn-outline-danger btn-sm text-start" onclick="handleDeleteClient('${c.id}')">
                                <i class="bi bi-trash me-2"></i> Eliminar Cliente
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(detailsTr);
    }

    // ----------------------
    // TICKETS (async)
    // ----------------------
    filtered.forEach(async (c) => {
        try {
            const pendingTickets = await window.api.getClientPendingTickets(c.id);
            const td = document.getElementById(`pending-tickets-${c.id}`);
            if (td) {
                td.innerHTML = pendingTickets > 0
                    ? `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-20 px-2 py-1 rounded small">${pendingTickets} pendientes</span>`
                    : '<span class="text-dim small">Al día</span>';
            }
        } catch {
            const td = document.getElementById(`pending-tickets-${c.id}`);
            if (td) td.innerHTML = '<span class="text-dim small">-</span>';
        }
    });

    // ----------------------
    // PAGINACIÓN UI
    // ----------------------
    const old = document.getElementById("clients-pagination");
    if (old) old.remove();

    const pagination = document.createElement("div");
    pagination.id = "clients-pagination";
    pagination.className = "d-flex justify-content-between align-items-center p-3 border-top border-secondary";

    pagination.innerHTML = `
        <button class="btn btn-sm btn-outline-light" ${currentClientsPage === 1 ? 'disabled' : ''} onclick="changeClientsPage(-1)">
            ← Anterior
        </button>

        <span class="small text-dim">
            Página ${currentClientsPage} de ${totalPages}
        </span>

        <button class="btn btn-sm btn-outline-light" ${currentClientsPage === totalPages ? 'disabled' : ''} onclick="changeClientsPage(1)">
            Siguiente →
        </button>
    `;

    const wrapper = document.querySelector("#clients-view .glass-card.overflow-hidden");
    if (wrapper) wrapper.appendChild(pagination);
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
    }
}

async function loadClientProjectsInView(clientId) {
    const container = document.getElementById(`projects-container-${clientId}`);
    container.innerHTML = '<div class="spinner-border spinner-border-sm text-accent-clients"></div>';

    try {
        const projectIds = await window.api.getClientProjects(clientId);
        // FIX: Usar variable global `assistants` en vez de otra llamada API
        const myProjects = assistants.filter(p => projectIds.includes(p.id));

        container.innerHTML = "";
        if (myProjects.length === 0) {
            container.innerHTML = '<div class="text-dim small p-2">No hay proyectos vinculados</div>';
        } else {
            myProjects.forEach(p => {

                const row = document.createElement("div");
                row.className = "d-flex justify-content-between align-items-center w-100 animate-fade";

                row.innerHTML = `
                    <div class="d-flex align-items-center gap-2 project-info">
                        <i class="bi bi-cpu"></i>
                        <span>${p.name}</span>
                    </div>

                    <button class="btn btn-outline-danger btn-sm btn-unlink">
                        <i class="bi bi-dash-circle"></i>
                    </button>
                `;

                // abrir asistente
                row.querySelector(".project-info").onclick = () => {
                    const item = document.querySelector(`.assistant-item[data-id="${p.id}"]`);
                    if (item) item.click();
                };

                // desvincular
                const btn = row.querySelector(".btn-unlink");

                btn.onclick = async (e) => {
                    e.stopPropagation();

                    if (!confirm("¿Desvincular este asistente?")) return;

                    btn.disabled = true;
                    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

                    try {

                        await window.api.unlinkProjectClient(p.id);

                        showToast("Asistente desvinculado", "warning");

                        await loadClientProjectsInView(clientId);

                    } catch (err) {

                        showToast("Error al desvincular", "danger");

                        btn.disabled = false;
                        btn.innerHTML = `<i class="bi bi-dash-circle"></i>`;
                    }
                };

                container.appendChild(row);

            });
        }
    } catch (err) {
        container.innerHTML = '<div class="text-danger small">Error cargando proyectos</div>';
    }
}

function openClientsTickets(clientId) {
    renderTicketsView(clientId);
}

function openNewClientModal() {
    document.getElementById("clientForm").reset();
    document.getElementById("clientId").value = "";
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
    document.getElementById("clientModalTitle").innerText = "Editar Cliente";

    new bootstrap.Modal(document.getElementById("clientModal")).show();
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

    try {
        if (id) {
            await window.api.updateClient(id, clientData);
            showToast("Cliente actualizado", "success");
        } else {
            await window.api.createClient(clientData);
            showToast("Cliente creado con éxito", "success");
        }
        bootstrap.Modal.getInstance(document.getElementById("clientModal")).hide();
        loadClientsData();
    } catch (err) {
        showToast("Error al guardar cliente", "danger");
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

    // FIX: Escapar comas y comillas para evitar corrupción del CSV
    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;

    const headers = ["ID", "Nombre", "Empresa", "Email", "Teléfono", "Plan", "Vencimiento"];
    const rows = allClients.map(c => [
        escapeCSV(c.id),
        escapeCSV(c.nombre),
        escapeCSV(c.empresa || '-'),
        escapeCSV(c.email || '-'),
        escapeCSV(c.telefono || '-'),
        escapeCSV(c.plan || 'Standard'),
        escapeCSV(c.vencimiento || '-')
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

function changeClientsPage(direction) {

    const filtered = allClients.filter(c => {
        const matchesSearch = c.nombre.toLowerCase().includes(clientsSearchQuery) ||
            (c.empresa && c.empresa.toLowerCase().includes(clientsSearchQuery)) ||
            (c.email && c.email.toLowerCase().includes(clientsSearchQuery));

        const matchesPlan = clientsPlanFilter === "" || c.plan === clientsPlanFilter;

        return matchesSearch && matchesPlan;
    });

    const totalPages = Math.ceil(filtered.length / CLIENTS_PER_PAGE);

    currentClientsPage += direction;

    if (currentClientsPage < 1) currentClientsPage = 1;
    if (currentClientsPage > totalPages) currentClientsPage = totalPages;

    renderClientsList();
}