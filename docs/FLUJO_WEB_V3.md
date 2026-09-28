# Flujo web V3 — estudiante y panel por local

Solicitud de Jorge, 26 septiembre de 2026. Se conserva el alcance de demo, sin publicación. La validación del backend precede al pulido de interfaz.

## Recorrido del estudiante

1. Abrir website e introducir únicamente un ID ficticio: 10001 o 10002. Sin contraseña para esta demostración.
2. Ver los cuatro locales: Cafeteria, The Hub, Frothy Monkey, We Proudly Serve Starbucks.
3. Cafeteria abre una selección de Omelet/Sandwich; los otros locales abren directamente su menú.
4. Elegir artículo/opciones y franja disponible. En retail autorizar el pago ficticio; dentro de Cafeteria no existe otro cobro.
5. Enviar y seguir el mismo ticket: recibido → pago confirmado/standby si aplica → preparando → listo → recogido.
6. Recuperar pedidos desde My orders o al volver a entrar al mismo perfil de demo.

Los IDs son perfiles públicos de demostración. Conocer 10001 permite entrar al perfil 10001: **esto no verifica identidad**, y no sirve para dinero ni datos reales. El servidor sigue separando perfiles y tomando el ID del perfil de sesión, pero esa separación no impide que un visitante entre al otro perfil público. No se admiten IDs reales arbitrarios ni se crean cuentas mediante este campo.

## Personal

Entrada separada con cuenta y contraseña de demo. Panel por local, con estaciones asignadas por el servidor. Cafeteria combina dos estaciones en una pantalla; los otros locales muestran su cola. Manager conserva vista general, reloj de ensayo y simulador.

Funciones requeridas: leer pedido e ID ficticio vinculado cuando aplique; aceptar/confirmar o rechazar pago simulado; dejar en standby; preparar; listo; recogido; pausar reservas, marcar disponibilidad, ajustar cupos y registrar presencial. Pago y preparación son estados diferentes. No declarar cobro real.

## Contrato de entrada

POST /api/auth/student, cuerpo {studentId:string}. Sólo 10001/10002 y aliases históricos D10001/D10002. Sesión expirable/revocable y rotación de token; no permite solicitar rol, estación ni identificadores de personal. POST /api/auth/login continúa para empleados con contraseña. Los aliases mantienen compatibilidad y los IDs internos permanecen estables para conservar historiales.

## Criterios de revisión

- Inicio por ID → local → menú/estaciones correcto en móvil.
- Panel del local y cuenta coinciden; URL no concede permisos.
- Pedido enviado aparece con las mismas opciones y código en otro navegador.
- Preparación retail bloqueada mientras el pago siga pendiente/rechazado.
- Reintentar no duplica; último cupo y cambios simultáneos tienen un único resultado válido.
- Cierre no cancela lo aceptado; conserva snapshots y datos al reiniciar.
- Flujo por teclado, controles táctiles legibles, sin overflow a 390 px/768 px.
- El aviso Ready se recibe con la página abierta; no se promete push de fondo.

La evidencia de pruebas y revisión está registrada en [QA V3](QA_V3.md). No se interpreta una suite verde como garantía de ausencia absoluta de errores.
