// --------------------------------------------------
// SMART REFRESH - MULTI-CHANNEL ENGINE
// --------------------------------------------------

// var kept for render.js DOMContentLoaded: lastAssistantsHash = generateAssistantsHash()
var lastAssistantsHash = "";
var isRefreshing = false; // mirrors services channel state

const _activeErrorKeys = new Set();

let _lastInteraction = Date.now();
let _idleMode = false;
let _deepIdleMode = false;
let _focusDebounceTimer = null;

function isUserInteracting() {
  const el = document.activeElement;
  if (el && el !== document.body && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  return !!(document.querySelector('.dropdown-menu.show') || document.querySelector('.modal.show'));
}

function registerActivity() {
  _lastInteraction = Date.now();
  _idleMode = false;
  _deepIdleMode = false;
}

["mousemove", "keydown", "click"].forEach(evt => window.addEventListener(evt, registerActivity));

// Kept global: render.js calls generateAssistantsHash() during DOMContentLoaded
function generateAssistantsHash() {
  return assistants?.map(p =>
    p.services.map(s => `${s.id}-${s.status}-${s.deploymentId || ""}`).join("|")
  ).join("#") || "";
}

function _updateIdleTiers() {
  const ms = Date.now() - _lastInteraction;
  if (ms > 300000)     { _deepIdleMode = true;  _idleMode = true;  }
  else if (ms > 60000) { _deepIdleMode = false; _idleMode = true;  }
  else                 { _deepIdleMode = false; _idleMode = false; }
}

// ---- Channels ----

const _ch = {

  services: {
    _t: 0, _running: false, _ver: 0, _callbacks: [],

    rate() {
      if (_deepIdleMode) return 60000;
      if (_idleMode)     return 30000;
      if (assistants?.some(p => p.services.some(s => s.status === "checking"))) return 3000;
      if (assistants?.some(p => p.services.some(s => s.status === "error")))    return 5000;
      if (selectedProjectId) return 5000;
      return 8000;
    },

    due() { return Date.now() - this._t >= this.rate(); },

    async run() {
      this._running = true;
      isRefreshing = true;
      this._t = Date.now();
      const v = ++this._ver;
      try {
        await loadAssistants(true);
        if (v !== this._ver) return;

        const hash = generateAssistantsHash();
        if (hash !== lastAssistantsHash && !isUserInteracting()) {
          lastAssistantsHash = hash;

          if (document.getElementById("assistants-view")?.style.display === "block") {
            patchAssistantsGrid();
          }
          if (selectedProjectId) {
            const project = assistants?.find(p => p.id === selectedProjectId);
            if (project) { patchServices(project); updateDetailHeader(project); }
          }
        }

        // Fire once per error incident, clear on recovery
        assistants?.forEach(project => project.services.forEach(service => {
          const key = `deploy-error-${service.id}`;
          if (service.status === "error") {
            if (!_activeErrorKeys.has(key)) {
              _activeErrorKeys.add(key);
              addNotification("deploy-error", "Error en deploy", `El servicio ${service.name} falló`, key);
            }
          } else {
            _activeErrorKeys.delete(key);
          }
        }));

      } finally {
        this._running = false;
        isRefreshing = false;
        this._callbacks.splice(0).forEach(cb => cb());
      }
    }
  },

  dashboard: {
    _t: 0, _running: false, _ver: 0, _callbacks: [],

    rate() { return _deepIdleMode ? 60000 : _idleMode ? 30000 : 15000; },

    due() {
      return localStorage.getItem("activeView") === "dashboard" &&
             Date.now() - this._t >= this.rate();
    },

    async run() {
      this._running = true;
      this._t = Date.now();
      const v = ++this._ver;
      try {
        const [c, t] = await Promise.all([
          window.api.getClients().catch(() => null),
          window.api.getTickets().catch(() => null)
        ]);
        if (v !== this._ver) return;
        if (c) window.clientsData = c;
        if (t) window.ticketsData = t;
        if (!isUserInteracting()) patchDashboard?.();
      } finally {
        this._running = false;
        this._callbacks.splice(0).forEach(cb => cb());
      }
    }
  },

  clients: {
    _t: 0, _running: false, _ver: 0, _hash: "", _callbacks: [],

    rate() { return _deepIdleMode ? 60000 : _idleMode ? 30000 : 20000; },

    due() {
      return localStorage.getItem("activeView") === "clients" &&
             Date.now() - this._t >= this.rate();
    },

    async run() {
      this._running = true;
      this._t = Date.now();
      const v = ++this._ver;
      try {
        const c = await window.api.getClients().catch(() => null);
        if (v !== this._ver || !c) return;
        const h = c.map(x => `${x.id}-${x.updated_at || x.nombre || ""}`).join("|");
        if (h !== this._hash) {
          this._hash = h;
          window.clientsData = c;
          if (!isUserInteracting()) loadClientsData?.();
        }
      } finally {
        this._running = false;
        this._callbacks.splice(0).forEach(cb => cb());
      }
    }
  },

  audit: {
    _t: 0, _running: false, _ver: 0, _callbacks: [],

    rate() { return _deepIdleMode ? 120000 : _idleMode ? 60000 : 30000; },

    due() {
      return localStorage.getItem("activeView") === "audit" &&
             Date.now() - this._t >= this.rate();
    },

    async run() {
      this._running = true;
      this._t = Date.now();
      try {
        if (!isUserInteracting()) loadAuditLogs?.();
      } finally {
        this._running = false;
        this._callbacks.splice(0).forEach(cb => cb());
      }
    }
  },

  tickets: {
    _t: 0, _running: false, _ver: 0, _count: -1, _callbacks: [],

    rate() { return _deepIdleMode ? 120000 : _idleMode ? 60000 : 30000; },

    due() { return Date.now() - this._t >= this.rate(); },

    async run() {
      this._running = true;
      this._t = Date.now();
      const v = ++this._ver;
      try {
        const tickets = await window.api.getTickets().catch(() => null);
        if (v !== this._ver || !tickets) return;

        window.ticketsData = tickets;

        if (this._count >= 0 && tickets.length > this._count) {
          const newOnes = tickets.slice(0, tickets.length - this._count);
          newOnes.forEach(t => {
            addNotification("ticket", "Nuevo ticket recibido", `Ticket: ${t.titulo || "Sin título"}`, `ticket-${t.id}`);
          });
          showToast("Nuevos tickets recibidos", "info");
          if (localStorage.getItem("activeView") === "tickets" && !isUserInteracting()) {
            prependNewTickets?.(newOnes);
          }
        }

        this._count = tickets.length;
      } finally {
        this._running = false;
        this._callbacks.splice(0).forEach(cb => cb());
      }
    }
  },

  variables: {
    _t: 0, _running: false, _ver: 0, _callbacks: [],

    rate() { return 10000; },

    due() {
      return document.getElementById("variables-view")?.style.display === "block" &&
             !!window.currentVarsContext &&
             Date.now() - this._t >= this.rate();
    },

    async run() {
      this._running = true;
      this._t = Date.now();
      const v = ++this._ver;
      try {
        const { projectId, environmentId, serviceId } = window.currentVarsContext;
        const vars = await window.api.getServiceVariables(projectId, environmentId, serviceId).catch(() => null);
        if (v !== this._ver || !vars) return;
        const h = JSON.stringify(vars);
        if (h !== window.lastVarsHash && !isUserInteracting()) {
          window.lastVarsHash = h;
          window.variablesCache = vars;
          loadVariables(projectId, environmentId, serviceId);
        }
      } finally {
        this._running = false;
        this._callbacks.splice(0).forEach(cb => cb());
      }
    }
  }
};

// ---- Ticker: fires every 1s, channels decide when they are due ----

let _ticker = null;

function _tick() {
  _updateIdleTiers();
  for (const ch of Object.values(_ch)) {
    if (!ch._running && ch.due()) {
      ch.run().catch(e => console.error("Channel error:", e));
    }
  }
}

// ---- Public API ----

function startAutoRefresh() {
  if (_ticker) clearInterval(_ticker);
  _ticker = setInterval(_tick, 1000);
}

// Reset timer to 0 so the channel fires on the next tick (~1s)
function scheduleImmediateRefresh() {
  _ch.services._t = 0;
  const view = localStorage.getItem("activeView");
  if (view && _ch[view]) _ch[view]._t = 0;
}
window.scheduleImmediateRefresh = scheduleImmediateRefresh;

// Called by navigate() after view renders to prevent double-fetch from channel
function onViewChanged(view) {
  if (_ch[view]) _ch[view]._t = Date.now();
}
window.onViewChanged = onViewChanged;

// Resolves after the next channel run that is guaranteed to start AFTER this call.
// If channel is currently running (stale run), waits for it then triggers one more.
// Falls back after `timeout` ms so the spinner always hides.
function waitForNextChannelRun(channelName, timeout = 8000) {
  return new Promise(resolve => {
    const ch = _ch[channelName];
    if (!ch) { resolve(); return; }

    let done = false;
    const guard = () => { if (!done) { done = true; resolve(); } };

    const timeoutId = setTimeout(guard, timeout);

    const resolver = () => { clearTimeout(timeoutId); guard(); };

    if (ch._running) {
      // Current run started before our action — wait for it, then do one fresh run
      ch._callbacks.push(() => {
        ch._callbacks.push(resolver);
        ch._t = 0;
      });
    } else {
      ch._callbacks.push(resolver);
      ch._t = 0;
    }
  });
}
window.waitForNextChannelRun = waitForNextChannelRun;

// ---- Action spinner ----

let _spinnerCount = 0;

function showActionSpinner(text = "Sincronizando con Railway...") {
  let el = document.getElementById("action-spinner");
  if (!el) {
    el = document.createElement("div");
    el.id = "action-spinner";
    el.innerHTML = `
      <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"
           style="width:0.9rem;height:0.9rem;border-width:2px;flex-shrink:0"></div>
      <span id="action-spinner-label"></span>
    `;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'none',
      alignItems: 'center',
      gap: '0.55rem',
      background: 'rgba(18,18,28,0.93)',
      backdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '2rem',
      padding: '0.42rem 1.1rem',
      fontSize: '0.8rem',
      zIndex: '10001',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      color: '#d0d0e0',
      whiteSpace: 'nowrap',
    });
    document.body.appendChild(el);
  }
  _spinnerCount++;
  el.querySelector("#action-spinner-label").textContent = text;
  el.style.display = 'flex';
}

function hideActionSpinner() {
  _spinnerCount = Math.max(0, _spinnerCount - 1);
  if (_spinnerCount > 0) return;
  const el = document.getElementById("action-spinner");
  if (el) el.style.display = 'none';
}

window.showActionSpinner = showActionSpinner;
window.hideActionSpinner = hideActionSpinner;

// Focus: reset all channel timers so each fires on next tick
window.addEventListener("focus", () => {
  if (_focusDebounceTimer) clearTimeout(_focusDebounceTimer);
  _focusDebounceTimer = setTimeout(() => {
    registerActivity();
    for (const ch of Object.values(_ch)) ch._t = 0;
  }, 800);
});

// Remove animation classes after first play so patching never retriggers them
document.addEventListener("animationend", e => {
  const t = e.target;
  if (e.animationName === "card-enter")       t.classList.remove("anim-card-enter");
  if (e.animationName === "panel-enter")      t.classList.remove("anim-panel-enter");
  if (e.animationName === "slide-from-right") t.classList.remove("anim-slide-right");
}, true);
