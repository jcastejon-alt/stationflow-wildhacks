# StationFlow V8 · menú, horarios y demo local

Revisión del 27 de septiembre de 2026. Sigue siendo un prototipo independiente: estudiantes, pedidos, pagos y meal swipes son ficticios. No se publicó ni se conectó al POS universitario.

## Cambios visibles

- **Hamburger Station de Cafeteria:** solo se eligen lettuce, cheese, pickles y tomato. La pantalla aclara que las salsas se toman en persona; no viajan como opciones del pedido.
- **The Hub:** Chicken tenders, Hub burger, wraps y salad ofrecen únicamente Ranch o Hub sauce como vasitos separados. Las otras salsas se toman en el local. Sandwich Station conserva su propio menú de salsas.
- **Horario de recogida:** el menú desplegable usa la estética de StationFlow y se coloca arriba o abajo según el espacio disponible. Muestra el cupo por franja y permite recorrer y elegir con teclado. El pie de navegación queda visible.
- **Frothy y Starbucks:** tarjetas de producto más breves, ilustraciones de ejemplo y una advertencia por local sobre el carácter provisional del menú. El combo de muffin y café conserva su aviso de elegibilidad ficticia.

## Verificación

`npm test`: **75/75**. `npm run build`: **aprobado**. Las pruebas cubren salsas retiradas, validación de opciones, migración de catálogos, snapshots de pedidos aceptados e idempotencia, además de las rutas de pago, cola y horarios existentes.

En el servidor local Wi-Fi se completó un pedido de Chicken tenders con Ranch para el ID ficticio `10002`. El panel de The Hub recibió el mismo ID, artículo y salsa; el empleado confirmó el pago simulado, marcó la orden en preparación y después lista. El ticket del estudiante se actualizó sin recargar y mostró el aviso de recogida. También se envió una hamburguesa de Cafeteria con lettuce y cheese; su ticket de empleado mostró solo el grupo de ingredientes, sin salsa ni cobro adicional.

La interfaz se inspeccionó a **1280 × 720** y **390 × 844**. En ambos tamaños, el desplegable quedó visible sin recortarse por el pie. Se comprobó selección con flechas y Enter, cierre con Escape y la visualización del cupo. Las capturas locales son [selector de horario](qa-pickup-dropdown-2026-09-27.png) y [pedido listo](qa-ready-2026-09-27.png).

## Límite de esta prueba

La comunicación estudiante–empleado se verificó entre dos sesiones de navegador contra el mismo servidor LAN; no se repitió todavía con un teléfono y un iPad físicos. El aviso es dentro de la página mientras permanece abierta; no existe push en segundo plano con el teléfono bloqueado. Al reiniciar el servidor, el reloj de servicio vuelve a la hora real y el manager debe activar de nuevo el escenario **Lunch** para ensayar fuera de horario. El enlace LAN solo funciona si la red permite que los dispositivos se vean entre sí.
