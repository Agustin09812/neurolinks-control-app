# 📋 Planificación de Cambios: Neurolinks Control 🚀

Este documento sirve como hoja de ruta operativa para la transformación del panel actual en un CRM integral.

---

## 🏗️ Fase 1: Cimientos y Modularización
*Objetivo: Limpiar el código actual y preparar la estructura para nuevas funcionalidades.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Separar lógica de Railway** (`railwayService.js`) | Alta | ✅ Completado | Lógica centralizada en `src/services/railwayService.js`. |
| **Integración inicial de Supabase** | Alta | ✅ Completado | Conexión activa para Clientes y Tickets. |
| **Configuración de variables de entorno** (`.env`) | Media | ✅ Completado | Credenciales movidas a `.env`. |

---

## 🎨 Fase 2: Rediseño Visual (UX/UI)
*Objetivo: Implementar una interfaz premium y moderna.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Implementar Sidebar Dinámica** | Alta | ✅ Completado | Navegación funcional entre Dashboard, Clientes y Tickets. |
| **Dashboard Maestro (Métricas Globales)** | Alta | ✅ Completado | Pantalla inicial con stats: bots activos, errores y tickets totales. |
| **Sistema de Tipografía (Inter/Outfit)** | Baja | ✅ Completado | Implementado vía Google Fonts y CSS premium. |
| **Micro-animaciones de transición** | Baja | ✅ Completado | Transiciones `animate-fade` implementadas. |

---

## 👥 Fase 3: Gestión de Clientes (CRM Core)
*Objetivo: Vincular la infraestructura técnica con datos reales de clientes.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Esquema de Base de Datos Clientes** | Alta | ✅ Completado | Tablas `clientes`, `tickets` y `proyectos_railway`. |
| **Vínculo Proyecto <-> Cliente** | Alta | ✅ Completado | Diálogo de vinculación funcional y persistente. |
| **Gestión de Planes y Facturación** | Media | ✅ Completado | Campos de `Plan` y `Vencimiento` en clientes con avisos visuales. |

---

## ⚡ Fase 4: Funcionalidades Avanzadas
*Objetivo: Automatización y valor agregado.*

| Tarea | Prioridad | Estado | Test de Verificación |
| :--- | :---: | :---: | :--- |
| **Alertas de Escritorio (Notificaciones)** | Alta | ✅ Completado | Notificación nativa de Windows cuando un bot entra en estado `error`. |
| **Módulo de Auditoría** | Baja | ✅ Completado | Implementado `logAction` en `supabaseService`. |
| **Acciones Rápidas (Quick Actions)** | Alta | ✅ Completado | Dashboard con botones directos y menús contextuales. |

---

## 📓 Notas de Progreso
*   **[2026-02-26]**: Finalización de la integración CRM + Tickets.
*   **Nueva Hoja de Ruta**: Se han priorizado el Dashboard Maestro, las Alertas de Escritorio y el control de Vencimientos/Planes para la siguiente etapa.
base, IPC handlers, y UI para gestión de clientes y vinculación de proyectos.
*   **Próximo paso sugerido**: Continuar con la **Fase 2: Rediseño Visual (UX/UI)** para unificar la estética del proyecto.
