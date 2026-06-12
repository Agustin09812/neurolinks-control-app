const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase2Url = process.env.SUPABASE2_URL;
const supabase2Key = process.env.SUPABASE2_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
    console.warn('Supabase credentials not configured in .env');
}
if (!supabase2Url || !supabase2Key) {
    console.warn('Supabase2 credentials not configured in .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');
const supabase2 = createClient(supabase2Url || '', supabase2Key || '');

const supabaseService = {
    /**
     * Ejemplo de prueba: Obtener configuración desde una tabla 'config'
     */
    async testConnection() {
        try {
            const { data, error } = await supabase2
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
        const { data, error } = await supabase2
            .from('clientes')
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        return data;
    },

    async createClient(clientData) {
        const { data, error } = await supabase2
            .from('clientes')
            .insert([clientData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateClient(id, clientData) {
        const { data, error } = await supabase2
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
            const { error: relError } = await supabase2
                .from('proyectos_railway')
                .delete()
                .eq('cliente_id', clientId);

            if (relError) throw relError;

            // 2. eliminar tickets
            const { error: ticketError } = await supabase2
                .from('tickets')
                .delete()
                .eq('cliente_id', clientId);

            if (ticketError) throw ticketError;

            // 3. eliminar pagos
            const { error: paymentError } = await supabase2
                .from('pagos')
                .delete()
                .eq('cliente_id', clientId);

            if (paymentError) throw paymentError;

            // 4. eliminar cliente
            const { error } = await supabase2
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
        const { data, error } = await supabase2
            .from('proyectos_railway')
            .upsert({
                railway_project_id: railwayProjectId,
                cliente_id: clientId
            }, { onConflict: 'railway_project_id' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getProjectClient(railwayProjectId) {
        const { data, error } = await supabase2
            .from('proyectos_railway')
            .select('*, clientes(*)')
            .eq('railway_project_id', railwayProjectId)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async getClientProjects(clientId) {
        const { data, error } = await supabase2
            .from('proyectos_railway')
            .select('railway_project_id')
            .eq('cliente_id', clientId);
        if (error) throw error;
        return data.map(item => item.railway_project_id);
    },

    async autoLinkClientProjects() {
        // Read clients that have railway_project_ids populated
        const { data: clients, error } = await supabase2
            .from('clientes')
            .select('id, railway_project_ids')
            .not('railway_project_ids', 'is', null);
        if (error) throw error;

        // Read existing links
        const { data: existing, error: err2 } = await supabase2
            .from('proyectos_railway')
            .select('railway_project_id, cliente_id');
        if (err2) throw err2;

        const linkedSet = new Set(existing.map(r => `${r.railway_project_id}:${r.cliente_id}`));

        const toInsert = [];
        for (const client of clients) {
            const ids = client.railway_project_ids;
            if (!Array.isArray(ids) || ids.length === 0) continue;
            for (const projectId of ids) {
                if (!projectId) continue;
                const key = `${projectId}:${client.id}`;
                if (!linkedSet.has(key)) {
                    toInsert.push({ railway_project_id: projectId, cliente_id: client.id });
                }
            }
        }

        if (toInsert.length === 0) return 0;

        const { error: err3 } = await supabase2
            .from('proyectos_railway')
            .upsert(toInsert, { onConflict: 'railway_project_id' });
        if (err3) throw err3;

        return toInsert.length;
    },

    async unlinkProjectClient(railwayProjectId) {
        const { error } = await supabase2
            .from('proyectos_railway')
            .delete()
            .eq('railway_project_id', railwayProjectId);

        if (error) throw error;

        return true;
    },

    /**
     * Gestión de Tickets
     */
    async getTickets(filters = {}) {
        let query = supabase2
            .from('tickets')
            .select('*, clientes(nombre)');

        if (filters.estado) query = query.eq('estado', filters.estado);
        if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id);

        const { data, error } = await query.order('created_at', { ascending: false });
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
        delete ticketData.tipo;
        delete ticketData.prioridad;
        delete ticketData.chat_id;

        const { data, error } = await supabase2
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
        const { data, error } = await supabase2
            .from('tickets')
            .update(ticketData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
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
        const { error } = await supabase2
            .from('tickets')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    async getPendingTicketsCount() {
        const { count, error } = await supabase2
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .neq('estado', 'Cerrado');
        if (error) throw error;
        return count;
    },

    async getClientPendingTickets(clientId) {
        const { data: projects } = await supabase2
            .from('proyectos_railway')
            .select('railway_project_id')
            .eq('cliente_id', clientId);

        const projectIds = (projects || []).map(p => p.railway_project_id);

        let query = supabase2
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .neq('estado', 'Cerrado');

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

    /**
     * Gestión de Pagos (Billing)
     */
    async getClientPayments(clientId) {
        const { data, error } = await supabase2
            .from('pagos')
            .select('*')
            .eq('cliente_id', clientId)
            .order('fecha', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getAllPayments() {
        const { data, error } = await supabase2
            .from('pagos')
            .select('*, clientes(nombre)')
            .order('fecha', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createPayment(paymentData) {
        const { data, error } = await supabase2
            .from('pagos')
            .insert([paymentData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deletePayment(id) {
        const { error } = await supabase2
            .from('pagos')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    async getSettings(projectId) {
        const { data, error } = await supabase2
            .from('settings')
            .select('key, value')
            .eq('project_id', projectId);
        if (error) throw error;
        return data;
    },

    async updateSetting(projectId, key, value) {
        const { data: updated, error: updateError } = await supabase2
            .from('settings')
            .update({ value })
            .eq('project_id', projectId)
            .eq('key', key)
            .select();
        if (updateError) throw updateError;

        if (!updated || updated.length === 0) {
            const { error: insertError } = await supabase2
                .from('settings')
                .insert({ project_id: projectId, key, value });
            if (insertError) throw insertError;
        }
        return true;
    }
};

module.exports = supabaseService;
