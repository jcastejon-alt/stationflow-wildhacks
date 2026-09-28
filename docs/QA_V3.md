# QA V3 — entrada por ID y paneles por local

26 de septiembre de 2026. Revisión del flujo solicitado por Jorge. Trabajo local; nada publicado.

## Backend verificado antes de pulir la interfaz

**52/52 pruebas automatizadas PASS**, incluyendo ocho pruebas nuevas del acceso por ID. La suite completa terminó en aproximadamente 12 segundos. Cubre sesiones y permisos, validación, identidad vinculada por el servidor, pago/preparación, horarios, concurrencia e idempotencia. Después de este resultado se inició el frontend con responsabilidades separadas entre tres agentes y revisión del coordinador.

La revisión independiente encontró un defecto: un artículo retirado podía reactivarse y pedirse aunque ya no apareciera en el catálogo. Se corrigieron tanto la reactivación como los pedidos nuevos. Una regresión verifica el rechazo y que el reintento de un pedido previamente aceptado siga recuperando el ticket original. Se conservan snapshots e historiales anteriores.

Pruebas adicionales aisladas del revisor, todas PASS:

- Los 17 artículos tienen IDs de grupos/opciones únicos y límites min/max compatibles.
- Starbucks y Cafeteria durante los cambios de DST del 8 de marzo y 1 de noviembre de 2026: apertura/cierre ±1 ms y última franja exactamente 12 minutos antes del cierre frente a 1 ms después.
- Ráfaga concurrente del simulador, dos pedidos online y tres presenciales, con capacidad total 5/online 3: exactamente cinco tickets, online ≤3, IDs únicos y lista staff sin tokens.
- Reintento de un pedido presencial ya aceptado/preparándose después de reducir capacidad, pausar, agotar y cerrar: mismo ID, snapshot y franja; devuelve el estado actual sin duplicarlo.

Estas pruebas usaron bases temporales; no modificaron la base de la app activa.

## Recorrido manual en dos navegadores

Chrome actuó como estudiante y el navegador integrado como empleado, con sesiones independientes. Se usaron únicamente perfiles y pagos ficticios.

| Comprobación | Evidencia | Resultado |
|---|---|---|
| Entrada sólo por ID | `10001`, sin contraseña; aparecen los cuatro locales | PASS |
| Cafeteria abre estaciones | Omelet y Sandwich; Sandwich abre su menú | PASS |
| Pedido dentro de Cafeteria | Ticket `245460`: Wheat + Turkey, Student 10001, sin cobro adicional; recibido en panel Cafeteria | PASS |
| Hub abre menú directo | Tenders + BBQ, autorización explícita de pago simulado | PASS |
| Identidad vinculada | Ticket `481306` recibido en panel Hub como Student 10001, con código de recogida separado | PASS |
| Pago antes de preparar | Nuevo/pago pendiente sin preparación; Confirm payment mueve a Standby | PASS |
| Sincronización de estados | Start preparing → Preparing; Mark ready → aviso de recogida en la página del estudiante | PASS |
| Recogida | Complete pickup retira `481306` de Ready y lo marca recogido | PASS |
| Cancelación permitida | `245460`, sin pago adicional, cancelado desde el perfil propietario | PASS |
| Cuenta de local equivocada | Cuenta hub en `/panel/cafeteria` recibe denegación, sin pedidos del comedor | PASS |
| ID inválido | `99999` rechazado con mensaje de los dos perfiles de demo | PASS |
| Cambiar ID | Desde un ticket, Switch ID abre `/login` limpio; entrar con 10001 vuelve a los cuatro locales | PASS |
| Otro perfil | `10002` no puede consultar el ticket de `10001` | PASS |
| Diseño adaptable | Estudiante 390×844, panel 768×1024; sin desbordamiento horizontal | PASS |

El simulador deja sus tickets claramente identificados. La cola del Hub mostró otros pedidos registrados delante del ticket nuevo; no representa personas medidas en una fila física.

## Correcciones durante la revisión de interfaz

- Una respuesta tardía de un ticket ya abandonado no puede reemplazar los datos del ticket actual.
- El envío pendiente conserva su clave de reintento y no navega desde una estación que el usuario ya dejó.
- El almacenamiento pendiente sólo se borra si coincide la clave procesada; un conflicto conserva la recuperación en My orders.
- El sondeo no muestra datos de una ruta anterior mientras carga otra y descarta respuestas anteriores a una mutación local.
- El acceso por ID inválido no dispara una falsa notificación de sesión caducada.
- Switch ID espera a que termine la navegación al login antes de volver a montar las rutas; evita regresar al ticket del perfil anterior. Corregido y verificado manualmente después de detectar la carrera en el navegador.

Revisión independiente del código de recuperación y respuestas tardías: PASS. No se simuló latencia adversa manualmente en el navegador; ese resultado proviene de inspección de código.

## Evidencia visual y límites

`artifacts/login-mobile-v3.png` registra la entrada móvil por ID. `artifacts/ready-mobile-v3.png` registra el aviso Ready de Student 10001 para el ticket 481306. El ticket se marcó recogido después de esa captura. Los archivos de evidencia y la base SQLite local están ignorados por Git.

Build de producción y TypeScript: PASS en la versión final. Smoke aislado del servidor con el bundle construido: `/login`, `/staff/login`, `/panel/hub` y `/locations/cafeteria` devolvieron HTML y JavaScript con HTTP 200. No se utilizó la base activa para este smoke. Las pruebas no garantizan ausencia absoluta de errores.

Queda pendiente un ensayo en celular e iPad físicos tras elegir y autorizar la conexión. La prueba actual utiliza dos navegadores y tamaños de pantalla representativos. El aviso Ready funciona con la página abierta; no hay push con el navegador cerrado o el teléfono bloqueado. No hay integración real con POS, cobros, nombres, balances, menús sincronizados ni verificación universitaria de identidad. Los IDs 10001/10002 son perfiles públicos de demo. No se inició LAN, túnel, despliegue, publicación ni entrega al hackathon.
