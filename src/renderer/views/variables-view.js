
async function renderVariablesView(projectId, environmentId, serviceId, serviceName) {

    const panel = document.getElementById("detail-side-panel");
    if (!panel) return;

    panel.innerHTML = `
        <div class="glass-card p-4 border-top border-warning border-3 animate-fade-up" style="height: calc(100% - 30px);">

            <div class="d-flex justify-content-between align-items-center mb-4">
                <h5 class="mb-0 text-warning">
                    <i class="bi bi-sliders me-2"></i> Variables: ${serviceName}
                </h5>
                <button class="btn btn-sm btn-outline-light"
                    onclick="document.getElementById('detail-side-panel').innerHTML = ''">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>

            <div class="p-3 rounded bg-dark border border-secondary border-opacity-20 mb-4">
                <h6 class="text-secondary small text-uppercase mb-3">Nueva Variable</h6>
                <div class="row g-2">
                    <div class="col-md-5">
                        <input type="text" id="new-var-name"
                            class="form-control form-control-sm text-light">
                    </div>
                    <div class="col-md-5">
                        <input type="text" id="new-var-value"
                            class="form-control form-control-sm text-light">
                    </div>
                    <div class="col-md-2 d-grid">
                        <button class="btn btn-warning btn-sm"
                            onclick="handleAddVariable('${projectId}', '${environmentId}', '${serviceId}', '${serviceName}')">
                            <i class="bi bi-plus-lg"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div id="vars-grid" class="d-grid gap-3" style="overflow-y:auto; height:calc(100% - 170px); min-height:0;">
                <div class="text-center text-secondary py-4">
                    Cargando variables...
                </div>
            </div>

        </div>
    `;

    loadVariables(projectId, environmentId, serviceId);
}

async function loadVariables(projectId, environmentId, serviceId) {
    const grid = document.getElementById("vars-grid");
    if (!grid) return;

    try {
        const variables = await window.api.getServiceVariables(projectId, environmentId, serviceId);

        const entries = Object.entries(variables);

        if (entries.length === 0) {
            grid.innerHTML = `
                <div class="text-center text-secondary py-4">
                    No hay variables definidas.
                </div>
            `;
            return;
        }

        grid.innerHTML = entries.map(([key, value]) => `
            <div class="variable-card p-4 d-flex justify-content-between align-items-start">

                <div>
                    <div class="variable-name">${key}</div>
                    <div class="variable-value mt-2">${value}</div>
                </div>

                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-danger"
                        onclick="handleDeleteVariable('${projectId}', '${environmentId}', '${serviceId}', '${key}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>

            </div>
        `).join("");

    } catch (err) {
        grid.innerHTML = `
            <div class="text-center text-danger py-4">
                Error: ${err.message}
            </div>
        `;
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
