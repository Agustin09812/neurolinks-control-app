const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
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
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        return data;
    },

    async createClient(clientData) {
        const { data, error } = await supabase
            .from('clientes')
            .insert([clientData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateClient(id, clientData) {
        const { data, error } = await supabase
            .from('clientes')
            .update(clientData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteClient(id) {
        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    /**
     * Vinculación de Proyectos
     */
    async linkProjectToClient(railwayProjectId, clientId) {
        const { data, error } = await supabase
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
        const { data, error } = await supabase
            .from('proyectos_railway')
            .select('*, clientes(*)')
            .eq('railway_project_id', railwayProjectId)
            .maybeSingle();
        if (error) throw error;
        return data; // Si existe, data.clientes tiene la info
    },

    async getClientProjects(clientId) {
        const { data, error } = await supabase
            .from('proyectos_railway')
            .select('railway_project_id')
            .eq('cliente_id', clientId);
        if (error) throw error;
        return data.map(item => item.railway_project_id);
    },

    /**
     * Gestión de Tickets
     */
    async getTickets(filters = {}) {
        let query = supabase
            .from('tickets')
            .select('*, clientes(nombre)');

        if (filters.estado) query = query.eq('estado', filters.estado);
        if (filters.tipo) query = query.eq('tipo', filters.tipo);
        if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createTicket(ticketData) {
        const { data, error } = await supabase
            .from('tickets')
            .insert([ticketData])
            .select()
            .single();
        if (error) throw error;
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

    async getWhatsAppSessionStatus(railwayProjectId) {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .select('updated_at, data')
                .eq('project_id', railwayProjectId)
                .maybeSingle();

            if (error) throw error;
            if (!data) return { connected: false, message: 'No session found' };

            // Verificamos si tiene el archivo creds.json (indicativo de sesión activa)
            const hasCreds = data.data && data.data['creds.json'];

            // Consideramos "desconectado" si no tiene creds o si el backup es muy viejo (> 24h)
            // aunque el bot suele actualizar cada 1h si está vivo.
            const lastUpdate = new Date(data.updated_at);
            const isFresh = (Date.now() - lastUpdate.getTime()) < 24 * 60 * 60 * 1000;

            return {
                connected: !!hasCreds && isFresh,
                lastUpdate: data.updated_at
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
            .neq('estado', 'Cerrado');
        if (error) throw error;
        return count;
    },

    async getClientPendingTickets(clientId) {
        const { count, error } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', clientId)
            .neq('estado', 'Cerrado');
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
        const { data, error } = await supabase
            .from('pagos')
            .select('*')
            .eq('cliente_id', clientId)
            .order('fecha', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getAllPayments() {
        const { data, error } = await supabase
            .from('pagos')
            .select('*, clientes(nombre)')
            .order('fecha', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createPayment(paymentData) {
        const { data, error } = await supabase
            .from('pagos')
            .insert([paymentData])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deletePayment(id) {
        const { error } = await supabase
            .from('pagos')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }
};

module.exports = supabaseService;
