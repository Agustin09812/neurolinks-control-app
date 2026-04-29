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

function addNotification(type, title, message, key = null) {
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
  showNotificationToast(notification);

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

  showToast(`<i class="bi ${icon} me-2"></i>${_escHtml(notification.title)}`, "info");
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
  const badge = document.getElementById("notifications-badge");
  if (!badge) return;
  const unread = notifications.filter(n => !n.read).length;
  badge.style.display = unread > 0 ? "block" : "none";

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
        <div class="d-flex align-items-start gap-3">
          <div class="notif-icon-badge ${cfg.cls}">
            <i class="bi ${cfg.icon}"></i>
          </div>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between align-items-start gap-2">
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
