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
      {/* HEADER */}
      <div className="rw-topbar mb-6">
        <div className="flex justify-between items-center mb-4">
          <button className="btn btn-outline-light" onClick={handleBack} title="Volver">
            <i className="bi bi-arrow-left"></i>
          </button>
          <button
            className="btn btn-outline-light btn-sm"
            onClick={() => api.openExternal("https://supabase.com/dashboard/project/ygyicozjewxbyixtpjlo/editor/99056?schema=public")}
          >
            <i className="bi bi-plus-lg mr-1"></i>Añadir variable
          </button>
        </div>
        <div className="text-center mb-2">
          <h4 className="font-bold mb-0">
            <i className="bi bi-sliders mr-2 icon-service"></i>{context.serviceName}
          </h4>
          <small className="text-dim">Configuración del servicio</small>
        </div>
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
