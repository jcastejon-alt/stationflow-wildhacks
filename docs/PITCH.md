# StationFlow · presentación y demo

**Historical draft — update before using on stage.** The current Hub item is **Hub burger** and staff actions run **Entered with Student ID → Payment received → Preparing → Ready**. See the [current rehearsal guide](DEMO_CELULAR_IPAD.md) and [V9 status QA](QA_STATUS_V9.md).

El [guion técnico en español, de cinco minutos](PRESENTATION_TECHNICAL_RUNDOWN.md) es la versión principal para leer en Demo Day. Cada acción visible del estudiante y el empleado tiene inmediatamente su explicación de código. Ensayar con la [guía de celular e iPad](DEMO_CELULAR_IPAD.md); todavía no hay una prueba verificada en esos dispositivos físicos ni una publicación en Cloudflare.

## Spoken English backup

Use this if the presentation must be in English. Keep the same live click sequence as the Spanish rundown: **Student 10001 → The Hub → Regular menu → Campus burger with Lettuce, Tomato, Ketchup and No Pickles → Add to cart → Add another item → Seasoned fries → Add to cart → pickup window → demo payment authorization → Place order → Confirm payment → Enter order / start preparing → Mark ready**. The iPad stays in `/panel/hub`; the phone stays on the ticket.

**Opening.** “A student can place a customized pickup order without standing at a counter. This is an independent prototype using fictional IDs, menus, prices and payments.”

**As I select the menu.** “The React page gets the menu from `GET /api/catalog`. The server tells it which item-specific choices are available. I customize a burger first, then add fries as a second line in the same cart. The demo regular menu allows up to six units; one fictional meal swipe covers only one configured eligible item.”

**As I select pickup and place the order.** “`GET /api/slots` shows windows with enough item capacity for the whole cart. `POST /api/orders` validates every line and reserves the window in a SQLite transaction. A retry key helps recover the same ticket if the network response is lost.”

**At the iPad.** “This ticket has one pickup code and both item configurations. The employee sees Student 10001 only because this is a public demo profile. I confirm a simulated payment; there is no POS connection or real charge. Then I press ‘Enter order / start preparing.’ The phone says the order has been entered. When I press ‘Mark ready,’ the student sees ‘Ready for pickup.’ Both views read the same API about every three seconds.”

**Closing.** “The cafeteria also shares one grill between morning omelets and later hamburgers, while Sandwich has its own queue and a Wrap-or-Sandwich customization flow. Before any real pilot, Dining Services would need to verify menus, identity, payment workflow and station capacity. The ready notice works while the ticket is open and the phone is awake; background push is a later step.”

## If only 90 seconds remain

Pre-stage one **two-item** Hub order with demo payment pending. Show both lines and the pickup code on the phone, then use **Confirm payment → Enter order / start preparing → Mark ready** on the iPad. Pause at each state so the phone visibly updates. Say: “The server validates and reserves the whole cart; staff state changes are shared through the same API; this remains a fictional local demo.” The [Spanish rundown](PRESENTATION_TECHNICAL_RUNDOWN.md#versión-de-respaldo-de-90-segundos) has the exact fallback.

## Questions judges may ask

**Why not Everyday?** Trevecca already offers Everyday. We have not verified whether it covers these exact station workflows; reuse or integration may be preferable.

**Does the ID prove student identity or charge an account?** No. The public IDs are only fictional profiles. The employee confirms a simulated payment; the prototype neither authenticates real students nor connects to the POS.

**Can the ticket duplicate after a bad connection?** The server stores an idempotency key with the accepted request and returns the original ticket on a valid retry. Capacity is checked inside the same database transaction.

**Can the phone alert while locked?** Not in this version. Keep the live ticket open and the screen awake. HTTPS by itself does not add background push.

**How was it tested?** Local automated tests, the build and browser walkthroughs. A phone/iPad pair on the presentation network and any public deployment still require direct verification.
