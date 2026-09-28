# Trevecca Dining — investigación para el prototipo

Verificado el **26 de septiembre de 2026**. Esta investigación distingue datos publicados, límites de las fuentes y decisiones propuestas para la demo. No hubo contacto con Sodexo, publicación, despliegue ni envío de pedidos. La instrucción actual de Jorge de **no subir nada** prevalece sobre cualquier instrucción de entrega del prompt anterior.

## Decisiones que ya pueden usar diseño e implementación

- **Identidad visual:** morado `#532c6d`, blanco y sans limpia; referencia extraída del HTML/CSS real de Trevecca Dining. Mantener un nombre y marca propios y el texto visible `Independent prototype · Demo orders only`.
- **Catálogo:** The Hub debe permitir pedidos regulares de todo el catálogo configurado para la demo. Meal exchange es una forma adicional de pedido para artículos/combinaciones expresamente marcados como elegibles en datos de ejemplo.
- **Datos:** no existe evidencia suficiente en las páginas revisadas para presentar el catálogo, los precios o la elegibilidad por artículo como datos actuales. Etiquetar la configuración `Sample menu · Availability and meal-exchange eligibility are examples` y omitir precios reales.
- **Posicionamiento:** proponer un flujo de estaciones, cupos y tickets; no afirmar que Trevecca carece de pedidos móviles. La cobertura exacta de Everyday en estas estaciones no está verificada.
- **Horarios:** usar franjas explícitamente de demo. No derivar el estado real «open» de una fuente que contiene discrepancias o de horas codificadas sin mantenimiento.

## Hechos publicados y límites

### The Hub

La página oficial ubica The Hub en el nivel inferior de Jernigan Student Center y describe cocina a la orden: hamburguesas, chicken tenders, flatbreads y fries. Publica horario regular lunes–viernes 11:00–22:00 y sábado–domingo 11:00–19:00. Es una descripción general, no un inventario exhaustivo ni una lista de elegibilidad exchange. [Fuente oficial](https://trevecca.sodexomyway.com/en-us/locations/the-hub).

### Meal exchange

La FAQ 2026–2027 define meal exchange como una comida fuera del dining hall incluida en un swipe del plan, con **un menú específico** en The Hub, Frothy Monkey y Starbucks. Publica dos exchanges diarios para Premium Access y uno para All Access/Limited Access. Dining Dollars es un mecanismo separado y puede usarse en los locales indicados. La FAQ no enumera qué platos califican ni demuestra una integración autorizada con este prototipo. [FAQ oficial](https://trevecca.sodexomyway.com/en-us/meal-plan/faq).

El brochure enlazado desde el sitio concuerda con esos límites generales de los planes. Tampoco aporta elegibilidad por artículo. [Brochure oficial](https://media-prd.sodexomyway.net/web/en-us/media/Trevecca%20Meal%20Plan%20Brochure_tcm17-65501.pdf).

**Aplicación en el contrato local:** `exchangeEligible: true/false` es configuración de demo claramente declarada; no una deducción por nombre del plato. La API rechaza `paymentMode: 'meal_exchange'` para un artículo no elegible, aunque un cliente manipule su petición. El pedido regular sigue permitido. Ninguna vía cobra ni consume un swipe real.

### PDF público del menú de The Hub: pista, no vigencia confirmada

El PDF existe en el CDN oficial; contiene categorías Grill, Wraps, Salads, Sides, drinks y A La Carte. Incluye, por ejemplo, burgers, Chicken Tenders (4), Chicken Caesar Wrap, Garden Salad, fries y fountain drink, junto con una composición de combo. La extracción no proporciona una fecha de vigencia. El servidor reportó `Last-Modified: Sat, 06 Dec 2025 07:33:19 GMT`; eso fecha el archivo servido y **no certifica** el menú de septiembre de 2026. No se verificó que el combo sea el meal exchange vigente. [PDF oficial](https://media-prd.sodexomyway.net/web/en-us/media/The%20Hub%20%28Menu%29_tcm17-53490.pdf).

Puede orientar categorías y nombres de ejemplos. No importar sus precios como actuales, ni usarlo para afirmar que chicken tenders califica para meal exchange. Para producción falta confirmación del operador sobre catálogo, modificadores, agotados, combos, precios, impuestos y reglas exchange actuales.

### Apple Dining Hall y estaciones

La página Dining Hall ubica el comedor en Jernigan Student Center, describe opciones de grill, deli, ensalada, comida casera, postres y opciones vegetarianas/veganas. Incluye interfaz de fecha, alérgenos y nutrición. No se recuperó un catálogo actual específico de ingredientes para las estaciones Omelet y Sandwich; esos modificadores deben seguir marcados como muestras. [Página oficial](https://trevecca.sodexomyway.com/en-us/locations/dining-hall).

Hay una discrepancia publicada: Dining Hall indica brunch dominical desde las **9:00**, mientras la FAQ da **10:00** para el fin de semana. La FAQ también describe servicio reducido entre 14:00 y 17:00. No codificar una promesa operativa sin aclarar esto con el operador. [Dining Hall](https://trevecca.sodexomyway.com/en-us/locations/dining-hall), [FAQ](https://trevecca.sodexomyway.com/en-us/meal-plan/faq).

La FAQ advierte que no puede garantizar ausencia de alérgenos/gluten. Evitar afirmaciones de seguridad alimentaria basadas en datos inventados. En el prototipo las exclusiones del pedido deben verse claramente; un filtro no equivale a una garantía médica. [Política publicada](https://trevecca.sodexomyway.com/en-us/meal-plan/faq).

### Everyday y propuesta de valor

La página local anuncia pedidos móviles, conexión a planes/Dining Dollars, pagos, menú y preferencias alimentarias. No especifica la cobertura de Omelet Station, Sandwich Station o The Hub. [Everyday en Trevecca](https://trevecca.sodexomyway.com/en-us/everyday/evdmobile).

La web general de Everyday anuncia pickup/delivery, pedidos y pagos, y aclara que las funciones varían por ubicación. [Everyday oficial](https://everyday.sodexo.com/).

**Conclusión de investigación:** no podemos verificar la ausencia de esos flujos en Trevecca, ni afirmar que los inventamos. Formulación propuesta para el pitch: «Exploramos cómo un flujo centrado en estaciones podría coordinar personalización, cupos y recogida para estudiantes y empleados». La supuesta reducción de papel o espera es un beneficio potencial que requiere medición.

## Estética observada en el sitio real

Inspección de HTML/CSS servido por [The Hub](https://trevecca.sodexomyway.com/en-us/locations/the-hub), realizada directamente por HTTPS. Estos son valores de código observados, **no una afirmación de mediciones visuales por screenshot**:

| Elemento | Evidencia observada | Aplicación propuesta |
| --- | --- | --- |
| Navegación | Fondo `#532c6d`, texto `#ffffff` | Morado como color principal y acciones |
| Texto | Neutros `#313132` y `#080808` | Tipografía oscura, alto contraste |
| Tipografía | `body { font-family: Rethink Sans,sans-serif }` | Usar Rethink Sans si está disponible; fallback sans |
| Jerarquía | Headings peso 700; reglas base h1 60px/h2 35px | Títulos grandes y claros, adaptados a móvil |
| Desktop | Contenedor hasta 1400px; nav 95px y radio `1rem` | Encabezado redondeado y ancho contenido |
| Estructura | Navegación por categorías, nombre del local, horario, descripción e imagen | Priorizar estación, disponibilidad y acción de pedido |

El HTML también carga otras fuentes para componentes específicos; **Rethink Sans es la familia del body**. No adoptar automáticamente Roboto/Bebas por el mero hecho de aparecer en links. La aplicación puede evocar el campus con morado, espacios amplios y jerarquía semejante sin reutilizar logos ni aparentar ser una herramienta oficial. Las decisiones de tarjetas, disposición de tickets y controles de cocina son diseño nuevo del prototipo.

## Web Push: alcance verificable para el plan

WebKit documenta Web Push en iOS/iPadOS desde 16.4 para apps añadidas a la pantalla de inicio. El permiso se solicita después de interacción directa del usuario, por ejemplo tocar un botón. Usa Push API, Notifications API y service workers; no exige membresía del Apple Developer Program. [Documentación WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

MDN describe el flujo: service worker activo → suscripción con endpoint/clave → mensaje del servidor → evento `push` → notificación. Puede recibir mensajes sin la página abierta; una notificación generada únicamente por el JavaScript de una pestaña abierta no demuestra este flujo. La URL del endpoint de la suscripción debe tratarse como sensible. [Push API, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).

**Plan de implementación y prueba propuesto:**

1. Aviso dentro del ticket al pasar a `Ready`, siempre funcional, con `aria-live` y texto inequívoco.
2. Botón contextual para activar avisos, con detección de capacidades y fallback visible si no hay permiso/soporte.
3. Push real cuando exista origen seguro y configuración servidor disponible: asociar suscripción al token privado del ticket y enviar sólo al cambiar a `Ready`.
4. Probar permiso concedido, denegado, pestaña cerrada y toque que abre el ticket. Para iPhone probar instalado en Home Screen y registrar dispositivo/versión.
5. Mantener una matriz de «implementado», «probado» y «pendiente». No llamar Web Push a un toast o a una simulación.

Esto documenta viabilidad; **no afirma que push esté implementado o probado**. La prueba entre equipos en una red local puede validar pedidos compartidos, pero por sí sola no valida permisos/service workers/push bajo las mismas condiciones de un origen HTTPS.

## Datos por confirmar antes de una versión real

- Catálogo e ingredientes actuales, disponibilidad diaria, reglas exactas y combos elegibles exchange.
- Capacidad por franja/estación y cómo compartir la cola con pedidos presenciales.
- Cobertura actual de Everyday y posibilidad de integración, en vez de duplicar un flujo existente.
- Permiso de operación, identidad, autenticación del personal, pago/campus-card, no-shows y cancelaciones.
- Horarios discrepantes, condiciones de pickup y quién mantiene los datos.
- Métricas del problema: papel consumido, espera actual, tasa de errores y carga del personal.

Estas validaciones quedan pendientes; la investigación no autoriza contactar, desplegar o publicar.
