# Contrato vigente

La ampliación [API_V2_PLAN.md](API_V2_PLAN.md) sustituye este contrato V1 para autenticación, roles, lugares, horarios y pagos simulados. Su sección "User correction" prevalece en el flujo de Cafeteria vs retail. Los campos base de pedido, selecciones y capacidad descritos abajo se conservan salvo las modificaciones explícitas de V2.

# Archivo: contrato V1

# Local draft API contract

All data is fictitious. UI in English; product docs may be Spanish. No deployment, push, submission or external writes authorized. Root owns scaffold and docs; backend worker owns server/ and tests/; frontend worker owns src/ and public/; shared contract changes coordinated with both.

API prefix `/api`. Every JSON error is `{error:{code:string,message:string}}`. Cache-Control: no-store. IDs are strings. Time is ISO UTC and UI displays America/Chicago. All response shapes below are exact.

`GET /catalog` -> `{stations: Station[], items: MenuItem[], demo: true}`.
Station: `{id,name,location,description,paused:boolean,capacity:number,onlineCapacity:number}`. IDs: `omelet`, `sandwich`, `hub`.
MenuItem: `{id,stationId,name,description,category,available:boolean,exchangeEligible:boolean,groups:OptionGroup[]}`.
OptionGroup: `{id,label,min:number,max:number,options:{id,label,available:boolean}[]}`. No prices, calories or unverified allergen tags. Exchange eligibility explicitly fictional.

`GET /slots?stationId=...` -> `{slots: Slot[]}`. Slot: `{id,startsAt,endsAt,remaining:number,totalRemaining:number,capacity:number,onlineCapacity:number,available:boolean}`. 10 minute demo slots, rolling next 2 hours, minimum 2 minute lead time. Availability checked again on submit. IDs stable within the same station/time.

`POST /orders` and `POST /staff/orders` -> HTTP 201 new or 200 replay `{order:Order}`. Body: `{idempotencyKey,stationId,itemId,selections:Record<string,string[]>,exclusions:string[],slotId,paymentMode:'regular'|'meal_exchange'}`. Exclusions optional defaults []; values are valid option IDs for item and cannot overlap selections. Staff route derives walk_in source; public route always online and rejects forged source. Student saves idempotency key before request and reuses after uncertain error; new key only when changing payload. Replay before availability validation; different canonical payload same key => 409. All required/min/max choices checked server-side, including availability. Exchange only for configured eligible Hub items. One item per ticket. No user identity fields.

Order: `{id,token,pickupCode,stationId,itemId,itemName,stationName,location,selectionSummary:{group:string,label:string,values:string[]}[],exclusions:string[],slot:Slot,status:'received'|'preparing'|'ready'|'picked_up'|'cancelled',paymentMode:'regular'|'meal_exchange',source:'online'|'walk_in',createdAt,updatedAt,queueAhead:number,events:{status,at}[]}`. Exclusions stored as human readable labels, selections are immutable snapshot. Token is cryptographically random, pickup code is not lookup key. queueAhead is active earlier digital orders at same station (not a physical line estimate). API may omit token from staff list only.

`GET /orders/:token` -> `{order:Order}`. `POST /orders/:token/cancel` -> `{order:Order}` only from received. Capacity conservatively not released by cancellation.
`GET /staff/orders?stationId=...` -> `{orders:Order[]}`.
`PATCH /staff/orders/:id` body `{status,expectedStatus}` -> `{order:Order}`; legal forward transitions only with compare-and-set. Invalid or raced status -> 409.
`PATCH /staff/stations/:id` body any `{paused,capacity,onlineCapacity}` -> `{station:Station}`. Positive integer capacities; online <= total. Reductions below already accepted orders do not change tickets, only block new ones. Pause blocks online orders only; staff walk-ins remain allowed within total capacity and valid future windows. Staff builder uses totalRemaining, ignoring online availability/paused for its own workflow.
`PATCH /staff/items/:id` body `{available:boolean}` -> `{item:MenuItem}`.
`PATCH /staff/items/:id/groups/:groupId/options/:optionId` body `{available:boolean}` -> `{item:MenuItem}`.
`GET /health` -> `{ok:true,demo:true}`.

Staff panel is deliberately an unauthenticated local simulation; it must be marked Demo kitchen. No reset endpoint. Bind localhost by default. Single Node server uses SQLite transactions and persists under data/ (gitignored). Use node:sqlite on Node >=22.13. Backend JS ESM, frontend React/TS/Vite. Root installs dependencies and config. Ports frontend 5173 and API 3001 in dev; production serves dist/ from API. Frontend polls 3 seconds with cleanup; error/disconnected visible, never fake order success. Links: `/`, `/order/:stationId`, `/ticket/:token`, `/kitchen`. Use react-router-dom. Notifications optional active-browser fallback with explicit permission button; never call it background push. Do not generate product images.
