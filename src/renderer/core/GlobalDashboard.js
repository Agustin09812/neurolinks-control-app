// =========================
// DASHBOARD MAESTRO GLOBAL
// =========================

async function renderDashboard() {

  if (assistants.length === 0) await loadAssistants(false);

  selectedProjectId = null;

  ["integrated-log-container", "integrated-var-container"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  const dash = document.getElementById("dashboard-global");
  dash.style.display = "block";

  // Si la estructura ya existe, solo parchear
  if (document.getElementById("dash-projects-count")) {
    patchDashboard();
    Promise.all([window.api.getClients(), window.api.getTickets()])
      .then(([c, t]) => { window.clientsData = c; window.ticketsData = t; patchDashboard(); })
      .catch(() => { });
    return;
  }

  // Primera vez: construir con data cacheada inmediatamente
  buildDashboard(dash, window.clientsData || [], window.ticketsData || []);

  // Refrescar en background
  Promise.all([window.api.getClients(), window.api.getTickets()])
    .then(([c, t]) => { window.clientsData = c; window.ticketsData = t; patchDashboard(); })
    .catch(console.error);
}

function buildPlanBars(planCounts, total) {
  if (total === 0) return '<div class="kpi-label">Sin datos</div>';
  const plans = [
    { key: 'Standard', color: 'var(--info)' },
    { key: 'Premium', color: 'var(--error)' },
    { key: 'Enterprise', color: 'var(--warning)' },
  ];
  return plans.map(p => {
    const pct = Math.round((planCounts[p.key] || 0) / total * 100);
    return `<div class="flex items-center gap-2 mb-1">
      <div class="bar-label bar-label-plan">${p.key}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${p.color};"></div></div>
      <div class="bar-count">${planCounts[p.key] || 0}</div>
    </div>`;
  }).join('');
}

function buildPrioBars(prioCounts, total) {
  if (total === 0) return '<div class="kpi-label">Sin tickets</div>';
  const prios = [
    { key: 'Alta', color: 'var(--error)' },
    { key: 'Media', color: 'var(--warning)' },
    { key: 'Baja', color: 'var(--text-dim)' },
  ];
  return prios.map(p => {
    const pct = Math.round((prioCounts[p.key] || 0) / total * 100);
    return `<div class="flex items-center gap-2 mb-1">
      <div class="bar-label bar-label-prio">${p.key}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${p.color};"></div></div>
      <div class="bar-count">${prioCounts[p.key] || 0}</div>
    </div>`;
  }).join('');
}

function buildServicesDist(online, error, total) {
  if (total === 0) return '<div class="kpi-label">Sin servicios registrados</div>';
  const offline = total - online - error;
  return [
    { label: 'Online', count: online, color: 'var(--success)' },
    { label: 'Error', count: error, color: 'var(--error)' },
    { label: 'Inactivo', count: offline, color: 'var(--text-dim)' },
  ].map(item => {
    const pct = Math.round(item.count / total * 100);
    return `<div class="flex items-center gap-2 mb-2">
      <span class="indicator-dot" style="background:${item.color};"></span>
      <div class="svc-dist-label">${item.label}</div>
      <div class="svc-bar-track"><div class="bar-fill" style="width:${pct}%;background:${item.color};"></div></div>
      <div class="svc-dist-count">${item.count}/${total}</div>
    </div>`;
  }).join('');
}

function renderRecentTickets(tickets) {
  if (tickets.length === 0) return '<div class="text-center py-4 text-dim">Sin tickets pendientes</div>';
  return tickets.map((t, i) => {
    const dotColor = t.prioridad === 'Alta' ? 'var(--error)' : t.prioridad === 'Media' ? 'var(--warning)' : 'var(--text-dim)';
    const pillBg = t.prioridad === 'Alta' ? 'rgba(248,113,113,0.15)' : t.prioridad === 'Media' ? 'rgba(251,191,36,0.15)' : 'rgba(100,116,139,0.15)';
    return `<div class="flex items-center gap-2 py-2 ${i < tickets.length - 1 ? 'border-bottom ticket-border' : ''}">
      <span class="indicator-dot" style="background:${dotColor};"></span>
      <div class="grow overflow-hidden">
        <div class="font-semibold truncate ticket-list-name">${t.titulo}</div>
        <div class="ticket-list-client">${t.clientes ? t.clientes.nombre : (t.chat_id || 'Sin cliente')}</div>
      </div>
      <span class="prio-pill" style="background:${pillBg};color:${dotColor};">${t.prioridad || 'Baja'}</span>
    </div>`;
  }).join('');
}

function buildDashboard(dash, clients, tickets) {
  const activeClients = clients.filter(c => c.plan !== 'Baja');
  const totalAbono = clients.reduce((sum, c) => sum + (parseFloat(c.abono) || 0), 0);
  const pendingTickets = tickets.filter(t => t.estado !== 'Cerrado');

  let onlineServices = 0, errorServices = 0, totalServices = 0;
  assistants.forEach(a => a.services.forEach(s => {
    totalServices++;
    if (s.status === 'online') onlineServices++;
    if (s.status === 'error') errorServices++;
  }));

  const planCounts = { Standard: 0, Premium: 0, Enterprise: 0 };
  activeClients.forEach(c => {
    if (planCounts[c.plan] !== undefined) planCounts[c.plan]++;
    else planCounts.Standard++;
  });

  const prioCounts = { Alta: 0, Media: 0, Baja: 0 };
  pendingTickets.forEach(t => {
    if (prioCounts[t.prioridad] !== undefined) prioCounts[t.prioridad]++;
    else prioCounts.Baja++;
  });

  const circ = 251.33;
  const onlineRatio = totalServices > 0 ? onlineServices / totalServices : 0;
  const errorRatio = totalServices > 0 ? errorServices / totalServices : 0;
  const onlineDash = +(circ * onlineRatio).toFixed(2);
  const errorDash = +(circ * errorRatio).toFixed(2);
  const healthOk = errorServices === 0;
  const uptimePct = totalServices > 0 ? Math.round(onlineRatio * 100) : 0;

  dash.innerHTML = `
    <div>
      <div class="view-header">
        <div class="view-header-left">
          <h2 class="view-header-title">DASHBOARD</h2>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        <div>
          <div class="glass-card p-4 h-full rounded flex items-center gap-4 anim-card-enter" style="--si:0">
            <div class="donut-wrapper">
              <svg width="72" height="72" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-soft)" stroke-width="12"/>
                <circle id="dash-donut-online" cx="50" cy="50" r="40" fill="none"
                  stroke="var(--success)" stroke-width="12"
                  stroke-dasharray="${onlineDash} ${circ}"
                  transform="rotate(-90 50 50)"/>
                <circle id="dash-donut-error" cx="50" cy="50" r="40" fill="none"
                  stroke="var(--error)" stroke-width="12"
                  stroke-dasharray="${errorDash} ${circ}"
                  transform="rotate(${-90 + 360 * onlineRatio} 50 50)"/>
              </svg>
              <div class="donut-center">
                <span id="dash-projects-count" class="kpi-count">${assistants.length}</span>
              </div>
            </div>
            <div>
              <div class="font-semibold kpi-project-name">Proyectos</div>
              <div class="kpi-stat-online"><span id="dash-online-count">${onlineServices}</span> online</div>
              <div class="kpi-stat-error"><span id="dash-error-count">${errorServices}</span> error</div>
            </div>
          </div>
        </div>

        <div>
          <div class="glass-card p-4 h-full rounded anim-card-enter" style="--si:1">
            <div class="flex justify-between items-start mb-2">
              <div>
                <div class="kpi-label">Clientes Activos</div>
                <div id="dash-clients-count" class="font-bold kpi-number kpi-number-primary">${activeClients.length}</div>
              </div>
              <i class="bi bi-people-fill kpi-icon kpi-icon-primary"></i>
            </div>
            <div id="dash-plan-bars">${buildPlanBars(planCounts, activeClients.length)}</div>
          </div>
        </div>

        <div>
          <div class="glass-card p-4 h-full rounded anim-card-enter" style="--si:2">
            <div class="flex justify-between items-start mb-2">
              <div>
                <div class="kpi-label">Tickets Pendientes</div>
                <div id="dash-tickets-count" class="font-bold kpi-number kpi-number-warning">${pendingTickets.length}</div>
              </div>
              <i class="bi bi-ticket-perforated-fill kpi-icon kpi-icon-warning"></i>
            </div>
            <div id="dash-prio-bars">${buildPrioBars(prioCounts, pendingTickets.length)}</div>
          </div>
        </div>

        <div>
          <div class="glass-card p-4 h-full rounded flex flex-col justify-between anim-card-enter" style="--si:3">
            <div class="flex justify-between items-start">
              <div>
                <div class="kpi-label">Estado de Salud</div>
                <div id="dash-health-status" class="font-bold kpi-health-status" style="color:${healthOk ? 'var(--success)' : 'var(--error)'};">
                  ${healthOk ? 'OK' : 'ALERTA'}
                </div>
              </div>
              <div id="dash-health-dot" class="dash-health-dot" style="background:${healthOk ? 'var(--success)' : 'var(--error)'};"></div>
            </div>
            <div>
              <div class="uptime-label">Uptime</div>
              <div class="uptime-track">
                <div id="dash-uptime-bar" class="uptime-fill" style="width:${uptimePct}%;background:${healthOk ? 'var(--success)' : 'var(--warning)'};"></div>
              </div>
              <div id="dash-health-desc" class="uptime-desc">${uptimePct}% operativo</div>
            </div>
          </div>
        </div>

        <div class="md:col-span-2">
          <div class="glass-card p-4 rounded anim-card-enter" style="--si:4">
            <div class="flex justify-between items-center">
              <div>
                <div class="kpi-label">Abonos Mensuales</div>
                <div id="dash-abonos-total" class="font-bold kpi-number" style="color:var(--success);">$${totalAbono.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <i class="bi bi-cash-stack kpi-icon" style="color:var(--success);font-size:1.8rem;opacity:0.3;"></i>
            </div>
          </div>
        </div>

      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div class="glass-card p-4 rounded anim-card-enter" style="--si:5">
          <h6 class="mb-4 font-bold">Distribucion Servicios</h6>
          <div id="dash-services-dist">${buildServicesDist(onlineServices, errorServices, totalServices)}</div>
        </div>

        <div class="glass-card p-4 rounded anim-card-enter" style="--si:6">
          <h6 class="mb-4 font-bold">Acciones Rapidas</h6>
          <div class="grid gap-2">
            <button class="btn btn-sm btn-outline-light text-left" onclick="navigate('clients')">
              <i class="bi bi-people mr-2"></i>Gestionar Clientes
            </button>
            <button class="btn btn-sm btn-outline-light text-left" id="dashboard-refresh">
              <i class="bi bi-arrow-clockwise mr-2"></i>Actualizar</button>
          </div>
        </div>

      </div>
    </div>
  `;

  const btn = document.getElementById('dashboard-refresh');
  btn.onclick = async () => {
    btn.disabled = true;
    window.showActionSpinner("Sincronizando infraestructura...");
    try {
      const [, c, t] = await Promise.all([
        loadAssistants(false),
        window.api.getClients(),
        window.api.getTickets()
      ]);
      window.clientsData = c;
      window.ticketsData = t;
      buildDashboard(document.getElementById("dashboard-global"), c, t);
    } catch (err) {
      console.error(err);
    } finally {
      window.hideActionSpinner();
      btn.disabled = false;
    }
  };
}

function patchDashboard() {
  if (!document.getElementById("dash-projects-count")) return;

  const clients = window.clientsData || [];
  const tickets = window.ticketsData || [];
  const activeClients = clients.filter(c => c.plan !== 'Baja');
  const totalAbono = clients.reduce((sum, c) => sum + (parseFloat(c.abono) || 0), 0);
  const pendingTickets = tickets.filter(t => t.estado !== 'Cerrado');

  let onlineServices = 0, errorServices = 0, totalServices = 0;
  assistants.forEach(a => a.services.forEach(s => {
    totalServices++;
    if (s.status === 'online') onlineServices++;
    if (s.status === 'error') errorServices++;
  }));

  const planCounts = { Standard: 0, Premium: 0, Enterprise: 0 };
  activeClients.forEach(c => {
    if (planCounts[c.plan] !== undefined) planCounts[c.plan]++;
    else planCounts.Standard++;
  });

  const prioCounts = { Alta: 0, Media: 0, Baja: 0 };
  pendingTickets.forEach(t => {
    if (prioCounts[t.prioridad] !== undefined) prioCounts[t.prioridad]++;
    else prioCounts.Baja++;
  });

  const circ = 251.33;
  const onlineRatio = totalServices > 0 ? onlineServices / totalServices : 0;
  const errorRatio = totalServices > 0 ? errorServices / totalServices : 0;
  const onlineDash = +(circ * onlineRatio).toFixed(2);
  const errorDash = +(circ * errorRatio).toFixed(2);
  const healthOk = errorServices === 0;
  const uptimePct = totalServices > 0 ? Math.round(onlineRatio * 100) : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('dash-projects-count', assistants.length);
  set('dash-online-count', onlineServices);
  set('dash-error-count', errorServices);
  set('dash-clients-count', activeClients.length);
  set('dash-tickets-count', pendingTickets.length);
  set('dash-abonos-total', '$' + totalAbono.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  set('dash-health-desc', uptimePct + '% operativo');

  const donutOnline = document.getElementById('dash-donut-online');
  if (donutOnline) {
    donutOnline.setAttribute('stroke-dasharray', `${onlineDash} ${circ}`);
    donutOnline.setAttribute('transform', 'rotate(-90 50 50)');
  }
  const donutError = document.getElementById('dash-donut-error');
  if (donutError) {
    donutError.setAttribute('stroke-dasharray', `${errorDash} ${circ}`);
    donutError.setAttribute('transform', `rotate(${-90 + 360 * onlineRatio} 50 50)`);
  }

  const healthEl = document.getElementById('dash-health-status');
  if (healthEl) {
    healthEl.textContent = healthOk ? 'OK' : 'ALERTA';
    healthEl.style.color = healthOk ? 'var(--success)' : 'var(--error)';
  }
  const dotEl = document.getElementById('dash-health-dot');
  if (dotEl) dotEl.style.background = healthOk ? 'var(--success)' : 'var(--error)';

  const uptimeBar = document.getElementById('dash-uptime-bar');
  if (uptimeBar) {
    uptimeBar.style.width = uptimePct + '%';
    uptimeBar.style.background = healthOk ? 'var(--success)' : 'var(--warning)';
  }

  const planBarsEl = document.getElementById('dash-plan-bars');
  if (planBarsEl) planBarsEl.innerHTML = buildPlanBars(planCounts, activeClients.length);

  const prioBarsEl = document.getElementById('dash-prio-bars');
  if (prioBarsEl) prioBarsEl.innerHTML = buildPrioBars(prioCounts, pendingTickets.length);

  const svcDist = document.getElementById('dash-services-dist');
  if (svcDist) svcDist.innerHTML = buildServicesDist(onlineServices, errorServices, totalServices);
}
