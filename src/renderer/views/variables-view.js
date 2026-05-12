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
                    <button class="btn btn-outline-light btn-sm" id="btnAddSetting">
                        <i class="bi bi-plus-lg me-1"></i>Añadir variable
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

    document.getElementById("btnAddSetting").onclick = () => {
        window.api.openExternal("https://supabase.com/dashboard/project/ygyicozjewxbyixtpjlo/editor/99056?schema=public");
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

        const settings = await window.api.getSettings(projectId);

        if (!settings || settings.length === 0) {
            grid.innerHTML = `<div class="text-secondary">No hay variables.</div>`;
            return;
        }

        const escapeHtml = (str) => String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;');

        grid.innerHTML = settings.map(({ key, value }) => {
            const safeKey = escapeHtml(key);
            const safeValue = escapeHtml(value);
            return `
            <div class="var-card" data-raw-value="${safeValue}">
                <div class="var-header-row">
                    <span class="var-key">${safeKey}</span>
                    <div class="var-actions-inline">
                        <button class="var-btn-edit btn-toggle-val" title="Mostrar/Ocultar">
                            <i class="bi bi-eye-slash-fill"></i>
                        </button>
                        <button class="var-btn-edit btn-copy-val" title="Copiar">
                            <i class="bi bi-clipboard-fill"></i>
                        </button>
                    </div>
                </div>
                <pre class="var-value masked">••••••••••••••••</pre>
            </div>`;
        }).join("");

        if (grid._clickHandler) grid.removeEventListener("click", grid._clickHandler);
        grid._clickHandler = (e) => {
            const card = e.target.closest(".var-card");
            if (!card) return;
            const raw = card.dataset.rawValue;
            const pre = card.querySelector(".var-value");

            if (e.target.closest(".btn-toggle-val")) {
                const icon = card.querySelector(".btn-toggle-val i");
                if (pre.classList.contains("masked")) {
                    pre.textContent = raw;
                    pre.classList.remove("masked");
                    icon.className = "bi bi-eye-fill";
                } else {
                    pre.textContent = "••••••••••••••••";
                    pre.classList.add("masked");
                    icon.className = "bi bi-eye-slash-fill";
                }
            } else if (e.target.closest(".btn-copy-val")) {
                navigator.clipboard.writeText(raw).then(() => {
                    showToast("Copiado al portapapeles", "success");
                });
            }
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
                card.style.display = k.includes(q) ? "" : "none";
            });
        };

        if (currentVal) {
            grid.querySelectorAll(".var-card").forEach(card => {
                const k = card.querySelector(".var-key").textContent.toLowerCase();
                card.style.display = k.includes(currentVal) ? "" : "none";
            });
        }

    }

}