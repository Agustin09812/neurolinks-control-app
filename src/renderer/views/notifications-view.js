function renderNotificationsView() {

    const view = document.getElementById("notifications-view");

    if (!view) return;

    const list = getNotifications();

    view.innerHTML = `
    
    <div class="animate-fade mt-4">

        <div class="d-flex justify-content-between align-items-center mb-4">

            <h2 class="fw-bold">NOTIFICACIONES</h2>

            <button class="btn btn-outline-light btn-sm" onclick="markAllNotificationsRead(); renderNotificationsView();">
                Marcar todo como leído
            </button>

        </div>

        <div class="d-grid gap-3">

            ${list.length === 0 ? `
                <div class="glass-card p-4 text-center text-secondary">
                    No hay notificaciones
                </div>
            ` : ""}

            ${list.map(n => `
            
            <div class="glass-card p-3 ${n.read ? "opacity-50" : ""}">
            
                <div class="fw-bold">${n.title}</div>

                <div class="small text-secondary">
                    ${n.message}
                </div>

                <div class="small text-dim mt-1">
                    ${new Date(n.date).toLocaleString()}
                </div>

            </div>

            `).join("")}

        </div>

    </div>
    
    `;
}