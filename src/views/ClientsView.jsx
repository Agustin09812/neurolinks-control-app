import React, { useState, useEffect, useRef } from 'react';
import { api } from '../core/api';
import { store, useStoreKey } from '../core/store';

export default function ClientsView({ navigate, setHasTicketsBadge }) {
  // Shared data from global store — updates silently in background (no flicker)
  const clientsData = useStoreKey('clients', () => store.fetchClients());
  const assistantsData = useStoreKey('assistants', () => store.fetchAssistants());
  const ticketsMetaData = useStoreKey('ticketsMeta', () => store.fetchTicketsMeta());

  const loading = clientsData === null || assistantsData === null || ticketsMetaData === null;

  const clients = clientsData || [];
  const assistants = assistantsData || [];
  const ticketsMeta = ticketsMetaData || [];

  // Admins (not in shared store, local to this view)
  const [admins, setAdmins] = useState([]);

  // Layout and Search
  const [search, setSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState('');

  // Selected Client details
  const [selectedClientId, setSelectedClientId] = useState(() => localStorage.getItem('selectedClientId') || null);
  const [clientProjects, setClientProjects] = useState([]);
  const [clientTickets, setClientTickets] = useState([]);

  useEffect(() => {
    if (selectedClientId) localStorage.setItem('selectedClientId', selectedClientId);
    else localStorage.removeItem('selectedClientId');
  }, [selectedClientId]);

  // Client Modal (Create / Edit)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientModalTitle, setClientModalTitle] = useState('Nuevo Cliente');
  const [formClientId, setFormClientId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formAbono, setFormAbono] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPlan, setFormPlan] = useState('Standard');
  const [formVencimiento, setFormVencimiento] = useState('');
  const [formVendedorUserId, setFormVendedorUserId] = useState('');
  const [formAdminUser, setFormAdminUser] = useState('');
  const [formAdminPass, setFormAdminPass] = useState('');

  // Link Assistant Modal
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkModalTab, setLinkModalTab] = useState('menu'); // 'menu', 'link', 'create'
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [deployingTemplate, setDeployingTemplate] = useState(false);

  const handleOpenCreateTab = async () => {
    setLinkModalTab('create');
    setLoadingTemplates(true);
    try {
      const data = await api.searchTemplates("");
      let filtered = (data || []).filter(t => t.id === '7ee93cd3-5d50-444e-9c47-1617446449d3');
      if (filtered.length === 0) {
        filtered = [{ id: '7ee93cd3-5d50-444e-9c47-1617446449d3', name: 'Backoffice - Official Meta API' }];
      }
      setTemplates(filtered);
    } catch (error) {
      console.error("Error loading templates:", error);
      if (window.showToast) window.showToast("Error al conectar con Railway", "danger");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleConfirmDeployForClient = async (templateId) => {
    if (!selectedClientId || !templateId) return;
    setDeployingTemplate(true);
    try {
      const result = await api.deployTemplate(templateId, selectedClientId);
      if (result.success) {
        alert("Despliegue iniciado. El nuevo proyecto aparecerá vinculado a este cliente en unos momentos.");
        if (window.refreshAssistants) window.refreshAssistants();
        setIsLinkModalOpen(false);
        fetchClientDetails(selectedClientId);
      } else {
        alert("Error al desplegar: " + (result.error || "Respuesta desconocida"));
      }
    } catch (error) {
      console.error("Error in handleConfirmDeployForClient:", error);
      alert("Error crítico al intentar desplegar el template.");
    } finally {
      setDeployingTemplate(false);
    }
  };

  // Tickets inside client detail modal
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketProjectId, setTicketProjectId] = useState('');

  // Project service configs visible
  const [sysConfigStates, setSysConfigStates] = useState({}); // { projectId: boolean }

  // Load admins once on mount
  useEffect(() => {
    api.getAdmins().then(d => setAdmins(d || [])).catch(() => { });
  }, []);

  // Sync sidebar ticket badge whenever ticketsMeta changes in store
  useEffect(() => {
    if (ticketsMeta) {
      const hasPending = ticketsMeta.some(t => t.estado !== 'Cerrado');
      setHasTicketsBadge(hasPending);
    }
  }, [ticketsMeta]);


  // Fetch client details when selectedClientId changes
  const fetchClientDetails = async (clientId) => {
    if (!clientId) return;
    try {
      const [projIds, ticketsRes] = await Promise.all([
        api.getClientProjects(clientId) || [],
        api.getTickets({ cliente_id: clientId, limit: 500 }) || {}
      ]);
      setClientProjects(projIds);

      const allTickets = ticketsRes?.data || [];
      const supportTickets = allTickets.filter(t => t.tipo === 'Soporte');
      setClientTickets(supportTickets);

      // Load SysConfig state for linked projects
      const linked = assistants.filter(p => projIds.includes(p.id));
      const initialConfigs = {};
      await Promise.all(linked.map(async (p) => {
        try {
          const settings = await api.getSettings(p.id);
          const val = settings?.find(s => s.key === 'SYSTEM_CONFIG_VISIBLE')?.value;
          initialConfigs[p.id] = val === 'true' || val === true;
        } catch {
          initialConfigs[p.id] = false;
        }
      }));
      setSysConfigStates(initialConfigs);
    } catch (err) {
      console.error('[ClientsView] Error loading client details:', err);
    }
  };

  useEffect(() => {
    fetchClientDetails(selectedClientId);
  }, [selectedClientId, assistants]);

  // Layout View Switcher removed

  const getPlanBadgeClass = (plan) => {
    if (!plan) return 'badge-status-secondary';
    switch (plan.toLowerCase()) {
      case 'standard': return 'badge-status-info';
      case 'premium': return 'badge-status-error';
      case 'enterprise': return 'badge-status-warning';
      case 'baja': return 'badge-status-secondary';
      default: return 'badge-status-secondary';
    }
  };

  const getStatusIcon = (status) => {
    if (!status) return 'bi-circle';
    switch (status.toLowerCase()) {
      case 'online': return 'bi-check-circle-fill text-emerald-400';
      case 'error': return 'bi-exclamation-circle-fill text-red-400';
      default: return 'bi-arrow-repeat text-yellow-400';
    }
  };

  const getStatusColor = (status) => {
    if (!status) return 'secondary';
    switch (status.toLowerCase()) {
      case 'online': return 'success';
      case 'error': return 'danger';
      case 'checking': return 'warning';
      default: return 'secondary';
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const filtered = getFilteredClients();
    if (filtered.length === 0) {
      window.showToast('No hay datos para exportar', 'warning');
      return;
    }

    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = ['ID', 'Nombre', 'Empresa', 'Abono', 'Email', 'Telefono', 'Plan', 'Vencimiento', 'Adjudicado A'];
    const rows = filtered.map(c => {
      const admin = admins.find(a => a.auth_user_id === c.vendedor_user_id);
      const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';
      return [
        escapeCSV(c.id),
        escapeCSV(c.nombre),
        escapeCSV(c.empresa || '-'),
        c.abono ?? 0,
        escapeCSV(c.email || '-'),
        escapeCSV(c.telefono || '-'),
        escapeCSV(c.plan || 'Standard'),
        escapeCSV(c.vencimiento || '-'),
        escapeCSV(adjudicado)
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
      + headers.join(',') + '\n'
      + rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'reporte_clientes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast('Reporte de clientes generado', 'success');
  };

  // CSV Payments Exporter
  const handleExportPaymentsCSV = () => {
    const filtered = getFilteredClients();
    if (filtered.length === 0) {
      window.showToast('No hay datos para exportar', 'warning');
      return;
    }

    const escapeCSV = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = ['Cliente', 'Tipo de Plan', 'Adjudicado A', 'Monto Bruto', 'Monto Neto'];
    const rows = filtered.map(c => {
      const admin = admins.find(a => a.auth_user_id === c.vendedor_user_id);
      const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';

      const montoBruto = c.abono ?? 0;
      const montoNeto = montoBruto - (montoBruto * 0.07);

      return [
        escapeCSV(c.nombre),
        escapeCSV(c.plan || 'Standard'),
        escapeCSV(adjudicado),
        montoBruto,
        montoNeto
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
      + headers.join(',') + '\n'
      + rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'reporte_pagos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast('Reporte de pagos generado', 'success');
  };

  // CSV Importer
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const clean = text.replace(/^\uFEFF/, '');
      const lines = clean.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        window.showToast('El archivo CSV está vacío o no tiene datos', 'warning');
        return;
      }

      const parseRow = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(cur); cur = '';
          } else {
            cur += ch;
          }
        }
        result.push(cur);
        return result;
      };

      const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
      const idxId = headers.indexOf('id');
      const idxNom = headers.indexOf('nombre');
      const idxEmp = headers.indexOf('empresa');
      const idxEmail = headers.indexOf('email');
      const idxTel = headers.indexOf('telefono');
      const idxPlan = headers.indexOf('plan');
      const idxVenc = headers.indexOf('vencimiento');

      if (idxNom === -1) {
        window.showToast('El CSV no tiene columna "Nombre"', 'danger');
        return;
      }

      const existingIds = new Set(clients.map(c => c.id));
      const VALID_PLANS = ['Standard', 'Premium', 'Enterprise', 'Baja'];
      let created = 0, updated = 0, errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const get = (idx) => idx !== -1 ? (cols[idx] || '').trim() : '';

        const nombre = get(idxNom);
        if (!nombre || nombre === '-') continue;

        const id = get(idxId);
        const empresa = get(idxEmp) === '-' ? '' : get(idxEmp);
        const email = get(idxEmail) === '-' ? '' : get(idxEmail);
        const telefono = get(idxTel) === '-' ? '' : get(idxTel);
        const venc = get(idxVenc) === '-' ? '' : get(idxVenc);
        const plan = VALID_PLANS.includes(get(idxPlan)) ? get(idxPlan) : 'Standard';

        const payload = { nombre, empresa: empresa || null, email: email || null, telefono: telefono || null, plan, vencimiento: venc || null };

        try {
          if (id && existingIds.has(id)) {
            await api.updateClient(id, payload);
            updated++;
          } else {
            await api.createClient(payload);
            created++;
          }
        } catch (err) {
          console.error(`[Import] Error en fila ${i + 1}:`, err);
          errors++;
        }
      }

      store.invalidate('clients');

      const parts = [];
      if (created) parts.push(`${created} creado${created > 1 ? 's' : ''}`);
      if (updated) parts.push(`${updated} actualizado${updated > 1 ? 's' : ''}`);
      if (errors) parts.push(`${errors} con error`);
      window.showToast(`Importación completada: ${parts.join(', ')}`, errors ? 'warning' : 'success');
    } catch (err) {
      window.showToast('Error al importar CSV', 'danger');
    }
  };

  // Client Modal controls
  const handleOpenNewClientModal = () => {
    setFormClientId('');
    setClientModalTitle('Nuevo Cliente');
    setFormName('');
    setFormCompany('');
    setFormAbono('');
    setFormEmail('');
    setFormPhone('');
    setFormPlan('Standard');
    setFormVencimiento('');
    setFormVendedorUserId('');
    setFormAdminUser('');
    setFormAdminPass('');
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (c) => {
    setFormClientId(c.id);
    setClientModalTitle('Editar Cliente');
    setFormName(c.nombre);
    setFormCompany(c.empresa || '');
    setFormAbono(c.abono ?? '');
    setFormEmail(c.email || '');
    setFormPhone(c.telefono || '');
    setFormPlan(c.plan || 'Standard');
    setFormVencimiento(c.vencimiento || '');
    setFormVendedorUserId(c.vendedor_user_id || '');
    setFormAdminUser(c.admin_user || '');
    setFormAdminPass(c.admin_pass || '');
    setIsClientModalOpen(true);
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    const clientData = {
      nombre: formName,
      empresa: formCompany || null,
      abono: parseFloat(formAbono) || 0,
      email: formEmail || null,
      telefono: formPhone || null,
      plan: formPlan,
      vencimiento: formVencimiento || null,
      vendedor_user_id: formVendedorUserId || null,
      admin_user: formAdminUser || null,
      admin_pass: formAdminPass || null
    };

    try {
      if (formClientId) {
        await api.updateClient(formClientId, clientData);
        window.showToast('Cliente actualizado', 'success');
      } else {
        await api.createClient(clientData);
        window.showToast('Cliente creado con éxito', 'success');
      }
      setIsClientModalOpen(false);
      store.invalidate('clients');
      if (formClientId && selectedClientId === formClientId) {
        // Refetch detailed client info
        fetchClientDetails(formClientId);
      }
    } catch (err) {
      window.showToast(err?.message || 'Error al guardar cliente', 'danger');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!confirm('¿Deseas eliminar este cliente? Se perderán sus vínculos técnicos.')) return;
    try {
      await api.deleteClient(id);
      window.showToast('Cliente eliminado', 'warning');
      if (selectedClientId === id) {
        setSelectedClientId(null);
      }
      store.invalidate('clients');
    } catch (err) {
      window.showToast('Error al eliminar cliente', 'danger');
    }
  };

  // Linking assistant logic
  const handleLinkAssistant = async (projectId) => {
    if (!selectedClientId) return;
    try {
      await api.linkProjectClient(projectId, selectedClientId);
      window.showToast('Proyecto vinculado', 'success');
      setIsLinkModalOpen(false);
      fetchClientDetails(selectedClientId);
      store.invalidate('clients'); // update lists silently
    } catch (err) {
      window.showToast('Error al vincular proyecto', 'danger');
    }
  };

  const handleUnlinkAssistant = async (projectId) => {
    if (!confirm('¿Desvincular este proyecto?')) return;
    try {
      await api.unlinkProjectClient(projectId);
      window.showToast('Proyecto desvinculado', 'warning');
      fetchClientDetails(selectedClientId);
      store.invalidate('clients');
    } catch (err) {
      window.showToast('Error al desvincular proyecto', 'danger');
    }
  };

  // Redeploy helper
  const handleRedeploy = async (serviceId, environmentId) => {
    if (!confirm('¿Deseas reiniciar este servicio?')) return;
    try {
      await api.redeployService(serviceId, environmentId);
      window.showToast('Reinicio solicitado correctamente', 'success');
    } catch (err) {
      window.showToast('Error al solicitar reinicio', 'danger');
    }
  };

  // System Config visible toggle
  const handleSysConfigToggle = async (projectId, checked) => {
    const newVal = checked ? 'true' : 'false';
    try {
      await api.updateSetting(projectId, 'SYSTEM_CONFIG_VISIBLE', newVal);
      setSysConfigStates(prev => ({ ...prev, [projectId]: checked }));
      window.showToast(`system-config ${checked ? 'activado' : 'desactivado'} - guardado en Supabase`, 'success');
    } catch {
      window.showToast('Error al actualizar configuración', 'danger');
    }
  };

  // Billing modal and functions removed as billing system is eradicated

  // Support Tickets Creation inside client
  const handleOpenTicketModal = () => {
    setTicketTitle('');
    setTicketDesc('');
    setTicketProjectId('');
    setIsTicketModalOpen(true);
  };

  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClientId) return;

    const ticketData = {
      titulo: ticketTitle,
      cliente_id: selectedClientId,
      project_id: ticketProjectId || null,
      descripcion: ticketDesc,
      estado: 'Abierto'
    };

    try {
      await api.createTicket(ticketData);
      window.showToast('Ticket creado correctamente', 'success');
      setIsTicketModalOpen(false);
      fetchClientDetails(selectedClientId);
      store.invalidate('ticketsMeta');
    } catch (err) {
      window.showToast('Error al crear ticket', 'danger');
    }
  };

  const handleOpenChat = (ticketId) => {
    localStorage.setItem('currentChatTicketId', ticketId);
    localStorage.setItem('currentChatTicketBackView', 'clients');
    navigate('ticket-chat');
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!confirm('¿Seguro que querés eliminar este ticket?')) return;
    try {
      await api.deleteTicket(ticketId);
      window.showToast('Ticket eliminado', 'warning');
      fetchClientDetails(selectedClientId);
      store.invalidate('ticketsMeta');
    } catch (err) {
      window.showToast('Error al eliminar ticket', 'danger');
    }
  };

  const getFilteredClients = () => {
    return clients.filter(c => {
      if (search && !(
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (c.empresa && c.empresa.toLowerCase().includes(search.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
      )) return false;

      if (adminFilter) {
        if (adminFilter === 'unassigned' && c.vendedor_user_id !== null) return false;
        if (adminFilter !== 'unassigned' && String(c.vendedor_user_id) !== String(adminFilter)) return false;
      }

      return true;
    });
  };

  const filteredClients = getFilteredClients();

  // Rendering Helper for single client card
  const renderClientItem = (c, index) => {
    const initials = c.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const admin = admins.find(a => a.auth_user_id === c.vendedor_user_id);
    const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';

    let astCount = 0;
    if (c.railway_project_ids && Array.isArray(c.railway_project_ids) && assistants) {
      const projIds = c.railway_project_ids.map(String);
      astCount = assistants.filter(p => projIds.includes(String(p.id))).length;
    }
    const ticketCount = ticketsMeta.filter(t => String(t.cliente_id) === String(c.id)).length;
    const hasCreds = Boolean(c.admin_user || c.admin_pass);

    return (
      <div
        key={c.id}
        className="glass-card p-4 hover-lift clickable flex flex-col justify-between anim-card-enter"
        style={{ '--si': index }}
        onClick={() => {
          localStorage.removeItem('clientBackToAssistants');
          localStorage.removeItem('clientBackToProjects');
          setSelectedClientId(c.id);
        }}
      >
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="grow min-w-0 overflow-hidden">
              <h6 className="font-bold mb-0.5 truncate">{c.nombre}</h6>
              <div className="text-sm text-dim truncate mb-0.5">{c.empresa || 'Particular'}</div>
              <div className="text-sm text-dim truncate mb-1">Abono: ${c.abono ?? 0}/mes</div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`badge ${getPlanBadgeClass(c.plan)}`}>{c.plan || 'Standard'}</span>
                <span className="text-sm text-dim" id={"ast-count-" + c.id}>
                  <i className="bi bi-robot mr-1"></i>{astCount}
                </span>
                <span className={`text-sm ${ticketCount > 0 ? 'text-red-400 font-semibold' : 'text-dim'}`} id={"ticket-count-" + c.id}>
                  <i className="bi bi-ticket-perforated-fill mr-1"></i>
                  <span className="tc-val">{ticketCount}</span>
                </span>
                <span className={`text-sm ${hasCreds ? 'text-green-500 font-bold' : 'text-dim font-bold'}`} title={hasCreds ? 'Con credenciales' : 'Sin credenciales'}>
                  <i className="bi bi-key mr-1"></i>{hasCreds ? '✓' : 'X'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center text-xs text-dim pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <span className="truncate max-w-[200px]" title={adjudicado}>Adjudicado: {adjudicado}</span>
        </div>
      </div>
    );
  };

  // Rendering Helper for linked assistant projects
  const renderClientAssistants = () => {
    const linked = assistants.filter(p => clientProjects.includes(p.id));

    if (linked.length === 0) {
      return (
        <div
          className="link-assistant-card flex flex-col items-center justify-center p-6 rounded cursor-pointer"
          onClick={() => { setLinkSearch(''); setLinkModalTab('menu'); setIsLinkModalOpen(true); }}
        >
          <i className="bi bi-plus-circle fs-3 mb-2 text-dim"></i>
          <div className="font-semibold">Vincular / Crear proyecto</div>
          <div className="text-sm text-dim mt-1">Asociar o desplegar un proyecto para este cliente</div>
        </div>
      );
    }

    const cards = [];
    linked.forEach(p => {
      const services = p.services?.length ? p.services : [null];
      services.forEach((svc, sIdx) => {
        if (!svc) {
          cards.push(
            <div key={`${p.id}-null-${sIdx}`} className="service-card p-4 rounded h-full">
              <div className="font-bold mb-1">{p.name}</div>
              <div className="text-sm text-dim">Sin servicios</div>
            </div>
          );
          return;
        }

        const isSysConfigChecked = sysConfigStates[p.id] === true;

        const openVariables = () => {
          sessionStorage.setItem('varsContext', JSON.stringify({
            projectId: p.id,
            environmentId: svc.environmentId,
            serviceId: svc.id,
            serviceName: svc.name
          }));
          navigate('variables');
        };

        cards.push(
          <div key={svc.id} className="service-card p-4 rounded h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-1">
                <div className="font-bold truncate max-w-[180px]">{svc.name}</div>
                <span className="service-status-icon">
                  <i className={`bi ${getStatusIcon(svc.status)}`}></i>
                </span>
              </div>
              <div className="x-small text-dim mb-4">
                Último deploy: {new Date(svc.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <button
                className="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2"
                onClick={async () => {
                  try {
                    const domains = await api.getServiceDomains(svc.projectId, svc.environmentId, svc.id);
                    let domain = domains?.customDomains?.[0]?.domain || domains?.serviceDomains?.[0]?.domain;
                    if (!domain) { window.showToast('No se encontró URL para este servicio', 'warning'); return; }
                    if (!domain.startsWith('http')) domain = 'https://' + domain;
                    api.openDashboardWindow(domain);
                  } catch { window.showToast('Error al obtener URL del servicio', 'danger'); }
                }}
              >
                <i className="bi bi-box-arrow-up-right mb-1"></i>
                <span style={{ fontSize: '0.65rem' }}>Backoffice</span>
              </button>

              <button
                className="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2"
                onClick={() => api.openDashboardWindow(`https://railway.com/project/${svc.projectId}/logs?environmentId=${svc.environmentId}&timeFrame=30d`)}
              >
                <i className="bi bi-terminal mb-1"></i>
                <span style={{ fontSize: '0.65rem' }}>Logs</span>
              </button>

              <button
                className="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2"
                onClick={openVariables}
              >
                <i className="bi bi-sliders mb-1"></i>
                <span style={{ fontSize: '0.65rem' }}>Variables</span>
              </button>

              <button
                className="btn btn-svc-tile btn-sm w-full flex flex-col items-center py-2"
                onClick={() => handleRedeploy(svc.id, svc.environmentId)}
              >
                <i className="bi bi-arrow-repeat mb-1"></i>
                <span style={{ fontSize: '0.65rem' }}>Redeploy</span>
              </button>
            </div>

            <div className="flex justify-between items-center mt-3 pt-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <button
                className="btn btn-sm btn-link text-danger flex items-center gap-1 p-0"
                onClick={() => handleUnlinkAssistant(p.id)}
              >
                <i className="bi bi-dash-circle"></i>
                <span style={{ fontSize: '0.75rem' }}>Desvincular</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-dim">system-config visible</span>
                <label className="sysconfig-toggle">
                  <input
                    type="checkbox"
                    className="btn-ca-sysconfig"
                    checked={isSysConfigChecked}
                    onChange={(e) => handleSysConfigToggle(p.id, e.target.checked)}
                  />
                  <span className="sysconfig-thumb">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-off"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="12" height="12" className="icon-on"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  </span>
                </label>
              </div>
            </div>
          </div>
        );
      });
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards}
        <div
          className="link-assistant-card flex flex-col items-center justify-center p-4 rounded cursor-pointer"
          style={{ height: '100%', minHeight: '120px' }}
          onClick={() => { setLinkSearch(''); setLinkModalTab('menu'); setIsLinkModalOpen(true); }}
        >
          <i className="bi bi-plus-circle fs-4 mb-1 text-dim"></i>
          <div className="font-semibold text-sm">Vincular / Crear proyecto</div>
        </div>
      </div>
    );
  };

  // Rendering Helper for Client Profile details panel
  const renderClientDetailPanel = () => {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return null;

    const initials = client.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const vencimiento = client.vencimiento ? new Date(client.vencimiento) : null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isExpired = vencimiento && vencimiento < today;
    const admin = admins.find(a => a.auth_user_id === client.vendedor_user_id);
    const adjudicado = admin ? admin.nombre || admin.email : 'Sin Asignar';

    return (
      <div className="anim-slide-right">
        {/* HEADER BACK BUTTON */}
        <div className="mb-6">
          <button className="btn btn-outline-light btn-sm" onClick={() => {
            if (localStorage.getItem('clientBackToProjects') === 'true' || localStorage.getItem('clientBackToAssistants') === 'true') {
              localStorage.removeItem('clientBackToProjects');
              localStorage.removeItem('clientBackToAssistants');
              setSelectedClientId(null);
              localStorage.removeItem('selectedClientId');
              navigate('projects');
            } else {
              setSelectedClientId(null);
            }
          }} title="Volver">
            <i className="bi bi-arrow-left mr-2"></i>Volver
          </button>
        </div>

        {/* PROFILE CARD */}
        <div className="glass-card px-6 py-4 rounded mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="client-avatar shrink-0">{initials}</div>
              <div>
                <div className="font-bold">{client.nombre}</div>
                <span className={`badge ${getPlanBadgeClass(client.plan)}`}>{client.plan || 'Standard'}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-outline-light btn-sm" onClick={() => handleOpenEditClient(client)}>
                <i className="bi bi-pencil mr-1"></i>Editar
              </button>
              <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteClient(client.id)}>
                <i className="bi bi-trash mr-1"></i>Eliminar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <div className="x-small text-dim font-bold mb-1">EMPRESA</div>
              <div className="text-sm">{client.empresa || '-'}</div>
            </div>
            <div>
              <div className="x-small text-dim font-bold mb-1">ABONO MENSUAL</div>
              <div className="text-sm font-bold">${client.abono ?? 0}</div>
            </div>
            <div>
              <div className="x-small text-dim font-bold mb-1">EMAIL</div>
              <div className="text-sm truncate">{client.email || '-'}</div>
            </div>
            <div>
              <div className="x-small text-dim font-bold mb-1">TELEFONO</div>
              <div className="text-sm">{client.telefono || '-'}</div>
            </div>
            <div>
              <div className="x-small text-dim font-bold mb-1">VENCIMIENTO</div>
              <div className={`text-sm ${isExpired ? 'text-red-400 font-bold' : ''}`}>
                {vencimiento ? vencimiento.toLocaleDateString() : '-'}
                {isExpired && <span className="badge badge-status-danger ml-1">VENCIDO</span>}
              </div>
            </div>
            <div className="col-span-2 md:col-span-5 mt-2 pt-2" style={{ borderTop: '1px dashed var(--border-soft)' }}>
              <span className="x-small text-dim font-bold mr-2">ADJUDICADO A:</span>
              <span className="text-sm font-semibold">{adjudicado}</span>
            </div>
          </div>
        </div>

        {/* PROJECTS SECTION */}
        <div className="mb-6">
          <h6 className="text-dim text-sm font-bold mb-4">PROYECTOS VINCULADOS</h6>
          {renderClientAssistants()}
        </div>

        {/* TICKETS SECTION */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h6 className="text-dim text-sm font-bold mb-0">
              TICKETS DEL CLIENTE
              {clientTickets.filter(t => t.estado !== 'Cerrado').length > 0 && (
                <span className="badge badge-status-danger ml-1">
                  {clientTickets.filter(t => t.estado !== 'Cerrado').length}
                </span>
              )}
            </h6>
            <button className="btn btn-outline-light btn-sm" onClick={handleOpenTicketModal}>
              <i className="bi bi-plus-circle mr-2"></i>Nuevo Ticket
            </button>
          </div>

          {/* Desktop ticket table */}
          <div className="glass-card overflow-hidden rounded hidden md:block">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center">Fecha</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientTickets.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-dim py-12">
                        No hay tickets para este cliente
                      </td>
                    </tr>
                  ) : (
                    clientTickets.map(t => {
                      const proj = assistants.find(a => String(a.id) === String(t.project_id));
                      return (
                        <tr key={t.id} className="ticket-row">
                          <td>
                            <div className="font-bold text-sm">#{t.id.substring(0, 8)}</div>
                            <div className="text-sm text-white">{t.titulo}</div>
                            {proj && (
                              <div className="text-xs text-dim mt-0.5">
                                <i className="bi bi-box-arrow-up-right mr-1"></i>
                                Proveniente de {proj.name}
                              </div>
                            )}
                          </td>
                          <td className="text-center">
                            <span className={`status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}`}>
                              {t.estado}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="text-sm text-dim">{new Date(t.created_at).toLocaleDateString()}</div>
                          </td>
                          <td className="text-right">
                            <div className="flex gap-2 justify-end">
                              <button className="btn btn-sm btn-outline-light" onClick={() => handleOpenChat(t.id)}>
                                <i className="bi bi-eye"></i>
                              </button>
                              {t.estado === 'Cerrado' && (
                                <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteTicket(t.id)}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile ticket cards */}
          <div className="md:hidden flex flex-col gap-2">
            {clientTickets.length === 0 ? (
              <div className="text-dim text-center py-6">No hay tickets para este cliente</div>
            ) : (
              clientTickets.map(t => {
                const proj = assistants.find(a => String(a.id) === String(t.project_id));
                const clampStyle = {
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                };
                return (
                  <div
                    key={t.id}
                    className="glass-card no-hover p-4 rounded"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleOpenChat(t.id)}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-dim text-sm">#{t.id.substring(0, 8)}</span>
                        <span className="text-sm text-dim">{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-center">
                        <span className={`status-badge status-${(t.estado || '').toLowerCase().replace(' ', '')}`}>
                          {t.estado}
                        </span>
                      </div>
                      {proj && (
                        <div className="text-xs text-dim text-center mt-1">
                          <i className="bi bi-box-arrow-up-right mr-1"></i>Proveniente de {proj.name}
                        </div>
                      )}
                      <div className="font-bold text-center" style={clampStyle}>{t.titulo}</div>
                      {t.descripcion && (
                        <div className="text-sm text-dim text-center" style={clampStyle}>{t.descripcion}</div>
                      )}
                      {t.estado === 'Cerrado' && (
                        <div className="text-center">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTicket(t.id);
                            }}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <div className="view-header">
          <div className="view-header-left">
            <h2 className="view-header-title">CLIENTES</h2>
          </div>
          <div className="view-header-controls">
            <button className="btn btn-sm btn-outline-light flex items-center gap-2" disabled>
              <span className="spinner-border spinner-border-sm"></span>
              Cargando
            </button>
          </div>
        </div>
        <div className="h-full flex flex-col justify-center items-center py-20 text-dim">
          <span className="spinner-border text-primary mb-3"></span>
          <span>Cargando panel de clientes...</span>
        </div>
      </div>
    );
  }

  // Filter available projects for linking
  const availableProjectsForLink = assistants.filter(p =>
    !clientProjects.includes(p.id) &&
    (!linkSearch || p.name.toLowerCase().includes(linkSearch.toLowerCase()))
  );

  return (
    <div>
      {selectedClientId ? (
        renderClientDetailPanel()
      ) : (
        <div id="clients-grid-panel">
          {/* HEADER */}
          <div className="view-header">
            <div className="view-header-left clients-header-left">
              <h2 className="view-header-title mb-0">CLIENTES</h2>
              <div className="input-group input-group-sm search-input-group mb-0">
                <span className="input-group-text text-dim">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control text-main"
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-select form-select-sm bg-dark border-secondary text-main"
                value={adminFilter}
                onChange={e => setAdminFilter(e.target.value)}
              >
                <option value="" className="bg-dark text-white">Clientes adjudicados</option>
                <option value="unassigned" className="bg-dark text-white">Sin Asignar</option>
                {admins.map(a => (
                  <option key={a.auth_user_id} value={a.auth_user_id} className="bg-dark text-white">
                    {a.nombre || a.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="view-header-controls">
              <div className="flex gap-2 clients-toolbar-btns">
                <button className="btn btn-outline-light btn-sm" onClick={handleExportPaymentsCSV}>
                  <i className="bi bi-cash-coin"></i>
                  <span className="btn-clients-label ml-1">Exportar Pagos</span>
                </button>
                <button className="btn btn-outline-light btn-sm" onClick={handleExportCSV}>
                  <i className="bi bi-file-earmark-excel"></i>
                  <span className="btn-clients-label ml-1">Exportar</span>
                </button>
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={() => document.getElementById('csv-import-input').click()}
                >
                  <i className="bi bi-upload"></i>
                  <span className="btn-clients-label ml-1">Importar</span>
                </button>
                <input
                  type="file"
                  id="csv-import-input"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleImportCSV}
                />
                <button className="btn btn-outline-light btn-sm" onClick={handleOpenNewClientModal}>
                  <i className="bi bi-person-plus"></i>
                  <span className="btn-clients-label ml-1">Nuevo</span>
                </button>
              </div>
            </div>
          </div>

          {/* GRID OF CARDS */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredClients.length === 0 ? (
              <div className="col-span-full text-center text-white/50 py-12">
                No hay clientes registrados.
              </div>
            ) : (
              filteredClients.map((c, idx) => renderClientItem(c, idx))
            )}
          </div>
        </div>
      )}

      {/* MODAL CLIENTE OVERLAY (Create/Edit) */}
      {isClientModalOpen && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content glass-card shadow-lg">
              <div className="modal-header">
                <h5 className="modal-title font-bold">{clientModalTitle}</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setIsClientModalOpen(false)}
                ></button>
              </div>
              <form onSubmit={handleClientSubmit}>
                <div className="modal-body p-6">
                  <div className="grid gap-4">
                    <div>
                      <label className="form-label text-dim text-sm font-bold required">NOMBRE COMPLETO</label>
                      <input
                        type="text"
                        className="form-control text-main"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label text-dim text-sm font-bold">EMPRESA</label>
                      <input
                        type="text"
                        className="form-control text-main"
                        value={formCompany}
                        onChange={(e) => setFormCompany(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label text-dim text-sm font-bold required">ABONO MENSUAL ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control text-main"
                        value={formAbono}
                        onChange={(e) => setFormAbono(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label text-dim text-sm font-bold">EMAIL</label>
                        <input
                          type="email"
                          className="form-control text-main"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label text-dim text-sm font-bold">TELEFONO</label>
                        <input
                          type="text"
                          className="form-control text-main"
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label text-dim text-sm font-bold">PLAN CONTRATADO</label>
                        <select
                          className="form-select border-secondary text-main bg-transparent"
                          value={formPlan}
                          onChange={(e) => setFormPlan(e.target.value)}
                        >
                          <option value="Standard" className="bg-dark text-white">Standard</option>
                          <option value="Premium" className="bg-dark text-white">Premium</option>
                          <option value="Enterprise" className="bg-dark text-white">Enterprise</option>
                          <option value="Baja" className="bg-dark text-white">Baja</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-dim text-sm font-bold">PROX. VENCIMIENTO</label>
                        <input
                          type="date"
                          className="form-control text-main"
                          value={formVencimiento}
                          onChange={(e) => setFormVencimiento(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label text-dim text-sm font-bold">ADJUDICADO A (ADMINISTRADOR)</label>
                      <select
                        className="form-select border-secondary text-main bg-transparent"
                        value={formVendedorUserId}
                        onChange={(e) => setFormVendedorUserId(e.target.value)}
                      >
                        <option value="" className="bg-dark text-white">Sin Asignar</option>
                        {admins.map(adm => (
                          <option key={adm.auth_user_id} value={adm.auth_user_id} className="bg-dark text-white">
                            {adm.nombre || adm.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-dim text-sm font-bold">CREDENCIALES BACKOFFICE</span>
                        <button
                          type="button"
                          className="btn-outline-custom text-xs px-2 py-1 flex items-center gap-1"
                          onClick={() => {
                            const randUser = 'admin_' + Math.random().toString(36).slice(2, 6);
                            const randPass = Math.random().toString(36).slice(2, 12);
                            setFormAdminUser(randUser);
                            setFormAdminPass(randPass);
                          }}
                        >
                          <i className="bi bi-magic"></i> Autogenerar
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label text-dim text-xs font-bold">ADMIN_USER</label>
                          <input
                            type="text"
                            className="form-control text-main"
                            placeholder="Usuario admin"
                            value={formAdminUser}
                            onChange={(e) => setFormAdminUser(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="form-label text-dim text-xs font-bold">ADMIN_PASS</label>
                          <input
                            type="text"
                            className="form-control text-main"
                            placeholder="Contraseña admin"
                            value={formAdminPass}
                            onChange={(e) => setFormAdminPass(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer p-4">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setIsClientModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-sm btn-success">
                    Guardar Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VINCULAR PROYECTO OVERLAY */}
      {isLinkModalOpen && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content glass-card">
              <div className="modal-header">
                <h5 className="modal-title font-bold">
                  {linkModalTab === 'menu' && 'Vincular / Crear Proyecto'}
                  {linkModalTab === 'link' && 'Vincular Proyecto Existente'}
                  {linkModalTab === 'create' && 'Crear Proyecto para el Cliente'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setIsLinkModalOpen(false)}
                ></button>
              </div>
              <div className="modal-body p-6">
                {linkModalTab === 'menu' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div
                      className="glass-card p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-success hover:scale-[1.02]"
                      onClick={() => setLinkModalTab('link')}
                    >
                      <i className="bi bi-link-45deg text-success fs-1 mb-3"></i>
                      <h6 className="font-bold text-lg mb-1">Vincular proyecto</h6>
                      <p className="text-sm text-dim text-center mb-0">
                        Buscar y asignar un proyecto existente de Railway a este cliente.
                      </p>
                    </div>

                    <div
                      className="glass-card p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-info hover:scale-[1.02]"
                      onClick={handleOpenCreateTab}
                    >
                      <i className="bi bi-rocket-takeoff text-info fs-1 mb-3"></i>
                      <h6 className="font-bold text-lg mb-1">Crear proyecto para el cliente</h6>
                      <p className="text-sm text-dim text-center mb-0">
                        Desplegar una nueva instancia en Railway asignada automáticamente a este cliente.
                      </p>
                    </div>
                  </div>
                )}

                {linkModalTab === 'link' && (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <button className="btn btn-sm btn-outline-light" onClick={() => setLinkModalTab('menu')}>
                        <i className="bi bi-arrow-left mr-1"></i>Volver
                      </button>
                    </div>
                    <div className="input-group input-group-sm mb-4">
                      <span className="input-group-text text-dim">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control text-main"
                        placeholder="Buscar proyecto..."
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2 scrollable-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {availableProjectsForLink.length === 0 ? (
                        <div className="text-dim text-sm text-center py-4">No hay proyectos disponibles</div>
                      ) : (
                        availableProjectsForLink.map(p => {
                          const statusColor = getStatusColor(p.status);
                          return (
                            <div key={p.id} className="flex items-center justify-between p-2 glass-card rounded">
                              <div className="flex items-center gap-2">
                                <i className={`bi bi-cpu text-info`}></i>
                                <span className="font-semibold text-sm">{p.name}</span>
                                <span className={`badge badge-status-${statusColor}`}>
                                  {p.status.toUpperCase()}
                                </span>
                              </div>
                              <button
                                className="btn btn-outline-success btn-sm btn-link-assistant"
                                onClick={() => handleLinkAssistant(p.id)}
                              >
                                <i className="bi bi-plus mr-1"></i>Vincular
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}

                {linkModalTab === 'create' && (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <button className="btn btn-sm btn-outline-light" onClick={() => setLinkModalTab('menu')} disabled={deployingTemplate}>
                        <i className="bi bi-arrow-left mr-1"></i>Volver
                      </button>
                    </div>
                    {loadingTemplates ? (
                      <div className="text-center py-12">
                        <div className="spinner-border text-success mb-3" role="status"></div>
                        <div className="text-dim text-sm">Cargando plantillas...</div>
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="text-dim text-sm text-center py-12">No se encontraron plantillas disponibles.</div>
                    ) : (
                      <div className="flex flex-col gap-4 py-2">
                        {templates.map(t => (
                          <div key={t.id} className="glass-card p-6 rounded-xl border border-secondary relative overflow-hidden">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-info/10 border border-info/20 text-info fs-3">
                                  <i className="bi bi-rocket-takeoff-fill"></i>
                                </div>
                                <div>
                                  <h6 className="font-bold text-main text-lg mb-1">{t.name}</h6>
                                  <p className="text-xs text-dim mb-0">Instancia dedicada con API oficial de META</p>
                                </div>
                              </div>
                              <button
                                className="btn btn-success btn-sm px-4 py-2 font-bold rounded-lg flex items-center gap-2"
                                onClick={() => handleConfirmDeployForClient(t.id)}
                                disabled={deployingTemplate}
                              >
                                {deployingTemplate ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>
                                    Desplegando...
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-cloud-upload mr-1"></i>Desplegar y Vincular
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing modal overlay removed */}

      {/* MODAL CREAR TICKET DESDE CLIENTE OVERLAY */}
      {isTicketModalOpen && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content glass-card">
              <div className="modal-header">
                <h5 className="modal-title font-bold">Nuevo Ticket</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setIsTicketModalOpen(false)}
                ></button>
              </div>
              <form onSubmit={handleCreateTicketSubmit}>
                <div className="modal-body p-6">
                  <div className="grid gap-4">
                    <div>
                      <label className="form-label text-sm font-bold">PROYECTO VINCULADO (OPCIONAL)</label>
                      <select
                        className="form-select border-secondary bg-transparent text-main"
                        value={ticketProjectId}
                        onChange={(e) => setTicketProjectId(e.target.value)}
                      >
                        <option value="">-- Seleccionar Proyecto --</option>
                        {assistants
                          .filter(a => clientProjects.includes(a.id))
                          .map(p => (
                            <option key={p.id} value={p.id} className="bg-dark text-white">
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-sm font-bold">TÍTULO DEL PROBLEMA</label>
                      <input
                        type="text"
                        className="form-control text-main"
                        placeholder="Ej: El bot no responde"
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label text-sm font-bold">DESCRIPCIÓN</label>
                      <textarea
                        className="form-control text-main"
                        rows="3"
                        placeholder="Describe el problema aquí..."
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer p-4">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setIsTicketModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success btn-sm">
                    Crear Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
