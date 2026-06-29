const { createClient } = require('@supabase/supabase-js');
const railwayService = require('./railwayService');
const dnsService = require('./dnsService');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured in .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

async function recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad) {
    console.log(`[recalculatePlanSubscriptionsLocal] Running fallback database-only count...`);
    const { count, error: countErr } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("vendedor_id", vendedorId)
        .eq("plan_tipo", planTipo)
        .eq("is_deleted", false);

    if (!countErr && count !== null) {
        await supabase
            .from("mp_planes")
            .update({ suscripciones_activas: count })
            .eq("vendedor_id", vendedorId)
            .eq("plan_tipo", planTipo)
            .eq("lineas_cantidad", lineasCantidad);
        console.log(`[recalculatePlanSubscriptionsLocal] Updated mp_planes with local count: ${count}`);
    }
}

async function recalculatePlanSubscriptions(vendedorId, planTipo, lineasCantidad) {
    try {
        console.log(`[recalculatePlanSubscriptions] Recalculating active subs for seller: ${vendedorId}, planTipo: ${planTipo}, lineasCantidad: ${lineasCantidad}`);
        const { data: planData, error: planErr } = await supabase
            .from("mp_planes")
            .select("mp_plan_id, mp_vendedores(access_token)")
            .eq("vendedor_id", vendedorId)
            .eq("plan_tipo", planTipo)
            .eq("lineas_cantidad", lineasCantidad)
            .single();

        if (planErr || !planData) {
            console.warn(`[recalculatePlanSubscriptions] Could not fetch mp_plan_id from DB:`, planErr?.message || "Plan not found.");
            return await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad);
        }

        const mpPlanId = planData.mp_plan_id;
        const accessToken = planData.mp_vendedores?.access_token;

        if (!mpPlanId || !accessToken) {
            console.warn(`[recalculatePlanSubscriptions] Missing mpPlanId or seller access_token. Falling back to local count.`);
            return await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad);
        }

        console.log(`[recalculatePlanSubscriptions] Querying Mercado Pago API for plan ID ${mpPlanId}...`);
        const mpRes = await fetch(`https://api.mercadopago.com/preapproval/search?preapproval_plan_id=${mpPlanId}&status=authorized`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        if (mpRes.ok) {
            const mpJson = await mpRes.json();
            const activeCount = mpJson.paging?.total ?? 0;
            console.log(`[recalculatePlanSubscriptions] Mercado Pago API reported ${activeCount} active subscriptions.`);

            const { error: updateErr } = await supabase
                .from("mp_planes")
                .update({ suscripciones_activas: activeCount })
                .eq("vendedor_id", vendedorId)
                .eq("plan_tipo", planTipo)
                .eq("lineas_cantidad", lineasCantidad);

            if (updateErr) throw updateErr;
            console.log(`[recalculatePlanSubscriptions] Successfully updated mp_planes via API.`);
        } else {
            const errText = await mpRes.text();
            console.warn(`[recalculatePlanSubscriptions] Mercado Pago API returned status ${mpRes.status}: ${errText}. Falling back to local count.`);
            return await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad);
        }
    } catch (err) {
        console.error(`[recalculatePlanSubscriptions] Error in recalculatePlanSubscriptions:`, err.message);
        await recalculatePlanSubscriptionsLocal(vendedorId, planTipo, lineasCantidad).catch(console.error);
    }
}

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
        
        // Cargar todas las credenciales de la tabla settings en una sola consulta eficiente
        const { data: settingsData } = await supabase
            .from('settings')
            .select('project_id, key, value')
            .in('key', ['ADMIN_USER', 'ADMIN_PASS']);

        const credsMap = {};
        if (settingsData) {
            settingsData.forEach(s => {
                if (!credsMap[s.project_id]) credsMap[s.project_id] = {};
                let val = s.value;
                if (val && val.startsWith('b64:')) {
                    try {
                        val = Buffer.from(val.slice(4), 'base64').toString('utf-8');
                    } catch(e) {}
                }
                credsMap[s.project_id][s.key] = val;
            });
        }

        return data.map(c => {
            if (c.proyectos_railway) {
                c.railway_project_ids = c.proyectos_railway.map(p => p.railway_project_id);
                delete c.proyectos_railway;
            }
            c.vendedor_user_id = c.vendedor_id;

            const clientCreds = credsMap[`client_${c.id}`];
            if (clientCreds) {
                if (!c.admin_user && clientCreds['ADMIN_USER']) c.admin_user = clientCreds['ADMIN_USER'];
                if (!c.admin_pass && clientCreds['ADMIN_PASS']) c.admin_pass = clientCreds['ADMIN_PASS'];
            }

            if (c.railway_project_ids && c.railway_project_ids.length > 0) {
                const firstProjectId = c.railway_project_ids[0];
                const projCreds = credsMap[firstProjectId];
                if (projCreds) {
                    if (!c.admin_user && projCreds['ADMIN_USER']) c.admin_user = projCreds['ADMIN_USER'];
                    if (!c.admin_pass && projCreds['ADMIN_PASS']) c.admin_pass = projCreds['ADMIN_PASS'];
                }
            }

            return c;
        });
    },

    async createClient(clientData) {
        const adminUser = clientData.admin_user;
        const adminPass = clientData.admin_pass;
        delete clientData.admin_user;
        delete clientData.admin_pass;

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

        if (data && data.id) {
            if (adminUser) {
                await this.updateSetting(`client_${data.id}`, 'ADMIN_USER', 'b64:' + Buffer.from(adminUser).toString('base64'));
            }
            if (adminPass) {
                await this.updateSetting(`client_${data.id}`, 'ADMIN_PASS', 'b64:' + Buffer.from(adminPass).toString('base64'));
            }
        }

        return data;
    },

    async updateClient(id, clientData) {
        const adminUser = clientData.admin_user;
        const adminPass = clientData.admin_pass;
        delete clientData.admin_user;
        delete clientData.admin_pass;

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

        // Sync admin credentials with client fallback ID and linked projects
        if (adminUser !== undefined || adminPass !== undefined) {
            try {
                if (adminUser) await this.updateSetting(`client_${id}`, 'ADMIN_USER', 'b64:' + Buffer.from(adminUser).toString('base64'));
                if (adminPass) await this.updateSetting(`client_${id}`, 'ADMIN_PASS', 'b64:' + Buffer.from(adminPass).toString('base64'));

                const { data: links } = await supabase
                    .from('proyectos_railway')
                    .select('railway_project_id')
                    .eq('cliente_id', id);
                if (links && links.length > 0) {
                    for (const link of links) {
                        if (link.railway_project_id) {
                            if (adminUser) {
                                await this.updateSetting(link.railway_project_id, 'ADMIN_USER', 'b64:' + Buffer.from(adminUser).toString('base64'));
                            }
                            if (adminPass) {
                                await this.updateSetting(link.railway_project_id, 'ADMIN_PASS', 'b64:' + Buffer.from(adminPass).toString('base64'));
                            }
                        }
                    }
                }
            } catch (syncErr) {
                console.error('[Creds-Sync] Error syncing credentials on client update:', syncErr.message);
            }
        }

        return data;
    },

    async deleteClient(clientId) {

        try {
            // 0. Consultar cliente para obtener datos de recursos externos (Teardown)
            const { data: cliente, error: fetchErr } = await supabase
                .from("clientes")
                .select("id, auth_user_id, backoffice_activado, mp_preapproval_id, token_backoffice, tokens_backoffice, deployment_url, deployment_urls, plan_tipo, vendedor_id, proyecto_slug, lineas_cantidad")
                .eq("id", clientId)
                .single();

            if (!fetchErr && cliente) {
                console.log(`[Teardown] Iniciando teardown de recursos para cliente ${clientId}...`);

                // 0.1 Cancelar suscripción en Mercado Pago
                if (cliente.mp_preapproval_id) {
                    console.log(`[Teardown] Cancelando preapproval en Mercado Pago: ${cliente.mp_preapproval_id}`);
                    let sellerToken = null;
                    if (cliente.vendedor_id) {
                        const { data: seller } = await supabase
                            .from("mp_vendedores")
                            .select("access_token")
                            .eq("id", cliente.vendedor_id)
                            .single();
                        if (seller) sellerToken = seller.access_token;
                    }
                    if (!sellerToken && cliente.auth_user_id) {
                        const { data: seller } = await supabase
                            .from("mp_vendedores")
                            .select("access_token")
                            .eq("user_id", cliente.auth_user_id)
                            .maybeSingle();
                        if (seller) sellerToken = seller.access_token;
                    }

                    const mainToken = process.env.MP_ACCESS_TOKEN;
                    const mpTokens = [];
                    if (sellerToken) mpTokens.push({ name: "Seller Token", value: sellerToken });
                    if (mainToken) mpTokens.push({ name: "Main Token", value: mainToken });

                    const url = `https://api.mercadopago.com/preapproval/${cliente.mp_preapproval_id}`;
                    let mpCancelled = false;

                    for (const token of mpTokens) {
                        try {
                            console.log(`[Teardown] Probando cancelación con ${token.name}...`);
                            const mpRes = await fetch(url, {
                                method: "PUT",
                                headers: {
                                    "Authorization": `Bearer ${token.value}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ status: "cancelled" })
                            });
                            if (mpRes.ok) {
                                console.log(`[Teardown] ✅ Preapproval ${cliente.mp_preapproval_id} cancelado exitosamente con ${token.name}.`);
                                mpCancelled = true;
                                break;
                            } else {
                                const errTxt = await mpRes.text();
                                console.warn(`[Teardown] ⚠️ MP API falló para ${token.name}:`, errTxt);
                            }
                        } catch (err) {
                            console.error(`[Teardown] ❌ Error con ${token.name}:`, err.message);
                        }
                    }
                }

                // 0.2 Eliminar proyectos de Railway
                const projectIds = new Set();
                if (cliente.token_backoffice) projectIds.add(cliente.token_backoffice);
                if (cliente.tokens_backoffice && cliente.tokens_backoffice.length) {
                    cliente.tokens_backoffice.forEach(tid => {
                        if (tid && tid !== 'none') projectIds.add(tid);
                    });
                }

                // Consultar también la tabla proyectos_railway para capturar los proyectos generados manualmente
                const { data: proys } = await supabase
                    .from('proyectos_railway')
                    .select('railway_project_id')
                    .eq('cliente_id', clientId);
                if (proys && proys.length) {
                    proys.forEach(p => {
                        if (p.railway_project_id) projectIds.add(p.railway_project_id);
                    });
                }

                for (const projectId of projectIds) {
                    try {
                        await railwayService.deleteProject(projectId);
                    } catch (err) {
                        console.error(`[Teardown] Error eliminando proyecto ${projectId}:`, err.message);
                    }
                }

                // 0.3 Eliminar registros DNS en Hostinger
                const slugs = new Set();
                if (cliente.proyecto_slug) {
                    slugs.add(cliente.proyecto_slug);
                    if (cliente.lineas_cantidad > 1) {
                        for (let i = 1; i <= cliente.lineas_cantidad; i++) {
                            slugs.add(`${cliente.proyecto_slug}-linea${i}`);
                        }
                    }
                }

                const dnsFilters = Array.from(slugs).flatMap(slug => [
                    { name: slug, type: "CNAME" },
                    { name: `_railway-verify.${slug}`, type: "TXT" }
                ]);

                if (dnsFilters.length > 0) {
                    try {
                        await dnsService.deleteDnsRecords(dnsFilters);
                    } catch (err) {
                        console.error(`[Teardown] Error eliminando registros DNS:`, err.message);
                    }
                }

                // 0.4 Eliminar datos operativos en Supabase asociados a los projectIds
                if (projectIds.size > 0) {
                    const pids = Array.from(projectIds);
                    console.log(`[Teardown] Limpiando datos operativos en BD para los proyectos:`, pids);
                    await supabase.from("settings").delete().in("project_id", pids);
                    await supabase.from("whatsapp_sessions").delete().in("project_id", pids);
                    await supabase.from("routing_table").delete().in("project_id", pids);
                    await supabase.from("meta_onboarding").delete().in("project_id", pids);
                    await supabase.from("chat_tags").delete().in("project_id", pids);
                    await supabase.from("tags").delete().in("project_id", pids);
                    await supabase.from("messages").delete().in("project_id", pids);
                    await supabase.from("chats").delete().in("project_id", pids);
                }
            }

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

            // 5. Recalcular suscripciones del vendedor
            if (cliente && cliente.vendedor_id && cliente.plan_tipo) {
                await recalculatePlanSubscriptions(cliente.vendedor_id, cliente.plan_tipo, cliente.lineas_cantidad);
            }

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

            // 4. Sync client credentials to this project from client fallback ID
            const { data: clientSettings } = await supabase
                .from('settings')
                .select('key, value')
                .eq('project_id', `client_${clientId}`)
                .in('key', ['ADMIN_USER', 'ADMIN_PASS']);

            if (clientSettings && clientSettings.length > 0) {
                for (const setting of clientSettings) {
                    await this.updateSetting(railwayProjectId, setting.key, setting.value);
                }
            }
        } catch (syncErr) {
            console.error('[Link-Sync] Failed to sync client tokens/credentials on manual link:', syncErr.message);
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
