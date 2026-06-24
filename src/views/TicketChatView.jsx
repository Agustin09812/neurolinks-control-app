import React, { useState, useEffect, useRef } from 'react';
import { api } from '../core/api';

export default function TicketChatView({ navigate }) {
  const [ticket, setTicket] = useState(null);
  const [clientName, setClientName] = useState('Cliente');
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const tickId = localStorage.getItem('currentChatTicketId');
  const backView = localStorage.getItem('currentChatTicketBackView') || 'tickets';

  const fetchTicketDetails = async (shouldScroll = true) => {
    if (!tickId) return;
    try {
      const tick = await api.getTicketById(tickId);
      if (tick) {
        setTicket(tick);
        
        // Resolve client name
        if (tick.clientes) {
          setClientName(tick.clientes.nombre || 'Cliente');
        } else {
          // Attempt fallback resolve
          try {
            const clients = await api.getClients() || [];
            const clientObj = clients.find(c => c.id === tick.cliente_id);
            if (clientObj) setClientName(clientObj.nombre);
          } catch {}
        }

        // Parse chats
        let chats = [];
        if (tick.chats_adjuntos) {
          if (typeof tick.chats_adjuntos === 'string') {
            try { chats = JSON.parse(tick.chats_adjuntos); } catch(e){}
          } else if (Array.isArray(tick.chats_adjuntos)) {
            chats = tick.chats_adjuntos;
          }
        }

        // Mark as read
        const totalMsgCount = (tick.descripcion ? 1 : 0) + chats.length;
        const currentReadCount = tick.read_admin_count || 0;
        if (totalMsgCount > currentReadCount) {
          await api.updateTicket(tick.id, { read_admin_count: totalMsgCount }).catch(() => {});
        }

        if (shouldScroll) {
          setTimeout(scrollToBottom, 60);
        }
      }
    } catch (err) {
      console.error('[TicketChatView] Error fetching ticket:', err);
      window.showToast('Error al cargar la conversación', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tickId) {
      navigate(backView);
      return;
    }
    fetchTicketDetails(true);

    // Auto-refresh chat every 15s when active
    const interval = setInterval(() => {
      fetchTicketDetails(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [tickId]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    localStorage.removeItem('currentChatTicketId');
    localStorage.removeItem('currentChatTicketBackView');
    navigate(backView);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !ticket || ticket.estado === 'Cerrado') return;

    setSending(true);
    try {
      await api.addTicketMessage(ticket.id, { rol: 'admin', mensaje: text });
      setInputText('');
      await fetchTicketDetails(true);
    } catch (err) {
      window.showToast('Error al enviar el mensaje', 'danger');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!ticket) return;
    try {
      if (newStatus === 'Cerrado') {
        await api.addTicketMessage(ticket.id, { 
          rol: 'admin', 
          mensaje: 'Este ticket se dio por concluido por el personal de soporte. Muchas gracias!' 
        });
      }
      await api.updateTicket(ticket.id, { estado: newStatus });
      window.showToast('Estado actualizado', 'success');
      fetchTicketDetails(true);
    } catch (err) {
      window.showToast('Error al cambiar estado del ticket', 'danger');
    }
  };

  if (loading) {
    return (
      <div className="animate-fade wa-chat-container relative h-[calc(100vh-80px)]">
        <div className="glass-header px-6 py-4 z-10 shadow-sm border-b border-[var(--border-soft)] tchat-header">
          <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
            <button
              className="btn btn-outline-secondary btn-sm rounded-circle flex items-center justify-center shrink-0"
              onClick={handleBack}
              title="Volver"
              style={{ width: '40px', height: '40px', padding: 0 }}
            >
              <i className="bi bi-arrow-left fs-5"></i>
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-dim font-medium mb-0.5">Cargando chat de soporte...</div>
            </div>
          </div>
        </div>
        <div className="h-full flex flex-col justify-center items-center py-20 text-dim">
          <span className="spinner-border text-primary mb-3"></span>
          <span>Cargando conversación...</span>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center text-dim flex flex-col items-center gap-4">
        <span>Ticket no encontrado</span>
        <button className="btn btn-outline-light btn-sm" onClick={handleBack}>Volver</button>
      </div>
    );
  }

  let chats = [];
  if (ticket.chats_adjuntos) {
    if (typeof ticket.chats_adjuntos === 'string') {
      try { chats = JSON.parse(ticket.chats_adjuntos); } catch(e){}
    } else if (Array.isArray(ticket.chats_adjuntos)) {
      chats = ticket.chats_adjuntos;
    }
  }

  const initials = clientName.substring(0, 2).toUpperCase();

  return (
    <>
      <style>{`
        .wa-chat-msg { max-width: 85%; padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.95rem; position: relative; line-height: 1.5; word-wrap: break-word; transition: var(--transition-fast); }
        .wa-chat-msg.admin { background: var(--accent); color: white; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 4px 12px rgba(0, 120, 212, 0.2); }
        .wa-chat-msg.cliente { background: var(--bg-card); border: 1px solid var(--border-soft); color: var(--text-main); align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: var(--glass-shadow); }
        .wa-chat-time { font-size: 0.7rem; color: var(--text-dim); margin-top: 6px; display: block; text-align: right; }
        .wa-chat-msg.admin .wa-chat-time { color: rgba(255, 255, 255, 0.7); }
        .wa-chat-container { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: transparent; }
        .tchat-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .tchat-select-wrap { flex-shrink: 0; }
        .tchat-label-container { 
            display: flex; align-items: center; gap: 0.75rem; margin: 0; cursor: pointer;
            background: rgba(128, 128, 128, 0.08);
            border: 1px solid var(--border-soft);
            padding: 4px 6px 4px 14px;
            border-radius: 8px;
        }
        .tchat-select { padding: 6px 12px; font-size: 0.875rem; min-width: 120px; }
        .tchat-label { font-size: 0.75rem; margin: 0; }
        @media (max-width: 767px) {
            .tchat-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
            .tchat-select-wrap { padding-left: 56px; }
            .tchat-select { padding: 4px 8px; font-size: 0.75rem; min-width: 100px; }
            .tchat-label { font-size: 0.65rem; }
        }
      `}</style>

      <div className="animate-fade wa-chat-container relative h-[calc(100vh-80px)]">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none -z-10"></div>

        {/* HEADER */}
        <div className="glass-header px-6 py-4 z-10 shadow-sm border-b border-[var(--border-soft)] tchat-header">
          <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
            <button
              className="btn btn-outline-secondary btn-sm rounded-circle flex items-center justify-center shrink-0"
              onClick={handleBack}
              title="Volver"
              style={{ width: '40px', height: '40px', padding: 0 }}
            >
              <i className="bi bi-arrow-left fs-5"></i>
            </button>
            <div className="client-avatar shrink-0 hidden sm:flex">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-dim font-mono mb-0.5">#{ticket.id.substring(0, 8)}</div>
              <div className="text-sm text-dim font-medium truncate mb-0.5">
                {clientName}
              </div>
              <div className="text-sm text-main font-bold truncate" title={ticket.titulo}>
                {ticket.titulo}
              </div>
            </div>
          </div>
          <div className="tchat-select-wrap">
            <label className="tchat-label-container">
              <span className="font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider tchat-label">Estado</span>
              <select
                className="tchat-select rounded border-gray-300 shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                style={{ cursor: 'pointer' }}
                value={ticket.estado}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="Abierto">Abierto</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </label>
          </div>
        </div>

        {/* MESSAGES */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 md:px-12 lg:px-24 flex flex-col gap-4 z-0 h-[calc(100%-140px)]"
        >
          {ticket.descripcion && (
            <div className="wa-chat-msg cliente">
              <span>{ticket.descripcion}</span>
              <span className="wa-chat-time">Ticket inicial</span>
            </div>
          )}

          {chats.length === 0 && !ticket.descripcion ? (
            <div className="text-center mt-6 p-4 glass-card mx-auto" style={{ maxWidth: '300px' }}>
              <div className="text-dim text-sm">
                <i className="bi bi-chat-left-dots mb-2 fs-3 block"></i>
                <br />
                No hay mensajes aún.
              </div>
            </div>
          ) : (
            chats.map((msg, index) => {
              const isMe = msg.rol === 'admin';
              const timeString = new Date(msg.timestamp || msg.fecha || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={index} className={`wa-chat-msg ${isMe ? 'admin' : 'cliente'}`}>
                  {msg.mensaje && <span>{msg.mensaje}</span>}
                  <span className="wa-chat-time">{timeString}</span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BAR */}
        <form
          onSubmit={handleSend}
          className="glass-header px-6 md:px-12 lg:px-24 py-4 flex gap-4 items-center border-t border-[var(--border-soft)] z-10 shadow-lg"
          style={{ background: 'var(--bg-card)' }}
        >
          <input
            type="text"
            id="tchat-input"
            className="form-control text-main"
            placeholder={ticket.estado === 'Cerrado' ? 'Conversación finalizada' : 'Escribe un mensaje...'}
            disabled={ticket.estado === 'Cerrado' || sending}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            id="tchat-send-btn"
            className="btn btn-primary rounded-circle flex items-center justify-center shrink-0"
            disabled={ticket.estado === 'Cerrado' || sending || !inputText.trim()}
            style={{ width: '48px', height: '48px', padding: 0 }}
          >
            {sending ? (
              <span className="spinner-border spinner-border-sm text-white"></span>
            ) : (
              <i className="bi bi-send-fill fs-5" style={{ marginLeft: '-2px' }}></i>
            )}
          </button>
        </form>
      </div>
    </>
  );
}
