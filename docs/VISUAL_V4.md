# StationFlow — revisión visual V4

26 de septiembre de 2026. Alcance: acabado visual local de la app, sin publicación, cambios de API ni cambios en reglas de pago, capacidad o permisos.

## Dirección aplicada

- Fondo papel cálido, morado profundo, detalles dorados y salvia. Títulos Georgia, interfaz Rethink Sans.
- Login compuesto como un cartel de campus junto al formulario de ID; versión compacta para móvil.
- Identidad gráfica distinta para Cafeteria, Hub, Frothy y Starbucks mediante CSS e iconos existentes. Sin fotos que se presenten como productos reales del campus.
- Menús con selección clara, opciones táctiles y revisión del pedido; en móvil los primeros productos aparecen en la primera pantalla.
- Ticket con código destacado, separadores de recibo, progreso y aviso de recogida. Historial con el mismo lenguaje visual.
- Panel por local con estados diferenciados, ID separado del código de recogida y controles secundarios plegables.

Las cinco variantes de Rethink Sans se sirven desde `public/fonts`, con su licencia OFL. Se eliminó el import remoto a Google Fonts. Georgia usa la fuente del sistema. No se añadieron dependencias de ejecución ni servicios externos.

## Verificación

Revisión del coordinador después del trabajo de tres agentes:

- Login de estudiante: escritorio, 768×1024 y 390×844.
- Locales y Cafeteria: revisión visual en móvil, sin desbordamiento horizontal observado.
- Menú Hub: cabecera móvil reducida; selección, franja, autorización y resumen verificados con controles reales.
- Pedido ficticio `430805`, Student 10001, tenders + BBQ: recibido en el panel del Hub → pago confirmado → standby → preparando → listo → recogido. Ambas pantallas usaron sesiones independientes.
- El aviso Ready apareció en el teléfono simulado con la página abierta. Se guardó la captura antes de marcar el ticket recogido.
- Historial: confirmó el ticket como Picked up; se eliminó la repetición de local cuando nombre y ubicación son iguales.
- Staff sign-in y panel Hub revisados a 768×1024; toolbar compacta. Acceso staff y Switch ID regresan a sus rutas de entrada.
- Se restauraron los tamaños de navegador después de la revisión.
- TypeScript y build de producción: PASS en la versión final. El trabajo visual no requirió repetir la suite de backend; su evidencia de 52 pruebas se conserva en [QA V3](QA_V3.md).

## Contraste y acceso

Se aplicó la guía a11y-audit con inspección de fuente, scanner y comprobación de contraste. El scanner estático produjo 65 alertas; se revisaron los casos relevantes y se descartaron falsos positivos por composición React, etiquetas anidadas y semántica implícita. No equivale a una certificación completa de WCAG.

Se corrigieron tres problemas concretos y se volvieron a calcular sus contrastes:

| Elemento | Resultado final | Criterio pertinente |
|---|---:|---|
| Texto de contador de cola | 5.03:1 | Texto normal ≥4.5 |
| Placeholder ID de 29–30 px | 4.14:1 | Texto grande ≥3 |
| Borde de campo student/staff | 3.38:1 | Componente de interfaz ≥3 |

Se verificó foco visible durante la navegación por teclado, etiquetas de formularios y selección de opciones. Los estilos respetan `prefers-reduced-motion`. No se realizó una auditoría con lector de pantalla ni en dispositivos físicos.

## Capturas

- `artifacts/login-desktop-v4.png`: entrada final de escritorio.
- `artifacts/login-mobile-v4.png`: composición de entrada móvil.
- `artifacts/places-desktop-v4.png`: cuatro locales.
- `artifacts/places-mobile-v4.png`: selección móvil.
- `artifacts/menu-mobile-v4.png`: menú compacto y selección.
- `artifacts/ready-mobile-v4.png`: aviso Ready del ticket 430805, que después se marcó recogido.
- `artifacts/kitchen-tablet-v4.png`: panel Hub a tamaño tablet.

Son capturas reales de la app local. Los estados y horarios reflejan el reloj simulado; no son una operación universitaria real. Sigue pendiente el ensayo con celular e iPad físicos después de definir la conexión. No se abrió una red LAN ni un túnel, ni se desplegó o subió el proyecto.
