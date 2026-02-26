# 📋 Planificación de Cambios: Neurolinks Control 🚀

Este documento sirve como hoja de ruta operativa para la transformación del panel actual en un CRM integral. Cada tarea debe ser verificada y testeada antes de pasar a la siguiente.

---

## 🏗️ Fase 1: Cimientos y Modularización
*Objetivo: Limpiar el código actual y preparar la estructura para nuevas funcionalidades.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Separar lógica de Railway** (`railwayService.js`) | Alta | ✅ Completado | La app debe listar proyectos igual que ahora usando el nuevo servicio. |
| **Refactorizar estructura de carpetas** (`src/`) | Alta | ✅ Completado | Los archivos están organizados en `main`, `services` y `renderer`. |
| **Integración inicial de Supabase** | Alta | ✅ Completado | Conexión exitosa y esquema de base de datos base creado. |
| **Configuración de variables de entorno** (`.env`) | Media | ✅ Completado | El `RAILWAY_TOKEN` no debe estar hardcodeado en `main.js`. |

---

## 🎨 Fase 2: Rediseño Visual (UX/UI)
*Objetivo: Implementar una interfaz premium y moderna.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Implementar Sidebar Dinámica** | Alta | ⏳ Pendiente | Navegación funcional entre Dashboard, Clientes e Infraestructura. |
| **Sistema de Tipografía (Inter/Outfit)** | Baja | ⏳ Pendiente | Verificación visual de fuentes en toda la aplicación. |
| **Dashboard de Métricas Clave** | Media | ⏳ Pendiente | Visualización de bots activos/error en la pantalla principal. |
| **Micro-animaciones de transición** | Baja | ⏳ Pendiente | Fluidez al cambiar entre secciones de la Sidebar. |

---

## 👥 Fase 3: Gestión de Clientes (CRM Core)
*Objetivo: Vincular la infraestructura técnica con datos reales de clientes.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Esquema de Base de Datos Clientes** | Alta | ✅ Completado | Tabla `clientes` creada y CRUD funcional. |
| **Vínculo Proyecto <-> Cliente** | Alta | ✅ Completado | Tabla `proyectos_railway` vincula Railway con clientes. |
| **Vista Detalle de Cliente** | Media | ✅ Completado | Gestión de clientes desde una nueva ventana (CRM UI). |

---

## ⚡ Fase 4: Funcionalidades Avanzadas
*Objetivo: Automatización y valor agregado.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Alertas de Escritorio (Errores)** | Media | ⏳ Pendiente | Notificación nativa cuando un servicio pasa a estado `error`. |
| **Módulo de Auditoría** | Baja | ⏳ Pendiente | Registro en base de datos de "quién reinició qué servicio". |
| **Acciones Rápidas (Quick Actions)** | Alta | ⏳ Pendiente | Botones directos para "Reiniciar" o "Limpiar" sin entrar a menús. |

---

## 📓 Notas de Progreso
*   **[2026-02-26]**: Creación del plan de trabajo basado en la propuesta inicial.
*   **[2026-02-26]**: Finalización de Fase 1 (Modularización) y gran parte de Fase 3 (CRM Core). Implementado backend con Supabase, IPC handlers, y UI para gestión de clientes y vinculación de proyectos.
*   **Próximo paso sugerido**: Continuar con la **Fase 2: Rediseño Visual (UX/UI)** para unificar la estética del proyecto.
