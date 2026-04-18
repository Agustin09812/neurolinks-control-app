async function renderVariablesView(projectId, environmentId, serviceId, serviceName) {

    const panel = document.getElementById("variables-view");
    if (!panel) return;

    // ocultar otras vistas
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";
    document.getElementById("billing-view").style.display = "none";
    document.getElementById("audit-view").style.display = "none";

    panel.style.display = "block";

    panel.innerHTML = `
        <div class="variables-panel animate-fade-up">

            <!-- HEADER -->
            <div class="variables-header d-flex justify-content-between align-items-center mb-3">

                <div>
                    <h5 class="text-warning m-0">
                        <i class="bi bi-sliders me-2"></i> Variables: ${serviceName}
                    </h5>
                    <small class="text-secondary">Configuración del servicio</small>
                </div>

                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-warning" id="btn-add-var">
                        <i class="bi bi-plus-lg"></i>
                    </button>
        
                    <button class="btn btn-sm btn-outline-light" id="btnBackVars">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                </div>
        
            </div>

            <!-- SEARCH -->
            <div class="mb-3">
                <input 
                    type="text" 
                    id="vars-search" 
                    class="form-control form-control-sm text-light"
                    placeholder="Buscar variable..."
                >
            </div>

            <!-- FORM -->
            <div id="vars-form" class="variables-form d-none mb-3">
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
            <div id="vars-grid" class="variables-grid">
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

    // toggle form
    document.getElementById("btn-add-var").onclick = () => {
        document.getElementById("vars-form").classList.toggle("d-none");
    };

    // guardar nueva variable
    document.getElementById("btn-save-var").onclick = () => {
        handleAddVariable(projectId, environmentId, serviceId);
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
        window.variablesCache = variables || {};

        const entries = Object.entries(variables || {});

        if (entries.length === 0) {
            grid.innerHTML = `<div class="text-secondary">No hay variables.</div>`;
            return;
        }

        grid.innerHTML = entries.map(([key, value]) => `
            <div class="var-card">
                <div class="var-card-header">
                    <div class="var-key-row">
                        <span class="var-key">${key}</span>
                        <div class="var-actions-inline">
                            <span class="badge badge-edit"
                                onclick="openEditModal('${projectId}', '${environmentId}', '${serviceId}', \`${key}\`, \`${value}\`)">
                                <i class="bi bi-pencil"></i>
                            </span>
                            <span class="badge badge-delete"
                                onclick="handleDeleteVariable('${projectId}', '${environmentId}', '${serviceId}', '${key}')">
                                <i class="bi bi-trash"></i>
                            </span>
                        </div>
                    </div>
                </div>
                <div class="var-card-body">
                    <pre class="var-value">${value}</pre>
                </div>
            </div>
        `).join("");

    } catch (err) {

        grid.innerHTML = `
            <div class="text-danger">
                Error: ${err.message}
            </div>
        `;
    }

    const searchInput = document.getElementById("vars-search");

    if (searchInput) {

        searchInput.oninput = (e) => {

            const value = e.target.value.toLowerCase();

            document.querySelectorAll(".var-card").forEach(card => {

                const key = card.querySelector(".var-key").textContent.toLowerCase();
                const val = card.querySelector(".var-value").textContent.toLowerCase();

                if (key.includes(value) || val.includes(value)) {
                    card.style.display = "";
                } else {
                    card.style.display = "none";
                }

            });

        };

    }

}


// --------------------------------------------------
// ADD VARIABLE
// --------------------------------------------------

async function handleAddVariable(pId, eId, sId) {

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


// --------------------------------------------------
// EDIT (MODAL)
// --------------------------------------------------

let editContext = {
    projectId: null,
    environmentId: null,
    serviceId: null,
    originalKey: null
};

function openEditModal(pId, eId, sId, key, value) {

    editContext = {
        projectId: pId,
        environmentId: eId,
        serviceId: sId,
        originalKey: key
    };

    document.getElementById("var-name").value = key;
    document.getElementById("var-value").value = value;

    const modal = new bootstrap.Modal(document.getElementById("editModal"));
    modal.show();
}


// --------------------------------------------------
// SAVE EDIT
// --------------------------------------------------

document.addEventListener("click", async (e) => {

    if (e.target.id !== "btn-save-variable") return;

    const newKey = document.getElementById("var-name").value.trim();
    const newValue = document.getElementById("var-value").value;

    if (!newKey) {
        showToast("Nombre requerido", "warning");
        return;
    }

    try {

        if (editContext.originalKey !== newKey) {
            await window.api.deleteVariable(
                editContext.projectId,
                editContext.environmentId,
                editContext.serviceId,
                editContext.originalKey
            );
        }

        await window.api.upsertVariable(
            editContext.projectId,
            editContext.environmentId,
            editContext.serviceId,
            newKey,
            newValue
        );

        showToast("Variable actualizada", "success");

        bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();

        loadVariables(
            editContext.projectId,
            editContext.environmentId,
            editContext.serviceId
        );

    } catch (err) {
        showToast("Error: " + err.message, "danger");
    }

});