async function renderVariablesView(projectId, environmentId, serviceId, serviceName) {

    const panel = document.getElementById("variables-view");
    if (!panel) return;

    // ocultar otras vistas (igual que logs)
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";
    document.getElementById("billing-view").style.display = "none";
    document.getElementById("audit-view").style.display = "none";

    // mostrar variables
    panel.style.display = "block";

    panel.innerHTML = `
    <div class="glass-card p-4 border-top border-warning border-3 animate-fade-up d-flex flex-column" style="height: calc(100vh - 160px);">

    <!-- HEADER -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-shrink-0">
        <h5 class="mb-0 text-warning">
            <i class="bi bi-sliders me-2"></i> Variables: ${serviceName}
        </h5>

        <div class="d-flex gap-2">

            <button class="btn btn-sm btn-warning" id="btn-add-var">
                <i class="bi bi-plus-lg"></i>
            </button>

            <button class="btn btn-sm btn-outline-light" id="btnBackVars">
                <i class="bi bi-arrow-left"></i>
            </button>

        </div>
    </div>

    <!-- FORM -->
    <div id="vars-form" class="mb-3 d-none flex-shrink-0">
        <div class="row g-2">
            <div class="col-md-5">
                <input type="text" id="new-var-name"
                    class="form-control form-control-sm text-light"
                    placeholder="Nombre">
            </div>
            <div class="col-md-5">
                <input type="text" id="new-var-value"
                    class="form-control form-control-sm text-light"
                    placeholder="Valor">
            </div>
            <div class="col-md-2 d-grid">
                <button class="btn btn-warning btn-sm" id="btn-save-var">
                    Guardar
                </button>
            </div>
        </div>
    </div>

    <!-- GRID -->
    <div id="vars-grid"
        class="flex-grow-1 overflow-auto"
        style="min-height:0;">
        <div class="text-secondary">Cargando variables...</div>
    </div>

</div>
`;

    // volver
    document.getElementById("btnBackVars").onclick = () => {
        clearActiveServiceMenu();
        panel.style.display = "none";
        document.getElementById("assistant-detail").style.display = "block";
    };

    // mostrar form
    document.getElementById("btn-add-var").onclick = () => {
        document.getElementById("vars-form").classList.toggle("d-none");
    };

    // guardar
    document.getElementById("btn-save-var").onclick = () => {
        handleAddVariable(projectId, environmentId, serviceId, serviceName);
    };

    loadVariables(projectId, environmentId, serviceId);
}

// --------------------------------------------------
// LOAD VARIABLES
// --------------------------------------------------

async function loadVariables(projectId, environmentId, serviceId) {

    const grid = document.getElementById("vars-grid");
    if (!grid) return;

    try {

        const variables = await window.api.getServiceVariables(projectId, environmentId, serviceId);
        window.variablesCache = variables || {}; // // Hash para variables
        const entries = Object.entries(variables || {});

        if (entries.length === 0) {
            grid.innerHTML = `<div class="text-secondary">No hay variables.</div>`;
            return;
        }

        grid.innerHTML = entries.map(([key, value]) => `
            <div class="d-flex justify-content-between align-items-start border-bottom border-secondary py-2">

                <div style="min-width:0; max-width:100%;" class="me-3">
                    <div class="fw-bold text-warning">${key}</div>
                    <div class="small text-light variable-value">${value}</div>
                </div>

                <button class="btn btn-sm btn-outline-danger"
                    onclick="handleDeleteVariable('${projectId}', '${environmentId}', '${serviceId}', '${key}')">
                    <i class="bi bi-trash"></i>
                </button>

            </div>
        `).join("");

    } catch (err) {

        grid.innerHTML = `
            <div class="text-danger">
                Error: ${err.message}
            </div>
        `;
    }
}

// --------------------------------------------------
// ADD VARIABLE
// --------------------------------------------------

async function handleAddVariable(pId, eId, sId, sName) {

    const name = document.getElementById("new-var-name").value.trim();
    const value = document.getElementById("new-var-value").value.trim();

    if (!name || !value) {
        showToast("Nombre y valor requeridos", "warning");
        return;
    }

    try {

        await window.api.upsertVariable(pId, eId, sId, name, value);

        showToast("Variable guardada", "success");

        document.getElementById("new-var-name").value = "";
        document.getElementById("new-var-value").value = "";

        loadVariables(pId, eId, sId);

    } catch (err) {

        showToast("Error: " + err.message, "danger");

    }
}

// --------------------------------------------------
// DELETE VARIABLE
// --------------------------------------------------

async function handleDeleteVariable(pId, eId, sId, name) {

    if (!confirm(`¿Eliminar ${name}?`)) return;

    try {

        await window.api.deleteVariable(pId, eId, sId, name);

        showToast("Variable eliminada", "info");

        loadVariables(pId, eId, sId);

    } catch (err) {

        showToast("Error: " + err.message, "danger");

    }
}