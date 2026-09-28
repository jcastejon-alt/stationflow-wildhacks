# ADR 001: prototipo local con servidor compartido

Estado: aceptado para draft del 26-09-2026, sujeto a revisión antes de publicación.

## Contexto

Jorge quiere un prototipo que se pueda revisar hoy y prohíbe subirlo todavía. Debe demostrar dos vistas sincronizadas y reglas de capacidad reales. No existe código previo, solo tres documentos de alcance. La máquina tiene Node 25.8.2.

## Opciones

| Alternativa | Ventaja | Costo/limitación |
|---|---|---|
| React + localStorage | Muy rápido para pantallas | No demuestra base compartida ni reserva atómica; descartado |
| React + Worker + D1 | Camino práctico a despliegue futuro | Añade herramientas/emulación de plataforma antes de decidir destino |
| React + Express + SQLite | Base persistente y transacciones reales sin cuenta remota | Requiere un proceso Node y almacenamiento persistente al hospedar |

Se elige React/Vite + Express + SQLite. Node incorpora `node:sqlite`, accesible sin flag desde 22.13; la versión local está verificada. El MVP conserva un contrato HTTP independiente del hosting. No se presupone migración automática a Workers/D1: requeriría adaptar servidor/persistencia y volver a probar concurrencia.

## Otras decisiones

- Polling de 3 segundos en lugar de WebSockets: menos piezas y suficiente para la demo; latencia y tráfico mayores, reevaluar con volumen real.
- Un plato por pedido: simplifica capacidad/modificadores; pedidos múltiples quedan fuera de este draft.
- Transacción de SQLite para validación y reserva: el servidor decide cupo, estado y elegibilidad, nunca solo el navegador.
- Idempotencia ligada al contenido canónico y fuente: repetir la misma petición recupera el pedido aceptado, incluso si luego se agotó el menú.
- Capacidad conservadora: cancelados/recogidos siguen consumiendo el cupo originalmente reservado; evita sobrecupo pero puede desaprovechar capacidad.
- Snapshot del menú en pedido: estabilidad del ticket frente a cambios operativos.
- Sin auth de producción: solo datos ficticios y localhost. Antes de exponer panel real se necesitan roles, sesiones y validación de acceso.
- Aviso en app como base: notificaciones del navegador son opt-in. Un service worker o aviso con página abierta no equivale a Web Push de fondo.

## Cuándo revisar

Al decidir hospedaje público, integrar sistemas campus, crecer a varios procesos/servidores, manejar identidad/pagos reales o realizar piloto. La implementación local no resuelve esos problemas por sí sola.

Fuentes técnicas: [Node SQLite](https://nodejs.org/api/sqlite.html), [Express static files](https://expressjs.com/en/starter/static-files/), [Vite](https://vite.dev/guide/). Ver [research](RESEARCH_DINING.md) para Web Push y fuentes institucionales.
