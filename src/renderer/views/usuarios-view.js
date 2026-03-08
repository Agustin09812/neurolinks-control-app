let allUsuarios = [];
let usuariosSearchQuery = "";

async function renderUsuariosView() {
    selectedProjectId = null;

    // Ocultar otras vistas principales
    document.getElementById("dashboard-global").style.display = "none";
    document.getElementById("assistant-detail").style.display = "none";
    document.getElementById("clients-view").style.display = "none";
    document.getElementById("tickets-view").style.display = "none";
    document.getElementById("billing-view").style.display = "none";
    document.getElementById("audit-view").style.display = "none";

    const view = document.getElementById("usuarios-view");
    view.style.display = "block";
    view.innerHTML = `
        <div class="d-flex justify-content-center align-items-center h-100" id="usuarios-loading">
            <div class="spinner-border text-light" role="status"></div>
        </div>
        <div class="animate-fade mt-4">
            <div id="usuarios-content" style="display:none;">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="fw-bold mb-0">GESTIÓN DE <span class="text-light">ADMINISTRADORES</span></h2>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-light btn-sm" onclick="openNewUsuarioModal()">
                            <i class="bi bi-person-plus me-2"></i> Nuevo Usuario
                        </button>
                        <button class="btn btn-outline-light btn-sm" onclick="loadUsuarios()">
                            <i class="bi bi-arrow-clockwise me-2"></i> Actualizar
                        </button>
                    </div>
                </div>

                <!-- Filtros -->
                <div class="glass-card p-4 mb-4">
                    <div class="row g-3">
                        <div class="col-md-12">
                            <label class="small text-dim fw-bold mb-2">BUSCAR USUARIO</label>
                            <div class="input-group">
                                <span class="input-group-text bg-dark border-secondary text-dim">
                                    <i class="bi bi-search text-secondary"></i>
                                </span>
                                <input type="text" class="form-control text-light" id="usuariosSearch" placeholder="Nombre, apellido, usuario..." onkeyup="handleUsuariosSearch(this.value)">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Lista de Usuarios -->
                <div class="glass-card p-0 overflow-hidden">
                    <table class="table table-dark table-hover mb-0 sticky-header-table custom-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Usuario</th>
                                <th>Rol</th>
                                <th>Cliente Asignado</th>
                                <th class="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="usuarios-list-body">
                            <!-- Rows -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    try {
        await loadUsuarios();
    } catch (err) {
        console.error("Error fatal en renderUsuariosView:", err);
        showToast("Error al inicializar la vista de usuarios", "danger");
    } finally {
        const loadingEl = document.getElementById("usuarios-loading");
        const contentEl = document.getElementById("usuarios-content");
        if (loadingEl) loadingEl.style.display = "none";
        if (contentEl) contentEl.style.display = "block";
    }
}

async function loadUsuarios() {
    console.log("Cargando lista de usuarios...");
    try {
        const result = await window.api.getUsuarios();
        console.log("Usuarios recibidos:", result);
        allUsuarios = result || [];
        renderUsuariosList();
    } catch (err) {
        showToast("Error al cargar usuarios desde la base de datos", "danger");
        console.error("Error en loadUsuarios:", err);
    }
}

function handleUsuariosSearch(query) {
    usuariosSearchQuery = query.toLowerCase();
    renderUsuariosList();
}

function renderUsuariosList() {
    const tbody = document.getElementById("usuarios-list-body");
    if (!tbody) return;

    let filtered = allUsuarios;

    if (usuariosSearchQuery) {
        filtered = filtered.filter(u =>
            String(u.nombre).toLowerCase().includes(usuariosSearchQuery) ||
            String(u.apellido).toLowerCase().includes(usuariosSearchQuery) ||
            String(u.usuario).toLowerCase().includes(usuariosSearchQuery)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-secondary">No se encontraron usuarios.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const rawCliente = u.clientes;
        const clienteNombre = rawCliente
            ? (Array.isArray(rawCliente) ? (rawCliente[0]?.nombre || 'Sin cliente') : rawCliente.nombre)
            : '<span class="text-secondary opacity-50">Sin cliente</span>';

        let rolBadge = "bg-secondary";
        const rolDisplay = u.rol ? String(u.rol).toUpperCase() : 'USUARIO';

        if (u.rol === 'admin') rolBadge = "bg-danger";
        if (u.rol === 'cliente') rolBadge = "bg-primary";

        return `
        <tr class="align-middle" style="cursor: pointer;">
            <td onclick="openEditUsuario('${u.id}')">
                <div class="fw-bold">${u.nombre || ''} ${u.apellido || ''}</div>
            </td>
            <td onclick="openEditUsuario('${u.id}')">${u.usuario || '---'}</td>
            <td onclick="openEditUsuario('${u.id}')"><span class="badge ${rolBadge}">${rolDisplay}</span></td>
            <td onclick="openEditUsuario('${u.id}')">${clienteNombre}</td>
            <td class="text-end">
                <button class="btn btn-outline-danger btn-sm" onclick="deleteUsuario('${u.id}')" title="Eliminar Usuario">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `}).join("");
}

function renderUsuarioModal(usuario = null) {
    // Si no está el modal en el DOM, crearlo
    let modalEl = document.getElementById('usuarioModal');
    if (!modalEl) {
        const modalHtml = `
            <div class="modal fade" id="usuarioModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content glass-card">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title fw-bold" id="usuarioModalTitle">Nuevo Usuario</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="usuarioForm">
                                <input type="hidden" id="usuarioId">
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">Nombre *</label>
                                        <input type="text" class="form-control text-light" id="usuarioNombre" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">Apellido *</label>
                                        <input type="text" class="form-control text-light" id="usuarioApellido" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">Usuario (Login) *</label>
                                        <input type="text" class="form-control text-light" id="usuarioLogin" required autocomplete="new-username">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">Contraseña <span id="pwdAsterisk">*</span></label>
                                        <input type="password" class="form-control text-light" id="usuarioPass" autocomplete="new-password">
                                        <div class="form-text text-secondary" id="usuarioPassHelp" style="display:none;">Dejá en blanco para no cambiarla.</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">Rol *</label>
                                        <select class="form-select text-light" id="usuarioRol" required onchange="togglePermisosUI()">
                                            <option value="cliente">Cliente</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-dim small fw-bold">Cliente Asignado</label>
                                        <select class="form-select text-light" id="usuarioClienteId">
                                            <option value="">-- Sin Cliente --</option>
                                        </select>
                                    </div>
                                </div>
                                <hr class="border-secondary">
                                <h6 class="fw-bold mb-3 text-info">Permisos Específicos</h6>
                                <div id="permisosContainer">
                                    <!-- Generado dinámicamente -->
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-outline-info btn-sm" id="btnSaveUsuario" onclick="handleUsuarioSubmit()">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}

async function prepareUsuarioModal(usuario = null) {
    renderUsuarioModal();
    document.getElementById("usuarioModalTitle").innerText = usuario ? "Editar Usuario" : "Nuevo Usuario";
    document.getElementById("usuarioId").value = usuario ? usuario.id : "";

    document.getElementById("usuarioNombre").value = usuario ? usuario.nombre : "";
    document.getElementById("usuarioApellido").value = usuario ? usuario.apellido : "";
    document.getElementById("usuarioLogin").value = usuario ? usuario.usuario : "";

    // Contraseña
    const passInput = document.getElementById("usuarioPass");
    const passHelp = document.getElementById("usuarioPassHelp");
    const pwdAsterisk = document.getElementById("pwdAsterisk");

    if (usuario) {
        passInput.required = false;
        passHelp.style.display = "block";
        pwdAsterisk.style.display = "none";
    } else {
        passInput.required = true;
        passHelp.style.display = "none";
        pwdAsterisk.style.display = "inline";
    }
    passInput.value = ""; // Limpiar siempre por seguridad

    document.getElementById("usuarioRol").value = usuario ? usuario.rol : "cliente";

    // Cargar clientes en el select
    try {
        const clientes = await window.api.getClients();
        const clientSelect = document.getElementById("usuarioClienteId");
        clientSelect.innerHTML = '<option value="">-- Sin Cliente --</option>' + clientes.map(c => `
            <option value="${c.id}">${c.nombre} (${c.empresa || ''})</option>
        `).join("");

        if (usuario && usuario.cliente_id) {
            clientSelect.value = usuario.cliente_id;
        }
    } catch (e) {
        console.error("Error al cargar clientes:", e);
    }

    // Funciones
    let funciones = usuario && usuario.funciones_habilitadas ? usuario.funciones_habilitadas : {
        clientes: 'none', tickets: 'none', agentes: 'none', facturas: 'none'
    };
    if (usuario?.rol === 'admin') {
        funciones = { clientes: 'editar_crear', tickets: 'editar_crear', agentes: 'editar_crear', facturas: 'editar_crear' };
    }
    renderPermisos(funciones);
    togglePermisosUI();
}

function renderPermisos(funciones) {
    const modules = ['clientes', 'tickets', 'agentes', 'facturas'];
    const pContainer = document.getElementById("permisosContainer");

    pContainer.innerHTML = modules.map(mod => {
        const val = funciones[mod] || 'none';
        return `
            <div class="row align-items-center mb-2">
                <div class="col-md-4 text-capitalize text-light">${mod}</div>
                <div class="col-md-8">
                    <select class="form-select form-select-sm text-light permiso-select" data-mod="${mod}">
                        <option value="none" ${val === 'none' ? 'selected' : ''}>Denegado</option>
                        <option value="ver_propio" ${val === 'ver_propio' ? 'selected' : ''}>Ver (Propio del cliente)</option>
                        <option value="ver_todo" ${val === 'ver_todo' ? 'selected' : ''}>Ver (Todo el sistema)</option>
                        <option value="editar_crear" ${val === 'editar_crear' ? 'selected' : ''}>Control Total (Editar/Crear)</option>
                    </select>
                </div>
            </div>
        `;
    }).join('');
}

function togglePermisosUI() {
    const rol = document.getElementById("usuarioRol").value;
    const isClient = rol === 'cliente';
    const clientSelect = document.getElementById("usuarioClienteId");

    // Si es administrador, bloqueamos las selecciones (es control total por defecto)
    document.querySelectorAll(".permiso-select").forEach(sel => {
        if (!isClient) {
            sel.value = 'editar_crear';
            sel.disabled = true;
        } else {
            sel.disabled = false;
        }
    });

    // Obligatorio asociar cliente si no es admin
    if (isClient) {
        clientSelect.required = true;
        // Opcional: añadir una indicación visual
        clientSelect.classList.add("border-info");
    } else {
        clientSelect.required = false;
        clientSelect.classList.remove("border-info");
    }
}

function openNewUsuarioModal() {
    prepareUsuarioModal(null).then(() => {
        const modal = new bootstrap.Modal(document.getElementById('usuarioModal'));
        modal.show();
    });
}

function openEditUsuario(id) {
    const u = allUsuarios.find(x => x.id === id);
    if (!u) return;

    prepareUsuarioModal(u).then(() => {
        const modal = new bootstrap.Modal(document.getElementById('usuarioModal'));
        modal.show();
    });
}

async function handleUsuarioSubmit() {
    const form = document.getElementById("usuarioForm");
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById("btnSaveUsuario");
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Guardando...`;
    btn.disabled = true;

    const id = document.getElementById("usuarioId").value;
    const pwd = document.getElementById("usuarioPass").value;

    const userData = {
        nombre: document.getElementById("usuarioNombre").value,
        apellido: document.getElementById("usuarioApellido").value,
        usuario: document.getElementById("usuarioLogin").value,
        rol: document.getElementById("usuarioRol").value,
        cliente_id: document.getElementById("usuarioClienteId").value || null
    };

    if (userData.rol === 'cliente' && !userData.cliente_id) {
        showToast("Los usuarios de tipo 'Cliente' deben estar asociados obligatoriamente a una empresa.", "warning");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    if (pwd) {
        userData.contrasena = pwd;
    }

    // Armar permisos
    if (userData.rol === 'admin') {
        userData.funciones_habilitadas = { clientes: 'editar_crear', tickets: 'editar_crear', agentes: 'editar_crear', facturas: 'editar_crear' };
    } else {
        const funciones = {};
        document.querySelectorAll(".permiso-select").forEach(sel => {
            funciones[sel.dataset.mod] = sel.value;
        });
        userData.funciones_habilitadas = (Object.keys(funciones).length > 0) ? funciones : null;
    }

    try {
        if (id) {
            await window.api.updateUsuario(id, userData);
            showToast("Usuario actualizado correctamente", "success");
        } else {
            await window.api.createUsuario(userData);
            showToast("Usuario creado correctamente", "success");
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('usuarioModal'));
        if (modal) modal.hide();

        loadUsuarios();
    } catch (err) {
        showToast("Error al guardar usuario", "danger");
        console.error(err);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function deleteUsuario(id) {
    if (!confirm("¿Estás seguro de que deseás eliminar este usuario permanentemente?")) return;
    try {
        await window.api.deleteUsuario(id);
        showToast("Usuario eliminado", "success");
        loadUsuarios();
    } catch (err) {
        showToast("Error al eliminar", "danger");
        console.error(err);
    }
}
