// logs-view.js
const LogsView = {
    init: function() {
        this.container = document.getElementById('logs-view');
        this.renderLayout();
        this.loadLogs();
        this.setupListeners();
    },

    renderLayout: function() {
        this.container.innerHTML = `
            <div class="audit-layout">
                <!-- Cabecera flotante -->
                <div class="view-header">
                    <div class="view-header-left">
                        <h2 class="view-header-title">
                            <i class="bi bi-terminal mr-2"></i>LOGS GLOBALES DEL SISTEMA
                        </h2>
                    </div>
                    <div class="view-header-controls">
                        <button class="btn btn-outline-light btn-sm" id="btn-refresh-logs">
                            <i class="bi bi-arrow-clockwise btn-refresh-icon mr-2"></i><span class="btn-refresh-label">Actualizar</span>
                        </button>
                    </div>
                </div>

                <!-- Área scrolleable -->
                <div class="audit-scroll-area flex flex-col gap-4 p-0 md:p-0">

                    <!-- Filtros Elegantes -->
                    <div class="glass-card p-4 rounded flex gap-4 flex-wrap items-end">
                        <div class="flex-1 min-w-[140px]">
                            <label class="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Desde</label>
                            <input type="datetime-local" id="log-filter-from" class="form-control form-control-sm text-main bg-transparent" onchange="LogsView.filterLogs()">
                        </div>
                        <div class="flex-1 min-w-[140px]">
                            <label class="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Hasta</label>
                            <input type="datetime-local" id="log-filter-to" class="form-control form-control-sm text-main bg-transparent" onchange="LogsView.filterLogs()">
                        </div>
                        <div class="flex-1 min-w-[140px]">
                            <label class="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Servicio</label>
                            <select id="log-filter-service" class="form-select form-select-sm text-main bg-transparent" onchange="LogsView.filterLogs()">
                                <option value="">Todos</option>
                                <option value="OPENAI">OpenAI</option>
                                <option value="META">Meta</option>
                                <option value="SUPABASE">Supabase</option>
                                <option value="RAILWAY">Railway</option>
                            </select>
                        </div>
                        <div class="flex-1 min-w-[120px]">
                            <label class="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Nivel</label>
                            <select id="log-filter-level" class="form-select form-select-sm text-main bg-transparent" onchange="LogsView.filterLogs()">
                                <option value="">Todos</option>
                                <option value="ERROR">Error</option>
                                <option value="WARN">Warning</option>
                                <option value="INFO">Info</option>
                            </select>
                        </div>
                        <div class="flex-1 min-w-[200px] grow-[2]">
                            <label class="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Búsqueda</label>
                            <div class="input-group input-group-sm search-input-group">
                                <span class="input-group-text text-dim">
                                    <i class="bi bi-search"></i>
                                </span>
                                <input type="text" class="form-control text-main" id="logsSearch" onkeyup="LogsView.filterLogs()" placeholder="Buscar mensaje o proyecto...">
                            </div>
                        </div>
                    </div>

                    <!-- Desktop: tabla -->
                    <div class="glass-card p-0 overflow-hidden rounded hidden md:block">
                        <div class="table-responsive">
                            <table class="table table-hover mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th>Fecha/Hora</th>
                                        <th>Nivel</th>
                                        <th>Origen</th>
                                        <th>Detalles</th>
                                        <th class="text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody id="logs-table-body">
                                    <tr><td colspan="5" class="text-center py-12 text-dim">Cargando logs...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Mobile: cards -->
                    <div id="logs-cards-view" class="md:hidden flex flex-col gap-2"></div>
                </div>

                <!-- Modal Detalle -->
                <div class="modal fade" id="logDetailModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content glass-card">
                            <div class="modal-header">
                                <h5 class="modal-title">Detalles del Error</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <pre id="log-detail-json" style="background:#1e1e1e; padding:15px; border-radius:8px; color:#9cdcfe; font-size:0.85rem; max-height:400px; overflow:auto;"></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    rawLogs: [],

    loadLogs: async function() {
        const tbody = document.getElementById('logs-table-body');
        const cardsView = document.getElementById('logs-cards-view');
        const btn = document.getElementById('btn-refresh-logs');
        
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'; }

        try {
            const data = await window.api.getLogs();
            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-dim">No hay logs registrados</td></tr>`;
                cardsView.innerHTML = `<div class="text-center py-12 text-dim">No hay logs registrados</div>`;
                this.rawLogs = [];
            } else {
                this.rawLogs = data;
                this.renderLogs(data);
            }
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-12">Error al cargar logs: ${error.message}</td></tr>`;
            cardsView.innerHTML = `<div class="text-danger text-center py-12">Error al cargar logs: ${error.message}</div>`;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-arrow-clockwise btn-refresh-icon mr-2"></i><span class="btn-refresh-label">Actualizar</span>';
            }
        }
    },

    filterLogs: function() {
        const searchInput = document.getElementById('logsSearch')?.value.toLowerCase() || '';
        const dateFrom = document.getElementById('log-filter-from')?.value;
        const dateTo = document.getElementById('log-filter-to')?.value;
        const service = document.getElementById('log-filter-service')?.value;
        const level = document.getElementById('log-filter-level')?.value;
        
        const filtered = this.rawLogs.filter(log => {
            // Text Search
            if (searchInput && !(
                (log.message && log.message.toLowerCase().includes(searchInput)) ||
                (log.project_id && log.project_id.toLowerCase().includes(searchInput)) ||
                (log.client_id && log.client_id.toLowerCase().includes(searchInput))
            )) return false;

            // Service
            if (service && log.service !== service) return false;

            // Level
            if (level && log.level !== level) return false;

            // Date Range
            if (dateFrom || dateTo) {
                const logTime = new Date(log.created_at).getTime();
                if (dateFrom && logTime < new Date(dateFrom).getTime()) return false;
                if (dateTo && logTime > new Date(dateTo).getTime()) return false;
            }

            return true;
        });
        this.renderLogs(filtered);
    },

    renderLogs: function(data) {
        const tbody = document.getElementById('logs-table-body');
        const cardsView = document.getElementById('logs-cards-view');
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-dim">Sin resultados para la búsqueda</td></tr>`;
            cardsView.innerHTML = `<div class="text-center py-12 text-dim">Sin resultados para la búsqueda</div>`;
            return;
        }

        tbody.innerHTML = data.map(log => {
            const date = new Date(log.created_at);
            return `
            <tr>
                <td>
                    <div class="font-bold">${date.toLocaleDateString()}</div>
                    <div class="text-sm text-dim">${date.toLocaleTimeString()}</div>
                </td>
                <td><span class="badge ${log.level === 'ERROR' ? 'badge-status-danger' : (log.level === 'WARN' ? 'badge-status-warning' : 'badge-status-info')}">${log.level}</span></td>
                <td>
                    <div class="font-bold">${log.service}</div>
                    <div class="text-sm text-dim">${log.project_id || 'Sistema'}</div>
                </td>
                <td class="text-sm">
                    ${log.client_id ? `<div class="text-dim mb-1"><i class="bi bi-person mr-1"></i>${log.client_id}</div>` : ''}
                    <div style="max-width: 350px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.message}">
                        ${log.message}
                    </div>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-light" onclick="LogsView.showDetail('${encodeURIComponent(JSON.stringify(log.details || {}))}')">
                        <i class="bi bi-code-slash mr-1"></i>JSON
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        cardsView.innerHTML = data.map(log => {
            const date = new Date(log.created_at);
            return `
            <div class="glass-card p-4 rounded">
                <div class="flex justify-between items-start gap-2 mb-2">
                    <span class="badge ${log.level === 'ERROR' ? 'badge-status-danger' : (log.level === 'WARN' ? 'badge-status-warning' : 'badge-status-info')}">${log.level}</span>
                    <span class="text-sm text-dim">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
                </div>
                <div class="text-sm mb-2">
                    <span class="text-dim">Origen:</span> <span class="font-bold">${log.service}</span>
                    ${log.project_id ? `<span class="text-dim ml-1">(${log.project_id})</span>` : ''}
                </div>
                ${log.client_id ? `<div class="text-sm mb-1 text-dim"><i class="bi bi-person mr-1"></i>${log.client_id}</div>` : ''}
                <div class="text-sm text-main mb-3" style="word-break:break-word;">${log.message}</div>
                <button class="btn btn-sm btn-outline-light w-full" onclick="LogsView.showDetail('${encodeURIComponent(JSON.stringify(log.details || {}))}')">
                    <i class="bi bi-code-slash mr-1"></i>Ver JSON
                </button>
            </div>
            `;
        }).join('');
    },

    showDetail: function(encodedDetails) {
        let details = {};
        try {
            details = JSON.parse(decodeURIComponent(encodedDetails));
        } catch (e) {
            console.error('Error parseando detalles:', e);
            details = { error: 'No se pudo parsear el JSON original' };
        }
        document.getElementById('log-detail-json').textContent = JSON.stringify(details, null, 2);
        const modal = new bootstrap.Modal(document.getElementById('logDetailModal'));
        modal.show();
    },

    setupListeners: function() {
        document.getElementById('btn-refresh-logs').addEventListener('click', () => this.loadLogs());
    }
};

// Note: Navigation click listeners for logs are now handled globally in render.js
