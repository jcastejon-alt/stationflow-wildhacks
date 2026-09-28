# StationFlow V7 · revisión final del prototipo local

**27 de septiembre de 2026 · revisión de Astra con auditorías de agentes Sol/Luna.** Este documento describe el estado actual del código y reemplaza el debrief V6, que cubría una versión anterior de un solo artículo. La presentación se trabajará después. El proyecto es independiente: no es un servicio oficial de Trevecca, Dining o Sodexo, ni cobra dinero o descuenta swipes reales.

## Producto que existe hoy

Hay cuatro lugares y cinco colas físicas: la plancha compartida Omelet/Hamburger y Sandwich dentro de Apple Dining Hall, The Hub, Frothy Monkey y We Proudly Serve Starbucks. El estudiante entra con `10001` o `10002`, elige local y arma su pedido en un wizard de un paso por pantalla. Cafeteria no vuelve a cobrar al estudiante después de entrar al comedor. En The Hub y Starbucks hay artículos configurados para un **meal swipe ficticio**; una orden de ese tipo contiene exactamente una unidad elegible. El menú regular permite hasta seis unidades, cada una con sus propias opciones, dentro de un único ticket para un solo local. Frothy conserva un menú de ejemplo sin elegibilidad de swipe confirmada.

Omelet se puede programar de 8 a 11 a. m.; desde las 11 la misma plancha ofrece hamburguesas. Sandwich permanece durante el horario asumido para Cafeteria. The Hub tiene Hub burger, tenders y un menú regular con precios **inventados para el demo**. La Hub burger permite lettuce, cheese, pickles y tomato; ranch o Hub sauce se piden aparte en un vasito. El wrap/sandwich usa bases y opciones del letrero fotografiado; Vinegar, Honey mustard y Caesar aparecen como extras de demo rotulados. El nivel de tostado se elige al final. Cada plato y cada ingrediente seleccionable del burger/wrap tiene una ilustración genérica local, no una foto oficial del producto real.

El pedido retail llega al panel con el ID ficticio, el contenido y la ventana elegida. Queda en pago pendiente hasta que el empleado confirma o rechaza una comprobación **simulada**. Solo después puede ingresarlo a preparación y marcarlo listo. El estudiante observa Received → Payment received → Entered/preparing → Ready en su ticket y recibe un aviso **dentro de la página abierta**. Ready no implica recogido: el empleado tiene una acción separada para completar la entrega. El panel de Cafeteria muestra una cola para la plancha compartida y selecciona automáticamente el menú Hamburger después de las 11; Sandwich tiene su cola propia.

## Arquitectura y contratos

```text
React 19 + TypeScript + Vite
  ├─ estudiante: ID demo → catálogo → opciones → carrito → franja → ticket
  └─ personal: inicio con contraseña → cola asignada → pago/estado
             ↓ HTTP mismo origen; consultas periódicas
Express API → validación, permisos, precios, horarios, cupos, estados
             ↓ transacciones BEGIN IMMEDIATE
SQLite       → sesiones, catálogo, reservas, tickets, eventos, reintentos
```

El navegador envía IDs de artículo/opción y un consentimiento de pago demo; **el servidor** decide si pertenecen al local, siguen disponibles, cumplen mínimos/máximos y son elegibles para swipe. Calcula y guarda el precio de ejemplo: no acepta un total elegido por el cliente. Una ventana de diez minutos debe empezar con al menos dos minutos de margen y terminar antes del cierre. Las reservas consumen unidades del cupo total y del cupo en línea de la **cola física**; Omelet/Hamburger comparten esos límites. La cola delante cuenta tickets digitales activos según franja y aceptación, no la fila de personas presentes.

Cada envío lleva una clave de idempotencia ligada al perfil y a un payload canónico. Si hay duda por pérdida de conexión, el mismo intento devuelve el ticket anterior incluso cuando ya se cerró el menú o se agotó el cupo; un intento cambiado con la misma clave se rechaza. El ticket conserva una captura de nombre, opciones, precio y franja aceptada aunque después cambie la disponibilidad. Pago y preparación son estados distintos; una transición concurrente solo progresa desde el estado esperado. Preparar un retail no aprobado está bloqueado. Un pedido aprobado no ofrece una falsa cancelación/reembolso.

Las sesiones de personal usan contraseña hash, cookie HttpOnly, expiración y revocación. Cada cuenta ve y cambia solo las estaciones asignadas; el gerente controla escenarios y reloj simulado. Los dos ID estudiantiles son perfiles **públicos del demo**, no autenticación universitaria. El código de recogida no equivale al token de acceso al ticket. El servidor protege escrituras por origen y admite un origen HTTPS explícito para un futuro despliegue aprobado. Ni configurar esa opción ni servir la demo en LAN publica el proyecto por sí solo.

## Revisión funcional y visual realizada

- `npm test`: **73/73** aprobadas. Se cubrieron validación de carrito/opciones, swipe único, cupos concurrentes, horarios y transición de las 11, idempotencia, pagos, permisos, sesiones, migraciones, LAN y orígenes HTTPS.
- `npm run build`: TypeScript y Vite correctos (**1606 módulos**). No hubo errores de compilación.
- Ensayo con dos navegadores en la Mac y la URL de la LAN: Hub burger + papas, ID `10001`, ventana 12:20–12:30 y ticket `158246`. El panel recibió ambas líneas, confirmó pago, ingresó el pedido y lo marcó Ready; la vista del estudiante mostró cada estado y conservó Ready tras recarga. Otro ticket comprobó una sola unidad con swipe demo. Estas pruebas no sustituyen la prueba en dos dispositivos físicos.
- Revisión visual: burger/ingredientes, Wrap/Sandwich y siete opciones de vegetales/salsas. A 1280×720 todas las siete opciones quedan visibles en dos columnas y el botón no se tapa. A 390×844 y 768×1024 se mantienen en una columna; a 844×390 el botón permanece visible con desplazamiento interno de opciones por la escasa altura.
- Auditoría de uso: se aclaró disponibilidad antes de ordenar, se conservó el resumen del carrito en móvil, se corrigió el selector de la plancha en el panel, se añadió antigüedad del ticket y confirmación persistente de acciones, y se mejoraron foco/título de rutas y recuperación de un cierre de sesión fallido. Los hallazgos restantes están en [Revisión UX](REVISION_UX_2026-09-27.md).

## Lo que aún no está verificado ni integrado

El ensayo real teléfono → iPad en el Wi‑Fi de la universidad sigue pendiente; esa red podría aislar clientes. El aviso Ready requiere ticket abierto y pantalla activa: no existe push con navegador cerrado. No hay cobro, conciliación, reembolso, consulta de nombre en POS ni descuento real de swipe. Antes de uso institucional, Dining/IT debe confirmar identidad, menú, elegibilidad, precios, horarios, cierres excepcionales, política de recogida y procedimiento de cobro remoto. Las ilustraciones son representaciones del demo; sus tres sprites PNG suman unos 6.4 MB, por lo que conviene optimizarlos antes de una demo pública en una red lenta. El panel usa un bloqueo global durante cada acción; para alto volumen convendría una acción pendiente por ticket.

**Estado de entrega:** código y demo LAN en esta Mac. No se ha hecho commit, push, despliegue en Cloudflare ni envío al hackathon. El guion V6 y otros documentos históricos pueden mencionar el menú anterior; no deben usarse como descripción de la versión actual hasta actualizarlos en la fase de presentación.
