# Revisión integral de uso · StationFlow

**Estado:** prototipo local para WildHacks, 27 de septiembre de 2026. Esta revisión cubre el recorrido del estudiante, el panel del empleado, los menús, el servidor y la interfaz en tamaños de escritorio, tableta y celular. Las cuentas, los precios y los pagos son de demostración.

## Recorrido comprobado

1. En el navegador del estudiante se inició sesión con el ID ficticio `10001`. Se personalizó una **Hub burger** con lettuce, cheese, tomato y ranch, se agregaron papas como segundo artículo, se eligió una ventana y se autorizó un pago simulado.
2. En otro navegador, la cuenta `hub` recibió **un ticket con ambos artículos**, el ID y las opciones. El empleado confirmó el pago, ingresó el pedido y lo marcó listo.
3. La página del estudiante actualizó el estado en cada transición y mostró el aviso de recogida. El ticket continuó en estado **Ready** después de recargarlo. También se comprobó por separado un pedido de **un solo meal swipe**. No se realizó un cargo ni se consumió un swipe real.

La auditoría automatizada final pasó **73/73 pruebas** y `npm run build`. Incluye reglas de carrito, límite de un swipe, validación de opciones, horarios/cupos, reintentos, permisos, persistencia y transiciones de empleado. Se inspeccionó la interfaz final a 1280×720 y se verificaron los cambios responsivos a 390×844, 768×1024 y 844×390. La prueba en **teléfono y iPad físicos sigue pendiente**.

## Ajustes hechos ahora

| Área | Cambio y beneficio |
|---|---|
| Menús | Categorías desplegables con ilustraciones. La burger y el wrap muestran una ilustración por ingrediente o salsa seleccionable; las opciones del wrap siguen el letrero fotografiado, con tres salsas extras rotuladas como demo. |
| Personalización | Sandwich empieza por Wrap o Sandwich. Cada selección sigue en su pantalla; base, proteína, queso, vegetales, salsas y tostado al final. Siete vegetales/salsas caben en dos columnas a 1280×720 sin quedar detrás del botón. |
| Carrito | Cada artículo se configura antes de agregarse. El menú regular acepta varios artículos de un mismo local; meal swipe permite exactamente una unidad elegible y el servidor lo vuelve a validar. |
| Disponibilidad | Tarjetas de locales/estaciones distinguen pedidos abiertos, programación posible y servicio cerrado o pausado. Cuando está cerrado ofrecen explorar el menú y muestran el próximo servicio, sin prometer que se puede ordenar de inmediato. |
| Celular | El pie del wizard conserva un resumen compacto del artículo/paso o del carrito/total. En pantalla horizontal baja, el botón de continuar permanece visible; las opciones se desplazan dentro del paso cuando la altura no alcanza. |
| Empleado | A la hora de almuerzo, el panel de Cafeteria selecciona Hamburger para la plancha compartida, conserva una sola cola, muestra cuánto lleva esperando un ticket activo y mantiene visible la confirmación de una acción al desplazarse. |
| Acceso y navegación | Cada ruta actualiza el título y mueve el foco al contenido principal; un cierre de sesión fallido conserva la vista con la que se puede reintentar. El error del ID se asocia al campo para tecnologías de asistencia. |

## Siguientes mejoras por prioridad

1. **Ensayo físico de la demo (prioridad alta).** Abrir el sitio en un teléfono y un iPad de la misma red, enviar un pedido nuevo y repetir todas las transiciones. El Wi‑Fi de la universidad podría impedir conexiones entre dispositivos; eso no se ha comprobado. El aviso actual aparece **dentro de la página abierta**, con la pantalla activa; no hay push con el navegador cerrado o el teléfono bloqueado.
2. **Velocidad de las ilustraciones (prioridad media).** Las tres hojas PNG suman aproximadamente **6.4 MB**. Exportaciones WebP/AVIF más pequeñas reducirían la carga inicial en redes lentas. Mantener las hojas originales como referencia y verificar visualmente cada conversión antes de sustituirlas.
3. **Flujo del panel durante muchos pedidos (prioridad media).** `src/Kitchen.tsx` usa un bloqueo de acción compartido mientras guarda y sincroniza. Para operación real, conviene bloquear solo el ticket que se está cambiando y permitir que otro empleado avance otros tickets. El flujo de la demo no depende de esa concurrencia adicional.
4. **Datos y operación institucional (fuera del alcance de este demo).** Verificar con Dining/IT los horarios, el menú, los precios y los beneficios vigentes. El ID solo no autentica estudiantes; el cobro y la confirmación del POS siguen siendo simulados. Antes de ofrecer pedidos reales se necesita identidad verificada, integración o procedimiento de pago aprobado y manejo de pedidos no recogidos.

La presentación técnica se actualizará después de cerrar el código, como pidió Jorge. El proyecto **no se ha publicado ni subido a Cloudflare**.
