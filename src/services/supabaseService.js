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
    }
};

module.exports = supabaseService;
