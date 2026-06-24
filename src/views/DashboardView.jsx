import React, { useState } from 'react';
import { store, useStoreKey } from '../core/store';

export default function DashboardView({ navigate }) {
  const assistantsData  = useStoreKey('assistants',  () => store.fetchAssistants());
  const clientsData     = useStoreKey('clients',     () => store.fetchClients());
  const ticketsData     = useStoreKey('ticketsMeta', () => store.fetchTicketsMeta());

  const assistants = assistantsData || [];
  const clients = clientsData || [];
  const tickets = ticketsData || [];
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        store.fetchAssistants(true),
        store.fetchClients(true),
        store.fetchTicketsMeta(true),
      ]);
    } catch (err) {
      console.error('[DashboardView] Error refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const loading = assistantsData === null || clientsData === null || ticketsData === null;

  if (loading) {
    return (
      <div>
        <div className="view-header flex justify-between items-center w-full">
          <div className="view-header-left">
            <h2 className="view-header-title">DASHBOARD</h2>
            <p className="text-xs mb-0 text-dim mt-1">Sincronizando información...</p>
          </div>
          <div className="view-header-right">
            <button className="btn btn-sm btn-outline-light flex items-center gap-2" disabled>
              <span className="spinner-border spinner-border-sm"></span>
              Cargando
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="glass-card p-6 h-full">
              <div className="flex items-start gap-4 mb-6">
                <div className="skeleton shrink-0" style={{ width: '44px', height: '44px', borderRadius: '12px' }}></div>
                <div className="grow">
                  <div className="skeleton mb-2" style={{ height: '15px', width: '70%' }}></div>
                  <div className="skeleton" style={{ height: '22px', width: '90px', borderRadius: '20px' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate calculations
  const activeClients = clients.filter(c => c.plan !== 'Baja');
  const totalAbono = clients.reduce((sum, c) => sum + (parseFloat(c.abono) || 0), 0);
  const pendingTickets = tickets.filter(t => t.estado !== 'Cerrado');

  let onlineServices = 0;
  let errorServices = 0;
  let totalServices = 0;
  assistants.forEach(a => {
    if (a.services) {
      a.services.forEach(s => {
        totalServices++;
        if (s.status === 'online') onlineServices++;
        if (s.status === 'error') errorServices++;
      });
    }
  });

  const planCounts = { Standard: 0, Premium: 0, Enterprise: 0 };
  activeClients.forEach(c => {
    if (planCounts[c.plan] !== undefined) {
      planCounts[c.plan]++;
    } else {
      planCounts.Standard++;
    }
  });

  const circ = 251.33;
  const onlineRatio = totalServices > 0 ? onlineServices / totalServices : 0;
  const errorRatio = totalServices > 0 ? errorServices / totalServices : 0;
  const onlineDash = +(circ * onlineRatio).toFixed(2);
  const errorDash = +(circ * errorRatio).toFixed(2);
  const healthOk = errorServices === 0;
  const uptimePct = totalServices > 0 ? Math.round(onlineRatio * 100) : 0;

  // Plan bars renderer
  const renderPlanBars = () => {
    const total = activeClients.length;
    if (total === 0) return <div className="kpi-label">Sin datos</div>;
    const plans = [
      { key: 'Standard', color: 'var(--info)' },
      { key: 'Premium', color: 'var(--error)' },
      { key: 'Enterprise', color: 'var(--warning)' },
    ];
    return plans.map(p => {
      const pct = Math.round(((planCounts[p.key] || 0) / total) * 100);
      return (
        <div key={p.key} className="flex items-center gap-2 mb-1">
          <div className="bar-label bar-label-plan">{p.key}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${pct}%`, background: p.color }}></div>
          </div>
          <div className="bar-count">{planCounts[p.key] || 0}</div>
        </div>
      );
    });
  };

  // Services distribution renderer
  const renderServicesDist = () => {
    if (totalServices === 0) return <div className="kpi-label">Sin servicios registrados</div>;
    const offline = totalServices - onlineServices - errorServices;
    const items = [
      { label: 'Online', count: onlineServices, color: 'var(--success)' },
      { label: 'Error', count: errorServices, color: 'var(--error)' },
      { label: 'Inactivo', count: offline, color: 'var(--text-dim)' },
    ];
    return items.map(item => {
      const pct = Math.round((item.count / totalServices) * 100);
      return (
        <div key={item.label} className="flex items-center gap-2 mb-2">
          <span className="indicator-dot" style={{ background: item.color }}></span>
          <div className="svc-dist-label">{item.label}</div>
          <div className="svc-bar-track">
            <div className="bar-fill" style={{ width: `${pct}%`, background: item.color }}></div>
          </div>
          <div className="svc-dist-count">{item.count}/{totalServices}</div>
        </div>
      );
    });
  };

  // Infrastructure distribution renderer
  const renderInfraDist = () => {
    const linkedIds = new Set();
    for (const c of clients) {
      if (Array.isArray(c.railway_project_ids)) {
        c.railway_project_ids.forEach(id => id && linkedIds.add(String(id)));
      }
    }

    const total = assistants.length;
    const linked = assistants.filter(a => linkedIds.has(String(a.id))).length;
    const orphanProj = total - linked;
    const totalCli = clients.length;

    const withInst = clients.filter(c => {
      if (!Array.isArray(c.railway_project_ids)) return false;
      return c.railway_project_ids.some(projId => assistants.some(a => String(a.id) === String(projId)));
    }).length;
    const orphanCli = totalCli - withInst;

    const bar = (count, max, color) => {
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      return (
        <div className="svc-bar-track">
          <div className="bar-fill" style={{ width: `${pct}%`, background: color }}></div>
        </div>
      );
    };

    return (
      <>
        <div className="x-small text-dim font-bold mb-2" style={{ letterSpacing: '.05em' }}>CLIENTES</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="indicator-dot" style={{ background: 'var(--info)' }}></span>
          <div className="svc-dist-label">Total</div>
          {bar(totalCli, totalCli, 'var(--info)')}
          <div className="svc-dist-count">{totalCli}</div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="indicator-dot" style={{ background: 'var(--warning)' }}></span>
          <div className="svc-dist-label">Sin instancia</div>
          {bar(orphanCli, totalCli, 'var(--warning)')}
          <div className="svc-dist-count">{orphanCli}</div>
        </div>
        <div className="x-small text-dim font-bold mb-2" style={{ letterSpacing: '.05em' }}>PROYECTOS RAILWAY</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="indicator-dot" style={{ background: 'var(--text-dim)' }}></span>
          <div className="svc-dist-label">Total</div>
          {bar(total, total, 'var(--text-dim)')}
          <div className="svc-dist-count">{total}</div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="indicator-dot" style={{ background: 'var(--success)' }}></span>
          <div className="svc-dist-label">Vinculados</div>
          {bar(linked, total, 'var(--success)')}
          <div className="svc-dist-count">{linked}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="indicator-dot" style={{ background: 'var(--error)' }}></span>
          <div className="svc-dist-label">Huérfanos</div>
          {bar(orphanProj, total, 'var(--error)')}
          <div className="svc-dist-count">{orphanProj}</div>
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="view-header flex justify-between items-center w-full">
        <div className="view-header-left">
          <h2 className="view-header-title">DASHBOARD</h2>
        </div>
        <div className="view-header-right">
          <button
            className="btn btn-sm btn-outline-light flex items-center gap-2"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <span className="spinner-border spinner-border-sm"></span>
            ) : (
              <i className="bi bi-arrow-clockwise"></i>
            )}
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-4">
        {/* KPI: Projects count with donut chart */}
        <div className="col-span-1">
          <div className="glass-card p-4 h-full rounded flex items-center gap-4 anim-card-enter" style={{ '--si': 0 }}>
            <div className="donut-wrapper">
              <svg width="72" height="72" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-soft)" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="12"
                  strokeDasharray={`${onlineDash} ${circ}`}
                  transform="rotate(-90 50 50)"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--error)"
                  strokeWidth="12"
                  strokeDasharray={`${errorDash} ${circ}`}
                  transform={`rotate(${-90 + 360 * onlineRatio} 50 50)`}
                />
              </svg>
              <div className="donut-center">
                <span className="kpi-count">{assistants.length}</span>
              </div>
            </div>
            <div>
              <div className="font-semibold kpi-project-name">Proyectos</div>
              <div className="kpi-stat-online"><span>{onlineServices}</span> online</div>
              <div className="kpi-stat-error"><span>{errorServices}</span> error</div>
            </div>
          </div>
        </div>

        {/* KPI: Active clients count with plan bars */}
        <div className="col-span-1">
          <div className="glass-card p-4 h-full rounded anim-card-enter" style={{ '--si': 1 }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="kpi-label">Clientes Activos</div>
                <div className="font-bold kpi-number kpi-number-primary">{activeClients.length}</div>
              </div>
              <i className="bi bi-people-fill kpi-icon kpi-icon-primary"></i>
            </div>
            <div>{renderPlanBars()}</div>
          </div>
        </div>

        {/* KPI: Pending tickets count */}
        <div className="col-span-1">
          <div className="glass-card p-4 h-full rounded anim-card-enter" style={{ '--si': 2 }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="kpi-label">Tickets Pendientes</div>
                <div className="font-bold kpi-number kpi-number-warning">{pendingTickets.length}</div>
              </div>
              <i className="bi bi-ticket-perforated-fill kpi-icon kpi-icon-warning"></i>
            </div>
            <div className="kpi-label">
              {pendingTickets.length === 0 ? 'Sin tickets pendientes' : 'tickets sin cerrar'}
            </div>
          </div>
        </div>

        {/* KPI: Health status and uptime bar */}
        <div className="col-span-1">
          <div className="glass-card p-4 h-full rounded flex flex-col justify-between anim-card-enter" style={{ '--si': 3 }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="kpi-label">Estado de Salud</div>
                <div className="font-bold kpi-health-status" style={{ color: healthOk ? 'var(--success)' : 'var(--error)' }}>
                  {healthOk ? 'OK' : 'ALERTA'}
                </div>
              </div>
              <div className="dash-health-dot" style={{ background: healthOk ? 'var(--success)' : 'var(--error)' }}></div>
            </div>
            <div>
              <div className="uptime-label">Uptime</div>
              <div className="uptime-track">
                <div className="uptime-fill" style={{ width: `${uptimePct}%`, background: healthOk ? 'var(--success)' : 'var(--warning)' }}></div>
              </div>
              <div className="uptime-desc">{uptimePct}% operativo</div>
            </div>
          </div>
        </div>

        {/* KPI: Monthly abonos total */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <div className="glass-card p-4 h-full rounded anim-card-enter flex flex-col justify-center" style={{ '--si': 4 }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="kpi-label">Abonos Mensuales</div>
                <div className="font-bold kpi-number" style={{ color: 'var(--success)' }}>
                  ${totalAbono.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <i className="bi bi-cash-stack kpi-icon" style={{ color: 'var(--success)', fontSize: '1.8rem', opacity: 0.3 }}></i>
            </div>
          </div>
        </div>

        {/* KPI: Service distribution */}
        <div className="col-span-1">
          <div className="glass-card p-4 h-full rounded anim-card-enter" style={{ '--si': 5 }}>
            <h6 className="mb-4 font-bold">Distribución Servicios</h6>
            <div>{renderServicesDist()}</div>
          </div>
        </div>

        {/* KPI: Infrastructure distribution */}
        <div className="col-span-1">
          <div className="glass-card p-4 h-full rounded anim-card-enter" style={{ '--si': 6 }}>
            <h6 className="mb-4 font-bold">Infraestructura</h6>
            <div>{renderInfraDist()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
