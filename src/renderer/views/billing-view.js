
let allPayments = [];
let billingFilters = {
    client: "",
    method: "",
    dateStart: "",
    dateEnd: ""
};

async function renderBillingView() {
    selectedProjectId = null;

    // Hide other views
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";
    document.getElementById("audit-view").style.display = "none";

    // Limpiar contenedores secundarios
    ["integrated-log-container", "integrated-var-container", "integrated-chat-container"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    const view = document.getElementById("billing-view");
    view.style.display = "block";
    view.innerHTML = `
        <div class="animate-fade mt-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="fw-bold mb-0 text-light" style="color: var(--text-main)">CONTROL DE PAGOS</h2>
                    <p class="text-secondary small mb-0">Gestión financiera y facturación histórica</p>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-light btn-sm" id="btnNuevaFactura" onclick="openNewPaymentModal()">
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

            <!-- FILTROS ESTILO TICKETS -->
            <div class="glass-card p-4 mb-4">
                <div class="row g-3">
                    <div class="col-md-3">
                        <label class="small text-dim fw-bold mb-2">BUSCAR CLIENTE</label>
                        <input type="text" class="form-control form-control-sm text-light" id="bill-filter-client" onkeyup="handleBillingFilter('client', this.value)">
                    </div>
                    <div class="col-md-3">
                        <label class="small text-dim fw-bold mb-2">MÉTODO DE PAGO</label>
                        <select class="form-select form-select-sm" id="bill-filter-method" onchange="handleBillingFilter('method', this.value)">
                            <option value="">Todos</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Mercado Pago">Mercado Pago</option>
                            <option value="Crypto">Crypto</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="small text-dim fw-bold mb-2">DESDE</label>
                        <input type="date" class="form-control form-control-sm text-light" id="bill-filter-start" onchange="handleBillingFilter('dateStart', this.value)">
                    </div>
                    <div class="col-md-3">
                        <label class="small text-dim fw-bold mb-2">HASTA</label>
                        <input type="date" class="form-control form-control-sm text-light" id="bill-filter-end" onchange="handleBillingFilter('dateEnd', this.value)">
                    </div>
                </div>
            </div>

            <div class="glass-card p-0 overflow-hidden shadow-lg border-secondary">
                <div class="table-responsive">
                    <table class="table align-middle">
                        <thead>
                            <tr>
                                <th class="ps-4" style="color: var(--bg-deep) !important">Fecha</th>
                                <th style="color: var(--bg-deep) !important">Cliente</th>
                                <th style="color: var(--bg-deep) !important">Concepto</th>
                                <th style="color: var(--bg-deep) !important">Monto</th>
                                <th class="text-center" style="color: var(--bg-deep) !important">Método</th>
                                <th class="text-center" style="color: var(--bg-deep) !important">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="billing-table-body">
                            <tr>
                                <td colspan="6" class="text-center py-5">
                                    <div class="spinner-border text-light" role="status"></div>
                                </td>
                            </tr>
                        </tbody>
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
                                    <input type="date" class="form-control text-light" id="payDateGlobal" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small fw-bold">MONTO ($)</label>
                                    <input type="number" class="form-control text-light" id="payAmountGlobal" required>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label small fw-bold">CONCEPTO</label>
                                    <input type="text" class="form-control text-light" id="payConceptGlobal" placeholder="Ej: Abono Mensual Febrero" required>
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
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-success btn-sm">Guardar Pago</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    loadBillingData();
}

async function loadBillingData() {
    const tbody = document.getElementById("billing-table-body");
    try {
        const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
        const funcs = (window.currentUser && window.currentUser.funciones_habilitadas) || {};
        let permLvl = isAdmin ? 'editar_crear' : (funcs.facturas || 'none');
        if (permLvl === true) permLvl = 'editar_crear';

        const btnNueva = document.getElementById("btnNuevaFactura");
        if (btnNueva) btnNueva.style.display = (permLvl === 'editar_crear') ? 'inline-block' : 'none';

        if (permLvl === 'none' || permLvl === false) {
            allPayments = [];
        } else {
            const payments = await window.api.getAllPayments() || [];
            if (permLvl === 'ver_propio') {
                allPayments = payments.filter(p => String(p.cliente_id) === String(window.currentUser.cliente_id));

                const filterSelect = document.getElementById("bill-filter-client");
                if (filterSelect && window.currentUser.cliente) {
                    filterSelect.value = window.currentUser.cliente.nombre;
                    filterSelect.disabled = true;
                    billingFilters.client = window.currentUser.cliente.nombre;
                }
            } else {
                allPayments = payments;
            }
        }

        applyBillingFilters();
    } catch (err) {
        console.error("Error loading billing data:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-danger">Error al cargar datos de facturación</td></tr>';
    }
}

async function refreshBilling() {

    const tbody = document.getElementById("billing-table-body");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="spinner-border text-light" role="status"></div>
                </td>
            </tr>
        `;
    }

    await loadBillingData();
}

function handleBillingFilter(key, value) {
    billingFilters[key] = value;
    applyBillingFilters();
}

function applyBillingFilters() {
    const tbody = document.getElementById("billing-table-body");
    tbody.innerHTML = "";

    let filtered = allPayments.filter(p => {
        const clientMatch = !billingFilters.client || (p.clientes && p.clientes.nombre.toLowerCase().includes(billingFilters.client.toLowerCase()));
        const methodMatch = !billingFilters.method || p.metodo === billingFilters.method;

        let dateMatch = true;
        const pDate = new Date(p.fecha);
        if (billingFilters.dateStart) {
            const start = new Date(billingFilters.dateStart);
            dateMatch = dateMatch && (pDate >= start);
        }
        if (billingFilters.dateEnd) {
            const end = new Date(billingFilters.dateEnd);
            end.setHours(23, 59, 59);
            dateMatch = dateMatch && (pDate <= end);
        }

        return clientMatch && methodMatch && dateMatch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary">No se encontraron pagos con estos filtros</td></tr>';
        return;
    }

    const isAdmin = window.currentUser && window.currentUser.rol === 'admin';
    const funcs = (window.currentUser && window.currentUser.funciones_habilitadas) || {};
    let permLvl = isAdmin ? 'editar_crear' : (funcs.facturas || 'none');
    if (permLvl === true) permLvl = 'editar_crear';

    filtered.forEach(p => {
        const tr = document.createElement("tr");
        tr.className = "border-secondary";

        let actionsHtml = '';
        if (permLvl === 'editar_crear') {
            actionsHtml = `
                <button class="btn btn-link text-danger p-0" onclick="deleteGlobalPayment('\${p.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            `;
        } else {
            actionsHtml = `<span class="small text-dim">-</span>`;
        }

        tr.innerHTML = `
            <td class="ps-4 text-secondary">\${new Date(p.fecha).toLocaleDateString()}</td>
            <td><span class="fw-bold text-accent-clients">\${p.clientes ? p.clientes.nombre : 'Sin Cliente'}</span></td>
            <td class="small opacity-75">\${p.concepto}</td>
            <td><span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 font-monospace">$\${p.monto}</span></td>
            <td class="text-center">
                <span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-20 px-2 py-1 rounded-pill x-small">
                    \${p.metodo}
                </span>
            </td>
            <td class="text-center">
                \${actionsHtml}
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
    // ... same implementation as before, maybe using the filtered list
    const listToExport = allPayments; // Or should it be 'filtered'? Let's keep all for now or the filtered one.
    // User probably wants the filtered one if they are filtering.
    // Let's use all for safety or just follow the context.

    if (listToExport.length === 0) {
        showToast("No hay datos para exportar", "warning");
        return;
    }

    const headers = ["Fecha", "Cliente", "Concepto", "Monto", "Método"];
    const rows = listToExport.map(p => [
        new Date(p.fecha).toLocaleDateString(),
        p.clientes ? p.clientes.nombre : 'Sin Cliente',
        p.concepto,
        p.monto,
        p.metodo
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
