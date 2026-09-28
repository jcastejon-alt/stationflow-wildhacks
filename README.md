# StationFlow

StationFlow is an independent WildHacks prototype for ordering ahead at Trevecca dining locations. A student can build an order, choose a pickup window, and watch its status. A worker can see the orders for their own location and tell students when food is ready. The prototype uses fictional student profiles, sample menus, and simulated payments. It is not a Trevecca or Sodexo service.

**[Open the live demo](https://stationflow-demo.fihnechn.workers.dev)** · [Student entry](https://stationflow-demo.fihnechn.workers.dev/login) · [Staff entry](https://stationflow-demo.fihnechn.workers.dev/staff/login)

## Why we built it

The idea came from a practical question: could students order around class instead of arriving at a counter before they know when food will be ready? There is a staff side to that question too. If remote orders arrive as paper slips, an employee spends paid work time printing, cutting, and sorting tickets. Each slip also uses paper and ink. StationFlow explores a shared digital queue and a direct ready signal. We have not measured current printing volume, labor, wait times, or potential savings with Dining Services; those are questions for a pilot, not results of this prototype.

Trevecca already promotes Everyday for dining. Before proposing another live ordering channel, we would need to compare its actual coverage at each campus station and learn where the gap is. See the [dining research](docs/RESEARCH_DINING_V2.md).

## Try the flow

1. Open `/login` and enter fictional student ID `10001` or `10002`. Choose **Cafeteria**, **The Hub**, **Frothy Monkey**, or **We Proudly Serve Starbucks**.
2. Pick a menu item, customize it, add it to the cart, and choose an available pickup window. Cafeteria offers **Right now** for the earliest window with room or **Schedule**; the other locations offer today's available windows. A window is a reservation target, not a promise that preparation starts immediately.
3. Submit the order and leave the ticket open. It shows a pickup code, the current state, and the digital orders ahead. That count does not measure the physical line.
4. In a separate browser profile or device, open `/staff/login` and select the matching one-click demo location. The worker sees only that location's current online orders. **Accept** moves the ticket into preparation; **Mark ready** updates the student's ticket. The worker panel is intentionally limited to those two actions.

Student and staff sessions share cookies within a browser profile, so use separate profiles for a two-person demo. The ticket page refreshes its status from the server; the ready alert appears while that page is open and the screen is awake. Background push with the browser closed or phone locked is not implemented.

In Cafeteria, the same grill serves Omelet before 11 AM and Hamburger afterward; Sandwich stays on its own station. A student building a sandwich chooses a wrap or bread, then protein, cheese, vegetables, sauces, and toast level. The order form follows that sequence so the kitchen receives the choices together. The server offers pickup windows only while the configured service is open and capacity remains. Omelet and Hamburger share the grill's capacity; Sandwich has its own. Those limits prevent the *digital* queue from accepting more units than its configured allowance, but they cannot measure people already waiting in person.

The Hub has a regular menu for carts with multiple individually customized items and a separate demo meal-exchange choice limited to one eligible unit per cart. Its online sauces are Ranch and Hub sauce, served in separate cups; other sauces are for in-person use. Frothy Monkey and We Proudly Serve Starbucks have separate sample menus and queues, including drink choices such as milk. A worker's panel shows only current orders assigned to that location. Menu items, prices, exchange eligibility, customization options, and Cafeteria station hours still need confirmation with Dining. The [Hub](docs/RESEARCH_HUB_V5.md), [coffee](docs/RESEARCH_COFFEE_V6.md), and [hours](docs/QA_CAFETERIA_HOURS.md) notes show what was sourced and what remains illustrative.

### What “Accept” means

At the Cafeteria, the model assumes dining hall admission was handled at the entrance. Its station ticket requires no second swipe or payment. At the Hub and cafés, the student authorizes a *fictional* payment during order review. The intended worker step is to enter the linked student ID in a separate campus POS, then press **Accept** after that step succeeds. In StationFlow, **Accept** records the represented POS entry, approves the simulated payment, and starts preparation in one database action. The app cannot read the campus POS, confirm a real account, charge a card, or spend a meal swipe. **Mark ready** changes the same ticket the student sees. A real staff procedure, payment handling, and reconciliation need Dining and IT approval. See [accounts and operations](docs/CUENTAS_Y_OPERACION.md).

## Run it locally

Requires Node.js 22.13 or newer for `node:sqlite`.

```sh
npm ci
npm run dev
```

Open [student login](http://127.0.0.1:5173/login) and [staff login](http://127.0.0.1:5173/staff/login). Vite serves the development UI on port 5173; the Express API runs on `127.0.0.1:3001` and saves demo data in `data/stationflow.sqlite`.

```sh
npm test
npm run build
npm start
```

`npm start` serves the built app and API together at [127.0.0.1:3001](http://127.0.0.1:3001). `npm run demo:lan` builds and starts a separate local-network demo on port 3002 with its own database. It is meant for a phone and worker tablet on the same reachable network. [`.env.example`](.env.example) lists optional settings; the server loads an `.env` file only when started explicitly with `node --env-file=.env server/index.js`.

The Cloudflare version uses the same frontend and shared API logic. With Wrangler authenticated to the intended Cloudflare account, deploy the Worker defined in [`wrangler.jsonc`](wrangler.jsonc):

```sh
npm run cf:deploy
```

This builds the UI and deploys the Worker. The live deployment needs neither the local Node server nor Jorge's Mac to stay on. Local and cloud databases are separate demo environments.

For an after-hours walkthrough, open **Manager / demo setup** on `/staff/login` and sign in as `manager` with the public demo password `CampusDemo!26`. In **Station controls**, choose **Breakfast** for Omelet or **Lunch** for the Hub and Hamburger. The manager can also add labeled simulated orders to show a queue. These are demo fixtures, not real walk-ins. The local Node clock resets on restart; the Cloudflare demo clock keeps its setting until a manager changes it.

## How it works

The UI is React and TypeScript, built with Vite. Locally, an Express server owns sessions, menus, pickup windows, orders, and staff actions, with SQLite persisting the demo state. In the live deployment, a Cloudflare Worker serves the built UI and `/api`; a SQLite-backed Durable Object keeps the queue, sessions, and demo clock shared across requests. Student and worker views poll the same API, so the status changes when a worker acts rather than on a timer. The server calculates illustrative prices and checks station permissions, pickup capacity, and order transitions. One cart becomes one ticket; capacity counts item units, while the student's queue indicator counts digital tickets.

The local [final review](docs/FINAL_REVIEW_V11.md) recorded 80 passing automated checks, a successful production build, and a two-session student/worker walkthrough on September 27, 2026. The live Cloudflare flow was then exercised in two browsers: student `10001` ordered Hub Chicken tenders with Ranch using a fictional meal exchange for the 12:20–12:30 window; order `#451922` appeared in the Hub worker inbox. **Accept** changed the student view to Preparing with payment received in the simulation, and **Mark ready** brought up the in-app ready alert and pickup code. Separate API checks found Secure, HttpOnly, SameSite Strict session cookies and a 403 response for an unapproved origin. Physical phone/iPad rehearsal and institutional integration remain unverified.

## Demo and pilot boundary

The [live demo](https://stationflow-demo.fihnechn.workers.dev) runs on Cloudflare with shared persisted demo state. Its accounts are deliberately public. Anyone who knows a fictional ID can enter that profile, so do not use real student data. The student and worker flow has been checked in two desktop browsers; the experience on physical phones and iPads has not yet been verified.

Before a campus pilot, we would need verified student authentication, Dining-approved station menus and hours, current prices and exchange rules, an approved POS/payment procedure or integration, accessibility and device testing, and an operating plan for cancellations, refunds, closures, and support. StationFlow does not claim those are solved. The prototype tests whether the student-to-staff flow is understandable and useful enough to pursue that work.

## WildHacks

This was built for WildHacks' September 2026 prototype challenge. The [event rules and sources](docs/REGLAS_WILDHACKS.md) call for a public repository, a README explaining the problem and how to run the project, and a live demo. AI development tools are permitted; the builder is expected to understand and explain the work. The [submission form](https://forms.gle/kcRmrFY3XbdjH5iQ9) was announced with a September 27, 11:59 PM deadline; the time zone was not stated in the reviewed announcement. Demo Day was announced for September 28 at 4 PM in Greathouse 303, with a five-minute presentation and questions. These event details are recorded from the [submission announcement](https://discord.com/channels/1545231728958898237/1551684605915168798/1553849957117726872) and [Demo Day announcement](https://discord.com/channels/1545231728958898237/1551684605915168798/1553872710621208658).
