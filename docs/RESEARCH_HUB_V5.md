# The Hub: menú, precios y horarios

Revisión de fuentes primarias por agente, 27 de septiembre de 2026.

- [The Hub, Trevecca Dining](https://trevecca.sodexomyway.com/en-us/locations/the-hub): publica hamburguesas, chicken tenders, flatbreads y fries como categorías. Horario regular: lunes–viernes 11 a. m.–10 p. m.; sábado–domingo 11 a. m.–7 p. m.
- La FAQ de Trevecca Dining confirma que existe un menú específico de meal exchange. En las páginas, folleto y referencias a Everyday revisadas no se encontraron precios públicos por plato, cantidades, lista detallada de modificadores ni todos los componentes de cada exchange.
- El índice de horarios devolvió una semana anterior al consultarlo. Por tanto, los horarios regulares de la página del local no constituyen verificación de cierres especiales, festivos ni restricciones horarias adicionales de meal swipe.

## Decisión del demo solicitada por Jorge

Meal swipe permite **Chicken tenders** y **Campus burger**. Esta selección procede de la instrucción de Jorge; no se atribuye a verificación institucional independiente.

Después de explicarle que no había precios públicos, Jorge autorizó explícitamente usar importes inventados para el demo. La interfaz los identifica como **Demo prices**, con estado `demo` y sin atribuirlos a una fuente oficial. Valores: tenders $8.49, Campus burger $8.99, veggie wrap $7.49, chicken wrap $8.49, garden salad $6.49, fries $2.99 e iced tea $1.99. Los modificadores se incluyen en estos ejemplos; no se calculan impuestos ni cargos reales. La modalidad Meal swipe se muestra como un swipe, sin convertirlo en un precio monetario de cero dólares.

Secuencia: plato → personalización, cuando corresponda → salsa → ventana de recogida del día. Los modificadores son ejemplos del prototipo mientras no se obtenga una lista oficial. Se mantienen las ventanas de hoy, el horizonte de dos horas del servicio retail y la validación de que toda la franja termine antes del cierre. No se implementan reservas para otros días por esta solicitud.

Todo pago sigue siendo simulado. El servidor asigna la modalidad y la información de precio al ticket; el navegador no puede enviar un importe arbitrario.
