# Public demo operations

**Live demo:** [stationflow-demo.fihnechn.workers.dev](https://stationflow-demo.fihnechn.workers.dev)

This URL runs on Cloudflare Workers. The same Worker serves the website and its `/api` routes; one SQLite-backed Durable Object holds the shared demo orders, sessions, station settings, and presentation clock. The old Quick Tunnel and the Mac-based Express server are no longer needed for this URL. Deploying a new version does not clear the Durable Object's existing tickets.

This is an independent, fictional prototype. The public student IDs and worker entrances are for judges to try. Do not enter real student information, and do not treat a displayed payment or meal swipe as a campus transaction.

## Rehearse the phone-to-tablet flow

Use different browser profiles or devices for the student and worker. Two tabs in one browser profile share a session cookie, so signing in on one tab switches the other tab's account.

1. If the venue is closed at rehearsal time, open [Manager / demo setup](https://stationflow-demo.fihnechn.workers.dev/staff/login), sign in as `manager` with the public demo password `CampusDemo!26`, and choose **Lunch** under Station controls. The shared demo clock keeps advancing from that preset and survives a Worker restart. Choose **Breakfast** for an Omelet demonstration or **Live** to return to the actual Central time.
2. On the phone, open [student login](https://stationflow-demo.fihnechn.workers.dev/login), enter fictional ID `10001`, and order a Hub burger or Chicken tenders with the one-item demo meal exchange. Choose a pickup window and leave the ticket open.
3. On the tablet, open [staff login](https://stationflow-demo.fihnechn.workers.dev/staff/login) and tap **The Hub**. Its panel shows only that location's current online orders. Tap **Accept** after the represented POS entry, then **Mark ready** when the simulated order is finished.
4. The student's open ticket refreshes from the same backend and displays the preparing and ready states. The ready alert works while that page is open and awake. There is no background push with the phone locked or browser closed.

The Cafeteria route works the same way: select Cafeteria on the worker tablet and choose Omelet, Hamburger, or Sandwich on the student side. The grill changes from Omelet to Hamburger at 11 AM in the demo service schedule. Cafeteria tickets do not use a separate meal swipe at the station; admission is assumed to happen at the dining hall entrance.

## Deploy an update

From this repository, with Wrangler authenticated to the intended Cloudflare account:

```sh
npm ci
npm test
npm run cf:deploy
```

`cf:deploy` builds the frontend and deploys the Worker and static assets. The `PUBLIC_ORIGIN` in [`wrangler.jsonc`](../wrangler.jsonc) must match the exact HTTPS demo origin. `npm run cf:dev` runs a local Worker with a separate local Durable Object database under `.wrangler/`; it does not alter the public demo state. The Node/SQLite development server remains available through `npm run dev`.

On September 27, the live Worker passed a two-session API walkthrough and a browser walkthrough with separate student and worker sessions. In the browser test, a Hub Chicken tenders meal-exchange ticket appeared in the Hub inbox without reloading; **Accept** changed the student's ticket to preparing with demo payment received, and **Mark ready** showed the ready alert and pickup code on the student's open page. HTTPS session flags and foreign-origin rejection were checked. The Cloudflare site and health endpoint still responded after the local Quick Tunnel and Mac demo server were stopped. Physical phone/iPad testing is still outstanding.
