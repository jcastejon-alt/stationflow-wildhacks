> V3 update: POST /api/auth/student {studentId} is the website student entry, without a password, for public fictional profiles10001/10002 (D10001/D10002 aliases). POST /auth/login remains password-based for staff and backwards compatibility. New online orders include server-derived snapshot studentId, including Cafeteria; walk-ins omit it. The number is the order user, not proof of identity. See FLUJO_WEB_V3.md and QA_V3.md.

# V2 implementation contract — local demo

User-authorized expansion, 26 September 2026. No publishing or live campus access.

## Authentication
- `GET /api/auth/me` → `{user: DemoUser|null}`. DemoUser `{id,displayName,role:'student'|'staff'|'manager',studentId?:string,stationIds:string[]}`.
- `POST /api/auth/login` body `{identifier,password}` → `{user}` + HttpOnly SameSite=Strict session cookie. `POST /api/auth/logout` invalidates cookie/session.
- Seeded fictional students `D10001`, `D10002`; staff `cafeteria`, `hub`, `coffee`; manager `manager`. All use public demo password `CampusDemo!26`. These are public test accounts, not production identity verification.
- Cafeteria staff assigned omelet/sandwich; hub assigned hub; coffee assigned frothy/starbucks; manager all five. Server enforces assignments on every staff resource.
- Students need login to create/read/cancel orders. Identity derives from session; request studentId/userId remain rejected. Student cannot read another student's token. Staff can read assigned orders. Legacy anonymous orders staff-only.
- `GET /api/my/orders` → `{orders:Order[]}`, newest first for authenticated student. Staff lists omit tokens. Token may return on staff-created walk-in confirmation for existing ticket navigation; auth/assignment is still required. Retail staff may see the linked fictional student ID only as part of the authorized demo payment workflow below.
- Scope idempotency by authenticated user, preserve retry-before-availability behavior. Client pending storage and recent ticket scoped to account. Logout removes rendered private state, never shares a pending request across accounts.

## Places and service hours
- Keep station IDs omelet/sandwich/hub, add frothy/starbucks.
- Catalog adds `locations: DiningLocation[]`, `serviceClock:{mode:string,now:string,label:string}`.
- DiningLocation `{id,name,building,description,hoursLabel,hoursSource,hoursNote}`. IDs cafeteria/hub/frothy/starbucks.
- Stations add `locationId`, `service:{open:boolean,acceptingOrders:boolean,label:string,closesAt:string|null,nextOpensAt:string|null,scheduleNote:string}`, `queue:{received:number,preparing:number,ready:number,active:number}`.
- Source-backed building schedules (America/Chicago); station windows are explicit demo assumptions, not verified campus schedules. No public physical queue or precise wait-time claim.
- Frothy: weekdays 08:00–20:00, Sat08:00–16:00, Sun closed. Starbucks: weekdays07:00–16:00, Sat closed, Sun08:00–15:00. Hub weekdays11:00–22:00, weekends11:00–19:00. Cafeteria use weekday published meal blocks; weekend conservative published overlap, documented.
- Pickup windows remain ten minutes, minimum two-minute lead and two-hour horizon. Only emit windows wholly contained within open service interval. Server revalidates on submit, both online and walk-in. No preopening booking; closed means no slots.
- `GET /api/slots` remains `{slots}` and may add `service` metadata. Pause and capacities continue.
- `PATCH /api/staff/demo-clock` manager-only `{mode:'live'|'lunch'|'near_close'|'closed'}` → `{serviceClock}`. Demo presets use Monday 28 September 2026 noon, 15:45, 23:00 Chicago respectively. Default live. Presets advance with elapsed real time, are labeled simulated. Clock state need not persist; restart returns live. Existing orders keep snapshots. Test-injected now remains supported.
- No claim of campus ordering cutoff: full-window-before-close and minimum lead are prototype policies.

## Staff / shared screen
- `GET /api/staff/orders` stationId optional: omitted returns all assigned station orders. Existing filtered form remains; unassigned returns403.
- Existing mutation endpoints require assigned staff or manager. Staff can pause/capacity/availability their stations. Manager controls demo clock.
- Shared kitchen shows all assigned queues or one station, clear station labels, counts, exact options/exclusions, CAS progression. One laptop can serve cafeteria's two stations; staff log in individually and select views. No iPad per station required. Accounts/assignments are seeded for demo; campus-managed provision later.
- Authorization-sensitive writes reject untrusted cross-origin requests. Login throttled. Server hashes demo passwords and expires/revokes sessions. Public demo credentials intentionally do not provide real security for deployment.

## Menu provenance
- Separate coffee menus with clearly marked sample products based on official published categories; never import national full menus/prices as campus facts.
- Meal exchange capability may be shown for fictional eligible retail items at Hub/Frothy/Starbucks, always explicitly illustrative. No real swipe, charge, or allowance validation.
- Existing API shapes otherwise remain, including immutable accepted order snapshots, source assigned by server and no free-text student identity fields.

## User correction: entrance vs retail payment (takes precedence)

The student ID/access check happens at the cafeteria entrance, not independently at Omelet or Sandwich. Those station orders have no additional charge in this model. Login is for a private order history, not a second cafeteria admission/swipe.

At Hub and both cafés, remote students authorize a demo campus-account payment or fictional eligible exchange. The employee receives the linked ID, enters the order into the existing POS if that system permits it, and confirms before preparation. Actual keyed-ID charging capability and remote authorization policy are UNVERIFIED; this app does not charge anything.

- Order adds `payment:{status:'not_required'|'pending'|'approved'|'declined',method:'cafeteria_entry'|'campus_account'|'meal_exchange'|'counter',studentId?:string,authorized:boolean,updatedAt:string|null}`.
- Online retail POST requires `paymentAuthorized:true`. Identity comes only from authenticated account; do not accept studentId in body. Client displays checkbox expressly authorizing simulated payment. Cafeteria does not require this flag or any charge step.
- Staff walk-in retail uses `counter`, pending, no linked ID; employee records simulated counter payment. Do not pretend it is a remotely authorized student-ID charge.
- `PATCH /api/staff/orders/:id/payment` body `{status:'approved'|'declined',expectedStatus:'pending'}`. Assigned staff only, while received, CAS transaction. Confirm/decline is a demo action, never a claim of real POS settlement.
- Retail cannot transition to preparing until approved. Pending/declined may be cancelled by student; approved cannot be cancelled by student without a refund/void workflow (not implemented).
- Staff displays linked fake ID only on authorized retail payment panel. No ID in generic kitchen headlines, public queues, printed/exported data, logs, notification text or share URLs. No export features are introduced.
- Declined is terminal for this payment attempt; student can cancel and create another demo ticket. No automatic retry of a charge. Real integration must use payment-provider idempotency, refunds, authoritative payment references and transaction reconciliation.

## Explicit queue demonstration

- `POST /api/staff/demo-rush` manager-only `{stationId,idempotencyKey}` → `{created:number,orders:Order[],message:string}`. Adds at most three synthetic online tickets for one station, with valid sample selections and capacity reservations. No bypass for service closed, pause, sold-out inventory or full windows. Report actual created count, including zero.
- Retry the same intent without duplicating tickets. The client keeps the original station/key until the result is known.
- Synthetic orders belong to an internal non-login fixture account (`QUEUE-DEMO` ID), never either interactive test student. Set `Order.simulated:true` and mark visibly in staff UI. Retail fixture payments are explicitly simulated approvals; ordinary student orders still require staff confirmation.
- This lets a subsequent student order display earlier digital tickets and demonstrates queue changes as employees complete them. These are recorded demo tickets, not a fabricated physical-line measurement.
- Retail student tracker: sent → payment received (demo) → preparing → ready → picked up. Cafeteria skips payment. Pending and declined payment have distinct messages. Paid/uncollected tickets retain approved status; no automatic refund or no-show penalty is implemented.

## Conexión de ensayo (preparada, no publicada)

`npm run demo:lan` sirve build/API en3002 con DBseparada; no inicia ningún servicio externo. `PUBLIC_ORIGIN=https://origen-exacto.example` en `npm start` es opcional para un proxyHTTPS aprobado: exige ese Origin en cada escritura, Secure cookies y rechaza configuración no canónica antes de abrir DB. No activa trust proxy ni autoriza un despliegue. Véase DEMO_CELULAR_IPAD.md.
