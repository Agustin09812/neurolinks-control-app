import React, { useState, useEffect, useRef } from 'react';
import { api } from './core/api';
import { store } from './core/store';
import DashboardView from './views/DashboardView';
import ClientsView from './views/ClientsView';
import AuditView from './views/AuditView';
import LogsView from './views/LogsView';
import AssistantsView from './views/AssistantsView';
import TicketsView from './views/TicketsView';
import VariablesView from './views/VariablesView';
import TicketChatView from './views/TicketChatView';
import DeployProject from './views/DeployProject';

export default function App() {
  const [view, setView] = useState(() => localStorage.getItem('activeView') || 'dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [hasTicketsBadge, setHasTicketsBadge] = useState(false);
  const [actionSpinner, setActionSpinner] = useState(null);

  const canvasRef = useRef(null);
  const notificationMemory = useRef(new Map());

  // Handle setting active view
  const navigate = (newView) => {
    setView(newView);
    localStorage.setItem('activeView', newView);
    setIsMobileSidebarOpen(false);
    setIsNotifOpen(false);
  };

  // Expose routing globally so legacy code can call it
  useEffect(() => {
    window.navigate = navigate;
    window.openDeployModal = () => navigate('deploy');
    document.body.classList.remove('app-preload');
  }, []);

  // Expose action spinner control globally
  useEffect(() => {
    let spinnerCount = 0;
    window.showActionSpinner = (text = "Sincronizando con Railway...") => {
      spinnerCount++;
      setActionSpinner({ text });
    };
    window.hideActionSpinner = () => {
      spinnerCount = Math.max(0, spinnerCount - 1);
      if (spinnerCount === 0) {
        setActionSpinner(null);
      }
    };
    return () => {
      window.showActionSpinner = null;
      window.hideActionSpinner = null;
    };
  }, []);

  // Theme synchronization
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Expose showToast globally
  useEffect(() => {
    window.showToast = (message, type = 'success', duration = 5000) => {
      const id = crypto.randomUUID();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    };
  }, []);

  // Fetch current user
  useEffect(() => {
    api.getCurrentUser()
      .then(data => {
        if (data && data.username) {
          const name = data.username.trim();
          const parts = name.split(/\s+/).filter(Boolean);
          let initials = '';
          if (parts.length > 0) {
            initials += parts[0][0];
            if (parts.length > 1) initials += parts[1][0];
          } else {
            initials = name.slice(0, 2);
          }
          setUser({
            username: displayName(parts),
            initials: initials.toUpperCase()
          });
        }
      })
      .catch(err => console.error('[Avatar] Error loading user:', err));

    function displayName(parts) {
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    }
  }, []);

  // Particle background animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const PARTICLE_COUNT = 130, MAX_DISTANCE = 160, SPEED = 0.45;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      size: Math.random() * 1.8 + 0.8,
    }));

    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_DISTANCE) continue;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,153,255,${(1 - dist / MAX_DISTANCE) * 0.22})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(72,202,228,0.45)';
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, []);

  // Notifications logic & SSE
  const addNotification = (type, title, message, key = null) => {
    const notifKey = key || `${type}-${message}`;
    const now = Date.now();

    // Deduplication check (TTL 60s)
    if (notificationMemory.current.has(notifKey)) {
      if (now - notificationMemory.current.get(notifKey) < 60000) return;
    }
    notificationMemory.current.set(notifKey, now);

    const newNotif = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      date: new Date(),
      read: false,
      key: notifKey
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      return updated.slice(0, 50); // limit to 50
    });

    const icon = type === 'ticket' ? 'bi-ticket-perforated-fill' :
                 type === 'deploy' ? 'bi-arrow-repeat' :
                 type === 'deploy-error' ? 'bi-exclamation-triangle-fill' :
                 type === 'error' ? 'bi-exclamation-triangle-fill' :
                 type === 'update' ? 'bi-arrow-up-circle-fill' : 'bi-bell';

    window.showToast(message, type === 'deploy-error' || type === 'error' ? 'danger' : (type === 'warning' ? 'warning' : 'info'));
  };

  // Connect SSE — invalidates store keys for background-silent refresh (no flicker)
  useEffect(() => {
    let logsSse;
    let ticketsSse;
    let clientsSse;

    try {
      logsSse = new EventSource('/api/logs/stream');
      logsSse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INSERT' && payload.log) {
            const log = payload.log;
            const level = log.level === 'WARN' ? 'Warning' : (log.level === 'ERROR' ? 'Error' : log.level);
            
            // Silence benign OpenAI 401 error
            if (log.message && log.message.includes('Error [401]: OpenAI no pudo generar una respues')) {
              return;
            }

            if (level === 'Error' || level === 'Warning') {
              addNotification(
                level === 'Error' ? 'error' : 'warning',
                'Alerta del Sistema',
                `Error detectado: ${log.message.slice(0, 80)}`,
                `agg-log-${level}`
              );
              if (window.refreshLogs) window.refreshLogs();
            }
          }
        } catch (e) {}
      };
    } catch (e) {
      console.error('SSE Logs error:', e);
    }

    try {
      ticketsSse = new EventSource('/api/tickets/stream');
      ticketsSse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INSERT' || payload.type === 'UPDATE' || payload.type === 'DELETE') {
            // Silent background refresh — no loading spinners
            store.invalidate('ticketsMeta', 'clients');
            if (window.refreshTickets) window.refreshTickets();
          }
        } catch (e) {}
      };
    } catch (e) {
      console.error('SSE Tickets error:', e);
    }

    try {
      clientsSse = new EventSource('/api/clients/stream');
      clientsSse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INSERT' || payload.type === 'UPDATE' || payload.type === 'DELETE') {
            // Silent background refresh — no loading spinners
            store.invalidate('clients', 'ticketsMeta');
          }
        } catch (e) {}
      };
    } catch (e) {
      console.error('SSE Clients error:', e);
    }

    return () => {
      if (logsSse) logsSse.close();
      if (ticketsSse) ticketsSse.close();
      if (clientsSse) clientsSse.close();
    };
  }, []);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearAllNotifications = () => {
    if (window.confirm('¿Seguro que querés eliminar todas las notificaciones?')) {
      setNotifications([]);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // View renderer
  const renderActiveView = () => {
    switch (view) {
      case 'dashboard':
        return <DashboardView navigate={navigate} />;
      case 'assistants':
        return <AssistantsView navigate={navigate} />;
      case 'clients':
        return <ClientsView navigate={navigate} setHasTicketsBadge={setHasTicketsBadge} />;
      case 'audit':
        return <AuditView navigate={navigate} />;
      case 'logs':
        return <LogsView navigate={navigate} />;
      case 'tickets':
        return <TicketsView navigate={navigate} />;
      case 'ticket-chat':
        return <TicketChatView navigate={navigate} />;
      case 'variables':
        return <VariablesView navigate={navigate} />;
      case 'deploy':
        return <DeployProject navigate={navigate} />;
      default:
        return <DashboardView navigate={navigate} />;
    }
  };

  return (
    <>
      {/* Particle background */}
      <canvas ref={canvasRef} id="neural-bg" aria-hidden="true" style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.16
      }} />

      {/* TOPBAR (Mobile/Tablet) */}
      <div className="topbar-mobile" id="topbar-mobile" style={{ zIndex: 1060 }}>
        <button className="btn btn-sidebar-toggle" onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}>
          <i className={isMobileSidebarOpen ? "bi bi-x-lg" : "bi bi-list"}></i>
        </button>
        <div className="topbar-brand">
          <span className="topbar-brand-name">Neurolinks Control</span>
        </div>
        <button className="btn btn-topbar-notif" onClick={() => setIsNotifOpen(!isNotifOpen)}>
          <i className="bi bi-bell"></i>
          {unreadCount > 0 && <span className="badge-dot"></span>}
        </button>
      </div>

      {/* BACKDROPS */}
      {isMobileSidebarOpen && <div className="offcanvas-backdrop fade show" onClick={() => setIsMobileSidebarOpen(false)} style={{ zIndex: 1040 }}></div>}
      {isNotifOpen && <div className="offcanvas-backdrop fade show" onClick={() => setIsNotifOpen(false)} style={{ zIndex: 1040 }}></div>}

      {/* SIDEBAR OFFCANVAS (Mobile/Tablet) */}
      <div className={`offcanvas offcanvas-start sidebar-offcanvas ${isMobileSidebarOpen ? 'show' : ''}`} tabIndex="-1" style={{ visibility: isMobileSidebarOpen ? 'visible' : 'hidden', zIndex: 1050, paddingTop: '65px' }}>
        <div className="offcanvas-body flex flex-col">
          {user && (
            <div className="flex items-center gap-3 px-3 py-2 mb-3" style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: '12px' }}>
              <div className="sidebar-user-avatar" style={{ margin: 0, width: '34px', height: '34px', fontSize: '0.8rem' }}>
                <span>{user.initials}</span>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{user.username}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Administrador</div>
              </div>
            </div>
          )}

          <div className="offcanvas-nav flex flex-col gap-1">
            <div className="offcanvas-section-label">ACCIONES</div>
            <div className="sidebar-item" onClick={() => { setIsMobileSidebarOpen(false); window.openDeployModal?.(); }}>
              <i className="bi bi-plus-lg"></i><span>Nuevo Proyecto</span>
            </div>

            <div className="offcanvas-section-label mt-2">NAVEGACIÓN</div>
            <div className={`sidebar-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>
              <i className="bi bi-bar-chart"></i><span>Dashboard</span>
            </div>
            <div className={`sidebar-item ${view === 'clients' ? 'active' : ''}`} onClick={() => navigate('clients')}>
              <i className="bi bi-people"></i><span>Clientes</span>
              {hasTicketsBadge && <span className="badge-dot"></span>}
            </div>
            <div className={`sidebar-item ${view === 'audit' ? 'active' : ''}`} onClick={() => navigate('audit')}>
              <i className="bi bi-clipboard-data"></i><span>Auditoría</span>
            </div>
            <div className={`sidebar-item ${view === 'logs' ? 'active' : ''}`} onClick={() => navigate('logs')}>
              <i className="bi bi-terminal"></i><span>Logs</span>
            </div>
            <div className={`sidebar-item ${view === 'assistants' ? 'active' : ''}`} onClick={() => navigate('assistants')}>
              <i className="bi bi-cpu"></i><span>Asistentes</span>
            </div>
          </div>

          <div className="grow"></div>

          <div className="offcanvas-nav offcanvas-nav-bottom flex flex-col gap-1">
            <div className="sidebar-item" onClick={toggleTheme}>
              <i className={theme === 'light' ? 'bi bi-sun-fill' : 'bi bi-moon-stars'}></i>
              <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
            </div>
            <div className="sidebar-item sidebar-item-logout" onClick={() => document.getElementById('logout-form').submit()}>
              <i className="bi bi-box-arrow-right"></i><span>Cerrar sesión</span>
            </div>
          </div>
        </div>
      </div>

      {/* SIDEBAR (Desktop) */}
      <div className="sidebar">
        <div className="sidebar-menu">
          <div className="sidebar-item" onClick={() => window.openDeployModal?.()} title="Nuevo Proyecto">
            <i className="bi bi-plus-lg"></i>
          </div>
          <div className={`sidebar-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')} title="Dashboard">
            <i className="bi bi-bar-chart"></i>
          </div>
          <div className={`sidebar-item ${view === 'clients' ? 'active' : ''}`} onClick={() => navigate('clients')} title="Clientes">
            <i className="bi bi-people"></i>
            {hasTicketsBadge && <span className="badge-dot"></span>}
          </div>
          <div className={`sidebar-item ${view === 'audit' ? 'active' : ''}`} onClick={() => navigate('audit')} title="Auditoría">
            <i className="bi bi-clipboard-data"></i>
          </div>
          <div className={`sidebar-item ${view === 'logs' ? 'active' : ''}`} onClick={() => navigate('logs')} title="Logs del Sistema">
            <i className="bi bi-terminal"></i>
          </div>
          <div className={`sidebar-item ${view === 'assistants' ? 'active' : ''}`} onClick={() => navigate('assistants')} title="Asistentes">
            <i className="bi bi-cpu"></i>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-item" onClick={toggleTheme} title="Cambiar tema">
            <i className={theme === 'light' ? 'bi bi-sun-fill' : 'bi bi-moon-stars'}></i>
          </div>
          <div className="sidebar-item" onClick={() => setIsNotifOpen(true)} title="Notificaciones">
            <i className="bi bi-bell"></i>
            {unreadCount > 0 && <span className="badge-dot"></span>}
          </div>
          {user && (
            <div className="sidebar-user-avatar" title={`Conectado: ${user.username}`}>
              <span>{user.initials}</span>
            </div>
          )}
          <div className="sidebar-item sidebar-item-logout" onClick={() => document.getElementById('logout-form').submit()} title="Cerrar sesión">
            <i className="bi bi-box-arrow-right"></i>
          </div>
          <form id="logout-form" action="/logout" method="POST" style={{ display: 'none' }}></form>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-wrapper">
        <div className="main-content">
          <div className={`grow overflow-auto ${view === 'ticket-chat' ? 'p-0' : 'p-6'}`}>
            {renderActiveView()}
          </div>
        </div>
      </div>

      {/* TOAST CONTAINER */}
      <div className="toast-container fixed top-0 left-1/2 -translate-x-1/2 p-4" style={{ zIndex: 9999 }}>
        {toasts.map(t => {
          const icon = t.type === 'success' ? 'bi-check-circle-fill' :
                       t.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill';
          const bgClass = t.type === 'danger' ? 'toast-danger' : (t.type === 'warning' ? 'toast-warning' : 'toast-themed');
          return (
            <div key={t.id} className={`toast show ${bgClass}`} role="alert" style={{ opacity: 1, display: 'block', marginBottom: '8px' }}>
              <div className="flex items-center">
                <div className="toast-body flex items-center gap-2">
                  <i className={`bi ${icon}`}></i>
                  <div>{t.message}</div>
                </div>
                <button type="button" className="btn-close btn-close-white mr-2 m-auto" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* OFFCANVAS NOTIFICATIONS */}
      <div id="notificationsCanvas" className={`offcanvas offcanvas-end ${isNotifOpen ? 'show' : ''}`} style={{ visibility: isNotifOpen ? 'visible' : 'hidden', zIndex: 1050 }}>
        <div className="offcanvas-header notif-canvas-header">
          <div className="flex items-center gap-2 grow">
            <div className="notif-header-icon">
              <i className="bi bi-bell-fill"></i>
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: '0.95rem' }}>Notificaciones</div>
              <div className="notif-header-sub">
                <span>{unreadCount > 0 ? unreadCount : '0'}</span>
                <span className="notif-header-sub-label"> sin leer</span>
              </div>
            </div>
          </div>
          <button type="button" className="btn-close btn-close-white ml-1" onClick={() => setIsNotifOpen(false)}></button>
        </div>
        <div className="offcanvas-body pt-3 px-3 flex flex-col" style={{ overflowY: 'auto' }}>
          <div className="flex flex-col gap-2 grow">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <i className="bi bi-bell-slash notif-empty-icon"></i>
                <div>Sin notificaciones</div>
              </div>
            ) : (
              notifications.map((n, i) => {
                const icon = n.type === 'error' || n.type === 'deploy-error' ? 'bi-exclamation-triangle-fill' :
                             n.type === 'deploy' ? 'bi-arrow-repeat' :
                             n.type === 'ticket' ? 'bi-ticket-perforated-fill' :
                             n.type === 'update' ? 'bi-arrow-up-circle-fill' : 'bi-bell-fill';
                const cls = n.type === 'error' || n.type === 'deploy-error' ? 'notif-icon-error' :
                            n.type === 'ticket' ? 'notif-icon-warning' : 'notif-icon-info';
                
                const timeDiff = Math.floor((Date.now() - new Date(n.date)) / 1000);
                const relTime = timeDiff < 60 ? 'ahora' :
                                timeDiff < 3600 ? `hace ${Math.floor(timeDiff / 60)} min` :
                                timeDiff < 86400 ? `hace ${Math.floor(timeDiff / 3600)} h` :
                                new Date(n.date).toLocaleDateString();

                return (
                  <div key={n.id} className={`notification-item ${n.read ? 'notif-read' : 'notif-unread'}`} onClick={() => markAsRead(n.id)}>
                    <div className="flex items-start gap-4">
                      <div className={`notif-icon-badge ${cls}`}>
                        <i className={`bi ${icon}`}></i>
                      </div>
                      <div className="grow min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="notif-title">{n.title}</div>
                          <div className="notif-time">{relTime}</div>
                        </div>
                        <div className="notif-message">{n.message}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="notif-mobile-footer" style={{ marginTop: 'auto', paddingTop: '16px', background: 'transparent' }}>
            <button className="btn notif-footer-btn" onClick={markAllAsRead}>
              <i className="bi bi-envelope-open mr-2"></i>Marcar como leídas
            </button>
            <button className="btn notif-footer-btn notif-footer-danger" onClick={clearAllNotifications}>
              <i className="bi bi-trash mr-2"></i>Vaciar
            </button>
          </div>
        </div>
      </div>

      {actionSpinner && (
        <div id="action-spinner" style={{
          position: 'fixed',
          bottom: '5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
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
        }}>
          <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true"
               style={{ width: '0.9rem', height: '0.9rem', borderWidth: '2px', flexShrink: 0 }}></div>
          <span id="action-spinner-label">{actionSpinner.text}</span>
        </div>
      )}
    </>
  );
}
