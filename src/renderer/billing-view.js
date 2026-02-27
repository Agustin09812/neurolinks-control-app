
let allPayments = [];

async function renderBillingView() {
    selectedProjectId = null;

    // Hide other views
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";

    const view = document.getElementById("billing-view");
    view.style.display = "block";
    view.innerHTML = `
        <div class="animate-fade">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="fw-bold mb-0">FACTURACIÓN GLOBAL</h2>
                    <p class="text-secondary small mb-0">Historial histórico de todos los cobros</p>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-light btn-sm" onclick="loadBillingData()">
                        <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
                    </button>
                    <button class="btn btn-outline-success btn-sm" onclick="exportBillingToCSV()">
                        <i class="bi bi-download me-2"></i>Exportar CSV
                    </button>
                </div>
            </div>

            <div class="glass-card p-0 overflow-hidden shadow-lg border-secondary">
                <div class="table-responsive">
                    <table class="table table-dark table-hover mb-0 align-middle">
                        <thead class="bg-dark-light">
                            <tr class="border-secondary">
                                <th class="ps-4">Fecha</th>
                                <th>Cliente</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th class="text-center">Método</th>
                            </tr>
                        </thead>
                        <tbody id="billing-table-body">
                            <tr>
                                <td colspan="5" class="text-center py-5">
                                    <div class="spinner-border text-success" role="status"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    loadBillingData();
}

async function loadBillingData() {
    const tbody = document.getElementById("billing-table-body");
    try {
        allPayments = await window.api.getAllPayments() || [];
        tbody.innerHTML = "";

        if (allPayments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-secondary">No hay registros de pagos</td></tr>';
            return;
        }

        allPayments.forEach(p => {
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
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error loading billing data:", err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-danger">Error al cargar datos de facturación</td></tr>';
    }
}

function exportBillingToCSV() {
    if (allPayments.length === 0) {
        showToast("No hay datos para exportar", "warning");
        return;
    }

    const headers = ["Fecha", "Cliente", "Concepto", "Monto", "Método"];
    const rows = allPayments.map(p => [
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

    showToast("Reporte de facturación generado", "success");
}
