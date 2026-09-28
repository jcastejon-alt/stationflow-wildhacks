# StationFlow V6 — debrief técnico y recorrido de demo

**27 de septiembre de 2026.** StationFlow es un prototipo independiente y local de pedidos para cinco colas físicas en cuatro lugares: la plancha compartida Omelet/Hamburger y Sandwich en Apple Dining Hall, The Hub, Frothy Monkey y We Proudly Serve Starbucks. No opera un servicio de Trevecca o Sodexo. Los perfiles, pedidos, precios y pagos son ficticios. Ninguna parte se publicó, desplegó, envió al hackathon ni conectó al POS.

## Qué resuelve y cómo se usa

El estudiante entra con uno de dos perfiles demo (`10001` o `10002`), escoge un lugar y completa un wizard de **un paso por pantalla**. The Hub y Starbucks presentan primero Meal swipe o Regular menu porque tienen artículos configurados como elegibles; Frothy no tiene ningún producto confirmado como elegible y pasa directo al menú. Cada artículo lleva a sus grupos concretos de opciones, uno por pantalla, luego a hora de recogida y revisión. The Hub separa plato, personalización y salsa cuando aplican. Cafeteria ofrece **Right now** —la primera ventana con cupo, no servicio instantáneo— o **Schedule** para las ventanas restantes de hoy. Volver conserva lo escogido; cambiar artículo borra opciones y exclusiones incompatibles. Menús, grupos largos, exclusiones y horarios se paginan para que el teléfono mantenga visibles Back y Continue; en zoom o pantallas cortas el panel central puede desplazarse sin cortar contenido.

Cafeteria asume **8:00 a. m.–8:00 p. m. diariamente** como política provisional pendiente de confirmar con Jorge. Omelet opera 8–11 a. m.; Hamburger usa **la misma plancha y cola** desde las 11 hasta el cierre; Sandwich sigue durante todo el horario de Cafeteria. La entrada al comedor se considera previa y el pedido de estación no solicita otro pago. The Hub y los cafés usan los horarios regulares publicados como referencia del demo, sin sincronización de festivos o cierres excepcionales. La hora se muestra en **America/Chicago** y el gerente puede usar un reloj simulado identificado en la interfaz.

El combo `starbucks-bakery-combo` representa muffin + drip coffee con un meal swipe ficticio, solicitado por Jorge. Elegir muffin es obligatorio; leche y endulzante son opcionales. Los lattes exigen una leche; bebidas que se pueden tomar negras ofrecen esa posibilidad. Frothy muestra ejemplos inspirados en el menú general de la marca, **sin afirmar que sean la carta del campus**. Ningún artículo Frothy se marcó elegible hasta obtener la lista específica. Fuentes y decisiones: [investigación de cafés](RESEARCH_COFFEE_V6.md), [FAQ de Dining](https://trevecca.sodexomyway.com/en-us/meal-plan/faq), [Frothy en Trevecca](https://trevecca.sodexomyway.com/en-us/locations/frothy-monkey), [menú general Frothy](https://frothymonkey.com/menu/) y [Starbucks en Trevecca](https://trevecca.sodexomyway.com/en-us/locations/we-proudly-serve-starbucks).

## Arquitectura y reglas del servidor

La cadena es **React 19 + TypeScript + Vite → API Express → SQLite local**. Las pantallas de estudiante y personal consultan el mismo servidor cada pocos segundos. El servidor define catálogo, elegibilidad, cupos, horario y precio: el navegador envía IDs de artículo y opciones, no un importe. Al aceptar el pedido, el ticket conserva una captura de nombre, opciones y precio aunque cambie el catálogo después. El pedido contiene un solo artículo; los importes retail son ejemplos de demo, sin impuesto ni recargos.

Cada franja dura diez minutos y exige dos minutos de anticipación. Las ventanas no cruzan el fin del servicio. Retail ofrece hasta dos horas dentro del horario válido; Schedule de Cafeteria puede mostrar el resto del servicio **de hoy**. Las reservas y el control de cupo total/en línea se hacen en transacciones SQLite, por cola física. La plancha conserva capacidad y pausa compartidas en el cambio de desayuno a hamburguesas; Sandwich tiene controles propios. El conteo delante ordena tickets digitales activos por hora de recogida y secuencia de aceptación, excluye pagos rechazados y no mide una fila física ni predice una hora exacta de preparación.

Un intento incierto se guarda en el navegador con clave de idempotencia y payload original. Al recuperar, el servidor primero busca ese intento y devuelve el mismo ticket aun si el cupo se llenó, el menú cerró o cambió la disponibilidad; una petición nueva debe superar las reglas actuales. Las sesiones están ligadas al perfil y los empleados sólo operan estaciones asignadas. El ID demo identifica un perfil público, **no acredita identidad universitaria**. Los tokens de ticket y los códigos de recogida cumplen funciones distintas; el código no abre una sesión. El panel permite que un empleado asignado supervise varias estaciones desde una tableta, sujeto a que exista acceso a la misma red y coordinación humana.

El estado del pedido y el estado de pago son distintos. Cafeteria no requiere pago de estación. En retail, el estudiante autoriza el **pago simulado en revisión**, el ticket queda recibido/pago pendiente y el empleado registra aprobación o rechazo manual de ejemplo. Un walk-in no hereda la identidad de un estudiante remoto; usa pago de mostrador simulado. Preparación está bloqueada hasta aprobación. Después el pedido pasa por Preparing, Ready y Picked up; la interfaz llama Standby al recibido con pago aprobado. Una aprobación no puede repetirse como otro cobro y un ticket aprobado no se cancela como si hubiera reembolso. El servidor controla estas transiciones con comparaciones de estado dentro de transacciones. No hay captura de dinero, deducción de swipe, conciliación ni reembolso real.

## Evidencia y límites de la revisión

El agente de backend y después el coordinador obtuvieron **67/67 pruebas automáticas** y build TypeScript/Vite exitoso (**1605 módulos**). Los casos cubren horario y cambio de plancha, cupos y concurrencia, reintentos, migración, permisos, precio/elegibilidad y pagos. La [QA de Cafeteria](QA_CAFETERIA_HOURS.md) registró pedidos en navegador antes y después de las 11, continuidad de tickets y revisión móvil a 390×844. El coordinador (Astra) revisó autenticación/sesiones/origen, transacciones, idempotencia, pagos, horarios, capacidad, cola, archivos centrales de React/TypeScript, workers, configuración y pruebas. Esa revisión corrigió leche obligatoria en lattes; exclusiones inapropiadas para cafés; altura del wrapper y un `<main>` anidado; visibilidad del cierre; variables de horario en LAN; conteo retail por hora/secuencia sin pagos rechazados; y cancelación visible de walk-ins rechazados.

La revisión de navegador comprobó The Hub con modo, artículo, salsa y Back preservando BBQ; muffin obligatorio en Starbucks; leche en 390×844 sin desplazamiento de página y con footer visible (borde inferior 837 px); y bloqueo al cerrar la recogida. El flujo completo Starbucks creó el ticket **515131** para `10001`, muffin blueberry, leche de avena, azúcar y un swipe demo: Received → aprobación → Standby → Preparing → Ready, con aviso visible al estudiante. Son casos locales concretos, no certificación de producción ni garantía de ausencia de fallos.

No se ha ensayado todavía con celular e iPad físicos, red universitaria, LAN real, túnel, nube, carga a escala ni POS institucional. El aviso Ready dentro del ticket requiere página abierta y teléfono despierto; no hay push de fondo. No se sincronizan festivos, menú, inventario ni capacidades reales. La lista de tickets y sus consultas necesitarían evaluación de rendimiento —incluido el patrón de consultas por ticket— antes de crecer mucho. Las exclusiones no garantizan seguridad frente a alérgenos. Los perfiles demo sin contraseña no deben admitir datos reales. Los límites y el procedimiento para un ensayo físico están en [guía celular/iPad](DEMO_CELULAR_IPAD.md).

## Mapa para continuar

| Archivo | Responsabilidad |
|---|---|
| `src/OrderPage.tsx`, `src/order-flow.css` | Wizard, revisión, recuperación y diseño móvil. |
| `src/Kitchen.tsx`, `src/kitchen.css` | Panel de empleado, colas, controles y estados. |
| `src/TicketPage.tsx`, `src/MyOrdersPage.tsx` | Ticket activo, alerta Ready e historial del perfil. |
| `src/AuthContext.tsx`, `src/api.ts` | Sesión y comunicación/polling del cliente. |
| `server/app.js`, `server/auth.js` | API, transacciones, permisos y sesiones. |
| `server/service.js`, `server/seed.js` | Horarios, colas físicas y catálogo. |
| `server/lan-demo.js`, `tests/` | Launcher de red privada y pruebas automatizadas. |

## Próximas decisiones, en orden

1. Con Dining/IT, comparar el flujo con **Everyday** y confirmar menús, elegibilidad de exchanges, precios, horarios, aforo y el procedimiento permitido para pedidos remotos. El resultado podría ser integrar, adaptar o no usar StationFlow.
2. Diseñar una identidad estudiantil aprobada y permisos operativos reales; reemplazar IDs públicos, contraseña demo y confirmación manual ficticia sólo tras validar el proceso POS y su conciliación/reembolsos.
3. Hacer un piloto supervisado de una estación con dispositivos físicos, red autorizada, accesibilidad, avisos, fallos de conexión y métricas de tiempos; decidir infraestructura compartida y carga antes de ampliar.

## Guion de cinco minutos

**0:00–0:45:** problema: tiempo incierto en estaciones y poca visibilidad de la cola. Mostrar cuatro lugares y explicar la plancha compartida. **0:45–2:10:** estudiante `10001` en The Hub: Regular menu, plato, salsa, hora, revisión y autorización simulada; mostrar ticket y código. **2:10–3:20:** empleado en `/panel/hub`: localizar ID ficticio, aprobar pago demo, Start preparing y Mark ready; volver al aviso del estudiante. **3:20–4:10:** enseñar rápidamente Right now/Schedule de Cafeteria y el cambio de 11 a. m.; señalar Starbucks combo ficticio y Frothy sin exchange confirmado. **4:10–5:00:** explicar SQLite/transacciones e idempotencia con el caso de la última plaza o conexión perdida, y cerrar con los límites y el primer paso con Dining/IT. Si falla la red, usar dos navegadores separados en la Mac; no improvisar un túnel ni una publicación.
