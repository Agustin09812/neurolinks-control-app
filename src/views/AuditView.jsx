import React, { useState, useEffect } from 'react';
import { api } from '../core/api';

export default function AuditView() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setIsSuccess(false);
    try {
      const fetched = await api.getAuditLogs() || [];
      fetched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setLogs(fetched);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 1500);
    } catch (err) {
      console.error('[AuditView] Error loading logs:', err);
      window.showToast('Error al cargar auditoría', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadgeClass = (action) => {
    if (!action) return 'badge-status-secondary';
    const a = action.toLowerCase();
    const map = [
      ['delete', 'badge-status-danger'],
      ['create', 'badge-status-success'],
      ['update', 'badge-status-warning'],
      ['deploy', 'badge-status-info']
    ];
    return map.find(([k]) => a.includes(k))?.[1] ?? 'badge-status-secondary';
  };

  const filteredLogs = logs.filter(log =>
    (log.accion && log.accion.toLowerCase().includes(search.toLowerCase())) ||
    (log.entidad_tipo && log.entidad_tipo.toLowerCase().includes(search.toLowerCase())) ||
    (log.detalles && log.detalles.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="audit-layout">
      {/* Cabecera flotante principal */}
      <div className="view-header">
        <div className="view-header-left clients-header-left">
          <h2 className="view-header-title mb-0">REGISTRO DE ACTIVIDAD</h2>
          <div className="input-group input-group-sm search-input-group mb-0">
            <span className="input-group-text text-dim">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control text-main"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="view-header-controls">
          <div className="flex gap-2 clients-toolbar-btns">
            <button
              className="btn btn-outline-light btn-sm flex items-center gap-1"
              onClick={fetchLogs}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : isSuccess ? (
                <i className="bi bi-check-lg"></i>
              ) : (
                <i className="bi bi-arrow-clockwise"></i>
              )}
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Área scrolleable */}
      <div className="audit-scroll-area mt-4">
        {/* Desktop: tabla */}
        <div className="glass-card p-0 overflow-hidden rounded hidden md:block">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Detalles</th>
                  <th className="text-center">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-dim">
                      Sin registros
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const date = new Date(log.created_at);
                    return (
                      <tr key={log.id}>
                        <td>
                          <div className="font-bold">{date.toLocaleDateString()}</div>
                          <div className="text-sm text-dim">{date.toLocaleTimeString()}</div>
                        </td>
                        <td>
                          <span className={`badge ${getActionBadgeClass(log.accion)}`}>{log.accion}</span>
                        </td>
                        <td>
                          <div>{log.entidad_tipo || '-'}</div>
                          <div className="text-sm text-dim">{log.entidad_id || ''}</div>
                        </td>
                        <td className="text-sm" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{log.detalles || ''}</td>
                        <td className="text-center text-sm">{log.usuario || 'Sistema'}</td>
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
            <div className="text-dim text-center py-12">Sin registros</div>
          ) : (
            filteredLogs.map(log => {
              const date = new Date(log.created_at);
              return (
                <div key={log.id} className="glass-card p-4 rounded">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`badge ${getActionBadgeClass(log.accion)}`}>{log.accion}</span>
                    <span className="text-sm text-dim">{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
                  </div>
                  {log.entidad_tipo && (
                    <div className="text-sm mb-1">
                      <span className="text-dim">Entidad:</span> {log.entidad_tipo}
                      {log.entidad_id && <span className="text-dim ml-1">({log.entidad_id})</span>}
                    </div>
                  )}
                  {log.detalles && (
                    <div className="text-sm text-dim mb-1" style={{ wordBreak: 'break-word' }}>
                      {log.detalles}
                    </div>
                  )}
                  <div className="text-sm text-dim mt-1">
                    <i className="bi bi-person mr-1"></i>{log.usuario || 'Sistema'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
