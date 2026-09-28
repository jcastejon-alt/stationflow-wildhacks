# The Hub — local QA, September 27, 2026

## Verified

- Backend suite: 63/63 tests passed. Includes server-controlled eligibility/pricing, immutable price snapshots, migration preservation and retry behavior.
- Final frontend production build passed after staff pricing and cafeteria Included-label corrections.
- Root independently exercised the student and employee interfaces in separate browser profiles.
- Meal swipe exposes Chicken tenders and Campus burger only; receipt shows one meal swipe.
- Tenders goes directly to Sauce; burger and wrap show Customize before Sauce, followed by Pickup.
- Regular menu displays clearly labeled illustrative demo prices. Chicken wrap with Cheddar and Caesar dressing produced ticket 357899 with a server snapshot of $8.49; employee panel shows the same price and choices.
- Meal-swipe burger ticket 848191 reached the employee panel with Student 10001, Lettuce and Ketchup. Confirm payment → Standby → Preparing → Ready produced the student's visible pickup alert.
- Salad dressing appears under Sauce after the final catalog correction.
- The live Sunday view showed 11 AM–7 PM; the Monday Lunch preset showed 11 AM–10 PM. Clock left on Monday Lunch for rehearsal.
- At 390 × 844, document width remained 390 pixels with no horizontal overflow. Viewport reset after inspection.
- Saved request recovery restores paymentMode and menu selection; source review confirmed the original payload remains authoritative.

## Evidence

- `artifacts/hub-menu-prices-v5.png`
- `artifacts/hub-menu-mobile-v5.png`
- Earlier cafeteria checks: `QA_CAFETERIA_HOURS.md`

All prices are fictional demo values approved by the user, not official campus prices. Real POS, institutional identity, payment capture, physical-device networking and background push notifications remain outside this local verification. Existing demo orders were preserved. Nothing was published or deployed.
