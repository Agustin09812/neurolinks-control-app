const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
const RAILWAY_TOKEN_TEMPLATE = process.env.RAILWAY_TOKEN_TEMPLATE || RAILWAY_TOKEN;
const RAILWAY_TEMPLATE_WORKSPACE_ID = process.env.RAILWAY_TEMPLATE_WORKSPACE_ID;
const RAILWAY_API = process.env.RAILWAY_API || "https://backboard.railway.com/graphql/v2";

/**
 * Función genérica para realizar peticiones a la API de Railway
 */
async function railwayQuery(query, variables = {}, customToken = null) {
  try {
    const token = customToken || RAILWAY_TOKEN;
    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ query, variables })
    });
    return await response.json();
  } catch (error) {
    console.error("Error en railwayQuery:", error);
    throw error;
  }
}

const railwayService = {
  async getAssistants() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              createdAt
              environments {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
              services {
                edges {
                  node {
                    id
                    name
                    deployments(first: 1) {
                      edges {
                        node {
                          id
                          status
                          createdAt
                        }
                      }
                    }
                    serviceInstances {
                      edges {
                        node {
                          environmentId
                          isUpdatable
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await railwayQuery(query);

    if (!result.data?.projects) {
      console.error("Respuesta inválida de Railway:", result);
      return [];
    }

    const projects = result.data.projects.edges.map(edge => edge.node);

    return projects.map(project => {
      const services = (project.services?.edges || []).map(serviceEdge => {
        const service = serviceEdge.node;
        const deployment = service.deployments?.edges[0]?.node;
        const deployStatus = deployment?.status || "UNKNOWN";
        const createdAt = deployment?.createdAt || null;
        const defaultEnvironmentIdx = project.environments?.edges.findIndex(e => e.node.name === "production") || 0;
        const defaultEnvironment = project.environments?.edges[defaultEnvironmentIdx > -1 ? defaultEnvironmentIdx : 0]?.node?.id || null;

        // Find if this service has an update available in the default environment
        const instances = service.serviceInstances?.edges || [];
        const currentInstance = instances.find(edge => edge.node.environmentId === defaultEnvironment);
        const isUpdatable = currentInstance?.node?.isUpdatable || false;

        let status = "offline";
        if (deployStatus === "SUCCESS") status = "online";
        else if (deployStatus === "FAILED" || deployStatus === "CRASHED") status = "error";
        else if (deployStatus === "BUILDING" || deployStatus === "DEPLOYING") status = "checking";

        return {
          id: service.id,
          name: service.name,
          railwayStatus: deployStatus,
          status,
          createdAt,
          deploymentId: deployment?.id || null,
          projectId: project.id,
          environmentId: defaultEnvironment,
          isUpdatable
        };
      });

      const hasError = services.some(s => s.status === "error");
      const hasBuilding = services.some(s => s.status === "checking");
      const hasOnline = services.some(s => s.status === "online");

      let projectStatus = "offline";
      if (hasError) projectStatus = "error";
      else if (hasBuilding) projectStatus = "checking";
      else if (hasOnline) projectStatus = "online";

      return {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        services: services || [],
        railwayUrl: `https://railway.com/project/${project.id}`,
        status: projectStatus,
        isUpdatable: services.some(s => s.isUpdatable)
      };
    });
  },

  async redeployService(serviceId, environmentId) {
    const query = `
      mutation serviceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `;
    return await railwayQuery(query, { serviceId, environmentId });
  },

  async deployServiceUpdate(serviceId, environmentId) {

    const query = `
    mutation serviceInstanceDeployV2($input: ServiceInstanceDeployV2Input!) {
      serviceInstanceDeployV2(input: $input)
    }
  `;

    const variables = {
      input: {
        serviceId,
        environmentId
      }
    };

    const res = await railwayQuery(query, variables);

    if (res.errors) {
      console.error(res.errors);
      throw new Error(res.errors[0].message);
    }

    return res.data;
  },

  async deleteService(serviceId) {
    const query = `
      mutation serviceDelete($id: String!) {
        serviceDelete(id: $id)
      }
    `;
    return await railwayQuery(query, { id: serviceId });
  },

  async updateProjectName(projectId, newName) {
    const query = `
      mutation projectUpdate($id: String!, $input: ProjectUpdateInput!) {
        projectUpdate(id: $id, input: $input) {
          id
          name
        }
      }
    `;
    return await railwayQuery(query, { id: projectId, input: { name: newName } });
  },

  async deleteProject(projectId) {
    const query = `
      mutation projectDelete($id: String!) {
        projectDelete(id: $id)
      }
    `;
    return await railwayQuery(query, { id: projectId });
  },

  async fetchDeploymentLogs(deploymentId) {
    const query = `
      query deploymentLogs($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          timestamp
          message
          severity
        }
      }
    `;
    const result = await railwayQuery(query, { deploymentId, limit: 1000 });
    return result.data?.deploymentLogs || [];
  },

  async getServiceVariables(projectId, environmentId, serviceId) {
    const query = `
      query variables($projectId: String!, $environmentId: String!, $serviceId: String) {
        variables(
          projectId: $projectId
          environmentId: $environmentId
          serviceId: $serviceId
        )
      }
    `;
    const result = await railwayQuery(query, { projectId, environmentId, serviceId });
    return result.data?.variables || {};
  },

  async upsertVariable(projectId, environmentId, serviceId, name, value) {
    const query = `
      mutation variableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input)
      }
    `;
    return await railwayQuery(query, {
      input: {
        projectId,
        environmentId,
        serviceId,
        name,
        value,
        skipDeploys: true
      }
    });
  },

  async deleteVariable(projectId, environmentId, serviceId, name) {
    const query = `
    mutation variableDelete($input: VariableDeleteInput!) {
      variableDelete(input: $input)
    }
  `;

    const result = await railwayQuery(query, {
      input: {
        projectId,
        environmentId,
        serviceId,
        name
      }
    });

    // 🔥 IMPORTANTE: manejar errores
    if (result.errors) {
      console.error("Error eliminando variable:", result.errors);
      throw new Error(result.errors[0].message);
    }

    return result.data;
  },

  async getServiceDomains(projectId, environmentId, serviceId) {
    const query = `
      query domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
        domains(
          projectId: $projectId
          environmentId: $environmentId
          serviceId: $serviceId
        ) {
          serviceDomains {
            id
            domain
          }
          customDomains {
            id
            domain
          }
        }
      }
    `;
    const result = await railwayQuery(query, { projectId, environmentId, serviceId });
    return result.data?.domains || null;
  },

  async searchTemplates(queryText) {
    try {
      if (!RAILWAY_TEMPLATE_WORKSPACE_ID) {
        console.warn("RAILWAY_TEMPLATE_WORKSPACE_ID no está definido en .env");
        return [];
      }

      // Obtenemos los templates asociados al Workspace del usuario
      const query = `
        query workspaceTemplates($workspaceId: String!) {
          workspaceTemplates(workspaceId: $workspaceId) {
            edges {
              node {
                id
                name
                description
                category
              }
            }
          }
        }
      `;

      const result = await railwayQuery(query, { workspaceId: RAILWAY_TEMPLATE_WORKSPACE_ID }, RAILWAY_TOKEN_TEMPLATE);
      const allTemplates = result.data?.workspaceTemplates?.edges.map(e => e.node) || [];

      // Ya no necesitamos filtrar por palabras clave porque estamos pidiendo solo los templates de este workspace
      let filtered = allTemplates;

      // Si se especificó una búsqueda adicional por el usuario, filtramos sobre lo encontrado
      if (queryText && queryText.trim()) {
        const lowerQuery = queryText.toLowerCase();
        filtered = filtered.filter(t =>
          (t.name && t.name.toLowerCase().includes(lowerQuery)) ||
          (t.description && t.description.toLowerCase().includes(lowerQuery))
        );
      }

      return filtered;
    } catch (error) {
      console.error("Error en searchTemplates (workspace-list):", error);
      return [];
    }
  },

  async searchGlobalTemplates(queryText) {
    const query = `
      query templates($query: String, $first: Int) {
        templates(query: $query, first: $first) {
          edges {
            node {
              id
              name
              description
              category
              config
            }
          }
        }
      }
    `;
    const result = await railwayQuery(query, { query: queryText || "", first: 20 }, RAILWAY_TOKEN_TEMPLATE);
    return result.data?.templates?.edges.map(e => e.node) || [];
  },

  async deployTemplate(templateId) {
    try {
      // 1. Primero obtenemos la configuración serializada del template
      const getConfigQuery = `
        query template($id: String!) {
          template(id: $id) {
            id
            name
            serializedConfig
          }
        }
      `;
      const configRes = await railwayQuery(getConfigQuery, { id: templateId }, RAILWAY_TOKEN_TEMPLATE);
      const template = configRes.data?.template;

      if (!template || !template.serializedConfig) {
        throw new Error("No se pudo obtener la configuración del template.");
      }

      // 2. Ejecutamos la mutación de despliegue V2
      // El campo serializedConfig devuelto por el query suele ser el objeto que espera la mutación
      const deployMutation = `
        mutation templateDeployV2($input: TemplateDeployV2Input!) {
          templateDeployV2(input: $input) {
            projectId
          }
        }
      `;

      const variables = {
        input: {
          templateId: template.id,
          serializedConfig: template.serializedConfig
        }
      };

      // Se usa el token principal (RAILWAY_TOKEN) para que el despliegue se realice en la cuenta/workspace original
      const result = await railwayQuery(deployMutation, variables);

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return {
        success: true,
        projectId: result.data?.templateDeployV2?.projectId,
        templateName: template.name
      };
    } catch (error) {
      console.error("Error en deployTemplate:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = railwayService;
