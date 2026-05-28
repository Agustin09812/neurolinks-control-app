
let allPayments = [];
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
            <div class="flex flex-wrap justify-between items-center gap-2 mb-6">
                <div>
                    <h2 class="font-bold mb-0">CONTROL DE PAGOS</h2>
                    <p class="text-sm mb-0 text-dim">Gestión financiera y facturación histórica</p>
                </div>
                <div class="flex gap-2 flex-wrap">
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
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th>Método</th>
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
        if (billingFilters.method && p.metodo !== billingFilters.method) return false;
        const pDate = new Date(p.fecha);
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-white/50">No se encontraron pagos con estos filtros</td></tr>';
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="ps-4 text-white/50">${new Date(p.fecha).toLocaleDateString()}</td>
            <td><span class="font-bold text-accent-clients">${p.clientes ? escapeHtml(p.clientes.nombre) : 'Sin Cliente'}</span></td>
            <td class="text-sm opacity-75">${escapeHtml(p.concepto)}</td>
            <td><span class="badge badge-status-success font-monospace">$${escapeHtml(String(p.monto))}</span></td>
            <td class="text-center">
                <span class="badge badge-status-secondary rounded-full x-small px-2 py-1">
                    ${escapeHtml(p.metodo)}
                </span>
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

    const headers = ["Fecha", "Cliente", "Concepto", "Monto", "Método"];
    const rows = listToExport.map(p => [
        escapeCSV(new Date(p.fecha).toLocaleDateString()),
        escapeCSV(p.clientes ? p.clientes.nombre : 'Sin Cliente'),
        escapeCSV(p.concepto),
        p.monto,
        escapeCSV(p.metodo)
    ]);

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
