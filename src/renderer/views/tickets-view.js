
let allTicketsView = [];
let lastTicketsCount = 0;
let ticketFilters = {
    status: "",
    type: "",
    client: "",
    priority: "",
    dateStart: "",
    dateEnd: ""
};

// paginacion
let currentPage = 1;
const ITEMS_PER_PAGE = 15;

async function renderTicketsView(filterClientId = "") {
    selectedProjectId = null;
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("billing-view").style.display = "none";
    document.getElementById("audit-view").style.display = "none";

    const secondary = document.getElementById("integrated-log-container");
    if (secondary) secondary.remove();
    const secondaryVar = document.getElementById("integrated-var-container");
    if (secondaryVar) secondaryVar.remove();

    if (filterClientId) {
        ticketFilters.client = filterClientId;
    }

    const view = document.getElementById("tickets-view");
    view.style.display = "block";
    view.innerHTML = `
    <div class="d-flex justify-content-center align-items-center h-100" id="tickets-loading">
                <div class="spinner-border text-light" role="status"></div>
            </div>
        <div class="animate-fade">
            <div id="tickets-content" style="display:none;">
                 <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="fw-bold mb-0" style="color: var(--text-main)">SISTEMA DE TICKETS</h2>
                    <button class="btn btn-outline-light btn-sm" onclick="openNewTicketModal()">
                        <i class="bi bi-plus-circle me-2"></i> Nuevo Ticket
                    </button>
                </div>
    
                <!-- FILTROS COMPACTOS -->
                <div class="glass-card p-2 mb-3 rounded">
                    <div class="row g-2 align-items-end">

                        <div class="col-md-2">
                            <select class="form-select form-select-sm"
                                id="view-filter-status"
                                onchange="handleTicketFilter('status', this.value)">
                                <option value="">Estado</option>
                                <option value="Abierto">Abierto</option>
                                <option value="En Progreso">En Progreso</option>
                                <option value="Cerrado">Cerrado</option>
                            </select>
                        </div>

                        <div class="col-md-2">
                            <select class="form-select form-select-sm"
                                id="view-filter-priority"
                                onchange="handleTicketFilter('priority', this.value)">
                                <option value="">Prioridad</option>
                                <option value="Baja">Baja</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                            </select>
                        </div>

                        <div class="col-md-3">
                            <select class="form-select form-select-sm"
                                id="view-filter-client"
                                onchange="handleTicketFilter('client', this.value)">
                                <option value="">Cliente</option>
                            </select>
                        </div>

                        <div class="col-md-2">
                            <input type="date"
                                class="form-control form-control-sm text-light"
                                id="view-filter-date-start"
                                onchange="handleTicketFilter('dateStart', this.value)">
                        </div>

                        <div class="col-md-2">
                            <input type="date"
                                class="form-control form-control-sm text-light"
                                id="view-filter-date-end"
                                onchange="handleTicketFilter('dateEnd', this.value)">
                        </div>

                        <div class="col-md-1">
                            <button class="btn btn-outline-custom btn-sm w-100"
                                onclick="resetTicketFilters()"
                                title="Limpiar filtros">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                        </div>

                    </div>
                </div>
    
                <div class="d-flex justify-content-end mb-3">
                    <button class="btn btn-outline-light btn-sm" onclick="exportTicketsToCSV()">
                        <i class="bi bi-file-earmark-excel me-2"></i>Exportar Excel (CSV)
                    </button>
                </div>
    
                <div class="glass-card overflow-hidden rounded">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>ID / Título</th>
                                    <th>Cliente</th>
                                    <th>Tipo</th>
                                    <th>Estado</th>
                                    <th>Prioridad</th>
                                    <th>Creado</th>
                                    <th class="text-end">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="tickets-table-body-view"></tbody>
                            </table>
                            </div>

                            <div class="d-flex justify-content-between align-items-center p-3 border-top border-secondary">
                                <button class="btn btn-sm btn-outline-light" onclick="changePage(-1)">
                                    ← Anterior
                                </button>

                                <span id="pagination-info" class="small text-dim"></span>

                                <button class="btn btn-sm btn-outline-light" onclick="changePage(1)">
                                    Siguiente →
                                </button>
                            </div>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        <!-- MODAL TICKET -->
            <div class="modal fade" id="ticketModalView" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content glass-card shadow-lg">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold" id="ticketModalTitleView">Nuevo Ticket</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="ticketFormView">
                            <div class="modal-body p-4">
                                <input type="hidden" id="ticketIdView">

                                <div class="row g-2">

                                    <!-- TÍTULO -->
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold required">TÍTULO DEL PROBLEMA</label>
                                        <input type="text" class="form-control text-light" id="ticketTitleView" required>
                                    </div>

                                    <!-- CLIENTE -->
                                    <div class="col-md-3">
                                        <label class="form-label text-dim small fw-bold required">CLIENTE</label>
                                        <select class="form-select" id="ticketClientView" required></select>
                                    </div>

                                    <!-- TIPO -->
                                    <div class="col-md-3">
                                        <label class="form-label text-dim small fw-bold">TIPO</label>
                                        <select class="form-select" id="ticketTypeView">
                                            <option value="Soporte">Soporte</option>
                                            <option value="Mejora">Mejora</option>
                                            <option value="Bugs">Bugs</option>
                                        </select>
                                    </div>

                                    <!-- ESTADO -->
                                    <div class="col-md-3">
                                        <label class="form-label text-dim small fw-bold">ESTADO</label>
                                        <select class="form-select" id="ticketStatusView">
                                            <option value="Abierto">Abierto</option>
                                            <option value="En Progreso">En Progreso</option>
                                            <option value="Cerrado">Cerrado</option>
                                        </select>
                                    </div>

                                    <!-- PRIORIDAD -->
                                    <div class="col-md-3">
                                        <label class="form-label text-dim small fw-bold">PRIORIDAD</label>
                                        <select class="form-select" id="ticketPriorityView">
                                            <option value="Baja">Baja</option>
                                            <option value="Media">Media</option>
                                            <option value="Alta">Alta</option>
                                        </select>
                                    </div>

                                    <!-- DESCRIPCIÓN (PROTAGONISTA) -->
                                    <div class="col-md-12 mt-2">
                                        <label class="form-label text-dim small fw-bold">DESCRIPCIÓN</label>
                                        <textarea 
                                            class="form-control text-light" 
                                            id="ticketDescView" 
                                            rows="10"
                                            style="min-height: 220px; resize: vertical;">
                                        </textarea>
                                    </div>

                                </div>
                            </div>

                            <div class="modal-footer p-3">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-success">Guardar Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
    `;

    document.getElementById("ticketFormView").onsubmit = handleTicketSubmit;
    populateTicketFilters(); // Sin await
    loadTicketsData(); // Sin await
}

async function populateTicketFilters() {
    try {
        const clients = await window.api.getClients() || [];
        const filterSelect = document.getElementById("view-filter-client");
        const modalSelect = document.getElementById("ticketClientView");

        if (!filterSelect || !modalSelect) return;

        const options = clients.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");

        filterSelect.innerHTML = '<option value="">Todos los clientes</option>' + options;
        modalSelect.innerHTML = '<option value="">-- Seleccionar --</option>' + options;

        if (ticketFilters.client) {
            filterSelect.value = ticketFilters.client;
        }
    } catch (err) {
        console.error("Error populating ticket filters:", err);
    }
}

async function loadTicketsData() {
    const loadingDiv = document.getElementById("tickets-loading");
    const contentDiv = document.getElementById("tickets-content");

    // Si no existen los divs, abortamos
    if (!loadingDiv || !contentDiv) return;

    try {

        const previousCount = lastTicketsCount;

        allTicketsView = await window.api.getTickets() || [];

        window.ticketsData = allTicketsView || []; // Hash para tickets

        // Detectar nuevos tickets
        // FIX: detección correcta de nuevos tickets + key única por notificación
        // Antes se usaba `ticket.id`, pero `ticket` no existía en este scope,
        // lo que generaba:
        // 1) ReferenceError en algunos casos (rompiendo el flujo)
        // 2) keys "ticket-undefined", haciendo que el sistema anti-duplicados
        //    (notificationMemory) bloquee notificaciones reales
        //
        // Además, la lógica original solo comparaba cantidad de tickets,
        // sin identificar cuáles eran nuevos.
        //
        // Este fix:
        // ✔ Detecta exactamente qué tickets son nuevos
        // ✔ Genera una notificación por cada ticket real
        // ✔ Usa `t.id` como key única → evita duplicados incorrectos
        // ✔ Mantiene consistencia en el sistema de notificaciones
        if (previousCount !== 0 && allTicketsView.length > previousCount) {

            const newTickets = allTicketsView.slice(0, allTicketsView.length - previousCount);

            newTickets.forEach(t => {
                addNotification(
                    "ticket",
                    "Nuevo ticket recibido",
                    `Ticket: ${t.titulo || "Sin título"}`,
                    `ticket-${t.id}`
                );
            });

            showToast("Nuevos tickets recibidos", "info");
        }

        lastTicketsCount = allTicketsView.length;

        renderTicketsList();

    } catch (err) {
        console.error("Error loading tickets:", err);
        showToast("Error al conectar con el servidor de tickets", "danger");
    } finally {
        // Aseguramos que el spinner SIEMPRE se oculte
        loadingDiv.classList.add("d-none");
        loadingDiv.style.display = "none";
        contentDiv.classList.remove("d-none");
        contentDiv.style.display = "block";
    }
}

function handleTicketFilter(key, val) {
    ticketFilters[key] = val;
    currentPage = 1;
    renderTicketsList();
}

function resetTicketFilters() {
    ticketFilters = { status: "", type: "", client: "", priority: "", dateStart: "", dateEnd: "" };
    if (document.getElementById("view-filter-status")) document.getElementById("view-filter-status").value = "";
    if (document.getElementById("view-filter-priority")) document.getElementById("view-filter-priority").value = "";
    if (document.getElementById("view-filter-client")) document.getElementById("view-filter-client").value = "";
    if (document.getElementById("view-filter-date-start")) document.getElementById("view-filter-date-start").value = "";
    if (document.getElementById("view-filter-date-end")) document.getElementById("view-filter-date-end").value = "";
    currentPage = 1;
    renderTicketsList();
}

function renderTicketsList() {
    const tbody = document.getElementById("tickets-table-body-view");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtered = allTicketsView.filter(t => {
        const matchStatus = !ticketFilters.status || t.estado === ticketFilters.status;
        const matchPriority = !ticketFilters.priority || t.prioridad === ticketFilters.priority;
        const matchClient = !ticketFilters.client || t.cliente_id === ticketFilters.client;

        // Filtro de fecha
        let matchDate = true;
        if (ticketFilters.dateStart || ticketFilters.dateEnd) {
            const ticketDate = new Date(t.created_at).toISOString().split('T')[0];
            if (ticketFilters.dateStart && ticketDate < ticketFilters.dateStart) matchDate = false;
            if (ticketFilters.dateEnd && ticketDate > ticketFilters.dateEnd) matchDate = false;
        }

        return matchStatus && matchPriority && matchClient && matchDate;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-dim py-5">No se encontraron tickets</td></tr>';
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;  // paginacion
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);  // paginacion

    paginated.forEach(t => {
        const tr = document.createElement("tr");
        tr.className = "ticket-row";
        tr.innerHTML = `
            <td>
                <div class="fw-bold">#${t.id.substring(0, 8)}</div>
                <div class="small text-white">${t.titulo}</div>
            </td>
            <td>${t.clientes ? t.clientes.nombre : 'Sin cliente'}</td>
            <td><span class="small text-dim">${t.tipo}</span></td>
            <td><span class="status-badge status-${t.estado.toLowerCase().replace(" ", "")}">${t.estado}</span></td>
            <td><span class="fw-bold priority-${t.prioridad ? t.prioridad.toLowerCase() : 'baja'}">${t.prioridad || 'Baja'}</span></td>
            <td><div class="small text-dim">${new Date(t.created_at).toLocaleDateString()}</div></td>
            <td class="text-end">
                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-sm btn-outline-light" onclick="openEditTicket('${t.id}')"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteTicket('${t.id}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const info = document.getElementById("pagination-info");

    if (info) {
        info.textContent = `Página ${currentPage} de ${totalPages}`;
    }
}

function openNewTicketModal() {
    document.getElementById("ticketFormView").reset();
    document.getElementById("ticketIdView").value = "";
    document.getElementById("ticketModalTitleView").innerText = "Nuevo Ticket";
    if (ticketFilters.client) {
        document.getElementById("ticketClientView").value = ticketFilters.client;
    }
    new bootstrap.Modal(document.getElementById("ticketModalView")).show();
}

function openEditTicket(id) {
    const tick = allTicketsView.find(t => t.id === id);
    if (!tick) return;

    document.getElementById("ticketIdView").value = tick.id;
    document.getElementById("ticketTitleView").value = tick.titulo;
    document.getElementById("ticketClientView").value = tick.cliente_id;
    document.getElementById("ticketTypeView").value = tick.tipo;
    document.getElementById("ticketStatusView").value = tick.estado;
    document.getElementById("ticketPriorityView").value = tick.prioridad;
    document.getElementById("ticketDescView").value = tick.descripcion || "";

    document.getElementById("ticketModalTitleView").innerText = "Editar Ticket";
    new bootstrap.Modal(document.getElementById("ticketModalView")).show();
}

async function handleTicketSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("ticketIdView").value;
    const data = {
        titulo: document.getElementById("ticketTitleView").value,
        cliente_id: document.getElementById("ticketClientView").value,
        tipo: document.getElementById("ticketTypeView").value,
        estado: document.getElementById("ticketStatusView").value,
        prioridad: document.getElementById("ticketPriorityView").value,
        descripcion: document.getElementById("ticketDescView").value
    };

    try {
        if (id) {
            await window.api.updateTicket(id, data);
            showToast("Ticket actualizado", "success");
        } else {
            await window.api.createTicket(data);
            showToast("Ticket creado correctamente", "success");
        }
        bootstrap.Modal.getInstance(document.getElementById("ticketModalView")).hide();
        loadTicketsData();
    } catch (err) {
        showToast("Error al guardar ticket", "danger");
    }
}

async function handleDeleteTicket(id) {
    if (!confirm("¿Seguro que querés eliminar este ticket?")) return;
    try {
        await window.api.deleteTicket(id);
        showToast("Ticket eliminado", "warning");
        loadTicketsData();
    } catch (err) {
        showToast("Error al eliminar ticket", "danger");
    }
}

function exportTicketsToCSV() {
    if (allTicketsView.length === 0) {
        showToast("No hay tickets para exportar", "warning");
        return;
    }

    const headers = ["ID", "Título", "Cliente", "Tipo", "Estado", "Prioridad", "Creado"];
    const rows = allTicketsView.map(t => [
        t.id,
        t.titulo,
        t.clientes ? t.clientes.nombre : 'Sin cliente',
        t.tipo,
        t.estado,
        t.prioridad || 'Baja',
        new Date(t.created_at).toLocaleDateString()
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_tickets_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Reporte generado", "success");
}

function changePage(direction) { // paginacion
    const totalPages = Math.ceil(allTicketsView.length / ITEMS_PER_PAGE);

    currentPage += direction;

    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    renderTicketsList();
}