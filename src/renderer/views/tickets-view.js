
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
const ITEMS_PER_PAGE = 5;

async function renderTicketsView(filterClientId = "") {
    // FIX: selectedProjectId y ocultamiento de vistas se manejan en navigate()
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
        <div class="animate-fade">
            <div id="tickets-content">
                 <div class="flex flex-wrap justify-between items-center gap-2 mb-6">
                    <h2 class="font-bold mb-0">SISTEMA DE TICKETS</h2>
                    <button class="btn btn-outline-light btn-sm" onclick="openNewTicketModal()">
                        <i class="bi bi-plus-circle mr-2"></i> Nuevo Ticket
                    </button>
                </div>

                <!-- FILTROS COMPACTOS -->
                <div class="glass-card p-2 mb-4 rounded">
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 items-end">

                        <div class="">
                            <select class="form-select form-select-sm"
                                id="view-filter-status"
                                onchange="handleTicketFilter('status', this.value)">
                                <option value="">Estado</option>
                                <option value="Abierto">Abierto</option>
                                <option value="Cerrado">Cerrado</option>
                            </select>
                        </div>

                        <div class="">
                            <select class="form-select form-select-sm"
                                id="view-filter-priority"
                                onchange="handleTicketFilter('priority', this.value)">
                                <option value="">Prioridad</option>
                                <option value="Baja">Baja</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                            </select>
                        </div>

                        <div class="">
                            <select class="form-select form-select-sm"
                                id="view-filter-client"
                                onchange="handleTicketFilter('client', this.value)">
                                <option value="">Cliente</option>
                            </select>
                        </div>

                        <div class="">
                            <input type="date"
                                class="form-control form-control-sm"
                                id="view-filter-date-start"
                                onchange="handleTicketFilter('dateStart', this.value)">
                        </div>

                        <div class="">
                            <input type="date"
                                class="form-control form-control-sm"
                                id="view-filter-date-end"
                                onchange="handleTicketFilter('dateEnd', this.value)">
                        </div>

                        <div class="">
                            <button class="btn btn-outline-custom btn-sm w-full"
                                onclick="resetTicketFilters()"
                                title="Limpiar filtros">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                        </div>

                    </div>
                </div>

                <div class="flex justify-end mb-4">
                    <button class="btn btn-outline-light btn-sm" onclick="exportTicketsToCSV()">
                        <i class="bi bi-file-earmark-excel mr-2"></i>Exportar Excel (CSV)
                    </button>
                </div>

                <!-- Desktop: tabla -->
                <div class="glass-card overflow-hidden rounded hidden md:block">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>ID / Título</th>
                                    <th>Cliente</th>
                                    <th class="text-center">Tipo</th>
                                    <th class="text-center">Estado</th>
                                    <th class="text-center">Prioridad</th>
                                    <th class="text-center">Creado</th>
                                    <th class="text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="tickets-table-body-view"></tbody>
                        </table>
                    </div>
                </div>

                <!-- Mobile: cards -->
                <div id="tickets-cards-view" class="md:hidden flex flex-col gap-2"></div>

                <!-- Paginación (compartida) -->
                <div class="flex justify-between items-center mt-4 glass-card p-4 rounded">
                    <button class="btn btn-sm btn-outline-light" onclick="changePage(-1)">← Anterior</button>
                    <span id="pagination-info" class="text-sm text-dim"></span>
                    <button class="btn btn-sm btn-outline-light" onclick="changePage(1)">Siguiente →</button>
                </div>
            </div>
        </div>
        <!-- MODAL TICKET -->
            <div class="modal fade" id="ticketModalView" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content glass-card shadow-lg">
                        <div class="modal-header">
                            <h5 class="modal-title font-bold" id="ticketModalTitleView">Nuevo Ticket</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="ticketFormView">
                            <div class="modal-body p-6">
                                <input type="hidden" id="ticketIdView">

                                <div class="grid md:grid-cols-2 gap-2">

                                    <!-- TÍTULO -->
                                    <div class="">
                                        <label class="form-label text-dim text-sm font-bold required">TÍTULO DEL PROBLEMA</label>
                                        <input type="text" class="form-control text-main" id="ticketTitleView" required>
                                    </div>

                                    <!-- CLIENTE -->
                                    <div class="">
                                        <label class="form-label text-dim text-sm font-bold required">CLIENTE</label>
                                        <select class="form-select" id="ticketClientView" required></select>
                                    </div>

                                    <input type="hidden" id="ticketTypeView" value="Asistencia Externa">

                                    <!-- ESTADO -->
                                    <div class="">
                                        <label class="form-label text-dim text-sm font-bold">ESTADO</label>
                                        <select class="form-select" id="ticketStatusView">
                                            <option value="Abierto">Abierto</option>
                                                        <option value="Cerrado">Cerrado</option>
                                        </select>
                                    </div>

                                    <!-- PRIORIDAD -->
                                    <div class="">
                                        <label class="form-label text-dim text-sm font-bold">PRIORIDAD</label>
                                        <select class="form-select" id="ticketPriorityView">
                                            <option value="Baja">Baja</option>
                                            <option value="Media">Media</option>
                                            <option value="Alta">Alta</option>
                                        </select>
                                    </div>

                                    <!-- DESCRIPCIÓN (PROTAGONISTA) -->
                                    <div class="md:col-span-2 mt-2">
                                        <label class="form-label text-dim text-sm font-bold">DESCRIPCIÓN</label>
                                        <textarea
                                            class="form-control text-main ticket-textarea"
                                            id="ticketDescView"
                                            rows="10">
                                        </textarea>
                                    </div>

                                </div>
                            </div>

                            <div class="modal-footer p-4">
                                <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-sm btn-success">Guardar Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
    `;

    document.getElementById("ticketFormView").onsubmit = handleTicketSubmit;
    allTicketsView = window.ticketsData || [];
    renderTicketsList();
    populateTicketFilters();
    loadTicketsData();
}


async function populateTicketFilters() {
    try {
        const clients = await window.api.getClients() || [];
        const filterSelect = document.getElementById("view-filter-client");
        const modalSelect = document.getElementById("ticketClientView");

        if (!filterSelect || !modalSelect) return;

        const options = clients.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");

        filterSelect.innerHTML = '<option value="">Todos los clientes</option>' + options;
        modalSelect.innerHTML = '<option value="">-- Seleccionar --</option>' + options;

        if (ticketFilters.client) {
            filterSelect.value = ticketFilters.client;
        }
    } catch (err) {
        console.error("Error populating ticket filters:", err);
    }
}

function _clientDisplay(t) {
    const name = t.clientes ? escapeHtml(t.clientes.nombre) : null;
    const phone = t.chat_id ? escapeHtml(t.chat_id) : null;
    if (name && phone) return `${name} <span class="text-dim">(${phone})</span>`;
    return name || phone || 'Sin cliente';
}

function prependNewTickets(newTickets) {
    const tbody = document.getElementById("tickets-table-body-view");
    const cardsView = document.getElementById("tickets-cards-view");

    newTickets.forEach(t => {
        allTicketsView.unshift(t);

        if (tbody) {
            const tr = document.createElement("tr");
            tr.className = "ticket-row ticket-new-row";
            tr.innerHTML = `
                <td>
                    <div class="font-bold">#${t.id.substring(0, 8)}</div>
                    <div class="text-sm text-white">${escapeHtml(t.titulo)}</div>
                </td>
                <td>${_clientDisplay(t)}</td>
                <td class="text-center"><span class="text-sm text-dim">${escapeHtml(t.tipo)}</span></td>
                <td class="text-center"><span class="status-badge status-${t.estado.toLowerCase().replace(" ", "")}">${escapeHtml(t.estado)}</span></td>
                <td class="text-center"><span class="font-bold priority-${t.prioridad ? t.prioridad.toLowerCase() : 'baja'}">${escapeHtml(t.prioridad || 'Baja')}</span></td>
                <td class="text-center"><div class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</div></td>
                <td class="text-right">
                    <div class="flex gap-2 justify-end">
                        <button class="btn btn-sm btn-outline-light" onclick="openEditTicket('${t.id}')"><i class="bi bi-eye"></i></button>
                        ${t.estado === 'Cerrado' ? `<button class="btn btn-sm btn-outline-danger" onclick="handleDeleteTicket('${t.id}')"><i class="bi bi-trash"></i></button>` : ''}
                    </div>
                </td>
            `;
            tbody.insertBefore(tr, tbody.firstChild);
        }

        if (cardsView) {
            const card = _buildTicketCard(t, openEditTicket, handleDeleteTicket);
            card.classList.add('ticket-new-row');
            cardsView.insertBefore(card, cardsView.firstChild);
        }
    });

    lastTicketsCount = allTicketsView.length;
    window.ticketsData = allTicketsView;
}

async function loadTicketsData() {
    try {

        const previousCount = lastTicketsCount;

        allTicketsView = await window.api.getTickets() || [];
        window.ticketsData = allTicketsView;

        if (previousCount !== 0 && allTicketsView.length > previousCount) {
            const newTickets = allTicketsView.slice(0, allTicketsView.length - previousCount);
            newTickets.forEach(t => {
                const clientName = t.clientes?.nombre || t.chat_id || 'cliente desconocido';
                const phone = (t.clientes?.nombre && t.chat_id) ? ` (${t.chat_id})` : '';
                addNotification(
                    "ticket",
                    "Nuevo ticket pendiente",
                    `Nuevo ticket de: ${clientName}${phone} — ${t.titulo || 'Sin título'}`,
                    `ticket-${t.id}`
                );
            });
            const count = newTickets.length;
            showToast(`<i class="bi bi-ticket-perforated-fill mr-2"></i>${count === 1 ? 'Nuevo ticket pendiente' : `${count} nuevos tickets pendientes`}`, "danger");
        }

        lastTicketsCount = allTicketsView.length;
        renderTicketsList();

    } catch (err) {
        console.error("Error loading tickets:", err);
        showToast("Error al conectar con el servidor de tickets", "danger");
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

function getFilteredTickets() {
    return allTicketsView.filter(t => {
        if (ticketFilters.status && t.estado !== ticketFilters.status) return false;
        if (ticketFilters.priority && t.prioridad !== ticketFilters.priority) return false;
        if (ticketFilters.client && t.cliente_id !== ticketFilters.client) return false;
        if (ticketFilters.dateStart || ticketFilters.dateEnd) {
            const d = new Date(t.created_at).toISOString().split('T')[0];
            if (ticketFilters.dateStart && d < ticketFilters.dateStart) return false;
            if (ticketFilters.dateEnd && d > ticketFilters.dateEnd) return false;
        }
        return true;
    });
}

function _buildTicketCard(t, onOpen, onDelete) {
    const card = document.createElement("div");
    card.className = "glass-card no-hover p-4 rounded";
    card.style.cursor = "pointer";

    const phone = t.chat_id ? escapeHtml(t.chat_id) : null;
    const clientName = t.clientes ? escapeHtml(t.clientes.nombre) : null;
    const clientLine = clientName
        ? `${clientName}${phone ? ` <span class="text-dim">(${phone})</span>` : ''}`
        : (phone || 'Sin cliente');

    const clamp = 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';

    card.innerHTML = `
        <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
                <span class="text-dim text-sm">#${t.id.substring(0, 8)}</span>
                <span class="text-sm text-dim">${escapeHtml(t.tipo)}</span>
            </div>
            <div class="text-sm text-dim text-center">${clientLine}</div>
            <div class="font-bold text-center" style="${clamp}">${escapeHtml(t.titulo)}</div>
            ${t.descripcion ? `<div class="text-sm text-dim text-center" style="${clamp}">${escapeHtml(t.descripcion)}</div>` : ''}
            <div class="text-center">
                <span class="status-badge status-${t.estado.toLowerCase().replace(' ', '')}">${escapeHtml(t.estado)}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="font-bold text-sm priority-${t.prioridad ? t.prioridad.toLowerCase() : 'baja'}">${escapeHtml(t.prioridad || 'Baja')}</span>
                <span class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</span>
            </div>
            ${t.estado === 'Cerrado' ? `<div class="text-center"><button class="btn btn-sm btn-outline-danger btn-card-del"><i class="bi bi-trash"></i></button></div>` : ''}
        </div>
    `;

    card.onclick = (e) => {
        if (!e.target.closest('.btn-card-del')) onOpen(t.id);
    };
    if (t.estado === 'Cerrado') {
        card.querySelector('.btn-card-del').onclick = (e) => {
            e.stopPropagation();
            onDelete(t.id);
        };
    }
    return card;
}

function renderTicketsList() {
    const tbody = document.getElementById("tickets-table-body-view");
    const cardsView = document.getElementById("tickets-cards-view");
    const info = document.getElementById("pagination-info");

    const filtered = getFilteredTickets();

    if (filtered.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-dim py-12">No se encontraron tickets</td></tr>';
        if (cardsView) cardsView.innerHTML = '<div class="text-dim text-center py-12">No se encontraron tickets</div>';
        if (info) info.textContent = '';
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

    // Tabla (desktop)
    if (tbody) {
        tbody.innerHTML = "";
        paginated.forEach(t => {
            const tr = document.createElement("tr");
            tr.className = "ticket-row";
            tr.innerHTML = `
                <td>
                    <div class="font-bold">#${t.id.substring(0, 8)}</div>
                    <div class="text-sm text-white">${escapeHtml(t.titulo)}</div>
                </td>
                <td>${_clientDisplay(t)}</td>
                <td class="text-center"><span class="text-sm text-dim">${escapeHtml(t.tipo)}</span></td>
                <td class="text-center"><span class="status-badge status-${t.estado.toLowerCase().replace(" ", "")}">${escapeHtml(t.estado)}</span></td>
                <td class="text-center"><span class="font-bold priority-${t.prioridad ? t.prioridad.toLowerCase() : 'baja'}">${escapeHtml(t.prioridad || 'Baja')}</span></td>
                <td class="text-center"><div class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</div></td>
                <td class="text-right">
                    <div class="flex gap-2 justify-end">
                        <button class="btn btn-sm btn-outline-light" onclick="openEditTicket('${t.id}')"><i class="bi bi-eye"></i></button>
                        ${t.estado === 'Cerrado' ? `<button class="btn btn-sm btn-outline-danger" onclick="handleDeleteTicket('${t.id}')"><i class="bi bi-trash"></i></button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Cards (mobile/tablet)
    if (cardsView) {
        cardsView.innerHTML = "";
        paginated.forEach(t => {
            cardsView.appendChild(_buildTicketCard(t, openEditTicket, handleDeleteTicket));
        });
    }

    if (info) info.textContent = `Página ${currentPage} de ${totalPages}`;
}

function openNewTicketModal() {
    document.getElementById("ticketFormView").reset();
    document.getElementById("ticketIdView").value = "";
    document.getElementById("ticketModalTitleView").innerText = "Nuevo Ticket";
    if (ticketFilters.client) {
        document.getElementById("ticketClientView").value = ticketFilters.client;
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("ticketModalView")).show();
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
    bootstrap.Modal.getOrCreateInstance(document.getElementById("ticketModalView")).show();
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
    const filtered = getFilteredTickets();

    if (filtered.length === 0) {
        showToast("No hay tickets para exportar", "warning");
        return;
    }

    // FIX: Escapar comas y comillas para evitar corrupción del CSV
    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;

    const headers = ["ID", "Título", "Cliente", "Tipo", "Estado", "Prioridad", "Creado"];
    const rows = filtered.map(t => [
        escapeCSV(t.id),
        escapeCSV(t.titulo),
        escapeCSV(t.clientes ? t.clientes.nombre : (t.chat_id || 'Sin cliente')),
        escapeCSV(t.tipo),
        escapeCSV(t.estado),
        escapeCSV(t.prioridad || 'Baja'),
        escapeCSV(new Date(t.created_at).toLocaleDateString())
    ]);

    let csvContent = "data:text/csv;charset=utf-8,﻿"
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

function changePage(direction) {
    const filtered = getFilteredTickets();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

    currentPage += direction;

    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    renderTicketsList();
}

// -----------------------------------------------
// TABS DE CLIENTE: Tickets inline en client-detail
// -----------------------------------------------

async function renderClientTicketsTab(clientId, container, clientTelefono = null) {
    container.innerHTML = `
        <div>
            <div class="flex justify-between items-center mb-4">
                <h6 class="text-dim text-sm font-bold mb-0" id="client-tickets-header">TICKETS DEL CLIENTE</h6>
                <button class="btn btn-outline-light btn-sm" id="btn-new-client-ticket">
                    <i class="bi bi-plus-circle mr-2"></i>Nuevo Ticket
                </button>
            </div>
            <!-- Desktop: tabla -->
            <div class="glass-card overflow-hidden rounded hidden md:block">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>Titulo</th>
                                <th class="text-center">Tipo</th>
                                <th class="text-center">Estado</th>
                                <th class="text-center">Prioridad</th>
                                <th class="text-center">Fecha</th>
                                <th class="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="client-tickets-tbody"></tbody>
                    </table>
                </div>
            </div>
            <!-- Mobile: cards -->
            <div id="client-tickets-cards" class="md:hidden flex flex-col gap-2"></div>
        </div>
    `;

    // Modal must live on <body> — rendering it inside a glass-card/animate-fade
    // container creates a CSS stacking context (backdrop-filter) that traps the
    // modal, making it appear "behind" the page and non-interactable.
    const existing = document.getElementById("clientTicketModal");
    if (existing) existing.remove();

    const modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.id = "clientTicketModal";
    modalEl.setAttribute("tabindex", "-1");
    modalEl.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content glass-card shadow-lg">
                <div class="modal-header">
                    <h5 class="modal-title font-bold" id="clientTicketModalTitle">Nuevo Ticket</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <form id="clientTicketForm">
                    <div class="modal-body p-6">
                        <input type="hidden" id="clientTicketId">
                        <div class="grid md:grid-cols-2 gap-2">
                            <div class="">
                                <label class="form-label text-dim text-sm font-bold required">TITULO</label>
                                <input type="text" class="form-control text-main" id="clientTicketTitle" required>
                            </div>
                            <input type="hidden" id="clientTicketType" value="Asistencia Externa">
                            <div class="">
                                <label class="form-label text-dim text-sm font-bold">ESTADO</label>
                                <select class="form-select" id="clientTicketStatus">
                                    <option value="Abierto">Abierto</option>
                                        <option value="Cerrado">Cerrado</option>
                                </select>
                            </div>
                            <div class="">
                                <label class="form-label text-dim text-sm font-bold">PRIORIDAD</label>
                                <select class="form-select" id="clientTicketPriority">
                                    <option value="Baja">Baja</option>
                                    <option value="Media">Media</option>
                                    <option value="Alta">Alta</option>
                                </select>
                            </div>
                            <div class="md:col-span-2 mt-2">
                                <label class="form-label text-dim text-sm font-bold">DESCRIPCION</label>
                                <textarea class="form-control text-main ticket-textarea"
                                    id="clientTicketDesc" rows="6"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer p-4">
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="submit" class="btn btn-sm btn-success">Guardar Ticket</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    document.getElementById("btn-new-client-ticket").onclick = () => {
        document.getElementById("clientTicketForm").reset();
        document.getElementById("clientTicketId").value = "";
        document.getElementById("clientTicketModalTitle").innerText = "Nuevo Ticket";
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    };

    document.getElementById("clientTicketForm").onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("clientTicketId").value;
        const data = {
            titulo: document.getElementById("clientTicketTitle").value,
            cliente_id: clientId,
            tipo: document.getElementById("clientTicketType").value,
            estado: document.getElementById("clientTicketStatus").value,
            prioridad: document.getElementById("clientTicketPriority").value,
            descripcion: document.getElementById("clientTicketDesc").value
        };
        try {
            if (id) {
                await window.api.updateTicket(id, data);
                showToast("Ticket actualizado", "success");
            } else {
                await window.api.createTicket(data);
                showToast("Ticket creado correctamente", "success");
            }
            bootstrap.Modal.getInstance(modalEl).hide();
            loadClientTickets(clientId, clientTelefono);
        } catch {
            showToast("Error al guardar ticket", "danger");
        }
    };

    loadClientTickets(clientId, clientTelefono);
}

async function loadClientTickets(clientId, clientTelefono = null) {
    const tbody = document.getElementById("client-tickets-tbody");
    const cardsView = document.getElementById("client-tickets-cards");

    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-dim"></div></td></tr>';
    if (cardsView) cardsView.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-dim"></div></div>';

    const openTicketModal = (t) => {
        document.getElementById("clientTicketId").value = t.id;
        document.getElementById("clientTicketTitle").value = t.titulo;
        document.getElementById("clientTicketType").value = t.tipo;
        document.getElementById("clientTicketStatus").value = t.estado;
        document.getElementById("clientTicketPriority").value = t.prioridad;
        document.getElementById("clientTicketDesc").value = t.descripcion || "";
        document.getElementById("clientTicketModalTitle").innerText = "Editar Ticket";
        bootstrap.Modal.getOrCreateInstance(document.getElementById("clientTicketModal")).show();
    };

    const deleteTicket = async (id) => {
        if (!confirm("¿Seguro que queres eliminar este ticket?")) return;
        try {
            await window.api.deleteTicket(id);
            showToast("Ticket eliminado", "warning");
            loadClientTickets(clientId, clientTelefono);
        } catch {
            showToast("Error al eliminar ticket", "danger");
        }
    };

    try {
        const [allTickets, clientProjects] = await Promise.all([
            window.api.getTickets(),
            window.api.getClientProjects(clientId)
        ]);
        const tickets = (allTickets || []).filter(t =>
            t.cliente_id === clientId ||
            (clientTelefono && t.chat_id === clientTelefono) ||
            (t.project_id && (clientProjects || []).includes(t.project_id))
        );

        if (tbody) tbody.innerHTML = "";
        if (cardsView) cardsView.innerHTML = "";

        const headerEl = document.getElementById("client-tickets-header");
        if (headerEl) {
            const pending = tickets.filter(t => t.estado !== 'Cerrado').length;
            headerEl.innerHTML = `TICKETS DEL CLIENTE${pending > 0 ? ` <span class="badge badge-status-danger ml-1">${pending} pendiente${pending !== 1 ? 's' : ''}</span>` : ''}`;
        }

        if (tickets.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-dim py-12">No hay tickets para este cliente</td></tr>';
            if (cardsView) cardsView.innerHTML = '<div class="text-dim text-center py-6">No hay tickets para este cliente</div>';
            return;
        }

        tickets.forEach(t => {
            // Fila de tabla (desktop)
            if (tbody) {
                const tr = document.createElement("tr");
                tr.className = "ticket-row";
                tr.innerHTML = `
                    <td>
                        <div class="font-bold text-sm">#${t.id.substring(0, 8)}</div>
                        <div class="text-sm text-white">${escapeHtml(t.titulo)}</div>
                    </td>
                    <td class="text-center"><span class="text-sm text-dim">${escapeHtml(t.tipo)}</span></td>
                    <td class="text-center"><span class="status-badge status-${t.estado.toLowerCase().replace(" ", "")}">${escapeHtml(t.estado)}</span></td>
                    <td class="text-center"><span class="font-bold priority-${t.prioridad ? t.prioridad.toLowerCase() : 'baja'}">${escapeHtml(t.prioridad || 'Baja')}</span></td>
                    <td class="text-center"><div class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</div></td>
                    <td class="text-right">
                        <div class="flex gap-2 justify-end">
                            <button class="btn btn-sm btn-outline-light btn-edit-ct"><i class="bi bi-eye"></i></button>
                            ${t.estado === 'Cerrado' ? `<button class="btn btn-sm btn-outline-danger btn-delete-ct"><i class="bi bi-trash"></i></button>` : ''}
                        </div>
                    </td>
                `;
                tr.querySelector(".btn-edit-ct").onclick = () => openTicketModal(t);
                if (t.estado === 'Cerrado') {
                    tr.querySelector(".btn-delete-ct").onclick = () => deleteTicket(t.id);
                }
                tbody.appendChild(tr);
            }

            // Card (mobile/tablet)
            if (cardsView) {
                const card = document.createElement("div");
                card.className = "glass-card no-hover p-4 rounded";
                card.style.cursor = "pointer";
                const clamp = 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';
                card.innerHTML = `
                    <div class="flex flex-col gap-2">
                        <div class="flex justify-between items-center">
                            <span class="text-dim text-sm">#${t.id.substring(0, 8)}</span>
                            <span class="text-sm text-dim">${escapeHtml(t.tipo)}</span>
                        </div>
                        <div class="font-bold text-center" style="${clamp}">${escapeHtml(t.titulo)}</div>
                        ${t.descripcion ? `<div class="text-sm text-dim text-center" style="${clamp}">${escapeHtml(t.descripcion)}</div>` : ''}
                        <div class="text-center">
                            <span class="status-badge status-${t.estado.toLowerCase().replace(' ', '')}">${escapeHtml(t.estado)}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-sm priority-${t.prioridad ? t.prioridad.toLowerCase() : 'baja'}">${escapeHtml(t.prioridad || 'Baja')}</span>
                            <span class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                        ${t.estado === 'Cerrado' ? `<div class="text-center"><button class="btn btn-sm btn-outline-danger btn-card-del-ct"><i class="bi bi-trash"></i></button></div>` : ''}
                    </div>
                `;
                card.onclick = (e) => {
                    if (!e.target.closest('.btn-card-del-ct')) openTicketModal(t);
                };
                if (t.estado === 'Cerrado') {
                    card.querySelector('.btn-card-del-ct').onclick = (e) => {
                        e.stopPropagation();
                        deleteTicket(t.id);
                    };
                }
                cardsView.appendChild(card);
            }
        });
    } catch {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-4">Error al cargar tickets</td></tr>';
        if (cardsView) cardsView.innerHTML = '<div class="text-red-400 text-center py-4">Error al cargar tickets</div>';
    }
}
