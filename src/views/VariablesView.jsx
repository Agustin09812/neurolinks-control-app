import React, { useState, useEffect } from 'react';
import { api } from '../core/api';

export default function VariablesView({ navigate }) {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [maskedStates, setMaskedStates] = useState({}); // { key: boolean }

  const contextStr = sessionStorage.getItem('varsContext');
  const context = contextStr ? JSON.parse(contextStr) : null;

  useEffect(() => {
    if (!context) {
      navigate('assistants');
      return;
    }

    const fetchVariables = async () => {
      setLoading(true);
      try {
        const settings = await api.getSettings(context.projectId) || [];
        setVariables(settings);
        // Initialize all as masked
        const initialMasks = {};
        settings.forEach(s => {
          initialMasks[s.key] = true;
        });
        setMaskedStates(initialMasks);
      } catch (err) {
        console.error('[VariablesView] Error loading settings:', err);
        window.showToast('Error al cargar variables de configuración', 'danger');
      } finally {
        setLoading(false);
      }
    };

    fetchVariables();
  }, [context?.projectId]);

  const toggleMask = (key) => {
    setMaskedStates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const copyToClipboard = (val) => {
    navigator.clipboard.writeText(val).then(() => {
      window.showToast('Copiado al portapapeles', 'success');
    });
  };

  if (!context) return null;

  const filteredVars = variables.filter(v =>
    v.key.toLowerCase().includes(search.toLowerCase())
  );

  const handleBack = () => {
    sessionStorage.removeItem('varsContext');
    navigate('assistants');
  };

  return (
    <div className="variables-panel animate-fade-up">
      {/* HEADER / TOPBAR */}
      <div className="view-header flex items-center justify-between gap-3 w-full mb-6" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-3 overflow-hidden">
          <button className="btn btn-outline-light btn-sm flex items-center justify-center shrink-0" onClick={handleBack} title="Volver a Asistentes">
            <i className="bi bi-arrow-left"></i>
          </button>
          <h2 className="view-header-title mb-0 text-base sm:text-lg lg:text-xl truncate hidden sm:block">Variables: {context.serviceName}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="btn btn-outline-light btn-sm flex items-center gap-2"
            onClick={() => api.openExternal("https://supabase.com/dashboard/project/ygyicozjewxbyixtpjlo/editor/99056?schema=public")}
          >
            <i className="bi bi-plus-lg"></i><span>Añadir variable</span>
          </button>
        </div>
      </div>

      {/* MOBILE SERVICE TITLE (visible only on mobile screens < 640px) */}
      <div className="block sm:hidden text-center mb-6 px-2">
        <h3 className="view-header-title font-bold text-lg mb-0 truncate w-full">Variables: {context.serviceName}</h3>
      </div>

      {/* SEARCH */}
      <div className="mb-4">
        <input
          type="text"
          className="form-control form-control-sm text-main bg-transparent border-secondary"
          placeholder="Buscar variable..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* GRID */}
      <div className="variables-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="var-card">
              <div className="skeleton mb-2" style={{ height: '24px', width: '55%' }}></div>
              <div className="skeleton" style={{ height: '48px', width: '100%' }}></div>
            </div>
          ))
        ) : filteredVars.length === 0 ? (
          <div className="text-white/50 py-6 col-span-full text-center">No hay variables que coincidan con la búsqueda.</div>
        ) : (
          filteredVars.map(({ key, value }) => {
            const isMasked = maskedStates[key] !== false;
            return (
              <div key={key} className="var-card">
                <div className="var-header-row">
                  <span className="var-key">{key}</span>
                  <div className="var-actions-inline">
                    <button
                      className="var-btn-edit btn-toggle-val"
                      onClick={() => toggleMask(key)}
                      title={isMasked ? "Mostrar valor" : "Ocultar valor"}
                    >
                      <i className={`bi ${isMasked ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                    <button
                      className="var-btn-edit btn-copy-val"
                      onClick={() => copyToClipboard(value)}
                      title="Copiar"
                    >
                      <i className="bi bi-clipboard-fill"></i>
                    </button>
                  </div>
                </div>
                <pre className={`var-value ${isMasked ? 'masked' : ''}`}>
                  {isMasked ? '••••••••••••••••' : value}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
