# Ensayo con celular e iPad

Actualización al 27 de septiembre: el panel simplificado usa cuatro locales y dos acciones por pedido. El flujo anterior de más botones queda documentado como [QA V9 histórica](QA_STATUS_V9.md). El build y la suite automatizada se ejecutan localmente; aún falta comprobar el recorrido en el celular y el iPad físicos. Esta guía no inicia ningún despliegue ni túnel de Cloudflare. Todos los IDs, pedidos y pagos son ficticios.

## Pantallas y cuentas vigentes

| Dispositivo | Entrada | Cuenta | Resultado |
|---|---|---|---|
| Celular del estudiante | `/login` | `10001` o `10002`, sin contraseña | Inicio con cuatro locales |
| iPad del trabajador | `/staff/login` | Elegir Cafeteria, The Hub, Starbucks o Frothy | Panel de ese local solamente |
| Preparación del ensayo | `/staff/login` → Manager / demo setup | `manager` / `CampusDemo!26` | `/kitchen` |

El estudiante escribe únicamente su ID ficticio. El trabajador toca el local donde trabaja; ese selector usa la cuenta demo pública correspondiente. El manager tiene una entrada separada para preparar el reloj y la cola. En dispositivos distintos las sesiones son independientes; para ensayar en la Mac usar navegadores o perfiles separados, porque las pestañas del mismo perfil comparten sesión.

Después del login del estudiante hay cuatro locales: **Cafeteria / Apple Dining Hall**, **The Hub**, **Frothy Monkey** y **We Proudly Serve Starbucks**. Cafeteria contiene **una misma plancha para Omelet y Hamburger según la hora**, más **Sandwich** en una estación independiente. Todos usan un wizard de un paso por pantalla. Omelet y Hamburger comienzan directamente con la primera personalización; Sandwich empieza con **Wrap o Sandwich** y termina con el nivel de tostado. Los locales con productos elegibles empiezan con **Meal swipe / Regular menu**. En menú regular se puede agregar hasta seis unidades al mismo ticket; un swipe demo permite sólo una unidad elegible. Son cinco colas físicas y seis IDs de menú/servicio; no hay una segunda plancha al llegar las 11.

## Conexión local para el ensayo

En una red privada o Wi-Fi que permita comunicación entre los dispositivos:

```sh
npm run demo:lan
```

Este comando compila, sirve la app en el puerto `3002` y muestra las direcciones privadas de la Mac. Usa `data/stationflow-lan.sqlite`, separado del desarrollo. Abrir **la misma dirección** en celular e iPad, agregando `/login` o `/staff/login` según corresponda. No escribir `localhost` en el celular: apuntaría al propio teléfono. La Mac debe permanecer encendida y despierta; el comando queda activo hasta `Ctrl+C`.

Si la red universitaria aísla dispositivos, esta alternativa puede fallar aunque ambos estén en el mismo Wi-Fi. No cambiar la seguridad de esa red. El respaldo local es mostrar estudiante y cocina en dos navegadores independientes de la Mac. No se ha comprobado todavía el acceso desde el celular y el iPad físicos.

## Preparación antes de presentar

1. En el iPad, abrir `/staff/login` y desplegar **Manager / demo setup**. Entrar como `manager` con `CampusDemo!26`; se abre `/kitchen`.
2. Desplegar **Station controls**. En **Demo service clock**, elegir **Lunch** para ensayar fuera del horario real. La hora se identifica como simulada y no modifica el reloj de la Mac.
3. En **Manage station**, elegir **The Hub**. Verificar que la estación no esté pausada, **Hub burger**, **Seasoned fries**, los ingredientes **Lettuce, Cheese, Pickles, Tomato** y las salsas en vasito **Ranch / Hub sauce** estén disponibles, y que una franja tenga al menos **dos espacios de artículo**.
4. Si se quiere mostrar una cola, pulsar **Simulate 3 orders** una sola vez y volver a revisar que queden dos espacios en una ventana. Crea hasta tres tickets ficticios dentro del cupo disponible; las tarjetas dicen **Rush simulation**. Usar el conteo realmente mostrado, no prometer exactamente tres si ya hay otros pedidos o poco cupo. Si la respuesta queda incierta, usar **Recover simulation**, que reutiliza el intento original.
5. Volver a `/staff/login` y tocar **The Hub**. El selector cambia a la cuenta demo de ese local y abre `/panel/hub`. El reloj y los pedidos permanecen en el servidor compartido. No reiniciar el servidor durante el pitch: el reloj vuelve a hora real al reiniciar.
6. Dejar el celular en `/login`, listo para escribir `10001`. Después de enviar el pedido, mantener el ticket abierto y el teléfono despierto.

## Secuencia en vivo

1. **Celular:** escribir `10001` y entrar sin contraseña. Mostrar los cuatro locales, elegir **The Hub → Regular menu → Hub burger**, escoger por ejemplo **Lettuce, Cheese y Tomato** en **Ingredients** y **Ranch** en **Side sauce · served in a small cup**; dejar **Pickles** sin seleccionar. Pulsar **Add to cart**, luego **Add another item → Seasoned fries → Add to cart**. Mostrar las dos líneas y el total ficticio de **$11.98** del menú actual. **Ranch** y **Hub sauce** son las únicas salsas elegibles online en The Hub; las demás se sirven personalmente en el local.
2. **Celular:** pulsar **Choose pickup** y escoger una ventana con al menos dos espacios de artículo. En la revisión final comprobar las dos líneas, autorizar el pago de campus account **simulado** y pulsar **Place order** una sola vez.
3. **Celular:** mostrar el código de recogida, los pedidos digitales anteriores y el estado de **pago demo pendiente**. El cupo se mide en unidades de artículos; el conteo de personas delante se basa en tickets digitales, no en la fila física.
4. **iPad, `/panel/hub`:** encontrar el pedido en **Pending**. La tarjeta identifica **Student 10001** y muestra ambos artículos con sus opciones; el **Pickup code** es un dato separado, no el ID del estudiante.
5. **iPad:** explicar que, en un sistema real, el empleado introduciría ese ID y cobraría en el POS existente. Esa conexión no existe en el demo. Pulsar **Accept** para representar que se hizo la entrada: una sola operación registra **Entered**, confirma el pago ficticio ya autorizado y empieza **Preparing**. El celular pasa a preparación.
6. **iPad:** pulsar **Mark ready** cuando se representa que terminó. El pedido pasa a **Done** en el panel.
7. **Celular:** cada cambio aparece en la próxima actualización, normalmente alrededor de tres segundos con conexión. **Ready for pickup** aparece únicamente después de **Mark ready**, con código y estación. Mostrar el aviso al jurado manteniendo la misma página abierta.

El panel del trabajador tiene solo **Pending → Preparing → Done** y los botones **Accept** / **Mark ready**. Como alternativa breve, elegir **Meal swipe → Chicken tenders → Ranch**: ese swipe demo admite una sola unidad elegible. Para mostrar dos artículos en un ticket, usar **Regular menu**.

En **Cafeteria**, el mismo panel muestra únicamente pedidos de ese local, cada uno rotulado como plancha (Omelet/Hamburger) o Sandwich. **Accept** inicia preparación sin pedir otro ID ni pago en la estación; **Mark ready** avisa al estudiante. Omelet y Hamburger comparten la plancha y Sandwich conserva su propia cola en el backend. Sandwich guía **Wrap o Sandwich → base → proteína → queso → vegetales → salsa → tostado**; las opciones actuales son provisionales hasta revisar la foto y el menú real. Los controles de pausas, walk-ins, cupos e inventario permanecen en la vista separada del manager.

## Ensayo adicional: mañana y cambio de servicio en Cafeteria

El supuesto provisional es **8:00 AM–8:00 PM todos los días**, pendiente de confirmar con Jorge y distinto de afirmar un horario oficial de Sodexo. Omelet opera **8–11 AM**, Hamburger **11 AM–8 PM** en la misma plancha, y Sandwich **8 AM–8 PM sin interrupción**.

1. Como manager, abrir **Station controls → Demo service clock → Breakfast**. En el celular elegir Cafeteria. Mostrar Omelet y Sandwich; Hamburger debe permanecer deshabilitado antes de las 11.
2. Para Omelet, comparar **Right now** —la primera franja válida con cupo— con **Schedule** —las franjas restantes de hoy dentro de 8–11 AM—. Right now es una reserva en la primera ventana disponible, no una promesa de preparación instantánea. No representa una reserva para mañana.
3. Enviar una orden; en `/staff/login`, tocar **Cafeteria** y localizarla en `/panel/cafeteria`. Verificar opciones, franja y ausencia de un paso de ID o pago en la estación. Pulsar **Accept** para llevarla a **Preparing**, y después **Mark ready** cuando corresponda. La orden conserva su horario elegido; no se mueve al refrescar.
4. En el dispositivo manager, usar **Transition** y después **Lunch** para revisar el límite de las 11. No ofrecer una franja de omelet que cruce las 11 ni una hamburguesa antes de su servicio. Sandwich continúa disponible durante el cambio, sujeto a cupos y estado de pausa.
5. Confirmar que el mismo panel conserva los tickets de omelet ya aceptados y recibe los de hamburger; cada ticket muestra su estación. Los controles de capacidad y pausa de la plancha son compartidos en el backend; Sandwich conserva los suyos. Marcar listos los tickets aceptados no requiere reabrir el servicio de la mañana.

Las franjas duran diez minutos, necesitan al menos dos minutos de anticipación y deben terminar dentro del horario de su servicio. Por eso la última franja de omelet puede ser 10:50–11:00; verla depende del tiempo restante y del cupo. Si una respuesta queda incierta, **Recover my ticket** recupera el intento original incluso después del cambio de servicio, sin crear otra reserva.

Este recorrido se verificó localmente con cliente y servidor: [resultado y límites](QA_CAFETERIA_HOURS.md). No sustituye la prueba en el celular/iPad físico ni confirma los horarios institucionales de la cafetería.

## Qué representa el paso de pago

Jorge describe el flujo operativo así: el cajero introduce el ID del estudiante en el POS existente y el POS muestra nombre y detalles. Esa descripción orienta el prototipo; **no es una integración técnica verificada**.

StationFlow muestra el ID ligado al perfil demo y el pedido retail. No consulta el POS, no busca nombres, no inventa saldos ni carga una cuenta. Para el ensayo, el trabajador usa el ID mostrado para representar la entrada externa y luego pulsa **Accept**. El backend registra la entrada, aprueba el pago ficticio autorizado y empieza la preparación en una transacción. En Cafeteria, **Accept** sólo toma el pedido de la estación y empieza la preparación, sin otro ID ni pago. No introducir IDs ficticios en un POS real ni realizar cobros durante la demo. Una versión operativa debe validar este proceso y su autorización con Dining Services.

## Alertas y respaldo

El aviso dentro del ticket funciona mientras la página permanece abierta y el teléfono despierto; no necesita permiso del sistema. En HTTP de la red local no se ofrece el botón de notificaciones del sistema. En navegadores compatibles y contexto seguro existe una opción voluntaria de alertas, pero no es necesaria para presentar.

**No se implementó push con el navegador cerrado o el teléfono bloqueado.** HTTPS por sí solo no añade esa función. En iOS/iPadOS, Web Push tiene requisitos de app añadida a la pantalla de inicio y autorización por gesto; además faltaría la infraestructura de suscripción y envío. [Documentación de WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Si falla la conexión entre los dispositivos, mostrar la misma secuencia con dos navegadores independientes en la Mac. El build local no depende de una integración externa de pagos. Los guiones de presentación anteriores deberán actualizarse para seguir este recorrido simplificado antes del pitch.

## Opción futura: enlace HTTPS, sólo después de autorización

Un **Cloudflare Tunnel** temporal podría permitir que celular e iPad accedan al mismo servidor cuando la red no permita conexiones directas. Es una propuesta pendiente, no una comprobación de la red ni autorización para exponer la app. La Mac conservaría SQLite y tendría que seguir encendida, despierta y conectada; ambos dispositivos necesitarían internet.

Los Quick Tunnels son herramientas de desarrollo/prueba con dominio aleatorio y sin garantía de disponibilidad; no son alojamiento permanente. El polling de esta app no depende de SSE. [Documentación oficial](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

La app usa Express y `node:sqlite`: subir únicamente `dist` a Pages no publica el servidor compartido. La compatibilidad revisada de Workers no ofrece una implementación funcional de `node:sqlite`; un alojamiento completo allí requeriría adaptar persistencia y transacciones, por ejemplo a D1, y desplegar API y frontend. [Compatibilidad de Workers](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) · [API de D1](https://developers.cloudflare.com/d1/best-practices/query-d1/). Revalidar esas condiciones si se elige esa ruta.

Pasos conservados para una decisión posterior:

1. Obtener autorización explícita de Jorge antes de instalar herramientas o iniciar el túnel. Al revisar esta Mac, `cloudflared` no estaba en PATH; esa observación puede cambiar y deberá revalidarse.
2. Usar una base separada con datos ficticios, `data/stationflow-cloud-demo.sqlite`. No compartir la carpeta del proyecto como servidor de archivos.
3. Después de la autorización, obtener la URL HTTPS del túnel hacia `http://127.0.0.1:3003`. Iniciar un túnel ya expone la app públicamente.
4. Ligar el servidor sólo a loopback y configurar `PUBLIC_ORIGIN` con el origen HTTPS exacto, sin slash final. Esa configuración restringe las escrituras al origen indicado y usa cookies Secure; no confía en headers de proxy arbitrarios. `.env` no se carga automáticamente.
5. Verificar login de ambos roles, carrito de dos artículos, **Accept** con ID visible y aprobación ficticia atómica, **Preparing**, **Ready**, aislamiento entre locales, privacidad entre cuentas y recuperación al recargar antes de usar el enlace en el pitch.
6. Detener túnel y servidor al terminar. Si cambia la URL, actualizar `PUBLIC_ORIGIN` y abrir el nuevo enlace en ambos dispositivos.

Ejemplo de configuración futura, **no una instrucción para ejecutarlo ahora**:

```sh
npm run build
HOST=127.0.0.1 PORT=3003 DB_PATH=data/stationflow-cloud-demo.sqlite PUBLIC_ORIGIN=https://origen-aprobado.example npm start
```

Las cuentas demo son públicas: quien tenga acceso al enlace podría usar roles de estudiante y personal y cambiar datos ficticios. Usar únicamente `10001` / `10002` para los estudiantes, nunca IDs reales ni cuentas de Trevecca. HTTPS no autentica estudiantes reales ni conecta pagos.
