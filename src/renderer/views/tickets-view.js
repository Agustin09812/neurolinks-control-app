
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
        <div class="animate-fade" style="height: 100%;">
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
                                    <th class="text-center">Estado</th>
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
    `;

    allTicketsView = window.ticketsData || [];
    renderTicketsList();
    populateTicketFilters();
    loadTicketsData();
}

function updateProjectDropdown(clientId, selectedProjectId = "") {
    const projSelect = document.getElementById("ticketProjectView");
    if (!projSelect) return;
    projSelect.innerHTML = '<option value="">-- Sin proyecto --</option>';
    if (!clientId) return;

    const client = (window.clientsData || []).find(c => String(c.id) === String(clientId));
    if (client && client.railway_project_ids && Array.isArray(client.railway_project_ids)) {
        client.railway_project_ids.forEach(projId => {
            const proj = window.assistants ? window.assistants.find(a => String(a.id) === String(projId)) : null;
            const projName = proj ? proj.name : projId;
            const opt = document.createElement("option");
            opt.value = projId;
            opt.textContent = projName;
            if (String(projId) === String(selectedProjectId)) opt.selected = true;
            projSelect.appendChild(opt);
        });
    }
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
    let clientStr = name || phone || 'Sin cliente';
    if (name && phone) clientStr = `${name} <span class="text-dim">(${phone})</span>`;
    
    if (t.project_id) {
        const proj = window.assistants ? window.assistants.find(a => String(a.id) === String(t.project_id)) : null;
        const projName = proj ? proj.name : 'Proyecto Desconocido';
        clientStr += `<br><span class="text-dim text-xs" style="margin-top:2px; display:inline-block;"><i class="bi bi-box-arrow-up-right mr-1"></i>Proveniente de ${escapeHtml(projName)}</span>`;
    }
    return clientStr;
}

function prependNewTickets(newTickets) {
    const tbody = document.getElementById("tickets-table-body-view");
    const cardsView = document.getElementById("tickets-cards-view");

    const filteredTickets = newTickets.filter(t => t.tipo === 'Soporte');

    filteredTickets.forEach(t => {
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
                <td class="text-center"><span class="status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}">${escapeHtml(t.estado || '')}</span></td>
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

// Total de tickets en el servidor (para paginación)
let _serverTotalTickets = 0;

async function loadTicketsData() {
    try {
        const res = await window.api.getTickets({
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            ...(ticketFilters.status    ? { estado: ticketFilters.status }         : {}),
            ...(ticketFilters.client    ? { cliente_id: ticketFilters.client }     : {}),
        });
        // El backend ahora devuelve { data, total, page, limit }
        const tickets = res?.data || [];
        _serverTotalTickets = res?.total || 0;
        allTicketsView = tickets; // solo la página actual
        window.ticketsData = tickets;
        renderTicketsList();
    } catch (err) {
        console.error("Error loading tickets:", err);
        showToast("Error al conectar con el servidor de tickets", "danger");
    }
}

function handleTicketFilter(key, val) {
    ticketFilters[key] = val;
    currentPage = 1;
    loadTicketsData(); // recarga desde el servidor con el filtro
}

function resetTicketFilters() {
    ticketFilters = { status: "", type: "", client: "", priority: "", dateStart: "", dateEnd: "" };
    if (document.getElementById("view-filter-status")) document.getElementById("view-filter-status").value = "";
    if (document.getElementById("view-filter-client")) document.getElementById("view-filter-client").value = "";
    if (document.getElementById("view-filter-date-start")) document.getElementById("view-filter-date-start").value = "";
    if (document.getElementById("view-filter-date-end")) document.getElementById("view-filter-date-end").value = "";
    currentPage = 1;
    loadTicketsData(); // recarga desde el servidor
}

// getFilteredTickets solo filtra por fecha (los demás filtros ya vienen del servidor)
function getFilteredTickets() {
    return allTicketsView.filter(t => {
        if (ticketFilters.dateStart || ticketFilters.dateEnd) {
            const d = new Date(t.created_at).toISOString().split('T')[0];
            if (ticketFilters.dateStart && d < ticketFilters.dateStart) return false;
            if (ticketFilters.dateEnd   && d > ticketFilters.dateEnd)   return false;
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

    const proj = t.project_id && window.assistants ? window.assistants.find(a => String(a.id) === String(t.project_id)) : null;
    const projectLine = proj ? `<div class="text-xs text-dim text-center mt-1"><i class="bi bi-box-arrow-up-right mr-1"></i>Proveniente de ${escapeHtml(proj.name)}</div>` : '';

    const clamp = 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';

    card.innerHTML = `
        <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
                <span class="text-dim text-sm">#${t.id.substring(0, 8)}</span>
                <span class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</span>
            </div>
            <div class="text-center"><span class="status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}">${escapeHtml(t.estado || '')}</span></div>
            <div class="text-sm text-dim text-center">${clientLine}</div>
            ${projectLine}
            <div class="font-bold text-center" style="${clamp}">${escapeHtml(t.titulo)}</div>
            ${t.descripcion ? `<div class="text-sm text-dim text-center" style="${clamp}">${escapeHtml(t.descripcion)}</div>` : ''}
            ${t.estado === 'Cerrado' ? `<div class="text-center"><button class="btn btn-sm btn-outline-danger btn-card-del"><i class="bi bi-trash"></i></button></div>` : '<div></div>'}
        </div>
    `;

    card.onclick = (e) => {
        if (!e.target.closest('.btn-card-del')) onOpen(t.id);
    };
    const delBtn = card.querySelector('.btn-card-del');
    if (delBtn) delBtn.onclick = (e) => {
        e.stopPropagation();
        onDelete(t.id);
    };
    return card;
}

function renderTicketsList() {
    const tbody = document.getElementById("tickets-table-body-view");
    const cardsView = document.getElementById("tickets-cards-view");
    const info = document.getElementById("pagination-info");

    const filtered = getFilteredTickets(); // fecha local, resto ya viene del servidor
    const totalPages = Math.max(1, Math.ceil(_serverTotalTickets / ITEMS_PER_PAGE));

    if (filtered.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-dim py-12">No se encontraron tickets</td></tr>';
        if (cardsView) cardsView.innerHTML = '<div class="text-dim text-center py-12">No se encontraron tickets</div>';
        if (info) info.textContent = _serverTotalTickets > 0 ? `Página ${currentPage} de ${totalPages}` : '';
        return;
    }

    // Tabla (desktop)
    if (tbody) {
        tbody.innerHTML = "";
        filtered.forEach(t => {
            const tr = document.createElement("tr");
            tr.className = "ticket-row";
            tr.innerHTML = `
                <td>
                    <div class="font-bold">#${t.id.substring(0, 8)}</div>
                    <div class="text-sm text-white">${escapeHtml(t.titulo)}</div>
                </td>
                <td>${_clientDisplay(t)}</td>
                <td class="text-center"><span class="status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}">${escapeHtml(t.estado || '')}</span></td>
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
        filtered.forEach(t => {
            cardsView.appendChild(_buildTicketCard(t, openEditTicket, handleDeleteTicket));
        });
    }

    if (info) info.textContent = `Página ${currentPage} de ${totalPages}`;
}

async function openNewTicketModal() {
    await populateTicketModalClients();
    document.getElementById("ticketFormView").reset();
    document.getElementById("ticketIdView").value = "";
    document.getElementById("ticketModalTitleView").innerText = "Nuevo Ticket";
    document.getElementById("ticketDescContainerView").style.display = "block";
    if (ticketFilters.client) {
        document.getElementById("ticketClientView").value = ticketFilters.client;
        updateProjectDropdown(ticketFilters.client);
    } else {
        updateProjectDropdown("");
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("ticketModalView")).show();
}

function openEditTicket(id) {
    window.currentChatTicketId = id;
    window.currentChatTicketBackView = 'tickets';
    localStorage.setItem('currentChatTicketId', id);
    localStorage.setItem('currentChatTicketBackView', 'tickets');
    navigate('ticket-chat');
}

// NOTE: renderTicketChatView is called directly by SmartRefresh when active view is 'ticket-chat'.
// No wrapper override needed here.

async function handleTicketSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("ticketIdView").value;
    const data = {
        titulo: document.getElementById("ticketTitleView").value,
        cliente_id: document.getElementById("ticketClientView").value,
        project_id: document.getElementById("ticketProjectView")?.value || null,
        descripcion: document.getElementById("ticketDescView").value,
        estado: document.getElementById("ticketEstadoView").value
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

    const headers = ["ID", "Título", "Cliente", "Estado", "Creado"];
    const rows = filtered.map(t => [
        escapeCSV(t.id),
        escapeCSV(t.titulo),
        escapeCSV(t.clientes ? t.clientes.nombre : 'Sin cliente'),
        escapeCSV(t.estado || ''),
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
    const totalPages = Math.max(1, Math.ceil(_serverTotalTickets / ITEMS_PER_PAGE));
    currentPage = Math.max(1, Math.min(currentPage + direction, totalPages));
    loadTicketsData(); // carga la nueva página desde el servidor
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
                                <th class="text-center">Estado</th>
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

    document.getElementById("btn-new-client-ticket").onclick = async () => {
        await populateTicketModalClients();
        document.getElementById("ticketFormView").reset();
        document.getElementById("ticketIdView").value = "";
        document.getElementById("ticketModalTitleView").innerText = "Nuevo Ticket";
        document.getElementById("ticketDescContainerView").style.display = "block";
        document.getElementById("ticketClientView").value = clientId;
        updateProjectDropdown(clientId);
        bootstrap.Modal.getOrCreateInstance(document.getElementById("ticketModalView")).show();
    };

    loadClientTickets(clientId, clientTelefono);
}

async function loadClientTickets(clientId, clientTelefono = null) {
    const tbody = document.getElementById("client-tickets-tbody");
    const cardsView = document.getElementById("client-tickets-cards");

    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><div class="spinner-border spinner-border-sm text-dim"></div></td></tr>';
    if (cardsView) cardsView.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-dim"></div></div>';

    window.openTicketModal = (t) => {
        window.currentChatTicketId = t.id;
        window.currentChatTicketBackView = 'clients';
        localStorage.setItem('currentChatTicketId', t.id);
        localStorage.setItem('currentChatTicketBackView', 'clients');
        navigate('ticket-chat');
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
        const [ticketsRes, clientProjects] = await Promise.all([
            window.api.getTickets({ cliente_id: clientId, limit: 500 }),
            window.api.getClientProjects(clientId)
        ]);
        const allTickets = ticketsRes?.data || [];
        const tickets = allTickets.filter(t =>
            (t.cliente_id === clientId ||
                (t.project_id && (clientProjects || []).includes(t.project_id))) &&
            t.tipo === 'Soporte'
        );
        window.clientTicketsData = tickets;

        if (tbody) tbody.innerHTML = "";
        if (cardsView) cardsView.innerHTML = "";

        const headerEl = document.getElementById("client-tickets-header");
        if (headerEl) {
            const pendingCount = tickets.filter(t => t.estado !== 'Cerrado').length;
            headerEl.innerHTML = `TICKETS DEL CLIENTE${pendingCount > 0 ? ` <span class="badge badge-status-danger ml-1">${pendingCount}</span>` : ''}`;
        }

        if (tickets.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-dim py-12">No hay tickets para este cliente</td></tr>';
            if (cardsView) cardsView.innerHTML = '<div class="text-dim text-center py-6">No hay tickets para este cliente</div>';
            return;
        }

        tickets.forEach(t => {
            // Fila de tabla (desktop)
            if (tbody) {
                const proj = t.project_id && window.assistants ? window.assistants.find(a => String(a.id) === String(t.project_id)) : null;
                const projectText = proj ? `<div class="text-xs text-dim mt-0.5"><i class="bi bi-box-arrow-up-right mr-1"></i>Proveniente de ${escapeHtml(proj.name)}</div>` : '';

                const tr = document.createElement("tr");
                tr.className = "ticket-row";
                tr.innerHTML = `
                    <td>
                        <div class="font-bold text-sm">#${t.id.substring(0, 8)}</div>
                        <div class="text-sm text-white">${escapeHtml(t.titulo)}</div>
                        ${projectText}
                    </td>
                    <td class="text-center"><span class="status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}">${escapeHtml(t.estado || '')}</span></td>
                    <td class="text-center"><div class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</div></td>
                    <td class="text-right">
                        <div class="flex gap-2 justify-end">
                            <button class="btn btn-sm btn-outline-light btn-edit-ct"><i class="bi bi-eye"></i></button>
                            ${t.estado === 'Cerrado' ? '<button class="btn btn-sm btn-outline-danger btn-delete-ct"><i class="bi bi-trash"></i></button>' : ''}
                        </div>
                    </td>
                `;
                tr.querySelector(".btn-edit-ct").onclick = () => openTicketModal(t);
                const delBtn = tr.querySelector(".btn-delete-ct");
                if (delBtn) delBtn.onclick = () => deleteTicket(t.id);
                tbody.appendChild(tr);
            }

            // Card (mobile/tablet)
            if (cardsView) {
                const proj = t.project_id && window.assistants ? window.assistants.find(a => String(a.id) === String(t.project_id)) : null;
                const projectText = proj ? `<div class="text-xs text-dim text-center mt-1"><i class="bi bi-box-arrow-up-right mr-1"></i>Proveniente de ${escapeHtml(proj.name)}</div>` : '';

                const card = document.createElement("div");
                card.className = "glass-card no-hover p-4 rounded";
                card.style.cursor = "pointer";
                const clamp = 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';
                card.innerHTML = `
                    <div class="flex flex-col gap-2">
                        <div class="flex justify-between items-center">
                            <span class="text-dim text-sm">#${t.id.substring(0, 8)}</span>
                            <span class="text-sm text-dim">${new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="text-center"><span class="status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}">${escapeHtml(t.estado || '')}</span></div>
                        ${projectText}
                        <div class="font-bold text-center" style="${clamp}">${escapeHtml(t.titulo)}</div>
                        ${t.descripcion ? `<div class="text-sm text-dim text-center" style="${clamp}">${escapeHtml(t.descripcion)}</div>` : ''}
                        ${t.estado === 'Cerrado' ? '<div class="text-center"><button class="btn btn-sm btn-outline-danger btn-card-del-ct"><i class="bi bi-trash"></i></button></div>' : ''}
                    </div>
                `;
                card.onclick = (e) => {
                    if (!e.target.closest('.btn-card-del-ct')) openTicketModal(t);
                };
                const cardDel = card.querySelector('.btn-card-del-ct');
                if (cardDel) cardDel.onclick = (e) => {
                    e.stopPropagation();
                    deleteTicket(t.id);
                };
                cardsView.appendChild(card);
            }
        });



    } catch (err) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-400 py-4">Error cargando tickets</td></tr>';
        if (cardsView) cardsView.innerHTML = '<div class="text-center text-red-400 py-4">Error cargando tickets</div>';
    }
}


// ticket-chat.view.js
// Nueva vista dinámica para la conversación de un ticket individual

async function renderTicketChatView() {
    const container = document.getElementById("ticket-chat-view");
    if (!container) return;

    const tickId = window.currentChatTicketId;
    if (!tickId) {
        navigate(window.currentChatTicketBackView || 'dashboard');
        return;
    }

    // Guard: definir goBack inmediatamente para que el botón nunca falle
    // aunque el usuario lo presione antes de que la carga async termine.
    if (!window.goBackFromTicketChat) {
        window.goBackFromTicketChat = function() {
            navigate(window.currentChatTicketBackView || 'tickets').then(() => {
                localStorage.removeItem('currentChatTicketId');
                localStorage.removeItem('currentChatTicketBackView');
            });
        };
    }


    // Buscar el ticket completo desde la API (trae chats_adjuntos frescos)
    let tick;
    try {
        tick = await window.api.getTicketById(tickId);
    } catch(e) {
        // fallback a caché local si la API falla
        tick = allTicketsView?.find(t => String(t.id) === String(tickId));
        if (!tick && window.clientTicketsData) {
            tick = window.clientTicketsData.find(t => String(t.id) === String(tickId));
        }
    }

    if (!tick) {
        container.innerHTML = '<div class="p-6 text-center text-dim">Ticket no encontrado</div>';
        return;
    }

    // Definir goBackFromTicketChat DESPUÉS de cargar tick, para usar tick.cliente_id directamente
    window.goBackFromTicketChat = function() {
        const backView = window.currentChatTicketBackView || 'tickets';
        navigate(backView).then(() => {
            localStorage.removeItem('currentChatTicketId');
            localStorage.removeItem('currentChatTicketBackView');
            if (backView === 'clients' && tick && tick.cliente_id && typeof openClientDetail === 'function') {
                setTimeout(() => { openClientDetail(tick.cliente_id); }, 50);
            }
        });
    };

    // --- ACTUALIZACIÓN DE LECTURA AUTOMÁTICA ---
    let currentChatsTemp = [];
    if (tick.chats_adjuntos) {
        if (typeof tick.chats_adjuntos === "string") {
            try { currentChatsTemp = JSON.parse(tick.chats_adjuntos); } catch(e){}
        } else if (Array.isArray(tick.chats_adjuntos)) {
            currentChatsTemp = tick.chats_adjuntos;
        }
    }
    const totalMsgCount = (tick.descripcion ? 1 : 0) + currentChatsTemp.length;
    const currentReadCount = tick.read_admin_count || 0;
    if (totalMsgCount > currentReadCount) {
        tick.read_admin_count = totalMsgCount;
        window.api.updateTicket(tick.id, { read_admin_count: totalMsgCount }).catch(() => {});
    }
    // -------------------------------------------

    const isSameTicketAndRendered = container.getAttribute('data-ticket-id') === String(tickId) && document.getElementById("tchat-messages");

    // Preservar scroll
    let isAtBottom = true;
    let oldScrollTop = 0;
    const oldMessagesContainer = document.getElementById("tchat-messages");
    if (oldMessagesContainer) {
        isAtBottom = Math.abs(oldMessagesContainer.scrollHeight - oldMessagesContainer.scrollTop - oldMessagesContainer.clientHeight) < 15;
        oldScrollTop = oldMessagesContainer.scrollTop;
    }

    const renderMessagesHtml = (ticket) => {
        let chats = [];
        if (ticket.chats_adjuntos) {
            if (typeof ticket.chats_adjuntos === "string") {
                try { chats = JSON.parse(ticket.chats_adjuntos); } catch(e){}
            } else if (Array.isArray(ticket.chats_adjuntos)) {
                chats = ticket.chats_adjuntos;
            }
        }

        let html = "";
        if (ticket.descripcion) {
            html += `
                <div class="wa-chat-msg cliente">
                    <span>${escapeHtml(ticket.descripcion)}</span>
                    <span class="wa-chat-time">Ticket inicial</span>
                </div>
            `;
        }

        if (chats.length === 0 && !ticket.descripcion) {
            html = '<div class="text-center mt-6 p-4 glass-card mx-auto" style="max-width: 300px;"><div class="text-dim text-sm"><i class="bi bi-chat-left-dots mb-2 fs-3 block"></i><br>No hay mensajes aún.</div></div>';
        } else {
            chats.forEach(msg => {
                const isMe = msg.rol === 'admin';
                const dateStr = new Date(msg.timestamp || msg.fecha || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                html += `
                    <div class="wa-chat-msg ${isMe ? 'admin' : 'cliente'}">
                        ${msg.mensaje ? `<span>${escapeHtml(msg.mensaje)}</span>` : ''}
                        <span class="wa-chat-time">${dateStr}</span>
                    </div>
                `;
            });
        }
        return html;
    };

    if (isSameTicketAndRendered) {
        const messagesContainer = document.getElementById("tchat-messages");
        messagesContainer.innerHTML = renderMessagesHtml(tick);
        
        const titleEl = document.getElementById("tchat-header-title");
        if (titleEl) {
            titleEl.innerText = tick.titulo || 'Ticket';
            titleEl.title = tick.titulo || 'Ticket';
        }
        
        const statusEl = document.getElementById("tchat-status");
        if (statusEl) statusEl.value = tick.estado;
        
        const inputField = document.getElementById("tchat-input");
        const sendBtn = document.getElementById("tchat-send-btn");
        if (inputField && sendBtn) {
            if (tick.estado === 'Cerrado') {
                inputField.disabled = true;
                sendBtn.disabled = true;
                inputField.placeholder = "Conversación finalizada";
            } else {
                inputField.disabled = false;
                sendBtn.disabled = false;
                if (inputField.placeholder === "Conversación finalizada") {
                    inputField.placeholder = "Escribe un mensaje...";
                }
            }
        }

        setTimeout(() => { 
            if (isAtBottom) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight; 
            } else {
                messagesContainer.scrollTop = oldScrollTop;
            }
        }, 50);

        return;
    }

    container.setAttribute('data-ticket-id', String(tickId));

    // Buscar nombre del cliente
    let clientName = "Cliente";
    if (window.clientsData && window.clientsData.length > 0) {
        const client = window.clientsData.find(c => c.id === tick.cliente_id);
        if (client) clientName = client.nombre;
    } else {
        const select = document.getElementById("ticketClientView");
        if (select && select.options) {
            for (let i=0; i<select.options.length; i++) {
                if (select.options[i].value === tick.cliente_id) {
                    clientName = select.options[i].text;
                    break;
                }
            }
        }
    }

    const initials = clientName.substring(0,2).toUpperCase();

    container.innerHTML = `
        <style>
        .wa-chat-msg { max-width: 85%; padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.95rem; position: relative; line-height: 1.5; word-wrap: break-word; transition: var(--transition-fast); }
        .wa-chat-msg.admin { background: var(--accent); color: white; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 4px 12px rgba(0, 120, 212, 0.2); }
        .wa-chat-msg.cliente { background: var(--bg-card); border: 1px solid var(--border-soft); color: var(--text-main); align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: var(--glass-shadow); }
        .wa-chat-time { font-size: 0.7rem; color: var(--text-dim); margin-top: 6px; display: block; text-align: right; }
        .wa-chat-msg.admin .wa-chat-time { color: rgba(255, 255, 255, 0.7); }
        .wa-chat-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: transparent; }
        .tchat-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .tchat-select-wrap { flex-shrink: 0; }
        .tchat-label-container { 
            display: flex; align-items: center; gap: 0.75rem; margin: 0; cursor: pointer;
            background: rgba(128, 128, 128, 0.08);
            border: 1px solid var(--border-soft);
            padding: 4px 6px 4px 14px;
            border-radius: 8px;
        }
        .tchat-select { padding: 6px 12px; font-size: 0.875rem; min-width: 120px; }
        .tchat-label { font-size: 0.75rem; margin: 0; }
        @media (max-width: 767px) {
            .tchat-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
            .tchat-select-wrap { padding-left: 56px; }
            .tchat-select { padding: 4px 8px; font-size: 0.75rem; min-width: 100px; }
            .tchat-label { font-size: 0.65rem; }
        }
        </style>
        <div class="animate-fade wa-chat-container relative">
            <!-- BG Grid layer -->
            <div class="absolute inset-0 bg-grid opacity-30 pointer-events-none -z-10"></div>
            
            <!-- HEADER -->
            <div class="glass-header px-6 py-4 z-10 shadow-sm border-b border-[var(--border-soft)] tchat-header">
                <div class="flex items-center gap-4 flex-1 min-w-0 w-full">
                    <button class="btn btn-outline-secondary btn-sm rounded-circle flex items-center justify-center shrink-0" onclick="goBackFromTicketChat()" title="Volver" style="width: 40px; height: 40px; padding: 0;">
                        <i class="bi bi-arrow-left fs-5"></i>
                    </button>
                    <div class="client-avatar shrink-0 hidden sm:flex">${initials}</div>
                    <div class="flex-1 min-w-0">
                        <div class="text-xs text-dim font-mono mb-0.5">#${tick.id.substring(0,8)}</div>
                        <div class="text-sm text-dim font-medium truncate mb-0.5">
                            ${escapeHtml(clientName)}
                            ${tick.project_id && window.assistants ? (window.assistants.find(a => String(a.id) === String(tick.project_id)) ? `<span class="badge badge-status-info text-xs ml-2" style="font-size: 0.72rem; padding: 2px 6px;"><i class="bi bi-box-arrow-up-right mr-1"></i>Proveniente de ${escapeHtml(window.assistants.find(a => String(a.id) === String(tick.project_id)).name)}</span>` : '') : ''}
                        </div>
                        <div id="tchat-header-title" class="text-sm text-main font-bold truncate" title="${escapeHtml(tick.titulo || 'Ticket')}">${escapeHtml(tick.titulo || 'Ticket')}</div>
                    </div>
                </div>
                <div class="tchat-select-wrap">
                    <label for="tchat-status" class="tchat-label-container">
                        <span class="font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider tchat-label">Estado</span>
                        <select id="tchat-status" class="tchat-select rounded border-gray-300 shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" style="cursor: pointer;">
                            <option value="Abierto" ${tick.estado === 'Abierto' ? 'selected' : ''}>Abierto</option>
                            <option value="Cerrado" ${tick.estado === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
                        </select>
                    </label>
                </div>
            </div>
            <!-- MESSAGES & SIDEBAR -->
            <div style="display:flex; flex:1; overflow:hidden;">
                <div id="tchat-messages" class="flex-1 overflow-y-auto p-6 md:px-12 lg:px-24 flex flex-col gap-4 z-0">
                </div>
            </div>
            <!-- INPUT -->
            <div class="glass-header px-6 md:px-12 lg:px-24 py-4 flex gap-4 items-center border-t border-[var(--border-soft)] z-10 shadow-lg" style="background: var(--bg-card);">
                <input type="text" id="tchat-input" class="form-control text-main" placeholder="Escribe un mensaje..." autocomplete="off">
                <button id="tchat-send-btn" class="btn btn-primary rounded-circle flex items-center justify-center shrink-0" style="width: 48px; height: 48px; padding: 0;">
                    <i class="bi bi-send-fill fs-5" style="margin-left: -2px;"></i>
                </button>
            </div>
        </div>
    `;

    const messagesContainer = document.getElementById("tchat-messages");
    const inputField = document.getElementById("tchat-input");
    const sendBtn = document.getElementById("tchat-send-btn");
    const statusSelect = document.getElementById("tchat-status");

    messagesContainer.innerHTML = renderMessagesHtml(tick);

    setTimeout(() => { 
        if (isAtBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight; 
        } else {
            messagesContainer.scrollTop = oldScrollTop;
        }
    }, 50);

    if (tick.estado === 'Cerrado') {
        inputField.disabled = true;
        sendBtn.disabled = true;
        inputField.placeholder = "Conversación finalizada";
    } else {
        inputField.disabled = false;
        sendBtn.disabled = false;
        inputField.placeholder = "Escribe un mensaje...";
        inputField.focus();
    }

    const sendMsg = async () => {
        const text = inputField.value.trim();
        if (!text) return;
        
        inputField.disabled = true;
        sendBtn.disabled = true;
        
        try {
            await window.api.addTicketMessage(tick.id, { rol: 'admin', mensaje: text });
            inputField.value = "";
            // Solo recargamos este ticket (quirúrgico, no toda la lista)
            renderTicketChatView();
        } catch(e) {
            showToast("Error enviando mensaje", "error");
            if (statusSelect.value !== 'Cerrado') {
                inputField.disabled = false;
                sendBtn.disabled = false;
            }
        }
    };

    sendBtn.onclick = sendMsg;
    inputField.onkeydown = (e) => {
        if (e.key === "Enter") sendMsg();
    };

    statusSelect.onchange = async () => {
        try {
            const newState = statusSelect.value;
            
            if (newState === 'Cerrado') {
                await window.api.addTicketMessage(tick.id, { 
                    rol: 'admin', 
                    mensaje: 'Este ticket se dió por concluido por el personal de soporte. Muchas gracias!' 
                });
            }

            await window.api.updateTicket(tick.id, { estado: newState });
            showToast("Estado actualizado", "success");
            // Solo recargamos el chat (el SmartRefresh se encarga del resto)
            renderTicketChatView();
        } catch(e) {
            showToast("Error al actualizar estado", "error");
        }
    };
}

async function populateTicketModalClients() {
    const modalSelect = document.getElementById("ticketClientView");
    if (!modalSelect) return;
    
    if (modalSelect.children.length <= 1) {
        try {
            const clients = await window.api.getClients() || [];
            const options = clients.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
            modalSelect.innerHTML = '<option value="">-- Seleccionar --</option>' + options;
        } catch (err) {
            console.error("Error populating ticket modal clients:", err);
        }
    }
}

function initTicketModalGlobal() {
    const form = document.getElementById("ticketFormView");
    if (form) form.onsubmit = handleTicketSubmit;
    
    const clientSelect = document.getElementById("ticketClientView");
    if (clientSelect) {
        clientSelect.addEventListener("change", (e) => {
            updateProjectDropdown(e.target.value);
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTicketModalGlobal);
} else {
    initTicketModalGlobal();
}
