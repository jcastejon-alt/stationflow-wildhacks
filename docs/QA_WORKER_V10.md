# StationFlow V10: four-location worker inbox

Historical verification. See [V11 final review](FINAL_REVIEW_V11.md) for the subsequent queue, payment-summary and current-day fixes and final results.

Local review on September 27, 2026. This remains a fictional hackathon demo; it has not been deployed and is not connected to campus identity, the POS, a meal plan, or real payment.

## Worker contract

The staff entry offers four one-click demo locations: **Cafeteria**, **The Hub**, **Starbucks**, and **Frothy Monkey**. A worker sees only current online orders for the selected location. Cafeteria combines its own Grill and Sandwich tickets on one screen and labels each ticket by station; the other three locations remain isolated. The board has three lanes:

| Lane | Stored status | Worker action |
|---|---|---|
| Pending | `received` or older `entered` | **Accept** |
| Preparing | `preparing` | **Mark ready** |
| Done | `ready` | No worker action |

The new `/staff/orders/:id/accept` API requires the expected current status and the assigned station. It runs inside one SQLite transaction. For a newly received online retail ticket, it checks the linked fictional Student ID and prior demo payment authorization, records `entered`, approves the fictional payment, and records `preparing`. An older `entered` ticket can be accepted into preparation too. Cafeteria tickets skip payment; entrance was represented before the station order. **Mark ready** uses the existing status transition. The student ticket polls the same order and shows Ready only after that action. This one-click retail payment approval is a **demo assertion** by the worker, not a response from a real POS.

The manager's legacy `/kitchen` view remains available for clock setup and extra operations, including pickup completion. The simple worker view displays only online tickets and no controls for walk-ins, stock, capacity, queue simulation, or other locations. Ready tickets appear newest first in Done until handoff is recorded elsewhere; the simple view does not ask the worker to mark pickup.

## Verification

- `npm test`: **79 passed, 0 failed**, including status conflict/race checks, payment authorization, student visibility, and separate Grill/Sandwich permissions.
- `npm run build`: TypeScript and Vite passed after integration.
- Browser walkthrough: student `10002` placed a Hub Chicken tenders demo meal-swipe order. Pickup `647071` appeared in the Hub's Pending lane. Worker **Accept** moved it to Preparing and completed the fictitious payment milestone on the student's open ticket. **Mark ready** moved it to Done and triggered the student's Ready notice without a page reload.
- Cafeteria walkthrough: the Cafeteria card opened `/panel/cafeteria` directly. The panel showed only Cafeteria orders and labeled the Grill tickets. A new Sandwich ticket, pickup `264313`, appeared with its Sandwich Station label and choices. **Accept** moved it to Preparing; **Mark ready** triggered Ready on the student ticket in another browser. No extra station ID/payment action appeared.
- Visual inspection covered the four-card entry and the worker board at desktop and iPad landscape/portrait widths. Buttons and Student IDs remained readable; the board used three columns in landscape and two in portrait.

The live server currently runs on local port `3002`. A physical phone/iPad rehearsal remains unverified; campus Wi-Fi may isolate devices. In-app notices require the student ticket to remain open and awake. The one-click demo accounts are public fictional roles and must not be used for real student data or a live service. No Cloudflare upload, tunnel, or publication occurred.
