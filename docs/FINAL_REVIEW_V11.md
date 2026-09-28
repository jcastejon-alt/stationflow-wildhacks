# StationFlow — revisión final local V11

27 de septiembre de 2026. Revisión coordinada por Astra con tres auditorías acotadas de Sol y comprobación independiente del flujo en navegador. Esta revisión cubre el demo existente; no incluye publicación, presentación ni integración institucional.

## Resultado

El recorrido principal funciona entre dos sesiones independientes que comparten el servidor: estudiante envía → local recibe en Pending → Accept confirma la entrada y el pago ficticio cuando corresponde, y pasa a Preparing → Mark ready pasa a Done y muestra el aviso Ready en el ticket del estudiante sin recargar. Los estados dependen del trabajador, no de un temporizador.

No quedaron fallos bloqueantes identificados en el alcance revisado. Esto no es una garantía de ausencia total de errores ni una prueba en dispositivos físicos.

## Correcciones de esta revisión

- Los tickets retail del trabajador muestran meal swipe o campus account, total ilustrativo y estado de confirmación. Cafeteria no muestra un pago adicional.
- Un pedido Ready deja de contar delante de otros pedidos. Las reservas de capacidad no cambian.
- La cola de preparación y el panel simple usan el día de recogida en America/Chicago según el reloj compartido del demo. Los pedidos de días anteriores conservan su historial y estado, pero no inflan la cola de hoy.
- El panel mantiene exclusivamente Accept y Mark ready. Done se ordena por la fecha de actualización registrada; los cambios manuales del reloj demo también afectan esas fechas.
- Una protección inmediata evita acciones duplicadas por doble toque. Refresh permite retirar errores de acciones anteriores y consultar de nuevo.

## Evidencia final

| Comprobación | Resultado |
|---|---|
| `npm test` | 80 aprobadas, 0 fallidas |
| `npm run build` | TypeScript y build de Vite aprobados |
| `npm audit --omit=dev` | 0 vulnerabilidades reportadas en dependencias de producción al revisar |
| Hub, pedido `399052` | Creado completamente mediante la interfaz móvil: Hub burger con lettuce, cheese, pickles y Hub sauce, más fries; total demo $11.98 |
| Persistencia | Reinicié el servidor con ese pedido pendiente; conservó sesión, ID, productos, opciones, total y ticket |
| Hub, interacción | El panel mostró el ID 10002 y el total; Accept y Mark ready actualizaron el otro navegador automáticamente |
| Cafeteria, pedido `405926` | Creado vía API como 10002, hamburger con cheese y lettuce; apareció sólo en Cafeteria; Accept y Mark ready operados en UI; el otro navegador mostró Preparing y Ready sin recargar |
| Diseño | Pedido/ticket a 390×844, panel a 1024×768 y 768×1024; sin desborde horizontal en las vistas comprobadas; menú ilustrado y dropdown de recogida inspeccionados |

Las pruebas automatizadas cubren personalización por producto, carrito regular, máximo de una unidad por meal swipe, precios calculados en servidor, ventanas y cierre, cambio Omelet→Hamburger y capacidad compartida, permisos por local, propiedad del ticket, reintentos idempotentes, concurrencia, transacciones de pago ficticio, migraciones, persistencia, simulación de cola, origen HTTPS y cookies. Se revisaron además las rutas, recuperación de sesión, polling, avisos, controles del manager y arranque/cierre del servidor.

## Requisitos de producto contrastados

- Cuatro accesos de trabajador: Cafeteria, Hub, Starbucks y Frothy; cada uno recibe únicamente sus locales asignados. Cafeteria reúne Omelet/Hamburger/Sandwich con etiquetas de estación.
- Omelet 8–11; Hamburger desde las 11; Sandwich durante el horario configurado de Cafeteria. El horario diario 8–20 de Cafeteria continúa siendo una hipótesis del demo.
- Hub: tenders y Hub burger elegibles para swipe, una unidad total; regular permite varios productos. Sólo Ranch y Hub sauce son salsas online. Cafeteria hamburger no ofrece salsas online.
- Sandwich/Wrap: bases correspondientes, protein, cheese, vegetables, las salsas de la foto más las tres extras aprobadas, y toast al final.
- Cafés: menús propios y personalización; combo Starbucks de muffin + drip coffee como una unidad de swipe ficticio.

## Entrega a Sol antes de publicar

1. Publicar frontend **y** API compartida: subir sólo `dist` no proporciona pedidos, sesiones ni persistencia. El código actual requiere Node 22.13+ y SQLite escribible. Conservar las transacciones y una base compartida si se cambia de plataforma.
2. Seguir la configuración HTTPS ya documentada: mismo origen para `/api`, `PUBLIC_ORIGIN` exacto, cookies Secure y persistencia de la base. No desactivar la validación de origen para solucionar un login. `server/lan-demo.js` es el lanzador LAN; para el origen público está preparado `server/index.js`.
3. Usar una base separada de ensayo con datos ficticios. No publicar `data/`, `.env`, sesiones ni dependencias; están ignorados por Git. El proyecto aún no tiene commit inicial y requiere añadir todos sus archivos fuente necesarios al publicar.
4. Tras publicar, probar **en el celular y el iPad físicos**, ambos con la misma URL: login, carrito, llegada al local correcto, Accept, Preparing, Mark ready, Ready, recarga y reconexión. Esto sigue pendiente y no lo sustituye la prueba entre navegadores de esta Mac.
5. Mantener el ticket del estudiante abierto y la pantalla despierta. Hay aviso en la página; no hay push garantizado con Safari cerrado o el teléfono bloqueado. El demo usa únicamente perfiles ficticios 10001/10002 y no cobra ni valida IDs reales.
6. Al reiniciar, el reloj vuelve a Live. Seleccionar Lunch en manager para Hub/Hamburger, o Breakfast para Omelet; comprobar espacio en la ventana antes de simular una cola.

No se inició ningún túnel ni se desplegó, subió o publicó el proyecto durante esta revisión.
