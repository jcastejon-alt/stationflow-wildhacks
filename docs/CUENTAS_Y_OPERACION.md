# Cuentas, filas y operación con pocos dispositivos

Propuesta para Jorge · actualizada el 27 de septiembre de 2026. El website usa entrada por ID ficticio sin contraseña; ver FLUJO_WEB_V3.md. El cambio de servicios de Cafeteria está en integración y este documento no afirma su verificación final. Las recomendaciones de SSO de abajo corresponden a una operación real. El demo usa cuentas ficticias y no conecta con Trevecca ni Sodexo.

## Cómo evitar que alguien pida con el ID de otro estudiante

**Aclaración de Jorge:** Cafeteria revisa acceso/ID en la entrada. Omelet, Hamburger y Sandwich sólo reciben pedidos internos; no necesitan cobrar ni pedir otro swipe. Omelet y Hamburger usan la misma plancha en turnos distintos. La vinculación de cuenta–ID para pago corresponde a Hub y los cafés. Una cuenta en la app sirve además para recuperar pedidos privados, sin convertir cada estación de Cafeteria en otra caja.

El número de estudiante identifica una cuenta; no prueba quién está usando el teléfono. Por eso no se debe permitir que escribir cualquier número cree una identidad ni descuente un meal swipe.

Para un piloto real, la primera opción es **iniciar sesión con la cuenta institucional**, con el proveedor de identidad que apruebe IT. Si es Microsoft Entra, usar su identidad inmutable y el tenant institucional autorizado, validando tokens, emisor y destinatario. El servidor vincula esa identidad con el registro estudiantil que entregue la universidad. El estudiante puede ver su ID asociado, pero no cambiar el dueño de un pedido escribiendo otro ID. Microsoft explica por qué email y nombre de usuario no sirven como claves de autorización estables: [validación de claims](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

Una alternativa temporal, si no hay SSO disponible, es activación supervisada: Dining/IT verifica un registro institucional, envía invitación de un solo uso al correo asociado y la persona configura acceso. Verificar que alguien posee un correo por sí solo **no demuestra que le pertenece un número estudiantil elegido libremente**. La relación correo–ID tiene que venir de una fuente autorizada. No pedir documentos personales en este prototipo.

Después del login, cada pedido toma su propietario de la sesión del servidor. Consultar, cancelar o modificar requiere permiso, aunque alguien conozca el enlace o el código. El código corto sirve para localizar una entrega y no para acceder a una cuenta. Autenticación y autorización son controles distintos: [guía de autorización de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Esto reduce suplantación por copiar números; no promete impedir que una persona comparta voluntariamente su contraseña o teléfono. Un piloto puede usar MFA institucional, sesiones revocables y cotejo de la credencial física al recoger. El canje real de meal exchange necesita además autorización del sistema de planes de comida; una sesión estudiantil no prueba saldo ni elegibilidad.

## Pedir a distancia y que el empleado lo cobre por ID

El flujo propuesto para Hub/Frothy/Starbucks es: estudiante autenticado → elige producto y método → autoriza cobro → pedido pendiente de pago → empleado autorizado ve el ID ya vinculado → lo procesa en la caja existente → confirma el resultado → preparación → recogida.

Esto funciona **sólo si la caja y las políticas de Sodexo permiten introducir un ID y cobrar sin presentar físicamente la tarjeta**. No encontré confirmación pública de esa capacidad; hay que probarla con Dining. Si la caja exige tarjeta física, no basta con construir la app: hace falta una integración aprobada, autorización remota del proveedor o un método alternativo aprobado. No confundir consultar una cuenta con tener permiso para cargarle dinero.

Para un cargo real, el estudiante debe conocer y autorizar el importe y método antes de cobrar. Primero se necesita el catálogo de precios vigente o una confirmación del total; la casilla del demo sin precios no reemplaza esa autorización financiera.

En el hackatón se puede demostrar todo el recorrido con ID ficticio y botones `Confirm payment` / `Decline`, dentro del bloque marcado **Demo**. No se abre ni opera ninguna caja real. El pedido retail no entra a Preparing hasta confirmación; el backend impide confirmar dos veces la misma operación y no acepta IDs arbitrarios desde el navegador. Para un pedido presencial, el empleado registra un pago de mostrador de ejemplo, no un cargo remoto a una cuenta inventada.

No hay devolución automatizada: una vez confirmado el pago simulado, el estudiante no puede cancelar ese pedido por su cuenta. Un sistema real necesita void/refund, referencias de transacción, conciliación y permiso de cobro antes de usar ese flujo. Este control evita presentar como resuelto un reembolso que el demo no ejecuta.

## Aclaración operativa de Jorge

Jorge describe que, al introducir el ID como método de pago en la caja, el empleado puede ver el nombre y los datos de esa cuenta. Para el flujo solicitado, el website identifica al usuario del pedido por el ID y entrega ese ID al panel; el empleado consulta/procesa el pago en el POS y después confirma el resultado en el panel. Es una descripción del usuario, no una prueba ejecutada por el equipo contra el POS.

El demo conserva ese paso manual simulado y no inventa un nombre real, saldo o respuesta del proveedor. La autorización financiera real y la integración siguen pendientes de validación con Dining; que la caja muestre un nombre no autentica por sí mismo a la persona que hizo el pedido web.

## Qué demuestra esta versión local

Se construyen dos estudiantes ficticios, cuentas de personal con estaciones asignadas y una cuenta manager. El estudiante entra sólo con10001/10002. No se verifica identidad: **cualquiera que conozca uno de esos IDs puede entrar al perfil ficticio**. El backend aplica permisos y propiedad entre sesiones, pero eso no convierte los perfiles públicos en cuentas privadas. El personal usa identificador y contraseña pública de prueba `CampusDemo!26`. No usar este mecanismo como verificación institucional ni introducir IDs reales.

| Cuenta demo | Acceso |
|---|---|
|10001 /10002| Perfil ficticio por ID, sin contraseña; aliasesD10001/D10002 compatibles |
| cafeteria | Plancha compartida Omelet/Hamburger y estación Sandwich dentro de Cafeteria |
| hub | The Hub |
| frothy | Sólo Frothy Monkey |
| starbucks | Sólo We Proudly Serve Starbucks |
| coffee | Supervisor demo de ambos cafés, compatible con la versión anterior |
| manager | Todas las estaciones y escenarios del reloj |

Las sesiones usan cookies HttpOnly y caducidad; cerrar sesión las revoca. Las contraseñas se almacenan con hash y sal. Los permisos se verifican en la API, no únicamente ocultando botones. Referencia de diseño: [sesiones de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). HTTPS, cuentas individuales privadas y configuración institucional son necesarios antes de exponer una versión real.

## Cómo operar sin un iPad por estación

**Cafeteria:** una laptop existente o un iPad compartido muestra las dos colas físicas: plancha Omelet/Hamburger y Sandwich. El panel `/panel/cafeteria` permite filtrar los servicios y muestra Standby, Preparing y Ready; no necesita confirmar otro pago. El cambio de menú de las 11 no elimina los pedidos aceptados ni exige otro dispositivo. Un empleado coordina la entrada y marca avances; la persona que prepara confirma verbalmente cuando termina. Si ya hay una pantalla externa, puede ampliar la misma vista, sin comprar una tablet por estación.

**Locales separados:** Hub y cada café necesitan alguna forma de recibir sus pedidos. Puede ser una computadora existente o un teléfono autorizado del personal con la vista de su local. Una sola laptop central también puede recibirlos, pero requiere una persona que comunique los pedidos y confirme estados; sin esa comunicación no se puede prometer actualización en tiempo real para los otros edificios. La cuenta coffee demuestra supervisión de ambos cafés; no implica que estén físicamente juntos.

Para operación real: cada empleado inicia sesión con cuenta individual, recibe sólo sus estaciones y cierra/bloquea sesión al terminar turno. El manager administra asignaciones y bajas. No ofrecer registro público de personal ni dejar que el usuario se otorgue rol de empleado. Esta versión usa asignaciones predefinidas; aún no hay administrador de altas/bajas ni auditoría individual completa de cambios.

## Qué significa la cola

- Hay cinco colas físicas: plancha de Cafeteria, Sandwich, Hub, Frothy y Starbucks. Los seis IDs de menú/servicio incluyen Omelet y Hamburger, que comparten la misma plancha y no duplican su capacidad.
- Pedidos online y presenciales consumen el cupo total de su franja; el límite online reserva parte de la capacidad para el mostrador.
- El panel combina las colas autorizadas y permite filtrarlas. Cada ticket conserva servicio/artículo, estación, franja, opciones y exclusiones. La pausa online y la capacidad de Omelet/Hamburger son compartidas; Sandwich es independiente.
- El estudiante ve pedidos digitales anteriores activos, no un conteo de personas en la fila física. La entrada presencial requiere que un empleado registre el ticket.
- La posición es orientativa: elegir ventanas futuras y diferentes tiempos de preparación impide prometer un turno FIFO exacto. No se inventan minutos de espera.
- Pausar online detiene nuevas reservas, pero conserva pedidos aceptados. Al cerrar, se bloquean nuevas franjas y se sigue viendo lo que falta preparar o entregar.

La política del draft usa franjas de diez minutos, al menos dos minutos de anticipación y exige que la franja completa termine antes del cierre de su servicio. Eso es una regla propuesta de la app, no un cutoff oficial de Sodexo.

Para la nueva Cafeteria se usa **8 AM–8 PM diario como supuesto provisional pendiente de Jorge**: Omelet **8–11 AM**, Hamburger **11 AM–8 PM** en la misma plancha y Sandwich **8 AM–8 PM continuo**. Las horas no se presentan como verificadas con Sodexo; la investigación anterior queda conservada como antecedente en [fuentes y horarios](RESEARCH_DINING_V2.md).

**Right now** solicita la primera franja válida con cupo. **Schedule** permite elegir entre las franjas restantes de omelet para hoy, dentro de 8–11 AM, sin limitar esa lista a las próximas dos horas. No habilita hamburguesas antes de las 11 ni permite cruzar el cambio de servicio. La última franja de omelet termina a las 11; Sandwich continúa durante el cambio. El pedido aceptado y sus opciones siguen siendo los mismos después de cambiar el reloj o actualizar el menú. Recuperar un intento incierto utiliza la clave y selección originales.

El manager puede ensayar la mañana, el cambio de turno y la tarde con **Breakfast**, **Transition** y **Lunch**. Estos presets se anuncian como hora simulada; no cambian el reloj del dispositivo.

## Seguimiento y pedidos no retirados

El estudiante retail sigue las etapas pedido enviado → pago recibido de ejemplo → preparando → listo → recogido. El empleado confirma pago y cambia los estados desde el panel del local. Una tablet compartida es una opción; una laptop ya disponible también sirve. No hay dispositivo por estudiante ni necesidad de una tablet en cada estación de Cafeteria.

Un pedido pagado que no se recoge conserva el estado de pago aprobado; el demo no devuelve dinero automáticamente ni aplica una penalización. La política real de no-shows tiene que explicarse antes de la compra y acordarse con Dining. Prepago reduce el riesgo de preparar una orden sin cobrar, pero no garantiza que el local nunca tenga costos, devoluciones o desperdicio.

El manager puede crear hasta tres tickets sintéticos de cola en una estación. Tienen un ID claramente ficticio QUEUE-DEMO, están identificados como simulación y respetan capacidad y cierres. Luego se crea el pedido del estudiante y se ve cómo disminuyen los tickets digitales anteriores al recogerlos.

## Qué hay que confirmar antes de un piloto

1. IT: proveedor institucional, datos mínimos disponibles, vínculo ID–cuenta y desactivación de usuarios.
2. Dining: acceso al comedor, meal exchange, pago, recogida, pedidos no retirados y catálogo vigente.
3. Responsables de cada local: horario de cada estación, última orden aceptada, capacidad por franja y dispositivos existentes.
4. Prueba supervisada: dos empleados concurrentes, desconexión/reconexión, cierres, cambio de turno y accesibilidad en el dispositivo real.

La verificación de esta ampliación se debe registrar después de integrar cliente y servidor; QA_V2.md y los registros V3/V4 describen revisiones anteriores, no prueban por sí solos este cambio. Este documento distingue el diseño del piloto de lo que realmente demuestra el hackatón.
