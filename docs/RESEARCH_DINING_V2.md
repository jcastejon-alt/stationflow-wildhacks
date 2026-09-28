# Dining V2 — cafés, Cafeteria y horarios

Verificación: **26 de septiembre de 2026**, aproximadamente **17:01 America/Chicago / 22:01 UTC**. Investigación de lectura pública; este documento no representa aprobación de Trevecca/Sodexo ni una integración operativa. No se publicaron datos, se contactó a nadie ni se enviaron pedidos.

## Resultado para decidir la estructura

La navegación de la app puede mostrar cuatro locales: **Cafeteria — Apple Dining Hall**, **The Hub**, **Frothy Monkey** y **We Proudly Serve Starbucks**. Dentro de Cafeteria se colocan **Omelet Station** y **Sandwich Station**, según el alcance pedido por Jorge. Esa agrupación es una decisión del producto; las fuentes públicas no validan el horario independiente de cada una de esas estaciones.

Los dos cafés necesitan catálogos y colas propios. Las fuentes confirman su existencia, ubicación y horarios regulares; **no se encontró un menú campus exhaustivo vigente ni una lista de artículos elegibles para exchange**. Se puede continuar con catálogos separados de muestra, claramente identificados.

## Nombres, ubicaciones y horario publicado

Horas locales de campus; mostrar la zona `America/Chicago`. “Regular” no incluye confirmación de feriados, cierres excepcionales o cambios del día.

| Local | Ubicación publicada | Lunes a viernes | Sábado | Domingo | Fuente |
| --- | --- | --- | --- | --- | --- |
| Frothy Monkey | Waggoner Library | 08:00–20:00 | 08:00–16:00 | Cerrado | [Página oficial](https://trevecca.sodexomyway.com/en-us/locations/frothy-monkey) |
| We Proudly Serve Starbucks | Bud Robinson Building | 07:00–16:00 | Cerrado | 08:00–15:00 | [Página oficial](https://trevecca.sodexomyway.com/en-us/locations/we-proudly-serve-starbucks) |
| The Hub | Nivel inferior de Jernigan Student Center | 11:00–22:00 | 11:00–19:00 | 11:00–19:00 | [Página oficial](https://trevecca.sodexomyway.com/en-us/locations/the-hub) |
| Dining Hall / Apple Dining Hall | Jernigan Student Center | Breakfast 07:00–09:30; Lunch 11:00–14:00; Dinner 17:00–20:00 | Brunch 10:00–14:00; Dinner 17:00–20:00 | Brunch 09:00–14:00; Dinner 17:00–20:00 | [Página oficial](https://trevecca.sodexomyway.com/en-us/locations/dining-hall) |

**Discrepancia Dining Hall:** la FAQ 2026–2027 sitúa el brunch de fin de semana desde las 10:00, mientras la página del local muestra 09:00 para domingo. También describe servicio reducido de 14:00 a 17:00 entre semana, con productos seleccionados. Esto no demuestra que las estaciones personalizadas operen durante todo ese tramo. [FAQ oficial](https://trevecca.sodexomyway.com/en-us/meal-plan/faq).

**Calidad del índice de horarios:** el resultado indexado de `locations/hours` mostraba semana 21–27 de septiembre. Al abrirlo y al hacer GET HTTPS directo, el documento servido mostraba semana **14–20 de septiembre** y “Closed” en todos los locales. No usar ese estado como prueba de cierre actual. Se verificaron directamente los horarios regulares de las páginas individuales de ambos cafés, con HTTP 200 y fecha del servidor 26-09-2026. [Índice oficial de horarios](https://trevecca.sodexomyway.com/en-us/locations/hours).

## Qué se sabe de los menús

### Frothy Monkey

La página de campus describe café tostado en Nashville, syrups de elaboración propia y bebidas con espresso. No enumera tamaños, leche, sabores, comida, precios ni productos agotados del día. Su HTML no contiene un enlace a un PDF de menú del café; el PDF encontrado en su navegación es el brochure general de meal plans. [Fuente campus](https://trevecca.sodexomyway.com/en-us/locations/frothy-monkey).

El sitio comercial de Frothy Monkey sí publica un menú amplio de cafés, comidas y bar. No identifica allí ese menú como el catálogo de Waggoner Library. **No se debe copiar su menú completo al campus ni trasladar sus precios, bebidas estacionales o disponibilidad.** [Menú de la marca, contexto general](https://frothymonkey.com/menu/).

### We Proudly Serve Starbucks

Ese es el nombre completo del local en Sodexo, aunque la FAQ lo abrevia a “Starbucks”. La descripción incluye café, espresso, pastelería, dulces y té Teavana. La página avisa que la oferta puede variar y enlaza al menú general de Starbucks para información de nutrición/alérgenos; ese enlace no certifica el surtido local. No se encontró allí un PDF de menú campus. [Fuente campus](https://trevecca.sodexomyway.com/en-us/locations/we-proudly-serve-starbucks).

El programa **We Proudly Serve Starbucks** ofrece bebidas de la marca a operaciones de foodservice y varias modalidades de servicio. No demuestra que el local campus tenga todo el catálogo o las funcionalidades de una tienda Starbucks corporativa. No afirmar compatibilidad con Starbucks Rewards, pedidos en la app Starbucks, gift cards o promociones sin una fuente campus específica. [Descripción oficial del programa](https://www.nestlecoffeepartnerssl.com/our-brands/we-proudly-serve-starbucks).

### Cafeteria y The Hub

“Cafeteria” puede ser la etiqueta comprensible de navegación, manteniendo **Apple Dining Hall** como nombre del lugar. La página oficial enumera deli, grill y otros tipos de comida, pero no recuperamos la lista de modificadores de Omelet/Sandwich ni sus horarios independientes. [Dining Hall](https://trevecca.sodexomyway.com/en-us/locations/dining-hall).

El research anterior cubre el [PDF público de The Hub](https://media-prd.sodexomyway.net/web/en-us/media/The%20Hub%20%28Menu%29_tcm17-53490.pdf): orienta categorías, pero no se verificó vigencia actual ni elegibilidad exchange por artículo. Mantener esa distinción al ampliar locales.

## Meal exchange en los dos cafés

La FAQ confirma que hay un **menú específico** para exchanges en The Hub, Frothy Monkey y Starbucks. No publica cuáles bebidas, tamaños, alimentos o combinaciones califican. Tampoco especifica un horario exclusivo de canje ni un cutoff digital. [FAQ oficial](https://trevecca.sodexomyway.com/en-us/meal-plan/faq).

**Propuesta para demo:** todos los productos disponibles pueden solicitarse de forma regular; sólo ejemplos expresamente marcados pueden ofrecer `Use meal exchange (demo)`. Si se decide incluir ejemplos elegibles en cafés, la validación servidor debe admitir los locales retail configurados, y ya no limitarse rígidamente a `stationId === 'hub'`. Se trata de una propuesta de contrato: no es una regla oficial ni una afirmación de implementación existente. Un latte real no se vuelve elegible por esta bandera de prueba.

Copy recomendado: `Sample menu · Meal-exchange eligibility is fictional`. En la confirmación: `No payment or real meal swipe was taken`.

## Cierres y cutoffs: qué es real y qué es configuración

**Verificado:** existen las horas regulares de local de la tabla. **No verificado:** cuánto antes del cierre se deja de aceptar un pedido, último pickup, pausas de cocina, horarios de Omelet/Sandwich, cierres académicos excepcionales y cobertura actual de Everyday por estación.

Por tanto, `15 minutes before close`, por ejemplo, sólo puede ser una **regla configurable de demo**, nunca “Sodexo’s cutoff”. Tampoco debe suponerse que un local abierto significa que todas sus estaciones aceptan pedidos.

Modelo propuesto:

- `venue`: Cafeteria, Hub, Frothy, WPS Starbucks; cada uno con nombre, localización, fuente y horario regular de referencia.
- `station`: unidad real de cola/cupo; Omelet y Sandwich pertenecen a Cafeteria. Los cafés mantienen sus propias estaciones.
- `orderingSchedule`: configuración de la simulación, separada del horario publicado. Incluir `sourceStatus: sample | published-reference | operator-confirmed` y fecha de revisión.
- `cutoffMinutes`, `minimumLeadMinutes` y capacidad son reglas de demo configurables hasta que el operador las confirme.
- Sólo ofrecer franjas completas contenidas en un intervalo habilitado: inicio después del mínimo de anticipación y fin no posterior al cierre configurado. Usar intervalos de apertura `[abre, cierra)`; al llegar a cierre ya no aceptar pedidos nuevos. Nunca ofrecer una franja que atraviese la pausa del mediodía.
- Validar cierre/cupo al enviar, pero recuperar una petición aceptada antes de volver a validar horario. Un reintento no pierde su ticket porque el local haya cerrado.
- Preservar tickets ya aceptados cuando llega el cierre o cambia la configuración. El cierre no cancela ni mueve órdenes silenciosamente.

Para la demo de hackatón, conservar un modo explícito que permita mostrar el circuito fuera de horario. La UI debe distinguir `Published regular hours` de `Demo ordering hours`. Si un horario desconocido se simula, mostrarlo como simulación; no presentar “Omelets served until 9:30 AM” como dato confirmado.

## Catálogos separados propuestos para avanzar

Estos son **ejemplos de interfaz**, no el menú actual de cada café. No se proponen precios ni nutrición.

| Catálogo | Ejemplos ficticios de productos | Modificadores de ejemplo |
| --- | --- | --- |
| Frothy Monkey demo | Brewed coffee, espresso, latte, iced latte, café mocha | Temperatura cuando aplique, tamaño genérico, leche, syrup opcional |
| WPS Starbucks demo | Brewed coffee, caffè latte, cappuccino, hot tea, bakery item | Temperatura cuando aplique, tamaño genérico, leche, opción de té |
| Cafeteria demo | Build your omelet; Build your sandwich | Mantener los constructores existentes, bajo el local padre |
| The Hub demo | Catálogo existente separado | Mantener regular/exchange según banderas ficticias |

Cada artículo tiene `venueId/stationId` propio, disponibilidad independiente y sus modificadores. No mezclar menús por compartir “latte”, “sandwich” o “coffee”. Las colas/cupos pertenecen a la estación que lo prepara.

## Pendientes que requieren datos del campus

1. Menú local actual de Frothy y WPS, tamaños, modificadores, precios y disponibilidad.
2. Lista exacta de combos/artículos exchange y horario aplicable.
3. Horario propio de Omelet y Sandwich, incluido el domingo.
4. Última hora de orden, preparación y pickup por estación; tratamiento de pedidos que quedan al cerrar.
5. Cierres de vacaciones/eventos y responsable de actualizar horarios.
6. Cobertura de Everyday y autorización para un eventual piloto.

No se encontraron PDFs de menú campus para los dos cafés en las páginas y búsquedas oficiales revisadas. Esto describe el alcance de la búsqueda; no prueba que no exista un documento interno o un menú físico.
