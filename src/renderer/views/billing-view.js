
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
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                <div>
                    <h2 class="fw-bold mb-0">CONTROL DE PAGOS</h2>
                    <p class="small mb-0 text-dim">Gestión financiera y facturación histórica</p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                    <button class="btn btn-outline-light btn-sm" onclick="openNewPaymentModal()">
                        <i class="bi bi-plus-lg me-2"></i>Nueva Factura
                    </button>
                    <button class="btn btn-outline-light btn-sm" onclick="refreshBilling()">
                        <i class="bi bi-arrow-clockwise"></i> Actualizar
                    </button>
                    <button class="btn btn-outline-light btn-sm" onclick="exportBillingToCSV()">
                        <i class="bi bi-download"></i> Descargar
                    </button>
                </div>
            </div>

            <!-- FILTROS COMPACTOS -->
            <div class="glass-card p-2 mb-3 rounded">
                <div class="row g-2 align-items-end">

                    <div class="col-md-3">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-dark border-secondary text-dim">
                                <i class="bi bi-search text-secondary"></i>
                            </span>
                            <input type="text"
                                class="form-control form-control-sm text-light"
                                placeholder="Cliente..."
                                id="bill-filter-client"
                                onkeyup="handleBillingFilter('client', this.value)">
                        </div>
                    </div>

                    <div class="col-md-3">
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

                    <div class="col-md-3">
                        <input type="date"
                            class="form-control form-control-sm text-light"
                            id="bill-filter-start"
                            onchange="handleBillingFilter('dateStart', this.value)">
                    </div>

                    <div class="col-md-3">
                        <input type="date"
                            class="form-control form-control-sm text-light"
                            id="bill-filter-end"
                            onchange="handleBillingFilter('dateEnd', this.value)">
                    </div>

                </div>
            </div>

            <div class="glass-card p-0 overflow-hidden border-secondary rounded">
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
                <div class="modal-content bg-dark text-light border-secondary">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title">Registrar Nuevo Pago</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="globalPaymentForm">
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-12">
                                    <label class="form-label small fw-bold">CLIENTE</label>
                                    <select class="form-select" id="payClientGlobal" required>
                                        <option value="">Seleccionar cliente...</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small fw-bold">FECHA</label>
                                    <input type="date" class="form-control text-main" id="payDateGlobal" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small fw-bold">MONTO ($)</label>
                                    <input type="number" class="form-control text-main" id="payAmountGlobal" required>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label small fw-bold">CONCEPTO</label>
                                    <input type="text" class="form-control text-main" id="payConceptGlobal" placeholder="Ej: Abono Mensual Febrero" required>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label small fw-bold">MÉTODO DE PAGO</label>
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
                        <div class="modal-footer border-secondary">
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary">No se encontraron pagos con estos filtros</td></tr>';
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement("tr");
        tr.className = "border-secondary";
        tr.innerHTML = `
            <td class="ps-4 text-secondary">${new Date(p.fecha).toLocaleDateString()}</td>
            <td><span class="fw-bold text-accent-clients">${p.clientes ? p.clientes.nombre : 'Sin Cliente'}</span></td>
            <td class="small opacity-75">${p.concepto}</td>
            <td><span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 font-monospace">$${p.monto}</span></td>
            <td class="text-center">
                <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-20 px-2 py-1 rounded-pill x-small">
                    ${p.metodo}
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
            clients.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
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

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
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
