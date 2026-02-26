const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
const RAILWAY_API = process.env.RAILWAY_API || "https://backboard.railway.com/graphql/v2";

/**
 * Función genérica para realizar peticiones a la API de Railway
 */
async function railwayQuery(query, variables = {}) {
  try {
    const response = await fetch(RAILWAY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RAILWAY_TOKEN}`
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
        const defaultEnvironment = project.environments?.edges[0]?.node?.id || null;

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
          environmentId: defaultEnvironment
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
        status: projectStatus
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
    const result = await railwayQuery(query, { deploymentId, limit: 500 });
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
    return await railwayQuery(query, {
      input: {
        projectId,
        environmentId,
        serviceId,
        name,
        skipDeploys: true
      }
    });
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
  }
};

module.exports = railwayService;
