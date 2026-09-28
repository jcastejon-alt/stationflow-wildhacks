# Cafeteria: cambio de servicio y horarios de recogida

Solicitud de Jorge, 27 de septiembre de 2026: Omelet funciona de 8 a 11 a. m.; la misma plancha sirve hamburguesas desde las 11; Sandwich funciona durante todo el horario de la cafetería. El estudiante puede pedir **Right now** o elegir **Schedule**.

## Criterios de aceptación

- Una sola plancha física y cola compartida entre Omelet y Hamburger. Los tickets aceptados conservan su menú, opciones y ventana al cambiar el servicio.
- Ninguna ventana de Omelet cruza las 11 a. m.; Hamburger no acepta pedidos antes de las 11.
- Sandwich no hereda las interrupciones de los antiguos bloques de desayuno, almuerzo y cena.
- Right now reserva en el servidor la primera ventana con cupo; es una estimación de recogida, no una promesa de preparación instantánea.
- Schedule muestra las ventanas restantes del servicio del día. Una reserva futura no debe contarse delante de una recogida anterior sólo por haberse creado primero.
- Reintentar una petición incierta devuelve el mismo ticket, incluso después del cambio de menú.
- El personal de Cafeteria puede gestionar ambos servicios de la plancha y Sandwich desde su panel existente.
- Las reglas y pagos de The Hub y los cafés siguen funcionando.

## Horario de referencia del demo

Se propuso 8 a. m.–8 p. m. como rango provisional de la cafetería mientras Jorge confirma apertura y cierre. La regla 8–11 de Omelet y el cambio a Hamburger a las 11 proceden directamente de su solicitud; no se presentan como verificación independiente de horarios oficiales.

## Verificación

Verificación completada el 27 de septiembre, antes de comenzar los ajustes siguientes de The Hub:

- **63/63 pruebas automáticas:** 52 casos previos adaptados y 11 casos nuevos de cafetería, ejecutados por el agente de backend con bases de datos temporales. Cubren frontera de 10:48 y milisegundo siguiente, 10:59/11:00, reservas antes de abrir, capacidad, concurrencia, reintentos, migración de cuentas y conservación de tickets.
- **Build integrado:** `npm run build` pasó (TypeScript y Vite, 1605 módulos).
- **Navegador independiente del coordinador:** a las 8:30 simuladas, una reserva de Omelet para 10:50–11:00 produjo el ticket `271475`. Después, Right now produjo `375144` para 8:40–8:50, sin contar la reserva futura como pedido delante.
- **Cambio a las 11:** Hamburger estaba bloqueado antes de las 11. Después, Omelet mostró el cierre y enlace a Hamburger; el pedido `605784` de hamburguesa fue aceptado con los dos pedidos de desayuno delante en la cola compartida.
- **Continuidad del empleado:** ambos omelets permanecieron en el filtro Grill. El ticket `375144` pasó a Preparing y Ready después de las 11; el estudiante conservó nombre, opciones y ventana originales y mostró el aviso Ready.
- **Vista móvil:** Cafeteria y el selector Right now/Schedule revisados a 390×844; ancho del documento 390, sin desborde horizontal. Tamaño de navegador restaurado al finalizar.
- **Revisión independiente de fuente:** se corrigió la elección del menú activo al pulsar el filtro Grill para que los controles abran Omelet durante Breakfast y Hamburger durante el almuerzo.

Evidencia visual local: `artifacts/cafeteria-pickup-mobile-v5.png`. No se publicó ni desplegó la app. Las pruebas de navegador añadieron tres tickets ficticios al perfil `10001`; no se borraron los pedidos anteriores del usuario. Las horas de apertura/cierre completas permanecen provisionales hasta que Jorge las confirme.
