# StationFlow

**Campus dining, on your time.** Independent local WildHacks prototype for Trevecca. Demo orders and simulated payments only; not operated by Trevecca or Sodexo.

Latest verification: [V11 final review](docs/FINAL_REVIEW_V11.md). The local build passed 80 automated checks. The public demo is at [stationflow demo](https://editor-criterion-banners-providers.trycloudflare.com) through a temporary Cloudflare Quick Tunnel to a Node/Express server on Jorge's Mac. It is a fictional prototype, not operated by Trevecca or Sodexo; the Mac, server and tunnel must stay running for the link to work. See [public demo operations](docs/PUBLIC_DEMO_RELEASE.md) for startup and rehearsal steps.

Four places, five physical queues and six menu/service IDs: **Cafeteria** contains one grill that serves Omelet in the morning and Hamburger after 11 AM, plus a separate Sandwich station. **The Hub**, **Frothy Monkey** and **We Proudly Serve Starbucks** each have a separate sample menu and queue. Students enter a fictional ID, browse menu categories in an accordion where applicable, customize each item before adding it to a cart, reserve a pickup window for that cart, see that profile’s tickets, and authorize a simulated retail payment. Workers choose one of the four places and see only that place's current online orders.

## Problem

Campus students may have to walk to a dining location before they know the order queue or whether an item can be ready around their schedule. Staff need a simple way to receive remote requests and tell students when to collect them. StationFlow demonstrates one shared order flow for students and location-specific worker panels, including pickup windows and live ticket status. It does not connect to campus payment or identity systems.

### Cafeteria service update · September 27

The Cafeteria service change passed local automated and browser QA; see [Cafeteria hours QA](docs/QA_CAFETERIA_HOURS.md). The current prototype assumes Cafeteria operates **8 AM–8 PM daily**, pending Jorge's confirmation. These are illustrative station hours, not verified Sodexo hours. The later ordering wizard has its own local review and has not been tested on physical phones or iPads.

| Service | Prototype hours | Physical queue |
|---|---|---|
| Omelet | 8–11 AM | Cafeteria grill |
| Hamburger | 11 AM–8 PM | The same Cafeteria grill |
| Sandwich | 8 AM–8 PM, continuously | Sandwich station |

**Right now** assigns the earliest pickup window that has capacity; it does not promise instant preparation. **Schedule** offers the remaining valid Omelet windows for today, within 8–11 AM, rather than only the next two hours. Hamburger ordering stays disabled before 11 AM. Windows last ten minutes, require at least two minutes of lead time and must fit entirely within the selected service. Omelet and Hamburger share capacity, online pause and the physical grill queue; they do not create a second grill. Previously accepted tickets keep their original item and pickup window after the service changes.

Omelet and Hamburger open directly on their first customization choice. Hamburger offers ingredients only; all cafeteria sauces are available in person and cannot be chosen online. Sandwich begins with **Wrap or Sandwich**, then advances through base, protein, cheese, vegetables, sauces and, last, toast level. Sandwich and Wrap bases, proteins, cheeses, toppings and four sauces follow the photographed station sign. Vinegar, honey mustard and Caesar are separately labeled demo extras requested for the prototype; toast levels are also demo choices. Current availability still needs confirmation with Dining.

## Run locally

Requires Node 22.13+ with `node:sqlite` (developed on Node 25.8.2).

```sh
npm ci
npm run dev
```

Open [student login](http://127.0.0.1:5173/login) and [staff sign-in](http://127.0.0.1:5173/staff/login) in **different browsers/profiles** to use separate student and staff sessions. Tabs in one browser share a session. API: `127.0.0.1:3001`; persisted SQLite: `data/stationflow.sqlite`. Leave the terminal running.

```sh
npm test
npm run build
npm start
```

Run `npm test` for the current automated suite. These checks verify tested local behavior, not institutional integration or production readiness. The [V10 worker inbox QA](docs/QA_WORKER_V10.md), [V8 menu and pickup QA](docs/QA_MENU_AND_PICKUP_V8.md), [V7 technical debrief](docs/DEBRIEF_V7.md) and [UX review](docs/REVISION_UX_2026-09-27.md) describe the build and its earlier reviews. The five-minute presentation draft is older and will be updated in the presentation phase.

### Public demo quick start

Open the [public demo](https://editor-criterion-banners-providers.trycloudflare.com). For a Hub rehearsal, sign in as manager and select **Lunch**. In one browser profile, use `/login` and fictional student ID `10001` (no password) to place a sample meal-swipe order. In a separate browser profile or device, use `/staff/login`, choose Hub and enter the public demo password **`CampusDemo!26`**; **Accept** and then **Mark ready** to advance the ticket. Keep the student ticket page open. This temporary tunnel depends on Jorge's Mac, server and tunnel staying online. See the [restart steps and full flow](docs/PUBLIC_DEMO_RELEASE.md).

For a phone/iPad rehearsal on a network that allows device-to-device connections, `npm run demo:lan` builds and serves port 3002, prints private network URLs, and uses a separate demo database. This exposes the demo to that local network only while the command runs. The physical phone/iPad rehearsal remains unverified. See the [phone/iPad rehearsal proposal](docs/DEMO_CELULAR_IPAD.md) and the separate [public demo operations](docs/PUBLIC_DEMO_RELEASE.md).

The built app is served at [127.0.0.1:3001](http://127.0.0.1:3001). The development server and `npm start` bind loopback by default; `demo:lan` is an explicit separate network launcher. No cloud account, API key or POS connection is required. Do not expose these public demo accounts as a real service.

## Test accounts

Students enter **10001** or **10002** with no password in the website. These are public fictional profiles, not verified campus identities. Anyone who knows a demo ID can access that profile; do not enter real student data. Historical D10001/D10002 aliases still work.

The staff entry shows four one-click demo locations. It uses the deliberately public demo password **`CampusDemo!26`** behind those choices. Manager setup remains separate.

| Identifier | Role and access |
|---|---|
| `10001`, `10002` | Separate public demo student profiles; ID-only website entry |
| `cafeteria` | Cafeteria only: Omelet/Hamburger shared grill and Sandwich |
| `grill`, `sandwich` | Optional narrower demo accounts for the two Cafeteria physical queues |
| `hub` | The Hub |
| `frothy` | Frothy Monkey only |
| `starbucks` | We Proudly Serve Starbucks only |
| `coffee` | Legacy supervisor for both cafés |
| `manager` | All five physical queues / six service IDs and service-clock scenarios |

The visible staff choices open `/panel/cafeteria`, `/panel/hub`, `/panel/frothy` or `/panel/starbucks`. Each worker panel shows only online tickets for its location in **Pending**, **Preparing** and **Done**. Cafeteria labels each ticket by station and keeps Omelet/Hamburger on the shared grill queue while Sandwich remains independent in the backend. `/kitchen` remains the manager setup and legacy operations view. Students start at `/login`, then choose a place.

To show a queue, manager selects a station and uses **Simulate 3 orders** before the student orders. These labeled fixtures respect capacity and hours and belong to a non-login demo profile. They do not populate either test student’s history.

The default clock follows real time. For an after-hours presentation, sign in as manager and open **Station controls**. **Breakfast**, **Transition** and **Lunch** are the Cafeteria scenarios for morning service, the 11 AM changeover and afternoon service; **Lunch** also works for the Hub rehearsal. Other presets demonstrate the final window before closing and closed locations. Simulated time is visible and advances while the server runs; restarting returns to live time.

## Ordering and payment

**Cafeteria:** access is checked at the dining hall entrance. Station orders require no additional swipe/payment in this model. The demo ID connects station tickets to a public fictional student profile; it is not another admission gate.

**Hub and cafés:** each location uses an accordion menu and a one-step-at-a-time wizard for menu mode when applicable, item-specific customizations, **Add to cart**, pickup and final review. A regular cart can contain up to six individually configured units from the same station in one ticket. A fictional meal swipe covers exactly one eligible unit. The student authorizes the demo payment only on the review screen. Meal swipe appears only for configured eligible items; Frothy currently has no confirmed eligible demo item. Counter walk-ins have no linked student account. No money or meal swipe moves.

The student ticket starts at **Order sent**. On a new online retail ticket, assigned staff use the linked fictional Student ID for a represented entry in the separate campus POS, then press **Accept** in StationFlow. That one demo action atomically records **Entered**, approves the already authorized *fictional* payment and starts **Preparing**; the app does not read the POS or charge an account. Cafeteria's **Accept** starts preparation without another ID or payment at the station. **Mark ready** changes the student's ticket to **Ready for pickup**. The worker panel has no pickup-completion step; the manager's legacy view can still mark handoff. Student and panel views poll the same server, so neither advances on a timer.

**The Hub menu:** choose Meal swipe (Chicken tenders or Hub burger, as fictional examples) or Regular menu. In Regular menu, configure each article before adding it to the cart; a Hub burger and Seasoned fries can share one ticket. Across Hub items, only Ranch and Hub sauce can be selected online, each served separately in a small cup. Other sauces are self-serve in person. Regular prices and the total are explicitly illustrative **Demo prices**; see [Hub research and price assumptions](docs/RESEARCH_HUB_V5.md). The server calculates the cart total and rejects client-supplied amounts. Pickup windows must have enough item capacity for the whole cart and finish before closing.

**Coffee menus:** Starbucks includes a fictional `Muffin + drip coffee combo` configured for one demo meal swipe. Muffin choice is required; coffee milk and sweetener are optional. A latte or mocha asks for its required milk before **Add to cart**. Frothy has a larger sample drink menu inspired by the brand's general menu; its exact campus products, modifiers and exchange eligibility remain unverified. Both cafés use illustrative demo prices. See [coffee source review](docs/RESEARCH_COFFEE_V6.md).

Jorge reports that entering an ID in the campus POS displays the student’s name and permits payment. This prototype models the employee confirming that result manually; it neither reads POS names nor processes actual charges. The exact remote-order procedure and integration remain **unverified with Dining/IT**. A real workflow needs Dining/IT approval, verified account-to-ID linkage, current prices/eligibility, authorized payment integration or approved manual POS entry, and reconciliation/refunds. A student ID alone is not authentication. [Spanish explanation and operating plan](docs/CUENTAS_Y_OPERACION.md).

## Core safeguards

- Server-bound profile, hashed staff demo passwords, expiring/revocable sessions and station permissions. ID-only student entry is explicitly a public demo, not identity verification.
- Each pickup window fits wholly before the configured service closing time. Cafeteria station hours are explicit prototype assumptions; other locations reference published regular hours. Holidays and exceptional closures are not synchronized.
- Per-physical-queue total/online capacity; Omelet and Hamburger share the grill's controls, while Sandwich remains independent. Online limits reserve room for registered walk-ins.
- Transactional reservations and payment/status compare-and-set; retry keys prevent duplicate order creation.
- Accepted options remain unchanged when an ingredient sells out. Pending request recovery is scoped to the account.
- Retail preparation is blocked until demo payment approval. Approved payment has no student cancellation/refund flow; students may cancel before staff entry, and staff may cancel an entered ticket after a declined demo payment.
- Queue counts cover recorded tickets, not an automatically measured physical line or guaranteed wait time.

One cart creates one ticket with all its configured lines. Slot capacity counts **item units**, while the student’s queue-ahead indicator counts **digital tickets**; neither measures the physical line. Cancelled/picked-up tickets conservatively retain their slot reservation. Student ticket lookup requires an authorized session as well as its random token; a pickup code cannot log in or retrieve a ticket without its authorized session. Public queue summaries do not display student IDs. Assigned staff see the linked ID on each online ticket, including Cafeteria; pickup codes remain separate.

## Architecture and limits

React/TypeScript/Vite → Express → SQLite. Student and staff screens poll the same server every few seconds. Database files, builds, dependencies and `.env` are ignored by Git. Existing V1 snapshots survive schema migration; legacy anonymous tickets are staff-only. `.env.example` describes options; `.env` is not automatically loaded. An exact HTTPS `PUBLIC_ORIGIN` configures the current Cloudflare Quick Tunnel origin for write requests and Secure session cookies. The separately running `cloudflared` process provides the public tunnel; the app and database still run on Jorge's Mac.

Sample menus are not verified campus item lists. The Hub uses clearly labeled illustrative prices approved for this demo; no official prices, calorie figures or allergen guarantees are claimed. Menu cards and selectable ingredients use generic generated illustrations, not official food photos or proof of a specific recipe. The UI follows the official site's purple/light design direction while keeping an independent identity: warm paper, purple, gold and sage surfaces with editorial type. Rethink Sans is served locally with its OFL license; display headings use system Georgia. The interface does not need a remote font request.

A prominent Ready pickup alert appears while the ticket page is open and the screen stays awake. Optional browser system alerts require a user permission action; **background push with the app closed or phone locked is not implemented**. Plain HTTP LAN views offer the in-app notice only. See [V7 debrief](docs/DEBRIEF_V7.md), [UX review](docs/REVISION_UX_2026-09-27.md), [visual review V4](docs/VISUAL_V4.md), [backend and flow QA V3](docs/QA_V3.md), [V2 historical QA](docs/QA_V2.md), [V1 historical QA](docs/QA_DRAFT.md), [V2 API](docs/API_V2_PLAN.md), [source research](docs/RESEARCH_DINING_V2.md) and [architecture](docs/ADR_001_LOCAL_FIRST.md).

## Hackathon

AI development tools are explicitly encouraged by WildHacks. The public repository and submission requirements are documented in [verified event rules](docs/REGLAS_WILDHACKS.md). Before submitting, make the GitHub repository and demo link public and provide the links in the Discord submission form.

In the September 27 announcement, fionahg published the [submission form](https://forms.gle/kcRmrFY3XbdjH5iQ9) and instructed participants to submit **before 11:59 PM on September 27**; the time zone is unconfirmed. Use the Discord **Submission** form for the project: the separate link in the email is registration. The submission form says links must be public. Only its first page was inspected; later fields remain unverified. [Submission announcement](https://discord.com/channels/1545231728958898237/1551684605915168798/1553849957117726872). The public demo and restart procedure are documented in [public demo operations](docs/PUBLIC_DEMO_RELEASE.md).

Sam confirmed **Monday, September 28, 4:00 PM, Greathouse 303** (written “Great house 303”), with a **five-minute presentation/demo followed by questions**, two judges, and a project name. Present the progress reached, including technical and business aspects. Judging covers the problem, innovation, execution/roadmap and presentation/pitch. Neither reviewed announcement states a time zone. [Demo Day details](https://discord.com/channels/1545231728958898237/1551684605915168798/1553872710621208658) · [Judging criteria](https://discord.com/channels/1545231728958898237/1551684605915168798/1553875630385397954).

[Product plan](docs/PLAN_HACKATHON_DRAFT.md) · [Historical five-minute presentation draft](docs/PRESENTATION_TECHNICAL_RUNDOWN.md) · [English pitch backup](docs/PITCH.md). The presentation material will be refreshed after the code review. This draft tests the station workflow; Trevecca already promotes Everyday, whose exact local coverage must be compared before a pilot.
