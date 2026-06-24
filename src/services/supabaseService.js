const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured in .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');



const supabaseService = {
    /**
     * Ejemplo de prueba: Obtener configuración desde una tabla 'config'
     */
    async testConnection() {
        try {
            const { data, error } = await supabase
                .from('config')
                .select('*')
                .eq('clave', 'test_connection')
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error connecting to Supabase:', error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Gestión de Clientes (CRM)
     */
    async getClients() {
        const { data, error } = await supabase
            .from('clientes')
            .select('*, proyectos_railway(railway_project_id)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        
        return data.map(c => {
            if (c.proyectos_railway) {
                c.railway_project_ids = c.proyectos_railway.map(p => p.railway_project_id);
                delete c.proyectos_railway;
            }
            c.vendedor_user_id = c.vendedor_id;
            return c;
        });
    },

    async createClient(clientData) {
        if (clientData.vendedor_user_id !== undefined) {
            clientData.vendedor_id = clientData.vendedor_user_id || null;
            delete clientData.vendedor_user_id;
        }
        const { data, error } = await supabase
            .from('clientes')
            .insert([clientData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateClient(id, clientData) {
        if (clientData.vendedor_user_id !== undefined) {
            clientData.vendedor_id = clientData.vendedor_user_id || null;
            delete clientData.vendedor_user_id;
        }
        const { data, error } = await supabase
            .from('clientes')
            .update(clientData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteClient(clientId) {

        try {

            // 1. eliminar vínculos de proyectos
            const { error: relError } = await supabase
                .from('proyectos_railway')
                .delete()
                .eq('cliente_id', clientId);

            if (relError) throw relError;

            // 2. eliminar tickets
            const { error: ticketError } = await supabase
                .from('tickets')
                .delete()
                .eq('cliente_id', clientId);

            if (ticketError) throw ticketError;

            // 3. eliminar pagos
            const { error: paymentError } = await supabase
                .from('pagos')
                .delete()
                .eq('cliente_id', clientId);

            if (paymentError) throw paymentError;

            // 4. eliminar cliente
            const { error } = await supabase
                .from('clientes')
                .delete()
                .eq('id', clientId);

            if (error) throw error;

            return { success: true };

        } catch (err) {
            console.error("deleteClient error:", err);
            throw err;
        }

    },

    /**
     * Vinculación de Proyectos
     */
    async linkProjectToClient(railwayProjectId, clientId) {
        // 1. Upsert relation
        const { data, error } = await supabase
            .from('proyectos_railway')
            .upsert({
                railway_project_id: railwayProjectId,
                cliente_id: clientId
            }, { onConflict: 'railway_project_id' })
            .select()
            .single();
        if (error) throw error;

        // 2. Fetch all current project links for this client to rebuild arrays
        try {
            const { data: links } = await supabase
                .from('proyectos_railway')
                .select('railway_project_id')
                .eq('cliente_id', clientId);

            const projectIds = (links || []).map(l => l.railway_project_id).filter(Boolean);

            // 3. Update client record
            await supabase
                .from('clientes')
                .update({
                    token_backoffice: projectIds[0] || null,
                    tokens_backoffice: projectIds,
                    updated_at: new Date().toISOString()
                })
                .eq('id', clientId);
        } catch (syncErr) {
            console.error('[Link-Sync] Failed to sync client tokens on manual link:', syncErr.message);
        }

        return data;
    },

    async getProjectClient(railwayProjectId) {
        const { data, error } = await supabase
            .from('proyectos_railway')
            .select('*, clientes(*)')
            .eq('railway_project_id', railwayProjectId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async getClientProjects(clientId) {
        const { data, error } = await supabase
            .from('proyectos_railway')
            .select('railway_project_id')
            .eq('cliente_id', clientId);
        if (error) throw error;
        return data.map(item => item.railway_project_id);
    },

    async autoLinkClientProjects() {
        // Read clients that have tokens_backoffice or token_backoffice populated
        const { data: clients, error } = await supabase
            .from('clientes')
            .select('id, tokens_backoffice, token_backoffice');
        if (error) throw error;

        // Read existing links
        const { data: existing, error: err2 } = await supabase
            .from('proyectos_railway')
            .select('railway_project_id, cliente_id');
        if (err2) throw err2;

        const linkedSet = new Set(existing.map(r => `${r.railway_project_id}:${r.cliente_id}`));

        const toInsert = [];
        const seenProjectIds = new Set();
        for (const client of clients) {
            let ids = [];
            if (Array.isArray(client.tokens_backoffice)) {
                ids = client.tokens_backoffice.filter(Boolean);
            } else if (client.token_backoffice) {
                ids = [client.token_backoffice];
            }
            for (const projectId of ids) {
                if (!projectId || projectId === 'none') continue;
                if (seenProjectIds.has(projectId)) continue;
                
                const key = `${projectId}:${client.id}`;
                if (!linkedSet.has(key)) {
                    toInsert.push({ railway_project_id: projectId, cliente_id: client.id });
                    linkedSet.add(key);
                    seenProjectIds.add(projectId);
                }
            }
        }

        if (toInsert.length === 0) return 0;

        const { error: err3 } = await supabase
            .from('proyectos_railway')
            .upsert(toInsert, { onConflict: 'railway_project_id' });
        if (err3) throw err3;

        return toInsert.length;
    },

    async syncClientsBackofficeTokens() {
        try {
            // 1. Fetch all projects linked in proyectos_railway
            const { data: links, error: err1 } = await supabase
                .from('proyectos_railway')
                .select('railway_project_id, cliente_id');
            if (err1) throw err1;

            // Group project IDs by client ID
            const clientProjectMap = new Map();
            for (const link of links) {
                if (!link.cliente_id || !link.railway_project_id) continue;
                if (!clientProjectMap.has(link.cliente_id)) {
                    clientProjectMap.set(link.cliente_id, []);
                }
                clientProjectMap.get(link.cliente_id).push(link.railway_project_id);
            }

            // 2. Fetch all clients
            const { data: clients, error: err2 } = await supabase
                .from('clientes')
                .select('id, tokens_backoffice, token_backoffice');
            if (err2) throw err2;

            let updatedCount = 0;
            for (const client of clients) {
                const linkedProjects = clientProjectMap.get(client.id) || [];
                const currentTokens = Array.isArray(client.tokens_backoffice) ? client.tokens_backoffice.filter(Boolean) : [];
                
                // Check if they are out of sync
                const needsSync = 
                    linkedProjects.length > 0 && (
                        currentTokens.length !== linkedProjects.length ||
                        !linkedProjects.every(p => currentTokens.includes(p)) ||
                        client.token_backoffice !== linkedProjects[0]
                    );

                if (needsSync) {
                    console.log(`[Sync] Client ${client.id} is out of sync. Updating tokens_backoffice with:`, linkedProjects);
                    const { error: errUpdate } = await supabase
                        .from('clientes')
                        .update({
                            token_backoffice: linkedProjects[0],
                            tokens_backoffice: linkedProjects,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', client.id);
                    
                    if (errUpdate) {
                        console.error(`[Sync] Failed to update client ${client.id}:`, errUpdate.message);
                    } else {
                        updatedCount++;
                    }
                }
            }

            return updatedCount;
        } catch (err) {
            console.error('[Sync] Error syncing backoffice tokens:', err.message);
            throw err;
        }
    },

    async validateAdminLogin(username, password) {
        try {
            const { data, error } = await supabase
                .from('admins_account')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .maybeSingle();

            if (error) {
                console.warn("[Login] Table admins_account might not exist yet:", error.message);
                return false;
            }
            return !!data;
        } catch (err) {
            console.error("validateAdminLogin error:", err.message);
            return false;
        }
    },

    async unlinkProjectClient(railwayProjectId) {
        // 1. Find the client ID associated with this project before deleting the link
        let clientId = null;
        try {
            const { data: link } = await supabase
                .from('proyectos_railway')
                .select('cliente_id')
                .eq('railway_project_id', railwayProjectId)
                .maybeSingle();
            clientId = link?.cliente_id;
        } catch (findErr) {
            console.error('[Unlink-Sync] Failed to find client before deletion:', findErr.message);
        }

        // 2. Delete relation
        const { error } = await supabase
            .from('proyectos_railway')
            .delete()
            .eq('railway_project_id', railwayProjectId);

        if (error) throw error;

        // 3. If there was an associated client, update their record
        if (clientId) {
            try {
                const { data: links } = await supabase
                    .from('proyectos_railway')
                    .select('railway_project_id')
                    .eq('cliente_id', clientId);

                const projectIds = (links || []).map(l => l.railway_project_id).filter(Boolean);

                await supabase
                    .from('clientes')
                    .update({
                        token_backoffice: projectIds[0] || null,
                        tokens_backoffice: projectIds,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', clientId);
            } catch (syncErr) {
                console.error('[Unlink-Sync] Failed to sync client tokens on manual unlink:', syncErr.message);
            }
        }

        return true;
    },

    /**
     * Gestión de Tickets
     */

    // Lista ligera para SmartRefresh y vistas de listado: SIN chats_adjuntos
    async getTickets(filters = {}) {
        const page  = parseInt(filters.page)  || 1;
        const limit = parseInt(filters.limit) || 25;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;

        let query = supabase
            .from('tickets')
            .select('id, cliente_id, project_id, titulo, descripcion, estado, tipo, created_at, updated_at, read_admin_count, chat_id, clientes(nombre)', { count: 'exact' })
            .eq('tipo', 'Soporte');

        if (filters.estado)     query = query.eq('estado', filters.estado);
        if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id);

        const { data, error, count } = await query
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { data, total: count, page, limit };
    },

    // Solo metadatos: para SmartRefresh (sin chats, sin descripcion pesada)
    async getTicketsMeta() {
        const { data, error } = await supabase
            .from('tickets')
            .select('id, cliente_id, project_id, estado, updated_at, read_admin_count, chats_adjuntos, clientes(nombre)')
            .eq('tipo', 'Soporte')
            .neq('estado', 'Cerrado')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // Ticket completo con chats_adjuntos: solo se llama al abrir el chat
    async getTicketById(id) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, clientes(nombre)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },


    async createTicket(ticketData) {
        const estadoMap = { "abierto": "Abierto", "cerrado": "Cerrado" };
        if (ticketData.estado) {
            ticketData.estado = estadoMap[ticketData.estado.toLowerCase().trim()] || "Abierto";
        } else {
            ticketData.estado = "Abierto";
        }
        ticketData.tipo = "Soporte";
        delete ticketData.prioridad;
        delete ticketData.chat_id;

        const { data, error } = await supabase
            .from('tickets')
            .insert([ticketData])
            .select()
            .single();

        if (error) {
            console.error("Error creating ticket:", error);
            throw error;
        }

        return data;
    },

    async updateTicket(id, ticketData) {
        const { data, error } = await supabase
            .from('tickets')
            .update(ticketData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async addTicketMessage(id, messageObj) {
        const { data: ticket, error: errFetch } = await supabase
            .from('tickets')
            .select('chats_adjuntos')
            .eq('id', id)
            .single();
        if (errFetch) throw errFetch;

        let chats = [];
        if (ticket.chats_adjuntos) {
            if (typeof ticket.chats_adjuntos === 'string') {
                try { chats = JSON.parse(ticket.chats_adjuntos); } catch(e) {}
            } else if (Array.isArray(ticket.chats_adjuntos)) {
                chats = ticket.chats_adjuntos;
            }
        }

        chats.push(messageObj);

        const { data, error } = await supabase
            .from('tickets')
            .update({ chats_adjuntos: chats })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        return data;
    },

    async deleteTicket(id) {
        const { error } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    async getWhatsAppSessionStatus(railwayProjectId) {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .select('updated_at, data')
                .eq('project_id', railwayProjectId)
                .eq('key_id', 'full_backup') // Always target the unified backup
                .order('updated_at', { ascending: false }) // Take the latest one
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (!data) return { connected: false, message: 'No session found' };

            // Verificamos el contenido de data (puede venir como objeto o string)
            let sessionData = data.data;
            if (typeof sessionData === 'string') {
                try {
                    sessionData = JSON.parse(sessionData);
                } catch (e) {
                    console.error('Error parsing session data string:', e);
                }
            }

            const hasCreds = sessionData && sessionData['creds.json'];

            // Consideramos "desconectado" si no tiene creds o si el backup es muy viejo (> 24h)
            const lastUpdate = new Date(data.updated_at);
            const diffMs = Date.now() - lastUpdate.getTime();
            const isFresh = diffMs < 24 * 60 * 60 * 1000;

            return {
                connected: !!hasCreds && isFresh,
                lastUpdate: data.updated_at,
                message: !hasCreds ? 'Faltan credenciales' : (!isFresh ? 'Sesión expirada' : 'OK')
            };
        } catch (error) {
            console.error('Error getting WhatsApp status:', error.message);
            return { connected: false, error: error.message };
        }
    },

    async deleteTicket(id) {
        const { error } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    async getPendingTicketsCount() {
        const { count, error } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'Abierto')
            .eq('tipo', 'Soporte');
        if (error) throw error;
        return count;
    },

    async getClientPendingTickets(clientId) {
        const { data: projects } = await supabase
            .from('proyectos_railway')
            .select('railway_project_id')
            .eq('cliente_id', clientId);

        const projectIds = (projects || []).map(p => p.railway_project_id);

        let query = supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'Abierto')
            .eq('tipo', 'Soporte');

        if (projectIds.length > 0) {
            query = query.or(`cliente_id.eq.${clientId},project_id.in.(${projectIds.join(',')})`);
        } else {
            query = query.eq('cliente_id', clientId);
        }

        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
    },

    /**
     * Auditoría
     */
    async logAction(action, details, entityType, entityId) {
        const { error } = await supabase
            .from('auditoria_acciones')
            .insert([{
                accion: action,
                detalles: details,
                entidad_tipo: entityType,
                entidad_id: entityId
            }]);
        if (error) console.error('Error logging action:', error);
    },

    async getRecentAutoRedeployCount(serviceId) {
        try {
            // Buscamos intentos en los últimos 30 minutos para no saturar
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000).toISOString();
            const { count, error } = await supabase
                .from('auditoria_acciones')
                .select('*', { count: 'exact', head: true })
                .eq('entidad_id', serviceId)
                .eq('accion', 'Auto-Redeploy')
                .gte('created_at', thirtyMinutesAgo);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error checking recent redeploys:', error.message);
            return 99; // Por seguridad, si falla la base de datos, no reintentamos
        }
    },

    async getAuditLogs() {
        const { data, error } = await supabase
            .from('auditoria_acciones')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        return data;
    },

    async getAdmins() {
        const { data, error } = await supabase
            .from('admins_account')
            .select('id, username')
            .order('id', { ascending: true });
        if (error) throw error;
        return data.map(admin => ({
            auth_user_id: admin.id,
            nombre: admin.username,
            email: ''
        }));
    },

    async getSettings(projectId) {
        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .eq('project_id', projectId);
        if (error) throw error;
        return data;
    },

    async updateSetting(projectId, key, value) {
        const { data: updated, error: updateError } = await supabase
            .from('settings')
            .update({ value })
            .eq('project_id', projectId)
            .eq('key', key)
            .select();
        if (updateError) throw updateError;

        if (!updated || updated.length === 0) {
            const { error: insertError } = await supabase
                .from('settings')
                .insert({ project_id: projectId, key, value });
            if (insertError) throw insertError;
        }
        return true;
    },

    /**
     * System Logs
     */
    async getSystemLogs(limit = 100) {
        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    }
};

module.exports = supabaseService;
