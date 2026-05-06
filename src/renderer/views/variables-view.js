async function renderVariablesView(projectId, environmentId, serviceId, serviceName) {

    const panel = document.getElementById("variables-view");
    if (!panel) return;

    // FIX: Variables se abre desde el menú de servicios, no desde navigate().
    // Necesita ocultar assistant-detail porque lo reemplaza visualmente.
    // Las demás vistas (clients, tickets, etc.) ya las maneja navigate().
    document.getElementById("assistant-detail").style.display = "none";

    panel.style.display = "block";

    panel.innerHTML = `
        <div class="variables-panel animate-fade-up">

            <!-- HEADER -->
            <div class="rw-topbar mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <button class="btn btn-outline-light" id="btnBackVars" title="Volver">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                    <button class="btn btn-outline-light" id="btn-add-var" title="Agregar variable">
                        <i class="bi bi-plus-lg"></i>
                    </button>
                </div>
                <div class="text-center mb-2">
                    <h4 class="fw-bold mb-0">
                        <i class="bi bi-sliders me-2 icon-service"></i>${serviceName}
                    </h4>
                    <small class="text-dim">Configuración del servicio</small>
                </div>
            </div>

            <!-- SEARCH -->
            <div class="mb-3">
                <input
                    type="text"
                    id="vars-search"
                    class="form-control form-control-sm"
                    placeholder="Buscar variable..."
                >
            </div>

            <!-- GRID -->
            <div id="vars-grid" class="variables-grid">
                ${'<div class="var-card"><div class="skeleton mb-2" style="height:24px;width:55%"></div><div class="skeleton" style="height:48px;width:100%"></div></div>'.repeat(6)}
            </div>

        </div>
        `;

    // Guardar contexto para SmartRefresh
    window.currentVarsContext = { projectId, environmentId, serviceId };
    window.lastVarsHash = null;

    // volver
    document.getElementById("btnBackVars").onclick = () => {
        window.currentVarsContext = null;
        window.lastVarsHash = null;
        clearActiveServiceMenu();
        panel.style.display = "none";
        document.getElementById("assistant-detail").style.display = "block";
    };

    // abrir modal para agregar variable
    document.getElementById("btn-add-var").onclick = () => {
        document.getElementById("new-var-name").value = "";
        document.getElementById("new-var-value").value = "";
        bootstrap.Modal.getOrCreateInstance(document.getElementById("addVarModal")).show();
    };

    // guardar nueva variable desde el modal
    document.getElementById("btn-save-new-var").onclick = () => {
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

        grid.innerHTML = entries.map(([key, value]) => {
            // BUG-01 FIX: Escape values to prevent XSS/HTML breakage
            const escapeHtml = (str) => String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/`/g, '&#96;');

            const safeKey = escapeHtml(key);
            const safeValue = escapeHtml(value);

            return `
            <div class="var-card" data-var-key="${safeKey}" data-var-value="${safeValue}"
                 data-project-id="${projectId}" data-env-id="${environmentId}" data-service-id="${serviceId}">
                <div class="var-header-row">
                    <span class="var-key">${safeKey}</span>
                    <div class="var-actions-inline">
                        <button class="var-btn-edit btn-edit-var" title="Editar">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="var-btn-delete btn-delete-var" title="Eliminar">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </div>
                <pre class="var-value">${safeValue}</pre>
            </div>
        `}).join("");

        // Event delegation — remove previous handler to avoid stacking on reload
        if (grid._clickHandler) grid.removeEventListener("click", grid._clickHandler);
        grid._clickHandler = (e) => {
            const card = e.target.closest(".var-card");
            if (!card) return;
            const k = card.dataset.varKey;
            const v = card.dataset.varValue;
            const pId = card.dataset.projectId;
            const eId = card.dataset.envId;
            const sId = card.dataset.serviceId;

            if (e.target.closest(".btn-edit-var")) openEditModal(pId, eId, sId, k, v);
            else if (e.target.closest(".btn-delete-var")) handleDeleteVariable(pId, eId, sId, k);
        };
        grid.addEventListener("click", grid._clickHandler);

    } catch (err) {

        grid.innerHTML = `
            <div class="text-danger">
                Error: ${err.message}
            </div>
        `;
    }

    const searchInput = document.getElementById("vars-search");

    if (searchInput) {

        const currentVal = searchInput.value.toLowerCase();

        searchInput.oninput = (e) => {
            const q = e.target.value.toLowerCase();
            grid.querySelectorAll(".var-card").forEach(card => {
                const k = card.querySelector(".var-key").textContent.toLowerCase();
                const v = card.querySelector(".var-value").textContent.toLowerCase();
                card.style.display = (k.includes(q) || v.includes(q)) ? "" : "none";
            });
        };

        // Reaplica el filtro si el usuario ya había escrito algo antes del reload
        if (currentVal) {
            grid.querySelectorAll(".var-card").forEach(card => {
                const k = card.querySelector(".var-key").textContent.toLowerCase();
                const v = card.querySelector(".var-value").textContent.toLowerCase();
                card.style.display = (k.includes(currentVal) || v.includes(currentVal)) ? "" : "none";
            });
        }

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

    const modal = bootstrap.Modal.getInstance(document.getElementById("addVarModal"));
    if (modal) modal.hide();

    window.showActionSpinner("Guardando variable...");
    try {

        await window.api.upsertVariable(pId, eId, sId, name, value);

        showToast("Variable guardada", "success");

        window.lastVarsHash = null;
        await window.waitForNextChannelRun("variables");

    } catch (err) {

        showToast("Error: " + err.message, "danger");

    } finally {

        window.hideActionSpinner();

    }
}


// --------------------------------------------------
// DELETE VARIABLE
// --------------------------------------------------

async function handleDeleteVariable(pId, eId, sId, name) {

    if (!confirm(`¿Eliminar ${name}?`)) return;

    window.showActionSpinner("Eliminando variable...");
    try {

        await window.api.deleteVariable(pId, eId, sId, name);

        showToast("Variable eliminada", "info");

        window.lastVarsHash = null;
        await window.waitForNextChannelRun("variables");

    } catch (err) {

        showToast("Error: " + err.message, "danger");

    } finally {

        window.hideActionSpinner();

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

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("editModal"));
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

    window.showActionSpinner("Actualizando variable...");
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

        window.lastVarsHash = null;
        await window.waitForNextChannelRun("variables");

    } catch (err) {
        showToast("Error: " + err.message, "danger");
    } finally {
        window.hideActionSpinner();
    }

});