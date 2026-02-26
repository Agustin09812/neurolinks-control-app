# Propuesta de Evolución: Neurolinks CRM 🚀

Este documento detalla la hoja de ruta técnica y funcional para transformar el actual panel de control de infraestructura en un **CRM Interno** integral para la gestión de clientes y servicios de Neurolinks.

---

## 🎨 1. Modificaciones Visuales (Aesthetics & UX)
El objetivo es pasar de una herramienta técnica a una interfaz de gestión de negocio clara y eficiente.

*   **Nueva Arquitectura de Navegación (Sidebar):**
    *   `🏠 Dashboard`: Vista general con métricas clave (bots activos, errores críticos, facturación del mes).
    *   `👥 Clientes`: Listado maestro de empresas/contactos vinculados a sus servicios.
    *   `🤖 Infraestructura`: Acceso técnico directo a los servicios de Railway (funcionalidad actual).
    *   `⚙️ Configuración`: Gestión de usuarios internos y permisos.
*   **Diseño de Componentes Premium:**
    *   **Cards Informativas:** Implementar tarjetas de estado que resuman la salud del cliente y su bot de un vistazo.
    *   **Tipografía:** Adoptar fuentes modernas como `Inter` o `Outfit` para mejorar la legibilidad profesional.
    *   **Micro-animaciones:** Transiciones suaves entre secciones para una sensación de aplicación fluida y de alto nivel.

---

## ⚙️ 2. Modificaciones Técnicas (Backend & Core)
Fortalecer la base del sistema para soportar datos de negocio y mejorar la seguridad.

*   **Persistencia de Datos Propia:**
    *   Integración de una base de datos (PostgreSQL/Supabase) para almacenar información que Railway no provee: nombres de clientes, contratos, fechas de pago y notas de soporte.
*   **Seguridad y Autenticación:**
    *   **Sistema de Login:** Eliminar el token de Railway hardcodeado. Cada empleado debe acceder con su cuenta.
    *   **Roles (RBAC):** Definir quién puede ver logs técnicos (`Soporte`) y quién solo datos de contacto y cobros (`Comercial`).
*   **Modularización del Código:**
    *   Separar la lógica en servicios independientes (ej: `railwayService.js`, `databaseService.js`) para facilitar el mantenimiento y escalabilidad del CRM.

---

## 🚀 3. Modificaciones Funcionales (Valor de Negocio)
Características diseñadas para optimizar la operación diaria de la empresa.

*   **Vínculo Cliente-Servicio:** Asociación automática de proyectos de Railway con perfiles de clientes específicos para conocer el impacto de cualquier falla técnica.
*   **Alertas Proactivas:**
    *   Notificaciones de escritorio o vía WhatsApp cuando un servicio de un cliente estratégico cambie a estado `error`.
*   **Módulo de Auditoría:** Registro de quién realizó cambios en las variables de entorno o reinició un servidor, mejorando la trazabilidad interna.
*   **Gestión de Planes y Facturación:** Panel para supervisar el estado de los pagos y suscripciones de los clientes directamente asociados a sus bots.
*   **Quick Actions de Soporte:** Botones rápidos para "Reiniciar Bot", "Limpiar Contexto" o "Descargar Reporte" sin necesidad de navegar por menús técnicos complejos.

---

> **Estado de la Propuesta:** En revisión.
> **Próximo Paso sugerido:** Diseño del prototipo de la nueva barra lateral y esquema de base de datos inicial.
