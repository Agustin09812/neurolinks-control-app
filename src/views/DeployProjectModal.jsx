import React, { useState, useEffect } from 'react';
import { api } from '../core/api';

export default function DeployProjectModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: search/select, 2: confirm
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deploying, setDeploying] = useState(false);

  // Fetch templates on first open
  useEffect(() => {
    if (isOpen && templates.length === 0) {
      loadTemplates();
    }
  }, [isOpen]);

  // Filter templates when search or templates changes
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFilteredTemplates(templates);
    } else {
      setFilteredTemplates(
        templates.filter(t =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q)
        )
      );
    }
  }, [search, templates]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.searchTemplates("");
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      if (window.showToast) window.showToast("Error al conectar con Railway", "danger");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedTemplate(null);
  };

  const handleConfirmDeploy = async () => {
    if (!selectedTemplate) return;
    setDeploying(true);
    try {
      const result = await api.deployTemplate(selectedTemplate.id);
      if (result.success) {
        alert("Despliegue iniciado. El nuevo proyecto aparecerá en la lista de asistentes en unos momentos.");
        onClose();
        // Trigger assistants view refresh if it's currently mounted and has exposed the refresh hook
        if (window.refreshAssistants) window.refreshAssistants();
      } else {
        alert("Error al desplegar: " + (result.error || "Respuesta desconocida"));
      }
    } catch (error) {
      console.error("Error in confirmDeploy:", error);
      alert("Error crítico al intentar desplegar el template.");
    } finally {
      setDeploying(false);
      setStep(1);
      setSelectedTemplate(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }} tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content glass-card">
          <div className="modal-header" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="flex items-center gap-4">
              <div className="deploy-modal-header-icon" style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(56,189,248,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <i className="bi bi-rocket-takeoff-fill" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}></i>
              </div>
              <div className="deploy-header-text">
                <h5 className="modal-title font-bold mb-0 text-main" style={{ fontSize: '1.05rem' }}>Nuevo Asistente</h5>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Selecciona un template de Railway para desplegar</div>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          {step === 1 ? (
            <div id="deploy-step-1" className="flex flex-col overflow-hidden">
              <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <div className="deploy-search-bar flex items-center gap-2 px-3 py-1.5" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '0.5rem',
                }}>
                  <i className="bi bi-search" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}></i>
                  <input
                    type="text"
                    className="bg-transparent border-0 text-main w-full focus:outline-none text-sm"
                    placeholder="Filtrar templates..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-body p-6" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="spinner-border text-success mb-3" role="status"></div>
                    <div className="text-dim text-sm">Cargando templates...</div>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 text-dim text-sm">No se encontraron templates.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredTemplates.map(template => (
                      <div
                        key={template.id}
                        className="template-card p-4 rounded border border-transparent hover:border-sky-500/30 cursor-pointer transition-all duration-200"
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-soft)',
                        }}
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <div className="flex gap-4">
                          <div className="template-icon flex items-center justify-center shrink-0" style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                          }}>
                            <i className="bi bi-box text-main" style={{ fontSize: '1.2rem' }}></i>
                          </div>
                          <div className="grow overflow-hidden">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="template-name font-bold truncate text-sm text-main">{template.name}</div>
                              <span className="template-badge text-xs px-2 py-0.5 rounded-full shrink-0" style={{
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: 'var(--accent)',
                              }}>{template.category || 'General'}</span>
                            </div>
                            <p className="template-desc text-xs text-dim mb-0 truncate">{template.description || 'Sin descripción disponible.'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div id="deploy-step-2">
              <div className="modal-body p-6">
                <div className="text-center py-6">
                  <div className="deploy-confirm-icon mb-4" style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}>
                    <i className="bi bi-rocket-takeoff-fill text-emerald-400" style={{ fontSize: '1.8rem' }}></i>
                  </div>
                  <h5 className="font-bold mb-1 text-main text-lg">{selectedTemplate?.name}</h5>
                  <p className="mb-4 text-xs text-dim" style={{ maxWidth: '360px', margin: '0 auto' }}>
                    {selectedTemplate?.description || 'Sin descripción disponible.'}
                  </p>
                  <div className="text-xs text-dim text-left mb-6 p-3 rounded" style={{
                    background: 'var(--border-soft)',
                    maxWidth: '360px',
                    margin: '0 auto 1.5rem',
                  }}>
                    <i className="bi bi-info-circle mr-1 text-sky-400"></i>
                    Se creará un proyecto en Railway con la configuración predeterminada. Podrás ajustar las variables desde la sección Variables.
                  </div>
                  <div className="flex justify-center gap-3">
                    <button className="btn btn-sm btn-outline-secondary" onClick={handleBack} disabled={deploying}>
                      <i className="bi bi-arrow-left mr-1"></i>Volver
                    </button>
                    <button className="btn btn-sm btn-success flex items-center gap-1" onClick={handleConfirmDeploy} disabled={deploying}>
                      {deploying ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          Desplegando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-rocket-takeoff mr-1"></i>Confirmar despliegue
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
