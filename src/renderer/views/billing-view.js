
let allPayments = [];
let allAdmins = [];
let billingFilters = {
    client: "",
    method: "",
    dateStart: "",
    dateEnd: ""
};

async function renderBillingView() {
    // FIX: selectedProjectId y ocultamiento de vistas se manejan en navigate()

    // Limpiar contenedores secundarios
    ["integrated-log-container", "integrated-var-container"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    const view = document.getElementById("billing-view");
    view.style.display = "block";
    view.innerHTML = `
        <div class="animate-fade">
            <div class="view-header">
                <div class="view-header-left">
                    <h2 class="view-header-title">COBROS</h2>
                </div>
                <div class="view-header-controls">
                    <button class="btn btn-outline-light btn-sm" onclick="openNewPaymentModal()">
                        <i class="bi bi-plus-lg mr-2"></i>Nueva Factura
                    </button>
                    <button class="btn btn-outline-light btn-sm" onclick="refreshBilling()">
                        <i class="bi bi-arrow-clockwise btn-refresh-icon mr-2"></i><span class="btn-refresh-label">Actualizar</span>
                    </button>
                    <button class="btn btn-outline-light btn-sm" onclick="exportBillingToCSV()">
                        <i class="bi bi-download"></i> Descargar
                    </button>
                </div>
            </div>

            <!-- FILTROS COMPACTOS -->
            <div class="glass-card p-2 mb-4 rounded">
                <div class="grid md:grid-cols-4 gap-2 items-end">

                    <div class="">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text text-dim">
                                <i class="bi bi-search text-white/50"></i>
                            </span>
                            <input type="text"
                                class="form-control form-control-sm"
                                placeholder="Cliente..."
                                id="bill-filter-client"
                                onkeyup="handleBillingFilter('client', this.value)">
                        </div>
                    </div>

                    <div class="">
                        <select class="form-select form-select-sm"
                            id="bill-filter-method"
                            onchange="handleBillingFilter('method', this.value)">
                            <option value="">Método</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Mercado Pago">Mercado Pago</option>
                            <option value="Crypto">Crypto</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    <div class="">
                        <input type="date"
                            class="form-control form-control-sm"
                            id="bill-filter-start"
                            onchange="handleBillingFilter('dateStart', this.value)">
                    </div>

                    <div class="">
                        <input type="date"
                            class="form-control form-control-sm"
                            id="bill-filter-end"
                            onchange="handleBillingFilter('dateEnd', this.value)">
                    </div>

                </div>
            </div>

            <div class="glass-card p-0 overflow-hidden rounded">
                <div class="table-responsive">
                    <table class="table align-middle">
                        <thead>
                            <tr>
                                <th class="ps-4">Fecha</th>
                                <th>Cliente</th>
                                <th>Plan / Concepto</th>
                                <th>Bruto</th>
                                <th>Comisión MP</th>
                                <th>Neto</th>
                                <th>Adjudicado a</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="billing-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- MODAL NUEVO PAGO GLOBAL -->
        <div class="modal fade" id="globalPaymentModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content glass-card">
                    <div class="modal-header">
                        <h5 class="modal-title">Registrar Nuevo Pago</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="globalPaymentForm">
                        <div class="modal-body">
                            <div class="grid gap-4">
                                <div class="">
                                    <label class="form-label text-sm font-bold">CLIENTE</label>
                                    <select class="form-select" id="payClientGlobal" required>
                                        <option value="">Seleccionar cliente...</option>
                                    </select>
                                </div>
                                <div class="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="form-label text-sm font-bold">FECHA</label>
                                        <input type="date" class="form-control text-main" id="payDateGlobal" required>
                                    </div>
                                    <div>
                                        <label class="form-label text-sm font-bold">MONTO ($)</label>
                                        <input type="number" class="form-control text-main" id="payAmountGlobal" required>
                                    </div>
                                </div>
                                <div class="">
                                    <label class="form-label text-sm font-bold">CONCEPTO</label>
                                    <input type="text" class="form-control text-main" id="payConceptGlobal" placeholder="Ej: Abono Mensual Febrero" required>
                                </div>
                                <div class="">
                                    <label class="form-label text-sm font-bold">MÉTODO DE PAGO</label>
                                    <select class="form-select" id="payMethodGlobal">
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Mercado Pago">Mercado Pago</option>
                                        <option value="Crypto">Crypto</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-success btn-sm">Guardar Pago</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    applyBillingFilters();
    loadBillingData();
}

async function loadBillingData() {
    try {
        allAdmins = await window.api.getAdmins() || [];
        allPayments = await window.api.getAllPayments() || [];
        applyBillingFilters();
    } catch (err) {
        console.error("Error loading billing data:", err);
        showToast("Error al cargar datos de facturación", "danger");
    }
}

async function refreshBilling() {
    await loadBillingData();
}

function getFilteredPayments() {
    return allPayments.filter(p => {
        if (billingFilters.client && !p.clientes?.nombre.toLowerCase().includes(billingFilters.client.toLowerCase())) return false;
        if (billingFilters.method && billingFilters.method !== "Mercado Pago") return false; // Todo es MP ahora
        const pDate = new Date(p.fecha_aprobacion);
        if (billingFilters.dateStart && pDate < new Date(billingFilters.dateStart)) return false;
        if (billingFilters.dateEnd) {
            const end = new Date(billingFilters.dateEnd);
            end.setHours(23, 59, 59);
            if (pDate > end) return false;
        }
        return true;
    });
}

function handleBillingFilter(key, value) {
    billingFilters[key] = value;
    applyBillingFilters();
}

function applyBillingFilters() {
    const tbody = document.getElementById("billing-table-body");
    tbody.innerHTML = "";

    const filtered = getFilteredPayments();

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-white/50">No se encontraron pagos con estos filtros</td></tr>';
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement("tr");
        
        let comisionMp = p.monto - (p.net_amount || p.monto);
        let montoNeto = p.net_amount || p.monto;

        // Admin selector
        let assignedAdminId = p.mp_vendedores?.user_id;
        let adminOptions = '<option value="">Sin Asignar</option>';
        allAdmins.forEach(adm => {
            let selected = (assignedAdminId === adm.auth_user_id) ? "selected" : "";
            adminOptions += `<option value="${adm.auth_user_id}" ${selected}>${escapeHtml(adm.nombre || adm.email)}</option>`;
        });

        tr.innerHTML = `
            <td class="ps-4 text-white/50">${new Date(p.fecha_aprobacion).toLocaleDateString()}</td>
            <td><span class="font-bold text-accent-clients">${p.clientes ? escapeHtml(p.clientes.nombre) : 'Sin Cliente'}</span></td>
            <td class="text-sm opacity-75">Suscripción</td>
            <td><span class="badge badge-status-secondary font-monospace">$${p.monto.toFixed(2)}</span></td>
            <td><span class="text-danger font-monospace text-xs">-$${comisionMp.toFixed(2)}</span></td>
            <td><span class="badge badge-status-success font-monospace">$${montoNeto.toFixed(2)}</span></td>
            <td>
                <select class="form-select form-select-sm text-xs bg-dark text-white border-secondary" style="max-width: 150px" onchange="assignPaymentAdmin('${p.id}', this.value)">
                    ${adminOptions}
                </select>
            </td>
            <td class="text-center">
                <button class="btn btn-link text-danger p-0" onclick="deleteGlobalPayment('${p.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function assignPaymentAdmin(paymentId, adminId) {
    try {
        await window.api.assignPaymentAdmin(paymentId, adminId);
        showToast("Pago adjudicado", "success");
        // No recargamos todo para no perder el scroll, ya se actualizó en DB
    } catch (err) {
        showToast("Error al adjudicar pago", "danger");
        console.error(err);
    }
}

async function openNewPaymentModal() {
    const modal = new bootstrap.Modal(document.getElementById("globalPaymentModal"));
    const select = document.getElementById("payClientGlobal");
    const form = document.getElementById("globalPaymentForm");

    // Set today as default date
    document.getElementById("payDateGlobal").valueAsDate = new Date();

    // Load clients
    try {
        const clients = await window.api.getClients();
        select.innerHTML = '<option value="">Seleccionar cliente...</option>' +
            clients.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
    } catch (e) {
        console.error(e);
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const paymentData = {
            cliente_id: document.getElementById("payClientGlobal").value,
            fecha: document.getElementById("payDateGlobal").value,
            monto: parseFloat(document.getElementById("payAmountGlobal").value),
            concepto: document.getElementById("payConceptGlobal").value,
            metodo: document.getElementById("payMethodGlobal").value
        };

        try {
            await window.api.createPayment(paymentData);
            modal.hide();
            showToast("Pago registrado con éxito");
            loadBillingData();
        } catch (err) {
            showToast("Error al registrar pago", "danger");
        }
    };

    modal.show();
}

async function deleteGlobalPayment(id) {
    if (!confirm("¿Eliminar este registro de pago?")) return;
    try {
        await window.api.deletePayment(id);
        showToast("Pago eliminado");
        loadBillingData();
    } catch (err) {
        showToast("Error al eliminar", "danger");
    }
}

function exportBillingToCSV() {
    const listToExport = getFilteredPayments();

    if (listToExport.length === 0) {
        showToast("No hay datos para exportar", "warning");
        return;
    }

    // FIX: Escapar comas y comillas para evitar corrupción del CSV
    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;

    const headers = ["Fecha", "Cliente", "Concepto", "Monto Bruto", "Comisión MP", "Monto Neto", "Método", "Adjudicado A"];
    const rows = listToExport.map(p => {
        let comisionMp = p.monto - (p.net_amount || p.monto);
        let montoNeto = p.net_amount || p.monto;
        let assignedAdminId = p.mp_vendedores?.user_id;
        let adjudicado = "Sin Asignar";
        if (assignedAdminId) {
            let adm = allAdmins.find(a => a.auth_user_id === assignedAdminId);
            if (adm) adjudicado = adm.nombre || adm.email;
        }

        return [
            escapeCSV(new Date(p.fecha_aprobacion).toLocaleDateString()),
            escapeCSV(p.clientes ? p.clientes.nombre : 'Sin Cliente'),
            escapeCSV("Suscripción"),
            p.monto.toFixed(2),
            comisionMp.toFixed(2),
            montoNeto.toFixed(2),
            escapeCSV("Mercado Pago"),
            escapeCSV(adjudicado)
        ];
    });

    let csvContent = "data:text/csv;charset=utf-8,﻿"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_facturacion.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reporte generado", "success");
}
