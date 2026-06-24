import React, { useState, useEffect } from 'react';
import { api } from '../core/api';
import { store, useStoreKey } from '../core/store';

const ITEMS_PER_PAGE = 12;

export default function TicketsView({ navigate }) {
  const clientsData    = useStoreKey('clients',    () => store.fetchClients());
  const assistantsData = useStoreKey('assistants', () => store.fetchAssistants());

  const clients = clientsData || [];
  const assistants = assistantsData || [];

  const [tickets, setTickets] = useState([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Client projects (for new ticket form dropdown)
  const [clientProjects, setClientProjects] = useState([]);

  // Filters state
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // New ticket modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Nuevo Ticket');
  const [ticketId, setTicketId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState('Abierto');


  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.getTickets({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        ...(filterStatus ? { estado: filterStatus } : {}),
        ...(filterClient ? { cliente_id: filterClient } : {}),
      }) || {};
      
      setTickets(res.data || []);
      setTotalTickets(res.total || 0);
    } catch (err) {
      console.error('[TicketsView] Error loading tickets:', err);
      window.showToast('Error al cargar tickets', 'danger');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchTickets();
    window.refreshTickets = () => {
      fetchTickets();
      store.invalidate('ticketsMeta');
    };
    return () => {
      window.refreshTickets = null;
    };
  }, [currentPage, filterStatus, filterClient]);

  // Load client projects when client is selected in the creation form
  useEffect(() => {
    if (formClientId) {
      api.getClientProjects(formClientId)
        .then(projIds => {
          setClientProjects(projIds || []);
        })
        .catch(err => {
          console.error('[TicketsView] Error fetching client projects:', err);
          setClientProjects([]);
        });
    } else {
      setClientProjects([]);
    }
    setFormProjectId('');
  }, [formClientId]);

  const handleOpenNewTicketModal = () => {
    setTicketId('');
    setModalTitle('Nuevo Ticket');
    setFormTitle('');
    setFormClientId('');
    setFormProjectId('');
    setFormDesc('');
    setFormStatus('Abierto');
    setIsModalOpen(true);
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!formClientId) {
      alert('Selecciona un cliente');
      return;
    }

    const ticketData = {
      titulo: formTitle,
      cliente_id: formClientId,
      project_id: formProjectId || null,
      descripcion: formDesc,
      estado: formStatus
    };

    try {
      if (ticketId) {
        await api.updateTicket(ticketId, ticketData);
        window.showToast('Ticket actualizado', 'success');
      } else {
        await api.createTicket(ticketData);
        window.showToast('Ticket creado correctamente', 'success');
      }
      setIsModalOpen(false);
      fetchTickets();
    } catch (err) {
      window.showToast('Error al guardar ticket', 'danger');
    }
  };

  const handleEditTicket = (id) => {
    localStorage.setItem('currentChatTicketId', id);
    localStorage.setItem('currentChatTicketBackView', 'tickets');
    navigate('ticket-chat');
  };

  const handleDeleteTicket = async (id) => {
    if (!confirm('¿Seguro que querés eliminar este ticket?')) return;
    try {
      await api.deleteTicket(id);
      window.showToast('Ticket eliminado', 'warning');
      fetchTickets();
    } catch (err) {
      window.showToast('Error al eliminar ticket', 'danger');
    }
  };

  const resetFilters = () => {
    setFilterStatus('');
    setFilterClient('');
    setFilterDateStart('');
    setFilterDateEnd('');
    setCurrentPage(1);
  };

  // Local filtering for date ranges (since date start/end is not passed to server)
  const getFilteredTickets = () => {
    return tickets.filter(t => {
      if (filterDateStart || filterDateEnd) {
        const d = new Date(t.created_at).toISOString().split('T')[0];
        if (filterDateStart && d < filterDateStart) return false;
        if (filterDateEnd && d > filterDateEnd) return false;
      }
      return true;
    });
  };

  const filteredTickets = getFilteredTickets();
  const totalPages = Math.max(1, Math.ceil(totalTickets / ITEMS_PER_PAGE));

  const handleExportCSV = () => {
    if (filteredTickets.length === 0) {
      window.showToast('No hay tickets para exportar', 'warning');
      return;
    }

    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = ['ID', 'Título', 'Cliente', 'Estado', 'Creado'];
    const rows = filteredTickets.map(t => [
      escapeCSV(t.id),
      escapeCSV(t.titulo),
      escapeCSV(t.clientes ? t.clientes.nombre : 'Sin cliente'),
      escapeCSV(t.estado || ''),
      escapeCSV(new Date(t.created_at).toLocaleDateString())
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
      + headers.join(',') + '\n'
      + rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_tickets_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast('Reporte generado', 'success');
  };

  const renderClientName = (t) => {
    const phone = t.chat_id || '';
    const name = t.clientes ? t.clientes.nombre : '';
    if (name) {
      return (
        <div>
          <div className="font-bold">{name}</div>
          {phone && <div className="text-xs text-dim">{phone}</div>}
        </div>
      );
    }
    return <div className="text-dim">{phone || 'Sin cliente'}</div>;
  };

  return (
    <div className="animate-fade">
      {/* HEADER */}
      <div className="view-header">
        <div className="view-header-left">
          <h2 className="view-header-title">
            <i className="bi bi-ticket-perforated mr-2"></i>SOPORTE Y TICKETS
          </h2>
        </div>
        <div className="view-header-controls">
          <button className="btn btn-outline-light btn-sm" onClick={handleOpenNewTicketModal}>
            <i className="bi bi-plus-lg mr-2"></i>Nuevo Ticket
          </button>
          <button className="btn btn-outline-light btn-sm" onClick={fetchTickets} disabled={loading}>
            {loading ? (
              <span className="spinner-border spinner-border-sm"></span>
            ) : (
              <i className="bi bi-arrow-clockwise"></i>
            )}
            <span className="btn-refresh-label">Actualizar</span>
          </button>
          <button className="btn btn-outline-light btn-sm" onClick={handleExportCSV}>
            <i className="bi bi-download"></i> Descargar
          </button>
        </div>
      </div>

      {/* FILTROS COMPACTOS */}
      <div className="glass-card p-4 mb-4 mt-4 rounded flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Estado</label>
          <select
            className="form-select form-select-sm text-main bg-transparent border-secondary"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Todos</option>
            <option value="Abierto">Abierto</option>
            <option value="Cerrado">Cerrado</option>
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Cliente</label>
          <select
            className="form-select form-select-sm text-main bg-transparent border-secondary"
            value={filterClient}
            onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Todos</option>
            {clients.map(c => (
              <option key={c.id} value={c.id} className="bg-dark text-white">
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Desde</label>
          <input
            type="date"
            className="form-control form-control-sm text-main"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
          />
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-dim mb-2 block uppercase tracking-wider font-semibold">Hasta</label>
          <input
            type="date"
            className="form-control form-control-sm text-main"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
          />
        </div>

        <div>
          <button className="btn btn-outline-secondary btn-sm" onClick={resetFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* LISTA / TABLA */}
      <div className="glass-card p-0 overflow-hidden rounded hidden md:block">
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th className="ps-4">Ticket</th>
                <th>Cliente</th>
                <th className="text-center">Estado</th>
                <th className="text-center">Fecha</th>
                <th className="text-right pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-white/50">
                    Cargando tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-white/50">
                    No se encontraron tickets
                  </td>
                </tr>
              ) : (
                filteredTickets.map(t => {
                  const proj = t.project_id ? assistants.find(a => String(a.id) === String(t.project_id)) : null;

                  return (
                    <tr key={t.id} className="ticket-row">
                      <td className="ps-4">
                        <div className="font-bold">#{t.id.substring(0, 8)}</div>
                        <div className="text-sm text-white">{t.titulo}</div>
                        {proj && (
                          <div className="text-xs text-dim mt-0.5">
                            <i className="bi bi-box-arrow-up-right mr-1"></i>
                            Proveniente de {proj.name}
                          </div>
                        )}
                      </td>
                      <td>{renderClientName(t)}</td>
                      <td className="text-center">
                        <span className={`status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}`}>
                          {t.estado}
                        </span>
                      </td>
                      <td className="text-center text-dim text-sm">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-right pe-4">
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-sm btn-outline-light" onClick={() => handleEditTicket(t.id)}>
                            <i className="bi bi-eye"></i>
                          </button>
                          {t.estado === 'Cerrado' && (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteTicket(t.id)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden flex flex-col gap-2">
        {loading ? (
          <div className="text-center py-12 text-white/50">Cargando tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-white/50">No se encontraron tickets</div>
        ) : (
          filteredTickets.map(t => {
            const proj = t.project_id ? assistants.find(a => String(a.id) === String(t.project_id)) : null;
            const phone = t.chat_id || '';
            const clientName = t.clientes ? t.clientes.nombre : '';
            const clientLine = clientName
              ? `${clientName}${phone ? ` (${phone})` : ''}`
              : (phone || 'Sin cliente');

            return (
              <div
                key={t.id}
                className="glass-card no-hover p-4 rounded"
                style={{ cursor: 'pointer' }}
                onClick={() => handleEditTicket(t.id)}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-dim text-sm">#{t.id.substring(0, 8)}</span>
                    <span className="text-sm text-dim">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-center">
                    <span className={`status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}`}>
                      {t.estado}
                    </span>
                  </div>
                  <div className="text-sm text-dim text-center">{clientLine}</div>
                  {proj && (
                    <div className="text-xs text-dim text-center mt-1">
                      <i className="bi bi-box-arrow-up-right mr-1"></i>Proveniente de {proj.name}
                    </div>
                  )}
                  <div
                    className="font-bold text-center"
                    style={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {t.titulo}
                  </div>
                  {t.descripcion && (
                    <div
                      className="text-sm text-dim text-center"
                      style={{
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {t.descripcion}
                    </div>
                  )}
                  {t.estado === 'Cerrado' && (
                    <div className="text-center mt-2">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTicket(t.id);
                        }}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 px-2">
          <button
            className="btn btn-sm btn-outline-light"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <span className="text-sm text-dim" id="pagination-info">
            Página {currentPage} de {totalPages}
          </span>
          <button
            className="btn btn-sm btn-outline-light"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* MODAL NUEVO TICKET OVERLAY */}
      {isModalOpen && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content glass-card">
              <div className="modal-header">
                <h5 className="modal-title font-bold">{modalTitle}</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setIsModalOpen(false)}
                ></button>
              </div>
              <form onSubmit={handleTicketSubmit}>
                <div className="modal-body p-6">
                  <div className="grid gap-4">
                    <div>
                      <label className="form-label text-sm font-bold">CLIENTE</label>
                      <select
                        className="form-select border-secondary bg-transparent text-main"
                        value={formClientId}
                        onChange={(e) => setFormClientId(e.target.value)}
                        required
                      >
                        <option value="">Seleccionar cliente...</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id} className="bg-dark text-white">
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label text-sm font-bold">PROYECTO RAILWAY (OPCIONAL)</label>
                      <select
                        className="form-select border-secondary bg-transparent text-main"
                        value={formProjectId}
                        onChange={(e) => setFormProjectId(e.target.value)}
                        disabled={!formClientId}
                      >
                        <option value="">-- Seleccionar Proyecto --</option>
                        {assistants
                          .filter(a => clientProjects.includes(String(a.id)))
                          .map(proj => (
                            <option key={proj.id} value={proj.id} className="bg-dark text-white">
                              {proj.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label text-sm font-bold">TÍTULO DEL PROBLEMA</label>
                      <input
                        type="text"
                        className="form-control text-main"
                        placeholder="Ej: Caída de Whatsapp"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label text-sm font-bold">DESCRIPCIÓN DETALLADA</label>
                      <textarea
                        className="form-control text-main"
                        rows="3"
                        placeholder="Escribe el problema aquí..."
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label text-sm font-bold">ESTADO INICIAL</label>
                      <select
                        className="form-select border-secondary bg-transparent text-main"
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                      >
                        <option value="Abierto" className="bg-dark text-white">Abierto</option>
                        <option value="Cerrado" className="bg-dark text-white">Cerrado</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer p-4">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success btn-sm">
                    Guardar Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
