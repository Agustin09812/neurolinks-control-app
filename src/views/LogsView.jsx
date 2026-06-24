import React, { useState, useEffect } from 'react';
import { api } from '../core/api';

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [service, setService] = useState('');
  const [level, setLevel] = useState('');
  const [selectedDetails, setSelectedDetails] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setRefreshSuccess(false);
    try {
      const data = await api.getLogs() || [];
      setLogs(data);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 1500);
    } catch (err) {
      console.error('[LogsView] Error loading logs:', err);
      window.showToast('Error al cargar logs del sistema', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Expose a global refresh handle for SSE logs listener
    window.refreshLogs = fetchLogs;
    return () => {
      window.refreshLogs = null;
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    // Silence benign OpenAI 401 error
    if (log.message && log.message.includes('Error [401]: OpenAI no pudo generar una respues')) {
      return false;
    }

    // Text search
    if (search) {
      const q = search.toLowerCase();
      const msg = log.message ? log.message.toLowerCase() : '';
      const pId = log.project_id ? log.project_id.toLowerCase() : '';
      const cId = log.client_id ? log.client_id.toLowerCase() : '';
      if (!msg.includes(q) && !pId.includes(q) && !cId.includes(q)) return false;
    }

    // Service filter
    if (service && log.service !== service) return false;

    // Level filter
    if (level && log.level !== level) return false;

    // Date range
    if (dateFrom || dateTo) {
      const logTime = new Date(log.created_at).getTime();
      if (dateFrom && logTime < new Date(dateFrom).getTime()) return false;
      if (dateTo && logTime > new Date(dateTo).getTime()) return false;
    }

    return true;
  });

  return (
    <div className="audit-layout animate-fade-in">
      {/* Cabecera flotante */}
      <div className="view-header">
        <div className="view-header-left clients-header-left">
          <h2 className="view-header-title mb-0 flex items-center gap-2">
            LOGS GLOBALES
          </h2>
        </div>
        <div className="view-header-controls">
          <button
            className="btn btn-outline-light btn-sm flex items-center gap-1"
            onClick={fetchLogs}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm"></span>
            ) : refreshSuccess ? (
              <i className="bi bi-check-lg"></i>
            ) : (
              <i className="bi bi-arrow-clockwise"></i>
            )}
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Área scrolleable */}
      <div className="audit-scroll-area flex flex-col gap-4 mt-4 p-0">
        {/* Filtros Elegantes */}
        <div className="glass-card p-4 rounded flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Desde</label>
            <input
              type="datetime-local"
              className="form-control form-control-sm text-main bg-transparent"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Hasta</label>
            <input
              type="datetime-local"
              className="form-control form-control-sm text-main bg-transparent"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Servicio</label>
            <select
              className="form-select form-select-sm text-main bg-transparent border-secondary"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="OPENAI">OpenAI</option>
              <option value="META">Meta</option>
              <option value="SUPABASE">Supabase</option>
              <option value="RAILWAY">Railway</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Nivel</label>
            <select
              className="form-select form-select-sm text-main bg-transparent border-secondary"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px] grow-[2]">
            <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Búsqueda</label>
            <div className="input-group input-group-sm search-input-group">
              <span className="input-group-text text-dim">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control text-main"
                placeholder="Buscar mensaje o proyecto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Desktop: tabla */}
        <div className="glass-card p-0 overflow-hidden rounded hidden md:block">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Nivel</th>
                  <th>Origen</th>
                  <th>Detalles</th>
                  <th className="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-dim">
                      {loading ? 'Cargando logs...' : 'Sin resultados para la búsqueda'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const date = new Date(log.created_at);
                    const lvlClass =
                      log.level === 'ERROR'
                        ? 'badge-status-danger'
                        : log.level === 'WARN'
                          ? 'badge-status-warning'
                          : 'badge-status-info';
                    return (
                      <tr key={log.id}>
                        <td>
                          <div className="font-bold">{date.toLocaleDateString()}</div>
                          <div className="text-sm text-dim">{date.toLocaleTimeString()}</div>
                        </td>
                        <td>
                          <span className={`badge ${lvlClass}`}>{log.level}</span>
                        </td>
                        <td>
                          <div className="font-bold">{log.service}</div>
                          <div className="text-sm text-dim">{log.project_id || 'Sistema'}</div>
                        </td>
                        <td className="text-sm">
                          {log.client_id && (
                            <div className="text-dim mb-1">
                              <i className="bi bi-person mr-1"></i>
                              {log.client_id}
                            </div>
                          )}
                          <div
                            style={{
                              maxWidth: '350px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={log.message}
                          >
                            {log.message}
                          </div>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline-light"
                            onClick={() => setSelectedDetails(log.details || {})}
                          >
                            <i className="bi bi-code-slash mr-1"></i>JSON
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden flex flex-col gap-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-dim">
              {loading ? 'Cargando logs...' : 'Sin resultados para la búsqueda'}
            </div>
          ) : (
            filteredLogs.map(log => {
              const date = new Date(log.created_at);
              const lvlClass =
                log.level === 'ERROR'
                  ? 'badge-status-danger'
                  : log.level === 'WARN'
                    ? 'badge-status-warning'
                    : 'badge-status-info';
              return (
                <div key={log.id} className="glass-card p-4 rounded">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`badge ${lvlClass}`}>{log.level}</span>
                    <span className="text-sm text-dim">
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <span className="text-dim">Origen:</span> <span className="font-bold">{log.service}</span>
                    {log.project_id && <span className="text-dim ml-1">({log.project_id})</span>}
                  </div>
                  {log.client_id && (
                    <div className="text-sm mb-1 text-dim">
                      <i className="bi bi-person mr-1"></i>
                      {log.client_id}
                    </div>
                  )}
                  <div className="text-sm text-main mb-3" style={{ wordBreak: 'break-word' }}>
                    {log.message}
                  </div>
                  <button
                    className="btn btn-sm btn-outline-light w-full"
                    onClick={() => setSelectedDetails(log.details || {})}
                  >
                    <i className="bi bi-code-slash mr-1"></i>Ver JSON
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Detalle */}
      {selectedDetails !== null && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content glass-card">
              <div className="modal-header">
                <h5 className="modal-title font-bold">Detalles del Error</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedDetails(null)}
                ></button>
              </div>
              <div className="modal-body p-6">
                <pre
                  id="log-detail-json"
                  style={{
                    background: '#1e1e1e',
                    padding: '15px',
                    borderRadius: '8px',
                    color: '#9cdcfe',
                    fontSize: '0.85rem',
                    maxHeight: '400px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(selectedDetails, null, 2)}
                </pre>
              </div>
              <div className="modal-footer p-4">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setSelectedDetails(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
