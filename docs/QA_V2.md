# QA V2 — cuentas, cafés, cierres y pago simulado

26 septiembre 2026. **Draft local integrado y revisado.** Los siguientes resultados fueron verificados; no equivalen a autorización de operación real o publicación.

Alcance: cuatro locales/cinco estaciones, Cafeteria sin cobro adicional, menús de café separados, cuentas demo, permisos, colas compartidas, cierre de servicio y confirmación de pago retail ficticio. No conexión POS/SSO, cobro real, publicación ni envío al concurso.

## Defectos detectados durante integración

- Referencias iniciales erróneas de edificios/nombre de cafés: corregidas contra investigación oficial antes de la prueba de pedidos.
- Login a través del proxy de desarrollo rechazaba Origin 5173: detectado en navegador y enviado al agente para corrección con allowlist local exacta y prueba de origen externo rechazado.
- Etiqueta de local abierto pero sin última franja disponible decía pausado: solicitado distinguir cierre de reservas de pausa operativa.

## Comandos finales

- `npm test`: **44/44 PASS**, 0 fallos, ejecución final del agente backend (~15s). Incluye las37 verificadas previamente por el coordinador, tres del launcher LAN y cuatro de la configuración HTTPS.
- `npm run build`: **PASS**, incluye TypeScript. JS360.06kB/gzip109.78kB, CSS66.46kB. Build posterior a los últimos cambios de código.
- Smoke de build en servidor efímero con DB en memoria: **PASS**, siete rutas SPA (`/`, `/login`, `/locations/cafeteria`, ambos cafés, `/my-orders`, `/kitchen`), JS, service worker, API staff sin sesión401 y API desconocida404.
- Suite cubre las19 pruebas originales adaptadas, más cuentas/sesiones/roles/propiedad, origen, ID ligado a sesión, aprobación de pago, cafés, cierres/DST, reloj, migración y simulador de cola.
- Revisor independiente ejecutó carreras pago aprobado vs rechazado, aprobado vs cancelado y cancelado vs aprobado: un éxito/un conflicto en cada par, sin pedido cancelado con pago aprobado.

## Navegador

Resultados del coordinador hasta esta fase:

- D10001 no puede entrar a cocina: vista de acceso restringido. Manager inicia sesión desde IAB y D10001 desde Chrome. Login por Vite funciona tras corregir Origin.
- Frothy aparece cerrado en horario real del sábado después de las 16:00. Manager selecciona Lunch: la pantalla del estudiante actualiza horario y franjas sin recarga manual.
- Frothy latte Iced + Oat milk: enviar sin consentimiento se rechaza en UI; al autorizar se crea ticket 130956 para D10001, 12:10–12:20. Staff recibe opciones exactas y ID vinculado. Preparar está deshabilitado hasta confirmar el pago ficticio. Confirmar → Preparing → Ready actualiza automáticamente el ticket en Chrome. No se pidió permiso de notificación.
- Salir y entrar como D10002 desde la misma URL de ticket130956: no aparecen sus datos y la API devuelve ticket no encontrado. La pantalla privada anterior se desmonta.
- Starbucks tiene catálogo propio y dirección Bud Robinson Building. Después del cutoff simulado no ofrece franjas; con preset15:45 muestra únicamente15:50–16:00, ninguna posterior al cierre.
- D10002 crea ticket654662, combo bakery/tea y exchange ficticio, en última franja. Staff ve ID D10002, consentimiento y método. Rechazar pago bloquea preparación; estudiante ve Payment not confirmed y cancela. Pantalla final confirma cancelación y que ya no hay acción de pago pendiente.
- Simulate3orders en Hub crea755348,393481,645152 como Rush simulation / QUEUE-DEMO. No son pedidos de D10001 ni D10002. Nuevo pedido de D10002,527099 (tenders+BBQ), muestra3digitalordersahead; recoger755348 reduce automáticamente a2. Las tres reservas consumieron cupos: primera ventana pasó de7 a4 espacios online, antes del pedido del estudiante.
- Ticket527099 muestra el seguimiento de cinco pasos, espera de pago y luego Payment received(demo) al confirmar el empleado; la cancelación desaparece tras aprobado. Captura móvil revisada con timeline vertical y posición2delante.
- Café aceptado130956 permaneció Ready/aprobado al pasar el reloj por cierre y al reiniciar API durante desarrollo: no fue cancelado ni reembolsado silenciosamente.
- Pantallas revisadas visualmente: ticket Ready en escritorio, Starbucks390×844, panel compartido768×1024. Sin overflow horizontal en esos tamaños (scrollWidth igual innerWidth). Se usan cuentas ficticias en Chrome (estudiante) y Codex IAB (personal), en la misma Mac; no son dos dispositivos físicos. Permisos del sistema de notificaciones no se modifican.

## Límites del resultado

Credenciales demo son públicas; no certifican identidad real. Horarios excepcionales y menú/precios/eligibilidad reales siguen pendientes. Autenticación institucional, capacidad de cobro remoto por ID en POS, conciliación y devoluciones no están conectadas. Las pruebas V1 están archivadas en QA_DRAFT.md y no se cuentan como verificación de cambios V2.


## Revisión de código e incidencias resueltas

Revisor independiente encontró y verificó tres correcciones frontend: conservar recovery en401/403/429, ignorar401 atrasados de una sesión anterior, y no solicitar pago de un pedido ya cancelado. Revisión del coordinador detectó Origin del proxy y etiquetas de cutoff. Preset Near closing se movió de15:48 a15:45 para dejar tiempo de probar la última ventana; no se cambió la regla de anticipación de dos minutos.

El backend valida estado y permisos dentro de transacciones. El simulador usa una cuenta interna cuyo login se rechaza, conserva el resultado idempotente incluso si creó0tickets y respeta cupos/stock/cierre. Pruebas verifican reintentos concurrentes y persistencia tras reabrir DB.

## Estado local

Servidor de desarrollo sigue en loopback, con datos ficticios de QA preservados. No se hizo push, commit, despliegue, túnel, cobro, envío al concurso ni contacto externo. Las sesiones de estudiante y manager se probaron en navegadores separados. Los controles de navegador se probaron también mediante teclado.

No se probó una caída real de red, sistema POS, SSO, dispositivo físico adicional, impresora, HTTPS público ni entrega de notificación del sistema. Recovery se cubrió mediante validación de código y pruebas de idempotencia; V1 conserva una prueba anterior de metadata pendiente. No se afirma cobertura de100% ni ausencia absoluta de errores.

## Celular/iPad y preparación de conexión

- El coordinador verificó en dos navegadores independientes el ticket527099: cocina Standby/aprobado → Start preparing → Mark ready; la vista móvil390×844 mostró automáticamente el aviso fijo Ready for pickup con527099/The Hub. No se pulsó permiso de notificación. Captura guardada en artifacts/ready-mobile-v2.png (archivo local ignorado por Git).
- Revisor independiente no encontró nuevos defectos concretos en el flujo de TicketPage/LoginPage/Kitchen; no sustituye la prueba física en iPhone/iPad.
- Launcher LAN probado en servidor efímero loopback: sirve build/API, admite Host/Origin de LAN iguales, filtra IPs privadas y falla antes de abrir servidor si falta build. No se abrió un puerto LAN real.
- PUBLIC_ORIGIN opcional preparado para futuro proxyHTTPS: origen exacto, cookiesSecure, rechazo de origen ausente/externo y headersreenviados falsificados, configuración inválida rechazada antes de SQLite. No se probó ningún túnel público.
- Build final del coordinador PASS después de estos cambios. Guion de2–3minutos y preparación de dispositivos documentados en PITCH.md/DEMO_CELULAR_IPAD.md.
