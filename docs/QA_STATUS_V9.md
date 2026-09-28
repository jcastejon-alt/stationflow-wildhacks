# StationFlow V9: staff-driven order status

Historical review of the earlier multi-button panel. The current worker inbox and its one-click Accept flow are documented in [V10 worker QA](QA_WORKER_V10.md).

Local review on September 27, 2026. This is a fictional hackathon demo; nothing was deployed or connected to a campus POS, student-account payment, or real meal plan.

## Contract

| Student milestone | Who triggers it | Server record |
|---|---|---|
| Order sent | Student places a ticket | `received` |
| Entered (retail) / Accepted at station (cafeteria) | Assigned worker marks it in their panel | `entered` |
| Payment received (Hub and cafés only) | Assigned worker confirms the simulated POS result | `payment.status = approved` |
| Preparing | Assigned worker starts work | `preparing` |
| Ready for pickup | Assigned worker finishes | `ready` |
| Picked up | Assigned worker completes handoff | `picked_up` |

New retail tickets require the worker to type the ticket's fictional Student ID before `entered`; the backend checks it against the ID captured from the student's session. The payment endpoint rejects confirmation before `entered`, and the status endpoint rejects preparation before payment approval. A mismatch cannot advance the ticket. Cafeteria has no station ID/payment check. The student ticket and the assigned panel read the same SQLite order; each polls the API every three seconds. Ready appears only after the worker marks it.

## Verification

- `npm test`: 76 passed, 0 failed. Tests cover the new transitions, ID mismatch, payment ordering, station permissions, persisted legacy orders, queue counts and cafeteria behavior.
- `npm run build`: TypeScript and Vite build passed.
- Browser walkthrough: student 10002 placed a Hub chicken-tenders meal-swipe demo order. The Hub panel saw it in **New orders**. After matching ID 10002, it moved to **Payment check**; payment approval moved it to **Standby**; starting work moved it to **Preparing**; **Mark ready** produced the student pickup alert without a page reload. The student tracker reflected each separate milestone.
- Cross-host local walkthrough: the student ticket at `127.0.0.1:3002` and the cafeteria panel at `10.128.37.39:3002` shared an existing Hamburger Station ticket. **Accept station order**, **Start preparing**, and **Mark ready** advanced the student view without a payment step or station ID prompt.
- Responsive review: student ticket at 390×844 and staff panel at 1024×768. The ticket displays a vertical tracker on narrow screens; the staff board uses wider cards in a two-column tablet layout. [Mobile tracker screenshot](qa-status-mobile-v9.png) · [iPad panel screenshot](qa-status-staff-ipad-v9.png).

The physical phone/iPad rehearsal remains unverified. The ready alert works while the ticket stays open and the browser can poll; there is no background push when the browser is closed or the phone is locked. The POS entry and payment confirmation are manual **demo assertions**, not real integrations. The ID-only student entry is intentionally a public fictional profile and must not be used for real accounts.

## Replay

Run `npm run demo:lan` for the private Wi-Fi build, then use the printed address on both devices if that Wi-Fi permits device-to-device traffic. Set the manager demo clock to **Lunch** for a predictable Hub/Hamburger rehearsal. Use student `10002` in one browser and staff `hub` or `cafeteria` in a separate browser/profile; the staff password is listed in the README. Restarting the server resets the clock to live time. The LAN demo uses `data/stationflow-lan.sqlite`, separate from the development database.
