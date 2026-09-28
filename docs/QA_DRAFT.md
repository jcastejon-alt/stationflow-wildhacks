> **Registro histórico V1.** Para el alcance ampliado de cuentas, cafés, cierres y pago simulado, consultar [QA_V2.md](QA_V2.md). Los resultados de abajo corresponden a la primera versión.

# Revisión del draft local

Fecha: 26 de septiembre de 2026. **Draft local revisado; apto para revisión de Jorge.** Este registro separa implementación y verificación. No representa autorización para publicar ni operar pedidos reales.

## Entorno y límites

- macOS, Node 25.8.2, npm 11.11.1.
- Frontend local `http://127.0.0.1:5173`; API `http://127.0.0.1:3001`.
- Sin subida a GitHub, despliegue, túnel público, envío al concurso ni contacto con Sodexo.
- Datos ficticios. Ninguna transacción real ni consumo de meal swipe.

## Resultados de comandos

| Verificación | Resultado |
|---|---|
| `npm install` | Correcto, 163 paquetes añadidos, auditoría de instalación: 0 vulnerabilidades |
| `GET /api/health` | HTTP correcto, `{ok:true,demo:true}` |
| `npm test` | **19/19 pruebas HTTP de integración pasan**, repetidas por coordinador tras integrar (0 fallos, 321ms) |
| `npm run typecheck` | PASS, incluido también en build mediante `tsc -b` |
| `npm run build` | PASS, React/TS/Vite, bundle JS ~322kB / ~100kB gzip |
| Producción local | PASS: build vigente, cuatro rutas SPA, assets, service worker, API health y 404 JSON, base aislada en memoria |

## Prueba funcional del coordinador

Dos navegadores independientes en el mismo Mac: estudiante en Chrome y cocina en Codex In-app Browser. No son dos dispositivos físicos.

- Pausa/reanudación de Omelet desde cocina: la home de Chrome mostró el cambio automáticamente por polling. PASS.
- Cupos de Omelet cambiados en UI de 6 total/4 online a 3/2 y restaurados a 6/4. Confirmación y valores persistidos visibles. PASS.
- Builder Sandwich: intentar enviar vacío mostró errores de pan/proteína. Selección Sourdough, Turkey, Swiss, Lettuce, Mustard y exclusión Red onion enviada. Cocina recibió ticket `228409` con esos detalles exactos, sin exponer token privado en lista. PASS.
- Hub: catálogo general visible; campus burger mostró exchange con aviso de elegibilidad ficticia; al volver a chicken tenders se quitó exchange y volvió regular. Pedido regular de tenders con BBQ aceptado desde la UI. PASS.
- Ticket `228409`: Received → Preparing → Ready → Picked up desde cocina. Cambio y aviso Ready aparecieron en Chrome automáticamente. Recarga preservó el mismo código, datos y estado. PASS.
- Recuperación de solicitud persistida: se reutilizó la metadata guardada por la primera versión del builder, se pausó Sandwich y redujo cupo a 1/1 con su franja ya consumida. `Recover my ticket` recuperó `228409` sin otro ticket y sin validar como orden nueva. Al volver al builder ya no había solicitud pendiente. Cupos restaurados a 8/6 y estación reanudada. PASS. No se fingió una interrupción real de red: se probó el estado de recuperación persistido equivalente.
- Opción Cheese: elegir Swiss y luego None elimina la selección. PASS.
- Hub `231694`: chicken tenders + BBQ regular aceptado, recuperado por su solicitud guardada y cancelado por estudiante mientras Received. Pantalla confirmó Cancelled. PASS.
- Omelet `163299`: walk-in Whole eggs + Spinach aceptado desde cocina aun estando pausada la entrada online; llegó a la cola como Walk-in con esos detalles. Estación reanudada al finalizar. PASS.

### Cobertura del servidor ya verificada

Las 19 pruebas comprueban: carrera por último cupo; solicitudes simultáneas con la misma clave; reintento después de agotado/pausa/caducidad; canonicalización de selecciones; rechazo de clave con contenido distinto; regular vs exchange; carreras y saltos inválidos de estado; cancelación conservadora; pausa online con walk-in permitido; agotados y snapshots intactos; ventanas caducadas/arbitrarias; mínimos/máximos/pertenencia de opciones y exclusiones; capacidad total/digital y estaciones independientes; rechazo de fuente presencial falsificada y campos de identidad; cola digital; reducción de capacidad; persistencia al reabrir la base; tipos JSON inválidos.

Un agente revisor independiente verificó además que el código de recogida no recupera tickets, que una petición canónica repetida recupera el mismo pedido después de sold-out y que no se permite cancelar Preparing. Su hallazgo de tokens innecesarios en la lista de cocina fue corregido antes de la prueba final del servidor.

## Prueba visual y accesibilidad

Home revisada visualmente en escritorio y 390×844; constructor Sandwich en escritorio y 390×844; cocina con ticket en 768×1024 y 390×844; ticket Hub en 390×844. Sin overflow horizontal: `scrollWidth` coincidió con ancho de viewport (390 y 768). Controles y exclusiones visibles. Los tamaños de prueba se restauraron después. La dirección morada/clara se comparó visualmente con The Hub oficial, además de la evidencia CSS del research.

QA de código encontró y corrigió: respuestas atrasadas de polling (single-flight por generación + versión de petición), prevalidación local bloqueando reintentos de pedidos aceptados, metadata pendiente sin limpiar tras éxito, falta de None en grupos opcionales y selección agotada que no se podía quitar. Revisor independiente volvió a leer las correcciones. El coordinador comprobó recuperación y None en navegador; la eliminación de ingrediente agotado fue revisada en código, no mediante fallo de red simulado. El ticket presencial no muestra una posición propia dentro de la cola digital.

## Matriz de notificaciones

| Modalidad | Implementación/verificación |
|---|---|
| Estado Ready y aviso en ticket | **Implementado y probado** entre Chrome y Codex, sin recarga manual |
| Notificación del sistema con página abierta | Implementada opt-in con Notifications API/SW; **permiso y entrega del sistema no probados**. No se modificó el permiso del navegador |
| Background Web Push con pestaña cerrada | Fuera de esta versión; no implementado ni verificado |
| iPhone Home Screen / varios dispositivos físicos | No verificado |

## Pendientes externos

- Instrucciones/formulario y hora exacta del concurso, anunciados para el 27.
- Menú, capacidad y elegibilidad meal exchange reales.
- Decisión de Jorge de publicar; luego validación HTTPS y otra red/dispositivo.
- Autenticación real del personal e integración aprobada de acceso/pagos antes de operar.

## Estado al entregar

Servidor de desarrollo local activo; tres órdenes ficticias de revisión conservadas (Sandwich recogido, Hub cancelado y Omelet presencial recibido). Estaciones activas y capacidades originales restauradas. IAB no reportó errores de consola; Chrome reportó mensajes de canal asíncrono durante automatización, sin fallo funcional observado. No se probaron dispositivos físicos, HTTPS público, permisos de notificación ni entrega de avisos del sistema.
