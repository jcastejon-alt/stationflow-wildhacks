# Cafeterías: fuentes y alcance del demo V6

Revisión de fuentes oficiales, 27 de septiembre de 2026. Este documento describe un prototipo local; no es un menú, precio ni beneficio institucional publicado.

## Lo que confirman las fuentes

- [FAQ de Trevecca Dining](https://trevecca.sodexomyway.com/en-us/meal-plan/faq): existen meal exchanges en The Hub, Frothy Monkey y Starbucks mediante un menú específico de retail. La FAQ no enumera los productos ni modificadores elegibles.
- [Frothy Monkey en Trevecca](https://trevecca.sodexomyway.com/en-us/locations/frothy-monkey): confirma la ubicación en Waggoner Library, café tostado en Nashville, jarabes caseros y bebidas con espresso. Horario regular publicado: lunes a viernes 8 a. m.–8 p. m.; sábado 8 a. m.–4 p. m.; domingo cerrado. No publica su carta concreta del campus.
- [Menú de la marca Frothy Monkey](https://frothymonkey.com/menu/): publica latte, mocha latte, chai latte, espresso doble, café filtrado y cold brew. Indica tamaños de 12 oz caliente y 16 oz frío para lattes; café filtrado caliente de 12 oz; leche de avena y almendra; jarabes de vainilla, banana, avellana y lavanda, además de miel, mocha y caramelo. Es el menú general de la marca, no prueba la oferta del local universitario.
- [We Proudly Serve Starbucks en Trevecca](https://trevecca.sodexomyway.com/en-us/locations/we-proudly-serve-starbucks): confirma bebidas con espresso, café, té y pastelería en Bud Robinson Building, y advierte que la oferta puede variar. Horario regular: lunes a viernes 7 a. m.–4 p. m.; sábado cerrado; domingo 8 a. m.–3 p. m. No confirma un combo de muffin, su composición ni su meal exchange.

## Decisiones del prototipo

- A petición de Jorge, `starbucks-bakery-combo` representa **Muffin + drip coffee combo** con un meal swipe ficticio. La selección de muffin es obligatoria; leche y endulzante del café son opcionales. La marca de elegibilidad procede de la instrucción del usuario, no de una verificación de Trevecca.
- Frothy presenta ejemplos representativos de latte, drip coffee, espresso doble, cold brew, mocha latte y chai latte, inspirados en el menú oficial de la marca. La disponibilidad, las recetas y cada modificador en el campus siguen sin verificar. Ningún producto de Frothy se marca como elegible para meal exchange hasta conocer la lista específica.
- El catálogo de Starbucks incluye bebidas ilustrativas y opciones cortas de leche, endulzante o sabor. Esas opciones tampoco equivalen a una carta verificada del local.
- Los lattes del demo requieren una leche; café filtrado, cold brew y el café del combo admiten la opción negra sin leche. Starbucks ofrece como ejemplos leche entera, 2 %, avena y almendra. En los complementos opcionales, no seleccionar endulzante significa preparar sin endulzante.
- Todos los importes de cafeterías son **precios demo ficticios** autorizados para la simulación: Frothy latte $4.75, drip coffee $3.25, espresso $3.00, cold brew $4.25, mocha $5.25, chai $4.75; Starbucks latte $4.75, drip coffee $3.25, iced tea $3.00, combo $6.95. En el ticket de combo pagado con meal exchange se muestra `meal_swipe` en vez de un importe de $0. No se simulan impuestos ni recargos por modificaciones.

El servidor toma la elegibilidad, el precio y los nombres de opciones del catálogo guardado; el cliente no puede enviar un precio propio. Una orden aceptada conserva su captura de artículo, opciones y precio aunque cambie el menú. La migración del catálogo conserva los indicadores de disponibilidad del personal por ID y retira el antiguo ejemplo `frothy-coffee-exchange` sin borrar tickets previos.

La misma migración corrige el tipo `sauce` de las salsas de hamburguesa y sándwich existentes sin modificar su disponibilidad. El servidor LAN recibe la configuración de horario de cafetería igual que el servidor local (`CAFETERIA_OPENS_AT` y `CAFETERIA_CLOSES_AT`).
