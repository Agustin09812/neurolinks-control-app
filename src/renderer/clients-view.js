
let allClients = [];
let clientsSearchQuery = "";
let clientsPlanFilter = "";

async function renderClientsView() {
    selectedProjectId = null;
    // Hide other views
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";

    // Clear secondary views if any
    const secondary = document.getElementById("integrated-log-container");
    if (secondary) secondary.remove();
    const secondaryVar = document.getElementById("integrated-var-container");
    if (secondaryVar) secondaryVar.remove();

    const view = document.getElementById("clients-view");
    view.style.display = "block";
    view.innerHTML = `
        <div class="d-flex justify-content-center align-items-center h-100" id="clients-loading">
            <div class="spinner-border text-accent-clients" role="status"></div>
        </div>
        <div id="clients-content" style="display:none;" class="animate-fade">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="fw-bold mb-0">GESTIÓN DE <span class="text-accent-clients">CLIENTES</span></h2>
                <button class="btn btn-premium" onclick="openNewClientModal()">
                    <i class="bi bi-person-plus me-2"></i> Nuevo Cliente
                </button>
            </div>

            <!-- Filtros -->
            <div class="glass-card p-4 mb-4">
                <div class="row g-3">
                    <div class="col-md-5">
                        <label class="small text-dim fw-bold mb-2">BUSCAR CLIENTE</label>
                        <div class="input-group">
                            <span class="input-group-text bg-dark border-secondary text-dim">
                                <i class="bi bi-search"></i>
                            </span>
                            <input type="text" class="form-control" id="clientsSearch" placeholder="Nombre, empresa o contacto..." onkeyup="handleClientsSearch(this.value)">
                        </div>
                    </div>
                    <div class="col-md-4">
                        <label class="small text-dim fw-bold mb-2">FILTRAR POR PLAN</label>
                        <select class="form-select" id="clientsFilterPlan" onchange="handleClientsFilterPlan(this.value)">
                            <option value="">Todos los planes</option>
                            <option value="Standard">Standard</option>
                            <option value="Premium">Premium</option>
                            <option value="Enterprise">Enterprise</option>
                            <option value="Baja">Baja</option>
                        </select>
                    </div>
                    <div class="col-md-3 d-flex align-items-end">
                        <button class="btn btn-outline-custom w-100" onclick="resetClientsFilters()">
                            <i class="bi bi-arrow-counterclockwise me-2"></i> Reset
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tabla -->
            <div class="glass-card overflow-hidden">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
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
                                    <label class="form-label text-dim small fw-bold">NOMBRE COMPLETO *</label>
                                    <input type="text" class="form-control" id="clientName" required>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label text-dim small fw-bold">EMPRESA</label>
                                    <input type="text" class="form-control" id="clientCompany">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold">EMAIL</label>
                                    <input type="email" class="form-control" id="clientEmail">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label text-dim small fw-bold">TELÉFONO</label>
                                    <input type="text" class="form-control" id="clientPhone">
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label text-dim small fw-bold">PLAN CONTRATADO</label>
                                    <select class="form-select" id="clientPlan">
                                        <option value="Standard">Standard</option>
                                        <option value="Premium">Premium</option>
                                        <option value="Enterprise">Enterprise</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer p-3">
                            <button type="button" class="btn btn-outline-custom" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-premium px-4">Guardar Cliente</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById("clientForm").onsubmit = handleClientSubmit;
    loadClientsData(); // Quitamos el await para no bloquear el hilo principal
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

    const filtered = allClients.filter(c => {
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
            </td>
            <td id="pending-tickets-${c.id}">
                <div class="spinner-border spinner-border-sm text-dim" style="width: 12px; height: 12px;"></div>
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
                        <h6 class="text-accent-clients fw-bold mb-3"><i class="bi bi-rocket-takeoff me-2"></i>PROYECTOS VINCULADOS</h6>
                        <div id="projects-container-${c.id}" class="d-flex flex-wrap gap-2"></div>
                    </div>
                    <div class="border-start border-secondary ps-4">
                        <h6 class="text-accent-clients fw-bold mb-3"><i class="bi bi-gear me-2"></i>ACCIONES RÁPIDAS</h6>
                        <div class="d-grid gap-2">
                            <button class="btn btn-outline-custom btn-sm text-start" onclick="openEditClient('${c.id}')">
                                <i class="bi bi-pencil me-2"></i> Editar Perfil
                            </button>
                            <button class="btn btn-outline-custom btn-sm text-start" onclick="openClientsTickets('${c.id}')">
                                <i class="bi bi-ticket-perforated me-2"></i> Ver Tickets
                            </button>
                            <hr class="my-1 border-secondary">
                            <button class="btn btn-danger-soft btn-sm text-start" onclick="handleDeleteClient('${c.id}')">
                                <i class="bi bi-trash me-2"></i> Eliminar Cliente
                            </button>
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
        plan: document.getElementById("clientPlan").value
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
    if (!confirm("¿Seguro que querés eliminar este cliente?")) return;
    try {
        await window.api.deleteClient(id);
        showToast("Cliente eliminado", "warning");
        loadClientsData();
    } catch (err) {
        showToast("Error al eliminar", "danger");
    }
}
