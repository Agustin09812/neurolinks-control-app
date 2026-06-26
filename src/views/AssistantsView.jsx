import React, { useState, useEffect } from 'react';
import { api } from '../core/api';
import { store, useStoreKey } from '../core/store';

export default function AssistantsView({ navigate }) {
  // Shared data from global store — instant if already cached from another view
  const assistantsData = useStoreKey('assistants', () => store.fetchAssistants());
  const clientsData    = useStoreKey('clients',    () => store.fetchClients());

  const clients = clientsData || [];

  // Sort assistants by creation date (derived, no extra state)
  const assistants = assistantsData
    ? [...assistantsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];

  // Show skeleton only on very first load
  const loading = assistantsData === null || clientsData === null;
  const [refreshing, setRefreshing] = useState(false);

  // Grid list controls
  const [isListView, setIsListView] = useState(() => window.innerWidth > 600);
  const [search, setSearch] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('');

  useEffect(() => {
    const handleResize = () => setIsListView(window.innerWidth > 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map project ID to client object for quick lookup
  const projectClientMap = React.useMemo(() => {
    const map = {};
    clients.forEach(c => {
      const pIds = c.railway_project_ids || c.tokens_backoffice || [];
      const ids = Array.isArray(pIds) ? pIds : (c.token_backoffice ? [c.token_backoffice] : []);
      ids.forEach(pId => {
        if (pId) map[pId] = c;
      });
      if (c.token_backoffice && !map[c.token_backoffice]) {
        map[c.token_backoffice] = c;
      }
    });
    return map;
  }, [clients]);

  // Selected assistant detail state
  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem('selectedAssistantProjectId') || null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectClient, setProjectClient] = useState(null);
  const [clientTicketsCount, setClientTicketsCount] = useState(0);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [domainsCache, setDomainsCache] = useState({}); // { serviceId: string }
  const [loadingHeaderData, setLoadingHeaderData] = useState(false);

  // Modals state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkClientId, setLinkClientId] = useState('');
  const [linkSearch, setLinkSearch] = useState('');

  const [sysConfigVal, setSysConfigVal] = useState(false);
  const [loadingSysConfig, setLoadingSysConfig] = useState(false);

  // Manual refresh — forces a real Railway API call bypassing server cache
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        store.fetchAssistants(true),
        store.fetchClients(true),
      ]);
    } catch (err) {
      window.showToast('Error al cargar asistentes', 'danger');
    } finally {
      setRefreshing(false);
    }
  };

  // Background polling: every 15s re-fetch via store (uses server cache, nearly instant)
  useEffect(() => {
    const timer = setInterval(() => {
      store.fetchAssistants().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);


  // Update selected project object when assistants list or selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('selectedAssistantProjectId', selectedProjectId);
      const proj = assistants.find(p => p.id === selectedProjectId);
      setSelectedProject(proj || null);
    } else {
      localStorage.removeItem('selectedAssistantProjectId');
      setSelectedProject(null);
    }
  }, [selectedProjectId, assistants]);

  // Load details header metadata (WhatsApp, Linked Client, Tickets, Settings)
  const fetchDetailMetadata = async () => {
    if (!selectedProjectId) return;
    setLoadingHeaderData(true);
    try {
      // 1. Linked client
      const linked = await api.getProjectClient(selectedProjectId);
      setProjectClient(linked?.clientes || null);

      if (linked?.clientes) {
        // 2. Pending tickets
        const tCount = await api.getClientPendingTickets(linked.clientes.id);
        setClientTicketsCount(tCount || 0);
      } else {
        setClientTicketsCount(0);
      }

      // 3. WhatsApp connectivity
      const ws = await api.getWhatsAppStatus(selectedProjectId);
      setWhatsappStatus(ws);

      // 4. system-config setting
      const settings = await api.getSettings(selectedProjectId);
      const val = settings?.find(s => s.key === 'SYSTEM_CONFIG_VISIBLE')?.value;
      setSysConfigVal(val === 'true' || val === true);
    } catch (err) {
      console.error('[AssistantsView] Error loading details metadata:', err);
    } finally {
      setLoadingHeaderData(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchDetailMetadata();
    }
  }, [selectedProjectId]);

  // Resolve service domains
  useEffect(() => {
    if (selectedProject && selectedProject.services) {
      selectedProject.services.forEach(svc => {
        if (!domainsCache[svc.id]) {
          api.getServiceDomains(svc.projectId, svc.environmentId, svc.id)
            .then(domains => {
              const domain = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain || 'Sin dominio público';
              setDomainsCache(prev => ({ ...prev, [svc.id]: domain }));
            })
            .catch(() => {
              setDomainsCache(prev => ({ ...prev, [svc.id]: '—' }));
            });
        }
      });
    }
  }, [selectedProject]);

  const getStatusIcon = (status) => {
    if (!status) return 'bi-circle';
    switch (status.toLowerCase()) {
      case 'online': return 'bi-check-circle-fill text-emerald-400';
      case 'error': return 'bi-exclamation-circle-fill text-red-400';
      default: return 'bi-arrow-repeat text-yellow-400';
    }
  };

  const getStatusColor = (status) => {
    if (!status) return 'secondary';
    switch (status.toLowerCase()) {
      case 'online': return 'success';
      case 'error': return 'danger';
      case 'checking': return 'warning';
      default: return 'secondary';
    }
  };

  // Redeploy service
  const handleRedeploy = async (serviceId, environmentId) => {
    if (!confirm('¿Deseas reiniciar este servicio?')) return;
    try {
      await api.redeployService(serviceId, environmentId);
      window.showToast('Reinicio solicitado correctamente', 'success');
      loadAssistantsData();
    } catch (err) {
      window.showToast('Error al reiniciar el servicio', 'danger');
    }
  };

  // Inline rename service
  const [renamingServiceId, setRenamingServiceId] = useState(null);
  const [renamingServiceName, setRenamingServiceName] = useState('');

  const handleStartRenameService = (svc) => {
    setRenamingServiceId(svc.id);
    setRenamingServiceName(svc.name);
  };

  const handleSaveRenameService = async (svcId) => {
    if (!renamingServiceName.trim()) return;
    try {
      await api.renameService(svcId, renamingServiceName);
      window.showToast('Servicio renombrado', 'success');
      setRenamingServiceId(null);
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al renombrar servicio', 'danger');
    }
  };

  // Update single service
  const handleServiceUpdate = async (projectId, environmentId, serviceId) => {
    if (!confirm('¿Actualizar este servicio a la última versión disponible?')) return;
    try {
      await api.updateService(projectId, environmentId, serviceId);
      window.showToast('Actualización iniciada correctamente', 'success');
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al aplicar la actualización', 'danger');
    }
  };

  // Update all services
  const handleUpdateAll = async () => {
    const updatable = assistants.flatMap(p => (p.services || []).filter(s => s.isUpdatable)) || [];
    if (updatable.length === 0) {
      window.showToast('No hay actualizaciones disponibles', 'info');
      return;
    }
    if (!confirm(`¿Actualizar ${updatable.length} servicio(s) a la última versión?`)) return;

    try {
      const results = await Promise.allSettled(
        updatable.map(s => api.updateService(s.projectId, s.environmentId, s.id))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        window.showToast(`${updatable.length} servicio(s) actualizado(s) correctamente`, 'success');
      } else {
        window.showToast(`${updatable.length - failed} actualizados, ${failed} con error`, 'warning');
      }
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error en actualización global', 'danger');
    }
  };

  // Rename Project
  const handleOpenRenameProject = () => {
    if (!selectedProject) return;
    setRenameValue(selectedProject.name);
    setIsRenameModalOpen(true);
  };

  const handleSaveRenameProject = async (e) => {
    e.preventDefault();
    if (!renameValue.trim() || !selectedProjectId) return;
    try {
      await api.updateProjectName(selectedProjectId, renameValue);
      if (selectedProject && selectedProject.services && selectedProject.services.length > 0) {
        await Promise.allSettled(
          selectedProject.services.map(s => api.renameService(s.id, renameValue))
        );
      }
      window.showToast('Proyecto renombrado', 'success');
      setIsRenameModalOpen(false);
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al renombrar el proyecto', 'danger');
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (!selectedProjectId) return;
    const confirmDelete = confirm('¿Seguro que querés eliminar este proyecto?\n\nEsta acción es irreversible.');
    if (!confirmDelete) return;

    try {
      await api.deleteProject(selectedProjectId);
      window.showToast('Proyecto eliminado', 'success');
      setSelectedProjectId(null);
      store.fetchAssistants(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al eliminar el proyecto', 'danger');
    }
  };

  // Toggle system config setting
  const handleSysConfigToggle = async (e) => {
    if (!selectedProjectId) return;
    const checked = e.target.checked;
    const newVal = checked ? 'true' : 'false';
    setLoadingSysConfig(true);
    try {
      await api.updateSetting(selectedProjectId, 'SYSTEM_CONFIG_VISIBLE', newVal);
      setSysConfigVal(checked);
      window.showToast(`system-config ${checked ? 'activado' : 'desactivado'} - guardado en Supabase`, 'success');
    } catch {
      window.showToast('Error al actualizar configuración', 'danger');
    } finally {
      setLoadingSysConfig(false);
    }
  };

  // Link client action
  const handleLinkClientSubmit = async (e) => {
    e.preventDefault();
    if (!linkClientId || !selectedProjectId) return;
    try {
      await api.linkProjectClient(selectedProjectId, linkClientId);
      window.showToast('Cliente vinculado', 'success');
      setIsLinkModalOpen(false);
      fetchDetailMetadata();
      store.fetchClients(true).catch(() => {});
    } catch (err) {
      window.showToast('Error al vincular cliente', 'danger');
    }
  };

  // Navigate to variables view
  const openVariables = (svc) => {
    sessionStorage.setItem('varsContext', JSON.stringify({
      projectId: selectedProjectId,
      environmentId: svc.environmentId,
      serviceId: svc.id,
      serviceName: svc.name
    }));
    navigate('variables');
  };

  if (loading) {
    return (
      <div>
        <div className="view-header">
          <div className="view-header-left clients-header-left">
            <h2 className="view-header-title mb-0">MIS ASISTENTES</h2>
          </div>
          <div className="view-header-controls">
            <button className="btn btn-sm btn-outline-light flex items-center gap-2" disabled>
              <span className="spinner-border spinner-border-sm"></span>
              Cargando
            </button>
          </div>
        </div>
        <div className="h-full flex flex-col justify-center items-center py-20 text-dim">
          <span className="spinner-border text-primary mb-3"></span>
          <span>Cargando asistentes...</span>
        </div>
      </div>
    );
  }

  // Filter list
  const filteredAssistants = assistants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (!selectedClientFilter) return true;
    const assignedClient = projectClientMap[p.id];
    return assignedClient && assignedClient.id === selectedClientFilter;
  });

  const anyUpdatable = assistants.some(p => (p.services || []).some(s => s.isUpdatable));

  return (
    <div>
      {selectedProject ? (
        <div className="anim-slide-right">
          {/* HEADER / TOPBAR */}
          <div className="view-header flex items-center justify-between gap-3 w-full mb-6" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-3 overflow-hidden">
              <button className="btn btn-outline-light btn-sm flex items-center justify-center shrink-0" onClick={() => setSelectedProjectId(null)} title="Volver a Asistentes">
                <i className="bi bi-arrow-left"></i>
              </button>
              <h2 className="view-header-title mb-0 text-base sm:text-lg lg:text-xl truncate hidden sm:block">{selectedProject.name}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="btn btn-outline-light btn-sm flex items-center justify-center" onClick={() => fetchDetailMetadata()} title="Actualizar">
                <i className="bi bi-arrow-clockwise"></i>
              </button>
              <div className="dropdown">
                <button className="btn btn-outline-light btn-sm dropdown-toggle flex items-center justify-center" data-bs-toggle="dropdown" aria-expanded="false">
                  <i className="bi bi-three-dots-vertical"></i>
                </button>
                <ul className="dropdown-menu dropdown-menu-end dropdown-menu-dark">
                  <li>
                    <button className="dropdown-item" onClick={handleOpenRenameProject}>
                      <i className="bi bi-pencil mr-2"></i>Cambiar nombre
                    </button>
                  </li>
                  <li>
                    <button className="dropdown-item" onClick={() => api.openExternal(selectedProject.railwayUrl)}>
                      <i className="bi bi-box-arrow-up-right mr-2"></i>Abrir Railway
                    </button>
                  </li>
                  <li>
                    <div className="dropdown-item d-flex justify-content-between align-items-center gap-3" style={{ cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm"><i className="bi bi-eye mr-2"></i>system-config visible</span>
                      <label className="sysconfig-toggle" style={{ opacity: loadingSysConfig ? 0.5 : 1 }}>
                        <input type="checkbox" className="btn-sysconfig-toggle" checked={sysConfigVal} onChange={handleSysConfigToggle} disabled={loadingSysConfig} />
                        <span className="sysconfig-thumb">
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                        </span>
                      </label>
                    </div>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item text-danger" onClick={handleDeleteProject}>
                      <i className="bi bi-trash mr-2"></i>Eliminar proyecto
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* MOBILE PROJECT TITLE (visible only on mobile screens < 640px) */}
          <div className="block sm:hidden text-center mb-6 px-2">
            <h3 className="view-header-title font-bold text-lg mb-0 truncate w-full">{selectedProject.name}</h3>
          </div>

          {/* Counters and Badges row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-6">
              {/* TILE 1: SERVICIOS */}
              <div className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner transition-all hover:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <i className="bi bi-hdd-network text-sky-400 fs-5"></i>
                  <span className="text-xs text-dim font-bold tracking-wider">SERVICIOS</span>
                </div>
                <div className="flex gap-2 text-xs font-semibold items-center">
                  <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20" title="Servicios Online">
                    <i className="bi bi-check-circle-fill"></i>
                    {(selectedProject.services || []).filter(s => s.status === 'online').length}
                  </span>
                  <span className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20" title="Servicios con Error">
                    <i className="bi bi-x-circle-fill"></i>
                    {(selectedProject.services || []).filter(s => s.status === 'error').length}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20" title="Servicios Verificando">
                    <i className="bi bi-arrow-repeat"></i>
                    {(selectedProject.services || []).filter(s => s.status === 'checking').length}
                  </span>
                </div>
              </div>

              {/* TILE 2: CLIENTE */}
              {projectClient ? (
                <button
                  className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner hover:bg-sky-500/10 hover:border-sky-500/30 transition-all text-left group border-0 w-full cursor-pointer"
                  onClick={() => {
                    localStorage.setItem('selectedClientId', projectClient.id);
                    navigate('clients');
                  }}
                  title="Ver detalle del cliente"
                >
                  <div className="flex items-center gap-2">
                    <i className="bi bi-person-badge text-sky-400 fs-5 group-hover:scale-110 transition-transform"></i>
                    <span className="text-xs text-dim font-bold tracking-wider">CLIENTE</span>
                  </div>
                  <span className="text-xs font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 truncate max-w-[150px]">
                    <i className="bi bi-person-fill text-sky-400"></i>
                    {projectClient.nombre}
                  </span>
                </button>
              ) : (
                <button
                  className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-left group border-0 w-full cursor-pointer"
                  onClick={() => { setLinkClientId(''); setLinkSearch(''); setIsLinkModalOpen(true); }}
                >
                  <div className="flex items-center gap-2">
                    <i className="bi bi-link-45deg text-emerald-400 fs-4 group-hover:scale-110 transition-transform"></i>
                    <span className="text-xs text-dim font-bold tracking-wider">CLIENTE</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                    Vincular cliente
                  </span>
                </button>
              )}

              {/* TILE 3: SOPORTE / TICKETS */}
              <div className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner transition-all hover:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <i className="bi bi-ticket-perforated text-sky-400 fs-5"></i>
                  <span className="text-xs text-dim font-bold tracking-wider">SOPORTE</span>
                </div>
                {projectClient ? (
                  clientTicketsCount > 0 ? (
                    <span className="text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                      <i className="bi bi-exclamation-circle-fill text-red-400"></i>
                      {clientTicketsCount} {clientTicketsCount === 1 ? 'Ticket' : 'Tickets'}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <i className="bi bi-check-circle-fill text-emerald-400"></i>
                      Sin pendientes
                    </span>
                  )
                ) : (
                  <span className="text-xs text-dim italic">Sin cliente</span>
                )}
              </div>

              {/* TILE 4: WHATSAPP */}
              <div className="flex items-center justify-between p-3.5 rounded-xl status-tile shadow-inner transition-all hover:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <i className="bi bi-whatsapp text-emerald-400 fs-5"></i>
                  <span className="text-xs text-dim font-bold tracking-wider">WHATSAPP</span>
                </div>
                {whatsappStatus?.connected ? (
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1"></span>
                    Conectado
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <i className="bi bi-x-circle-fill text-amber-400"></i>
                    Desconectado
                  </span>
                )}
              </div>
            </div>

          {/* SERVICES LIST */}
          <div className="grid gap-4 mt-6">
            {(selectedProject.services || []).length === 0 ? (
              <div className="glass-card p-6 text-center text-dim text-sm">Este proyecto no tiene servicios registrados</div>
            ) : (
              selectedProject.services.map((service, sIdx) => {
                const domain = domainsCache[service.id] || '—';
                const isRenaming = renamingServiceId === service.id;

                return (
                  <div key={service.id} className="service-card p-6 rounded anim-card-enter" style={{ '--si': sIdx }}>
                    <div className="rw-svc-header px-6 py-4">
                      <div className="flex items-start gap-4">
                        <div className="rw-svc-icon shrink-0 mt-1 hidden sm:flex">
                          <i className="bi bi-cpu-fill"></i>
                        </div>
                        <div className="grow min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            {isRenaming ? (
                              <div className="flex items-center gap-1 grow min-w-0">
                                <input
                                  type="text"
                                  className="form-control form-control-sm text-main"
                                  style={{ maxWidth: '160px' }}
                                  value={renamingServiceName}
                                  onChange={(e) => setRenamingServiceName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRenameService(service.id);
                                    if (e.key === 'Escape') setRenamingServiceId(null);
                                  }}
                                />
                                <button className="btn btn-success btn-sm px-2" onClick={() => handleSaveRenameService(service.id)}>
                                  <i className="bi bi-check-lg"></i>
                                </button>
                                <button className="btn btn-outline-secondary btn-sm px-2" onClick={() => setRenamingServiceId(null)}>
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              </div>
                            ) : (
                              <span className="font-bold service-name text-xs sm:text-sm md:text-base truncate">{service.name}</span>
                            )}
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="service-status-icon">
                                <i className={`bi ${getStatusIcon(service.status)}`}></i>
                              </span>
                              {service.isUpdatable && (
                                <button
                                  className="btn btn-warning btn-sm btn-update-mini flex items-center gap-1"
                                  onClick={() => handleServiceUpdate(service.projectId, service.environmentId, service.id)}
                                >
                                  <i className="bi bi-info-circle-fill"></i>
                                  <span className="hidden md:inline">Update available</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="x-small text-dim rw-svc-domain">
                            <i className="bi bi-globe2 mr-1"></i>
                            <span>{domain}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rw-svc-meta px-6 py-2 flex items-center justify-between">
                      <div className="x-small text-dim service-date">
                        <i className="bi bi-clock mr-1"></i>
                        Último deploy: {new Date(service.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Action Tabs */}
                    <div className="rw-svc-actions flex">
                      <div
                        className="service-menu-item btn-backoffice flex-1 text-center py-2 cursor-pointer"
                        onClick={async () => {
                          try {
                            const domains = await api.getServiceDomains(service.projectId, service.environmentId, service.id);
                            let domain = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain;
                            if (!domain) { window.showToast('Este servicio no tiene dominio público', 'warning'); return; }
                            if (!domain.startsWith('http')) domain = 'https://' + domain;
                            api.openDashboardWindow(domain);
                          } catch {
                            window.showToast('Error al obtener URL del servicio', 'danger');
                          }
                        }}
                      >
                        <i className="bi bi-box-arrow-up-right mr-1"></i> Backoffice
                      </div>
                      <div className="rw-sep"></div>
                      <div
                        className="service-menu-item btn-logs flex-1 text-center py-2 cursor-pointer"
                        onClick={() => api.openDashboardWindow(`https://railway.com/project/${service.projectId}/logs?environmentId=${service.environmentId}&timeFrame=30d`)}
                      >
                        <i className="bi bi-terminal mr-1"></i> Logs
                      </div>
                      <div className="rw-sep"></div>
                      <div className="service-menu-item btn-vars flex-1 text-center py-2 cursor-pointer" onClick={() => openVariables(service)}>
                        <i className="bi bi-sliders mr-1"></i> Variables
                      </div>
                      <div className="rw-sep"></div>
                      <div className="service-menu-item btn-redeploy flex-1 text-center py-2 cursor-pointer" onClick={() => handleRedeploy(service.id, service.environmentId)}>
                        <i className="bi bi-arrow-repeat mr-1"></i> Redeploy
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div id="assistants-grid-panel">
          {/* HEADER PANEL */}
          <style>{`
            /* Contenedor principal de la cabecera */
            .assistant-custom-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 1rem;
              width: 100%;
            }
            .assistant-header-top {
              display: flex;
              align-items: center;
              gap: 1rem;
              flex: 1 1 auto;
            }
            .assistant-header-inputs {
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .assistant-header-controls {
              display: flex;
              align-items: center;
              justify-content: flex-end;
              flex-shrink: 0;
            }
            .assistant-btn-label {
              display: inline !important;
            }
            .assistant-btn-icon {
              margin-right: 0.5rem !important;
            }

            /* VISTA TABLET Y MOBILE: <= 991px */
            @media (max-width: 991px) {
              .assistant-custom-header {
                flex-direction: column;
                align-items: center;
                gap: 1rem;
                width: 100%;
              }
              .assistant-header-top {
                flex-direction: column;
                align-items: center;
                width: 100%;
                gap: 0.8rem;
              }
              .assistant-header-inputs {
                flex-direction: column;
                align-items: center;
                width: 100%;
                gap: 0.8rem;
              }
              .assistant-header-inputs > div {
                width: 100% !important;
                max-width: 400px;
              }
              .assistant-header-controls {
                width: 100%;
                justify-content: center;
              }
              .assistant-header-controls .flex {
                justify-content: center;
                width: 100%;
                flex-wrap: wrap;
              }
            }
          `}</style>
          <div className="view-header assistant-custom-header">
            <div className="assistant-header-top">
              <h2 className="view-header-title mb-0 text-center">MIS ASISTENTES</h2>
              <div className="assistant-header-inputs">
                <div className="input-group input-group-sm mb-0" style={{ width: '180px' }}>
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
                <div className="flex flex-row items-center gap-1" style={{ width: '180px' }}>
                  <select
                    className="form-select form-select-sm text-main bg-transparent border-secondary w-full"
                    value={selectedClientFilter}
                    onChange={(e) => setSelectedClientFilter(e.target.value)}
                  >
                    <option value="">Todos los clientes</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id} className="bg-dark text-white">
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {selectedClientFilter && (
                    <button className="btn btn-outline-secondary btn-sm shrink-0" onClick={() => setSelectedClientFilter('')} title="Limpiar filtro">
                      <i className="bi bi-x-lg"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="assistant-header-controls">
              <div className="flex gap-2 items-center justify-center">
                {anyUpdatable && (
                  <button className="btn btn-warning btn-sm flex items-center" onClick={handleUpdateAll}>
                    <i className="bi bi-arrow-up-circle assistant-btn-icon"></i>
                    <span className="assistant-btn-label">Update All</span>
                  </button>
                )}
                <button className="btn btn-outline-light btn-sm flex items-center" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? (
                    <span className="spinner-border spinner-border-sm assistant-btn-icon"></span>
                  ) : (
                    <i className="bi bi-arrow-clockwise assistant-btn-icon"></i>
                  )}
                  <span className="assistant-btn-label">Actualizar</span>
                </button>
              </div>
            </div>
          </div>

          {/* GRID / LIST */}
          <div className={`mt-4 ${isListView ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
            {filteredAssistants.length === 0 ? (
              <div className="col-span-full text-center text-white/50 py-12">No hay asistentes desplegados.</div>
            ) : (
              filteredAssistants.map((project, index) => {
                const statusColor = getStatusColor(project.status);
                const hasUpdate = (project.services || []).some(s => s.isUpdatable);
                const client = projectClientMap[project.id];

                if (isListView) {
                  return (
                    <div
                      key={project.id}
                      className="glass-card px-4 py-3 flex items-center gap-3 assistant-card hover-lift clickable anim-card-enter"
                      style={{ '--si': index }}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{project.name}</div>
                        <div className="text-xs text-white/50">ID: {project.id.substring(0, 8)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {client ? (
                          <span className="badge badge-status-info">
                            <i className="bi bi-person-fill mr-1"></i>{client.nombre}
                          </span>
                        ) : (
                          <span className="badge badge-status-secondary">
                            <i className="bi bi-dash-circle mr-1"></i>No vinculado
                          </span>
                        )}
                        <span className="text-sm text-dim hidden sm:block">Servicios: {(project.services || []).length}</span>
                        <span className={`badge badge-status-${statusColor}`}>{project.status.toUpperCase()}</span>
                        {hasUpdate && (
                          <span className="badge badge-status-warning">
                            <i className="bi bi-info-circle-fill"></i>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={project.id}
                    className="glass-card p-4 h-full assistant-card hover-lift clickable anim-card-enter"
                    style={{ '--si': index }}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="font-bold truncate mb-2">{project.name}</div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`badge badge-status-${statusColor}`}>{project.status.toUpperCase()}</span>
                      <span className="text-xs text-white/50">ID: {project.id.substring(0, 8)}</span>
                    </div>
                    <div className="mb-3">
                      {client ? (
                        <span className="badge badge-status-info">
                          <i className="bi bi-person-fill mr-1"></i>{client.nombre}
                        </span>
                      ) : (
                        <span className="badge badge-status-secondary">
                          <i className="bi bi-dash-circle mr-1"></i>No vinculado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-sm text-dim">
                      <span>Servicios: {(project.services || []).length}</span>
                      {hasUpdate && (
                        <span className="badge badge-status-warning">
                          <i className="bi bi-info-circle-fill mr-1"></i>Update
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* RENAME PROJECT MODAL OVERLAY */}
      {isRenameModalOpen && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content glass-card">
              <div className="modal-header">
                <h5 className="modal-title font-bold">Renombrar proyecto</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsRenameModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveRenameProject}>
                <div className="modal-body p-6">
                  <input type="text" className="form-control text-main" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required />
                </div>
                <div className="modal-footer p-4">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setIsRenameModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-sm btn-success">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LINK CLIENT MODAL OVERLAY */}
      {isLinkModalOpen && (
        <div className="modal fade show overflow-y-auto" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered mx-4 sm:mx-auto max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl lg:max-w-4xl w-full">
            <div className="modal-content glass-card w-full max-w-full">
              <div className="modal-header px-4 py-3 sm:p-4">
                <h5 className="modal-title font-bold text-base sm:text-lg">Vincular Cliente</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsLinkModalOpen(false)}></button>
              </div>
              <form onSubmit={handleLinkClientSubmit} className="w-full max-w-full">
                <div className="modal-body p-3 sm:p-6 w-full max-w-full">
                  <div className="mb-2 sm:mb-4 w-full max-w-full">
                    <label className="form-label text-xs sm:text-sm font-bold">BUSCAR CLIENTE</label>
                    <div className="input-group input-group-sm mb-2 w-full max-w-full">
                      <span className="input-group-text bg-transparent border-secondary text-dim">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control border-secondary text-main bg-transparent text-ellipsis overflow-hidden text-xs sm:text-sm"
                        placeholder="Escribí nombre, empresa o email para buscar..."
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                      />
                      {linkSearch && (
                        <button type="button" className="btn btn-outline-secondary border-secondary text-dim" onClick={() => setLinkSearch('')}>
                          <i className="bi bi-x"></i>
                        </button>
                      )}
                    </div>

                    {linkSearch && (
                      <div className="mb-3 max-h-[160px] sm:max-h-[240px] overflow-y-auto border border-secondary rounded bg-black/40 p-1 shadow-inner w-full max-w-full">
                        {clients
                          .filter(c => c.nombre.toLowerCase().includes(linkSearch.toLowerCase()) || (c.empresa && c.empresa.toLowerCase().includes(linkSearch.toLowerCase())) || (c.email && c.email.toLowerCase().includes(linkSearch.toLowerCase())))
                          .map(c => {
                            const emp = c.empresa && c.empresa.trim().toLowerCase() !== c.nombre.trim().toLowerCase() ? ` (${c.empresa})` : '';
                            return (
                              <div
                                key={c.id}
                                className={`p-1.5 sm:p-2 rounded cursor-pointer text-xs sm:text-sm flex items-center justify-between mb-1 last:mb-0 transition-all w-full max-w-full overflow-hidden ${linkClientId === c.id ? 'bg-success/20 border border-success/40 text-success font-bold' : 'hover:bg-white/10 text-main'}`}
                                onClick={() => setLinkClientId(c.id)}
                              >
                                <div className="truncate max-w-[180px] sm:max-w-[400px]" title={`${c.nombre}${emp}`}>
                                  <i className="bi bi-person mr-1.5 text-dim"></i>
                                  {c.nombre}{emp}
                                </div>
                                {linkClientId === c.id && <i className="bi bi-check-circle-fill text-success shrink-0 ml-2"></i>}
                              </div>
                            );
                          })}
                        {clients.filter(c => c.nombre.toLowerCase().includes(linkSearch.toLowerCase()) || (c.empresa && c.empresa.toLowerCase().includes(linkSearch.toLowerCase())) || (c.email && c.email.toLowerCase().includes(linkSearch.toLowerCase()))).length === 0 && (
                          <div className="p-2 text-center text-xs text-dim italic">No se encontraron clientes coincidentes.</div>
                        )}
                      </div>
                    )}

                    {linkClientId && (
                      <div className="mt-3 p-2.5 rounded bg-success/15 border border-success/30 flex items-center justify-between w-full max-w-full text-xs sm:text-sm">
                        <div className="flex items-center gap-2 text-main font-bold truncate">
                          <i className="bi bi-person-check-fill text-success fs-5"></i>
                          <span className="truncate">Seleccionado: {clients.find(c => c.id === linkClientId)?.nombre} {clients.find(c => c.id === linkClientId)?.empresa ? `(${clients.find(c => c.id === linkClientId)?.empresa})` : ''}</span>
                        </div>
                        <button type="button" className="btn btn-sm text-dim hover:text-danger p-0 border-0" onClick={() => setLinkClientId('')} title="Quitar selección">
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer p-3 sm:p-4 flex justify-end gap-2 w-full max-w-full">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setIsLinkModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-sm btn-success" disabled={!linkClientId}>Vincular</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
