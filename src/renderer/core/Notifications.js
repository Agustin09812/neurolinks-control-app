// --------------------------------------------------
// NOTIFICATIONS IN APP
// --------------------------------------------------

let notifications = [];
const notificationMemory = new Map();
const NOTIFICATION_TTL = 60000;
const NOTIFICATIONS_CAP = 50;

const _escHtml = str => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function _relativeTime(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(date).toLocaleDateString();
}

function _pruneMemory() {
  const now = Date.now();
  for (const [key, ts] of notificationMemory) {
    if (now - ts >= NOTIFICATION_TTL) notificationMemory.delete(key);
  }
}

function addNotification(type, title, message, key = null, silent = false) {
  const notificationKey = key || `${type}-${message}`;

  _pruneMemory();

  if (notificationMemory.has(notificationKey)) {
    if (Date.now() - notificationMemory.get(notificationKey) < NOTIFICATION_TTL) return;
  }

  notificationMemory.set(notificationKey, Date.now());

  const notification = { id: crypto.randomUUID(), type, title, message, date: new Date(), read: false };

  notifications.unshift(notification);
  if (notifications.length > NOTIFICATIONS_CAP) notifications.length = NOTIFICATIONS_CAP;

  updateNotificationsBadge();
  if (!silent) showNotificationToast(notification);

  if (document.getElementById("notificationsCanvas")?.classList.contains("show")) {
    renderNotificationsPanel();
  }
}

function showNotificationToast(notification) {
  const icon =
    notification.type === "ticket"      ? "bi-ticket-perforated-fill" :
    notification.type === "deploy"       ? "bi-arrow-repeat" :
    notification.type === "deploy-error" ? "bi-exclamation-triangle-fill" :
    notification.type === "error"        ? "bi-exclamation-triangle-fill" :
    notification.type === "update"       ? "bi-arrow-up-circle-fill" :
    "bi-bell";

  showToast(`<i class="bi ${icon} mr-2"></i>${_escHtml(notification.title)}`, "info");
}

function getNotifications() {
  return notifications;
}

function markAllNotificationsRead() {
  notifications.forEach(n => n.read = true);
  updateNotificationsBadge();
  document.querySelectorAll(".notification-item").forEach(el => {
    el.classList.remove("notif-unread");
    el.classList.add("notif-read");
  });
}

function markNotificationAsRead(id) {
  const notif = notifications.find(n => n.id === id);
  if (!notif) return;
  notif.read = true;
  updateNotificationsBadge();
  const item = document.querySelector(`[data-notif-id="${id}"]`);
  if (item) {
    item.classList.remove("notif-unread");
    item.classList.add("notif-read");
  }
}

function clearAllNotifications() {
  if (!confirm("¿Seguro que querés eliminar todas las notificaciones?")) return;
  notifications = [];
  updateNotificationsBadge();
  renderNotificationsPanel();
}

function updateNotificationsBadge() {
  const unread = notifications.filter(n => !n.read).length;
  ["notifications-badge", "notifications-badge-topbar"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = unread > 0 ? "block" : "none";
  });
  const countEl = document.getElementById("notif-unread-count");
  if (countEl) countEl.textContent = unread > 0 ? unread : "";
}

// --------------------------------------------------
// NOTIFICATIONS PANEL (OFFCANVAS)
// --------------------------------------------------

function openNotificationsPanel() {
  const canvasEl = document.getElementById("notificationsCanvas");
  if (!canvasEl) return;
  renderNotificationsPanel();
  document.body.classList.add("notif-panel-open");
  canvasEl.addEventListener("hidden.bs.offcanvas", () => {
    document.body.classList.remove("notif-panel-open");
    updateNotificationsBadge();
  }, { once: true });
  bootstrap.Offcanvas.getOrCreateInstance(canvasEl).show();
}

const _typeConfig = {
  "deploy-error": { icon: "bi-exclamation-triangle-fill", cls: "notif-icon-error"   },
  "error":        { icon: "bi-exclamation-triangle-fill", cls: "notif-icon-error"   },
  "deploy":       { icon: "bi-arrow-repeat",              cls: "notif-icon-info"    },
  "ticket":       { icon: "bi-ticket-perforated-fill",    cls: "notif-icon-warning" },
  "update":       { icon: "bi-arrow-up-circle-fill",      cls: "notif-icon-info"    },
};

function renderNotificationsPanel() {
  const container = document.getElementById("notifications-panel-list");
  if (!container) return;

  const list = notifications;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="notif-empty">
        <i class="bi bi-bell-slash notif-empty-icon"></i>
        <div>Sin notificaciones</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((n, i) => {
    const cfg = _typeConfig[n.type] || { icon: "bi-bell-fill", cls: "notif-icon-default" };
    return `
      <div class="notification-item ${n.read ? 'notif-read' : 'notif-unread'} anim-card-enter"
           style="--si:${Math.min(i, 7)}" data-notif-id="${n.id}"
           onclick="markNotificationAsRead('${n.id}')">
        <div class="flex items-start gap-4">
          <div class="notif-icon-badge ${cfg.cls}">
            <i class="bi ${cfg.icon}"></i>
          </div>
          <div class="grow min-w-0">
            <div class="flex justify-between items-start gap-2">
              <div class="notif-title">${_escHtml(n.title)}</div>
              <div class="notif-time">${_relativeTime(n.date)}</div>
            </div>
            <div class="notif-message">${_escHtml(n.message)}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// --------------------------------------------------
// SSE REALTIME NOTIFICATIONS (FASE 3)
// --------------------------------------------------
const _sessionLogCounts = { Error: 0, Warning: 0 };
const _pendingLogUpdates = new Set();
let _logDebounceTimer = null;

function initRealtimeLogs() {
  try {
    const logsEventSource = new EventSource('/api/logs/stream');

    logsEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'INSERT' && payload.log) {
          const log = payload.log;
          
          // Agrupar niveles
          const level = log.level === 'WARN' ? 'Warning' : (log.level === 'ERROR' ? 'Error' : log.level);

          if (level === 'Error' || level === 'Warning') {
            _sessionLogCounts[level] = (_sessionLogCounts[level] || 0) + 1;
            _pendingLogUpdates.add(level);

            const btnRefresh = document.getElementById('btn-refresh-logs');
            if (btnRefresh && document.getElementById('logs-view').style.display !== 'none') {
                btnRefresh.click();
            }

            clearTimeout(_logDebounceTimer);
            _logDebounceTimer = setTimeout(() => {
                for (const lvl of _pendingLogUpdates) {
                    const count = _sessionLogCounts[lvl];
                    const msg = `${count} errores de nivel ${lvl} detectados`;
                    const notifType = lvl === 'Error' ? 'error' : 'warning';
                    const icon = lvl === 'Error' ? 'bi-x-octagon-fill' : 'bi-exclamation-triangle-fill';
                    
                    // Remover notificacion vieja del mismo nivel para que no se llene el panel
                    const oldIdx = notifications.findIndex(n => n.key === `agg-log-${lvl}`);
                    if (oldIdx !== -1) notifications.splice(oldIdx, 1);
                    
                    // Añadir la nueva notificacion agrupada
                    const notifObj = { 
                        id: crypto.randomUUID(), 
                        type: notifType, 
                        title: `Alertas del Sistema`, 
                        message: msg, 
                        date: new Date(), 
                        read: false,
                        key: `agg-log-${lvl}`
                    };
                    
                    notifications.unshift(notifObj);
                    if (notifications.length > NOTIFICATIONS_CAP) notifications.length = NOTIFICATIONS_CAP;
                    
                    updateNotificationsBadge();
                    if (document.getElementById("notificationsCanvas")?.classList.contains("show")) {
                        renderNotificationsPanel();
                    }
                    
                    // Mostrar Toast
                    if(typeof window.showToast === 'function') {
                        window.showToast(`<i class="bi ${icon} mr-2"></i>${msg}`, notifType, 6000);
                    }
                }
                _pendingLogUpdates.clear();
            }, 1000);
          }
        }
      } catch (err) {
        console.error('Error parseando evento de logs:', err);
      }
    };

    logsEventSource.onerror = (err) => {
      console.error('Logs SSE Connection Error:', err);
    };

  } catch (err) {
    console.error('Error inicializando SSE para logs:', err);
  }
}

// Inicializar al cargar el panel
initRealtimeLogs();

function initRealtimePayments() {
  try {
    const paymentsEventSource = new EventSource('/api/payments/stream');
    paymentsEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'INSERT') {
            if (typeof window.showToast === 'function') {
                window.showToast("Nuevo pago recibido de Mercado Pago", "success");
            }
            if (typeof window.refreshBilling === 'function' && document.getElementById('billing-view')?.style.display !== 'none') {
                window.refreshBilling();
            }
        }
      } catch (err) { }
    };
  } catch (err) { }
}
initRealtimePayments();
