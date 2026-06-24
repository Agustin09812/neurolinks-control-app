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
  const [isListView, setIsListView] = useState(() => localStorage.getItem('assistantsView') === 'list');
  const [search, setSearch] = useState('');

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

  const toggleView = () => {
    const next = !isListView ? 'list' : 'grid';
    setIsListView(!isListView);
    localStorage.setItem('assistantsView', next);
  };

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
          <div className="view-header-left">
            <h2 className="view-header-title">MIS ASISTENTES</h2>
            <p className="view-header-subtitle">Gestión técnica de proyectos desplegados en Railway</p>
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
  const filteredAssistants = assistants.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const anyUpdatable = assistants.some(p => (p.services || []).some(s => s.isUpdatable));

  return (
    <div>
      {selectedProject ? (
        <div className="anim-slide-right">
          {/* HEADER / TOPBAR */}
          <div className="rw-topbar mb-6">
            <div className="flex justify-between items-center mb-4">
              <button className="btn btn-outline-light" onClick={() => setSelectedProjectId(null)} title="Volver a Asistentes">
                <i className="bi bi-arrow-left"></i>
              </button>
              <div className="flex items-center gap-2">
                <button className="btn btn-outline-light" onClick={() => fetchDetailMetadata()} title="Actualizar">
                  <i className="bi bi-arrow-clockwise"></i>
                </button>
                <div className="dropdown">
                  <button className="btn btn-outline-light dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
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

            <div className="text-center mb-2">
              <h4 className="font-bold mb-0">{selectedProject.name}</h4>
            </div>

            {/* Counters and Badges row */}
            <div className="flex justify-center items-center gap-4 flex-wrap pt-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <div className="flex gap-4 text-sm items-center">
                <span>
                  <i className="bi bi-check-circle-fill text-emerald-400 mr-1"></i>
                  {(selectedProject.services || []).filter(s => s.status === 'online').length}
                </span>
                <span>
                  <i className="bi bi-x-circle-fill text-red-400 mr-1"></i>
                  {(selectedProject.services || []).filter(s => s.status === 'error').length}
                </span>
                <span>
                  <i className="bi bi-arrow-repeat text-yellow-400 mr-1"></i>
                  {(selectedProject.services || []).filter(s => s.status === 'checking').length}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                {projectClient ? (
                  <span className="badge badge-status-info">
                    <i className="bi bi-person-fill mr-1"></i>
                    {projectClient.nombre}
                  </span>
                ) : (
                  <button className="badge badge-status-info badge-client-btn badge-sm-action border-0" onClick={() => { setLinkClientId(''); setIsLinkModalOpen(true); }}>
                    <i className="bi bi-link-45deg mr-1"></i>
                    Vincular cliente
                  </button>
                )}

                {projectClient && (
                  clientTicketsCount > 0 ? (
                    <div className="badge badge-status-danger">
                      <i className="bi bi-ticket-perforated-fill mr-1"></i>
                      {clientTicketsCount} Tickets
                    </div>
                  ) : (
                    <div className="badge badge-status-success">
                      <i className="bi bi-check-circle-fill mr-1"></i>
                      Sin pendientes
                    </div>
                  )
                )}

                {whatsappStatus?.connected ? (
                  <span className="badge badge-status-success">
                    <i className="bi bi-whatsapp mr-1"></i>
                    Conectado
                  </span>
                ) : (
                  <span className="badge badge-status-warning">
                    <i className="bi bi-whatsapp mr-1"></i>
                    Desconectado
                  </span>
                )}
              </div>
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
                        <div className="rw-svc-icon shrink-0 mt-1">
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
                              <span className="font-bold service-name truncate">{service.name}</span>
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
                              {!isRenaming && (
                                <button className="btn btn-sm btn-rename-service p-0 text-dim" onClick={() => handleStartRenameService(service)}>
                                  <i className="bi bi-pencil" style={{ fontSize: '0.75rem' }}></i>
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
          {/* GRID PANEL HEADER */}
          <div className="view-header">
            <div className="view-header-left">
              <h2 className="view-header-title">MIS ASISTENTES</h2>
              <p className="view-header-subtitle">Gestión técnica de proyectos desplegados en Railway</p>
            </div>
            <div className="view-header-controls">
              <div className="input-group input-group-sm search-input-group">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input type="text" className="form-control" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button className="btn btn-outline-light btn-sm" onClick={toggleView} title={isListView ? 'Vista cuadrícula' : 'Vista lista'}>
                <i className={`bi bi-${isListView ? 'grid' : 'list-ul'}`}></i>
              </button>
              {anyUpdatable && (
                <button className="btn btn-warning btn-sm" onClick={handleUpdateAll}>
                  <i className="bi bi-arrow-up-circle mr-2"></i>Update All
                </button>
              )}
              <button className="btn btn-outline-light btn-sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? (
                  <span className="spinner-border spinner-border-sm mr-2"></span>
                ) : (
                  <i className="bi bi-arrow-clockwise mr-2"></i>
                )}
                Actualizar
              </button>
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
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content glass-card">
              <div className="modal-header">
                <h5 className="modal-title font-bold">Vincular Cliente</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsLinkModalOpen(false)}></button>
              </div>
              <form onSubmit={handleLinkClientSubmit}>
                <div className="modal-body p-6">
                  <div className="mb-4">
                    <label className="form-label text-sm font-bold">CLIENTE</label>
                    <select
                      className="form-select border-secondary text-main bg-transparent"
                      value={linkClientId}
                      onChange={(e) => setLinkClientId(e.target.value)}
                      required
                    >
                      <option value="">-- Seleccionar --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id} className="bg-dark text-white">
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer p-4">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setIsLinkModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-sm btn-success">Vincular</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
