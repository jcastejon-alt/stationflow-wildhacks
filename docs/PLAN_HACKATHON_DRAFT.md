# StationFlow · Plan de hackatón, draft local

Actualizado: 27 de septiembre de 2026. Nombre provisional, sujeto a Jorge. Prioridad actual: avanzar lo máximo posible en un prototipo revisable, sin subir a GitHub, desplegar, abrir túneles ni hacer entregas externas. Los prompts anteriores son antecedentes; esta decisión actual reemplaza sus instrucciones de publicación. La ampliación de Cafeteria descrita abajo está en integración; su QA final todavía no se afirma aquí.

## La idea que se presenta

Pedidos remotos para estaciones hechas al momento, con una cola que el personal puede controlar. Un estudiante arma su omelet por la mañana, una hamburguesa después de las 11 o un sándwich durante todo el horario de Cafeteria; también puede elegir del menú propio de The Hub, Frothy Monkey o We Proudly Serve Starbucks. Reserva una ventana con cupo y recibe un ticket. Cocina recibe exactamente sus opciones y exclusiones, prepara y marca Ready. El estudiante ve el aviso y recoge con su código.

El problema viene de la observación de Jorge: filas, repetición verbal y boletas impresas que hay que cortar. La cifra de unas 200 páginas cada dos días es un relato pendiente de medir, no ahorro comprobado. El prototipo no debe afirmar que es la primera app de pedidos de Trevecca: Everyday ya existe y su cobertura concreta necesita verificarse con el personal.

## Alcance del draft

| Prioridad | Parte | Resultado verificable |
|---|---|---|
| P0 | Cafeteria | Una plancha Omelet/Hamburger por turnos y Sandwich continuo; constructores con opciones, exclusiones, resumen y ticket persistente |
| P0 | Hub y cafés | Menús separados; cuenta campus o meal exchange ilustrativo; autorización remota y confirmación de pago simulado por empleado |
| P0 | Cuentas | Dos estudiantes ficticios con historial propio; personal asignado por estación; manager |
| P0 | Horarios | Cafeteria provisional 8–20 diario: Omelet 8–11, Hamburger 11–20 y Sandwich 8–20; cada franja cabe dentro de su servicio |
| P0 | Motor de pedidos | Right now toma el primer cupo válido; Schedule ofrece todas las franjas restantes de omelet hoy; base compartida, cupos por cola física/franja y reintentos sin duplicados |
| P0 | Cocina | Una pantalla para las colas asignadas; retail New orders → Standby → Preparing → Ready → Picked up, con pago simulado previo; Cafeteria comienza en Standby |
| P0 | Seguimiento | Token privado, pedidos digitales delante, ventana estimada, aviso visible al estar listo |
| P1 | Operación | Pausar estación, ajustar cupo, agotar artículos/ingredientes y registrar walk-in |
| P1 | Avisos del sistema | Opción para navegador compatible mientras la app permanece abierta; reportar lo realmente verificado |
| Siguiente | Web Push de fondo | Implementar suscripción y envío desde servidor, HTTPS y prueba real con permiso; iPhone requiere Home Screen compatible |
| Posterior | Piloto real | Aprobación Dining Services, datos de menú reales, seguridad y acceso/pago acordados |

No hay cobros ni swipes reales, SSO institucional, IDs reales, pedidos a Sodexo ni garantía alimentaria. Las cuentas son ficticias y usan credenciales públicas para probar permisos. Un plato por ticket simplifica la capacidad. Los precios y calorías no se inventan. Menús y exchange son ejemplos; los locales retail usan horarios regulares publicados como referencia, con limitaciones documentadas y escenarios de reloj simulados. **El horario completo de Cafeteria 8–20 diario sigue pendiente de confirmar con Jorge**, no se afirma como horario oficial. Cafeteria verifica acceso en la entrada: sus estaciones no cobran otro swipe. Retail tiene un paso de pago simulado separado; la posibilidad y autorización de cobrar remotamente por ID en el POS real sigue pendiente de verificación con Dining.

El cambio de Cafeteria mantiene **cinco colas físicas y seis IDs de menú/servicio**. Omelet y Hamburger usan la misma plancha, capacidad y pausa; Sandwich conserva una cola independiente y continúa durante el cambio de las 11. No se habilita Hamburger antes de las 11. Cada franja dura diez minutos, necesita dos minutos de anticipación y termina dentro del horario del servicio. Right now significa la primera ventana válida con cupo, no entrega inmediata; Schedule en Omelet ofrece las franjas válidas restantes de hoy entre 8 y 11, no de mañana. Los escenarios **Breakfast**, **Transition** y **Lunch** permitirán ensayar estos límites.

## Experiencia y estética

La página oficial usa morado `#532c6d`, blanco, texto neutro, Rethink Sans, titulares fuertes y navegación redondeada. El draft toma esa dirección: morado, fondos claros, tipografía limpia y tarjetas amplias. Mantiene nombre/identidad propios; sin logos oficiales ni fotografías generadas del producto.

Estudiante: entrar con ID ficticio → escoger local/servicio → construir pedido → Right now o ventana programada → autorizar pago de ejemplo si es retail → ticket. Cafeteria agrupa la plancha Omelet/Hamburger y Sandwich sin otro cobro por estación. The Hub conserva el catálogo general visible, aunque un plato no sea elegible para exchange. Cocina prioriza legibilidad en tablet, exclusiones y botones grandes. Indicador permanente: `Independent prototype · Demo orders only`.

## Arquitectura decidida para esta iteración

React + TypeScript + Vite en el cliente; Node + Express en la API; SQLite persistente en el servidor. El almacenamiento compartido permite dos ventanas/navegadores reales viendo los mismos pedidos. `localStorage` se limita a recuperar ticket y clave de reintento, no es la base de pedidos.

Reservas y cambios se validan en servidor dentro de transacciones. Los pedidos conservan una fotografía de sus opciones; agotar un ingrediente después no modifica silenciosamente pedidos aceptados. Las franjas no se mueven automáticamente. El código de recogida sirve para cotejar una entrega; el token aleatorio y una sesión autorizada permiten consultar el ticket. El servidor vincula el propietario; escribir un ID ajeno en una petición no cambia esa identidad. Cancelar no libera cupo en este draft, decisión conservadora documentada.

Poll cada 3 segundos basta para una demo de cocina. El panel usa cuentas ficticias con permisos por estación. Una laptop puede mostrar todas las colas asignadas; personal en edificios separados todavía necesita acceso a una pantalla o coordinación humana. Los pagos se confirman mediante transacción y el estado aprobado bloquea otra confirmación; no hay integración POS. Por defecto todo escucha en localhost; no se publica ni expone mediante túnel. Ver [decisión de arquitectura](ADR_001_LOCAL_FIRST.md) y [contrato API](API_CONTRACT.md), [ampliación V2](API_V2_PLAN.md) y [cuentas y operación](CUENTAS_Y_OPERACION.md).

## Trabajo por agentes y revisión del coordinador

1. Investigación: fuentes oficiales, estética, diferencias entre hechos y supuestos.
2. Backend: catálogo, base, cupos, idempotencia, estados, controles y pruebas de integración.
3. Frontend: home, constructor, ticket y cocina, conectados a la API.
4. Coordinador: reglas en Discord, arquitectura/contrato, integración, revisión final funcional/visual, correcciones y documentación.

La revisión del coordinador debe probar un pedido que llega a cocina, Ready que aparece en ticket sin recarga manual, persistencia al recargar, Hub regular/exchange, funcionamiento móvil y estados de error. Para este cambio también debe verificar el límite de las 11, Sandwich continuo, capacidad y pausa compartidas de la plancha, pedidos programados frente a inmediatos, permisos de Cafeteria y recuperación del mismo ticket después del cambio de servicio. Registrar los resultados nuevos por separado; los registros V1–V4 son antecedentes. No llamar probada una función que solo está implementada.

## Ruta de aquí a Demo Day

**Domingo 27:** integrar Cafeteria, resolver QA y ensayar la presentación. fionahg publicó hoy el [formulario de entrega](https://forms.gle/kcRmrFY3XbdjH5iQ9) con plazo **antes de las 11:59 PM**. El correo de Fiona del 27 de septiembre, mostrado a las 5:05 PM en Outlook, dice explícitamente “tonight”: queda confirmada la fecha **hoy domingo 27**; sólo la zona horaria no está especificada. El enlace de **Submission** de Discord corresponde al proyecto; Jorge aclaró que el enlace distinto del correo es de registro. [Anuncio de entrega](https://discord.com/channels/1545231728958898237/1551684605915168798/1553849957117726872).

**Lunes 28:** Demo Day a las **4:00 PM en Greathouse 303**, con **cinco minutos de presentación/demo y preguntas después**. Presentar el problema, la solución, el lado técnico y el de negocio; llevar un nombre y mostrar hasta donde llegó el prototipo. Los criterios son problema, innovación, ejecución/plan y presentación/pitch. [Logística confirmada por Sam](https://discord.com/channels/1545231728958898237/1551684605915168798/1553872710621208658) · [Criterios](https://discord.com/channels/1545231728958898237/1551684605915168798/1553875630385397954). Zona horaria no especificada en esos mensajes.

La entrega pide repositorio público y README; el formulario dice que los enlaces deben ser públicos. No se verificó una exigencia de desplegar una web pública. **Sólo cuando Jorge decida** se podrá subir código, hacer accesible una demo o enviar el formulario. Haber leído esos requisitos no autoriza ninguna publicación.

## Qué falta decidir o validar con personas

- Nombre definitivo y cambios de estética de Jorge.
- Menú y modificadores reales, elegibilidad exchange por artículo/combo.
- Cobertura actual de Everyday para estas estaciones.
- Capacidad por turno, espacio para walk-ins y ubicación física de recogida.
- Verificación de acceso/pago y manejo de no-shows para pedidos desde fuera del comedor.
- Responsable del menú, permisos del personal y dispositivos/red para un piloto.
- Medición de fila física, tiempo pedido→listo, pedidos/hora, errores, papel y minutos dedicados a cortar boletas.

## Después del hackatón

Validar primero con estudiantes y cocina. Hacer una prueba supervisada en una estación con consentimiento de Dining Services. Decidir si conviene integrar/extender Everyday antes de crear infraestructura paralela. Una continuidad razonable sería una herramienta operativa administrada por Dining Services, con responsable y costo de mantenimiento definidos; no se asumen ingresos ni ahorros medidos.
