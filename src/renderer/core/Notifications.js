// --------------------------------------------------
// NOTIFICATIONS IN APP
// --------------------------------------------------

let notifications = [];
const notificationMemory = new Map();
const NOTIFICATION_TTL = 60000; // 60 segundos

function addNotification(type, title, message, key = null) {

  const notificationKey = key || `${type}-${message}`;

  if (notificationMemory.has(notificationKey)) {

    const lastTime = notificationMemory.get(notificationKey);

    if (Date.now() - lastTime < NOTIFICATION_TTL) {
      return;
    }

  }

  notificationMemory.set(notificationKey, Date.now());

  const notification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    date: new Date(),
    read: false
  };

  notifications.unshift(notification);

  updateNotificationsBadge();

  showNotificationToast(notification);

  console.log("Nueva notificación:", notification);

  renderNotificationsPanel?.();
}

function showNotificationToast(notification) {

  const icon =
    notification.type === "ticket" ? "bi-ticket-perforated" :
      notification.type === "deploy" ? "bi-arrow-repeat" :
        notification.type === "deploy-error" ? "bi-exclamation-triangle-fill" :
          notification.type === "error" ? "bi-exclamation-triangle-fill" :
            "bi-bell";

  showToast(
    `<i class="bi ${icon} me-2"></i>${notification.title}`,
    "info"
  );

}

function getNotifications() {
  return notifications;
}

function markAllNotificationsRead() {
  notifications.forEach(n => n.read = true);
  updateNotificationsBadge();
}

function markNotificationAsRead(id) {
  const notif = notifications.find(n => n.id === id);
  if (!notif) return;
  notif.read = true;
  updateNotificationsBadge();
  renderNotificationsPanel();
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

  if (unread === 0) {
    badge.style.display = "none";
    return;
  }

  badge.style.display = "block";
}

// --------------------------------------------------
// NOTIFICATIONS PANEL (OFFCANVAS)
// --------------------------------------------------

function openNotificationsPanel() {

  const canvasEl = document.getElementById("notificationsCanvas");
  if (!canvasEl) return;

  const canvas = bootstrap.Offcanvas.getOrCreateInstance(canvasEl);

  renderNotificationsPanel();

  canvas.show();
}

function renderNotificationsPanel() {

  const container = document.getElementById("notifications-panel-list");
  if (!container) return;

  const list = getNotifications() || [];

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card p-3 text-center text-secondary">
        No hay notificaciones
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(n => `

        <div
          class="glass-card notification-item ${n.read ? "opacity-50" : ""}"
          onclick="markNotificationAsRead('${n.id}')"
        >
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-bold">${n.title}</div>
            <div class="small text-secondary">
              ${n.message}
            </div>
          </div>
          <div class="small text-dim text-end min-w-60">
            ${new Date(n.date).toLocaleTimeString()}
          </div>
        </div>
      </div>

  `).join("");

}
