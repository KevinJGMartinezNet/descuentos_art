# Módulo de Descuentos – NetSuite

## Descripción
El **Módulo de Descuentos** es un desarrollo personalizado en NetSuite cuyo objetivo es **gestionar, controlar y automatizar la aplicación de descuentos** en artículos, evitando errores operativos y garantizando que solo se apliquen descuentos vigentes.

Este módulo permite desactivar automáticamente descuentos vencidos, recalcular precios de compra cuando corresponde y mantener la integridad de la información comercial dentro del ERP.

---

## Objetivos del Módulo
- Evitar la aplicación de descuentos vencidos
- Automatizar procesos que antes se realizaban de forma manual
- Reducir errores en precios y condiciones comerciales
- Mejorar el control y la trazabilidad de los descuentos
- Optimizar tiempos operativos del área comercial

---

## Funcionalidades Principales
✔️ Validación de vigencia de descuentos  
✔️ Desactivación automática de descuentos vencidos  
✔️ Recalculo de precios de compra cuando aplica  
✔️ Ejecución programada mediante **Scheduled Script**  
✔️ Envío de notificaciones por correo (opcional)  
✔️ Generación de archivos CSV para auditoría o revisión  

---

## Arquitectura Técnica
- **ERP:** NetSuite
- **Lenguaje:** SuiteScript 2.x
- **Tipo de Script:** Scheduled Script
- **Módulos NetSuite utilizados:**
  - `N/search`
  - `N/record`
  - `N/runtime`
  - `N/email`
  - `N/file`
  - `N/log`

---

## Flujo General del Proceso
1. El script se ejecuta de forma programada
2. Se identifican descuentos con fecha de vigencia vencida
3. Se desactivan los descuentos correspondientes
4. Se recalculan precios de compra si es necesario
5. Se genera un reporte (CSV)
6. Se envía una notificación por correo con el resultado del proceso

---

## Ejecución
El módulo está diseñado para ejecutarse:
- De forma **programada** (diaria/semanal)
- En horarios de baja carga operativa

---

## Reportes y Salidas
- Archivo **CSV** con:
  - Artículos procesados
  - Descuentos desactivados
  - Precios recalculados
- Correo automático con resumen del proceso

---

## Consideraciones
- El script respeta configuraciones de negocio definidas previamente
- Se recomienda probar en **Sandbox** antes de pasar a Producción
- Los permisos del usuario que ejecuta el script deben estar correctamente configurados

---

## Beneficios
- Mayor control comercial
- Menor riesgo financiero
- Automatización de tareas repetitivas
- Información confiable y actualizada
- Escalabilidad para futuras mejoras

---

## Autor
**Kevin Jesús González Martínez**  
Desarrollo NetSuite | SuiteScript | Automatización ERP

---

## Notas Finales
Este módulo puede ampliarse para incluir:
- Descuentos por sucursal
- Descuentos por cliente o grupo
- Integración con reportes financieros

