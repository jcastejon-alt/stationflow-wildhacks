# Public demo operations

## What is public

The current demo URL is [https://editor-criterion-banners-providers.trycloudflare.com](https://editor-criterion-banners-providers.trycloudflare.com). It is a Cloudflare Quick Tunnel to the Express server running on Jorge's Mac. The URL is temporary and may change when the tunnel restarts. The Mac, tunnel process and application server must remain online; stopping or sleeping the Mac takes the demo offline. This is a fictional prototype, not a Trevecca or Sodexo service. Do not enter real student information.

The demo uses its own ignored database at `data/stationflow-cloud-demo.sqlite`, separate from the normal local database. It contains fictional demo activity only.

## Start or restart

Run commands from the project root. Keep each process running in its own terminal. If the app or tunnel restarts, repeat these steps and update anyone using the link if the Quick Tunnel URL changes.

1. Build the frontend:

   ```sh
   npm run build
   ```

2. Start a Quick Tunnel to the loopback app port:

   ```sh
   cloudflared tunnel --url http://127.0.0.1:3003
   ```

   Copy the HTTPS `trycloudflare.com` URL printed by `cloudflared`. That exact origin is needed by the app. The current verified URL is `https://editor-criterion-banners-providers.trycloudflare.com`.

3. In a second terminal, start the server with that exact URL as `PUBLIC_ORIGIN`:

   ```sh
   HOST=127.0.0.1 PORT=3003 DB_PATH=data/stationflow-cloud-demo.sqlite PUBLIC_ORIGIN=https://editor-criterion-banners-providers.trycloudflare.com node server/index.js
   ```

   If Cloudflare prints a different URL, replace the origin above with the new URL, without a trailing slash. Start the tunnel first so its URL is known before starting the server.

4. Open the public URL and sign in as a manager to select the **Lunch** preset for the Hub rehearsal. Restarting the server resets simulated time to the live clock, so select Lunch again after each restart.

## Rehearsal flow

Use separate browser profiles or devices for the student and staff sessions, since cookies are shared among tabs in one browser profile. Keep the student ticket page open during the staff status changes.

1. In the student profile, open `/login` and enter fictional student ID `10001` (no student password). Place a sample meal-swipe order at The Hub.
2. In the separate staff profile, open `/staff/login`, choose the Hub staff entry and use the public fictional demo password `CampusDemo!26`.
3. Confirm the ticket appears in the Hub staff inbox, then use **Accept** and **Mark ready**. The student ticket should update to its ready state.

The public demo flow was verified through the Quick Tunnel: student order `250438` appeared in the staff inbox, and the staff actions changed it through preparing/payment approved to ready. These are fictional records and simulated payment states; no real account, charge, or meal swipe is involved.

## Event links

WildHacks' September 27 announcement asks for submission before **11:59 PM September 27**; the time zone is unconfirmed. Make the GitHub repository and demo URL public, then provide their links through the Discord [Submission form](https://forms.gle/kcRmrFY3XbdjH5iQ9). The separate form link in the email is for registration.
