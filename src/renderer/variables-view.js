
async function renderVariablesView(projectId, environmentId, serviceId, serviceName) {
    let varContainer = document.getElementById("integrated-var-container");

    if (!varContainer) {
        const detailMain = document.getElementById("assistant-detail");
        varContainer = document.createElement("div");
        varContainer.id = "integrated-var-container";
        varContainer.className = "mt-4 animate-fade-up";
        detailMain.appendChild(varContainer);
    }

    varContainer.innerHTML = `
        <div class="glass-card p-4 border-top border-warning border-3">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0 text-warning"><i class="bi bi-sliders me-2"></i> Variables: ${serviceName}</h5>
                <button class="btn btn-sm btn-outline-light" onclick="this.parentElement.parentElement.parentElement.remove()">
                    <i class="bi bi-x-lg"></i> Cerrar
                </button>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Valor</th>
                            <th class="text-end">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="vars-table-body">
                        <tr><td colspan="3" class="text-center">Cargando variables...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="mt-4 p-3 rounded bg-dark border border-secondary border-opacity-20">
                <h6 class="text-secondary small text-uppercase mb-3">Nueva Variable</h6>
                <div class="row g-2">
                    <div class="col-md-5">
                        <input type="text" id="new-var-name" class="form-control form-control-sm" placeholder="NOMBRE_VARIABLE">
                    </div>
                    <div class="col-md-5">
                        <input type="text" id="new-var-value" class="form-control form-control-sm" placeholder="valor">
                    </div>
                    <div class="col-md-2 d-grid">
                        <button class="btn btn-warning btn-sm" onclick="handleAddVariable('${projectId}', '${environmentId}', '${serviceId}', '${serviceName}')">
                            <i class="bi bi-plus-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    varContainer.scrollIntoView({ behavior: 'smooth' });
    loadVariables(projectId, environmentId, serviceId);
}

async function loadVariables(projectId, environmentId, serviceId) {
    const tbody = document.getElementById("vars-table-body");
    if (!tbody) return;

    try {
        const variables = await window.api.getServiceVariables(projectId, environmentId, serviceId);
        if (Object.keys(variables).length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-secondary">No hay variables definidas.</td></tr>';
            return;
        }

        tbody.innerHTML = Object.entries(variables).map(([key, value]) => `
            <tr>
                <td class="fw-bold text-info">${key}</td>
                <td class="text-truncate" style="max-width: 200px;">${value}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-link text-danger" onclick="handleDeleteVariable('${projectId}', '${environmentId}', '${serviceId}', '${key}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join("");

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error: ${err.message}</td></tr>`;
    }
}

async function handleAddVariable(pId, eId, sId, sName) {
    const name = document.getElementById("new-var-name").value.trim();
    const value = document.getElementById("new-var-value").value.trim();

    if (!name || !value) {
        showToast("Nombre y valor son requeridos", "warning");
        return;
    }

    try {
        await window.api.upsertVariable(pId, eId, sId, name, value);
        showToast("Variable guardada correctamente", "success");
        document.getElementById("new-var-name").value = "";
        document.getElementById("new-var-value").value = "";
        loadVariables(pId, eId, sId);
    } catch (err) {
        showToast("Error: " + err.message, "danger");
    }
}

async function handleDeleteVariable(pId, eId, sId, name) {
    if (!confirm(`¿Eliminar la variable ${name}?`)) return;

    try {
        await window.api.deleteVariable(pId, eId, sId, name);
        showToast("Variable eliminada", "info");
        loadVariables(pId, eId, sId);
    } catch (err) {
        showToast("Error: " + err.message, "danger");
    }
}
