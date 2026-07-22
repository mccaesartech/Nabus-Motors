# True Goshen PWA Implementation

Progressive Web App support for the customer site and a separate admin install experience, built with **Serwist** (`@serwist/turbopack`) on **Next.js 16**.

## What’s included

| Feature | Customer | Admin |
|--------|----------|-------|
| Manifest | `/manifest.webmanifest` (`src/app/manifest.ts`) | `/admin/manifest.webmanifest` |
| Start URL | `/` | `/admin` (login; middleware protects `/platform`) |
| Icons | `public/icons/` | `public/icons/admin/` |
| Install prompt | `InstallPrompt` (customer copy) | Same component, admin variant on `/admin` & `/platform` |
| Service worker | `/serwist/sw.js` (shared origin SW) | Same SW (scope-limited via admin manifest) |

Brand colors (from `globals.css`):

- `theme_color`: `#4c1d95`
- `background_color` (customer): `#faf5ff`
- Admin manifest background: `#2e1065`

## Service worker

- **Source:** `src/app/sw.ts` (must be Serwist worker code — never overwrite with app/router helpers)
- **Route:** `src/app/serwist/[path]/route.ts` (built at deploy time)
- **Registration:** lazy via `DeferredPwaShell` → `PwaServiceWorkerRegistrar` in `src/app/layout.tsx`
- **Updates:** SW uses `skipWaiting` + `clientsClaim`; the registrar reloads **once per build** on `controlling` when `isUpdate` (shares `tg-build-reloaded-for` with chunk recovery)
- **Legacy cleanup:** `unregisterStaleServiceWorkers` only removes **non-**/serwist registrations (key `tg-sw-legacy-cleanup-v3`) — it must not unregister the live Serwist worker
- **Cache bust:** runtime cache names are versioned (`v3`); activate handler deletes older True Goshen runtime caches

### Caching strategy

| Resource | Strategy |
|----------|----------|
| `/_next/static/*` (hashed) | CacheFirst |
| Other scripts / styles / workers | StaleWhileRevalidate |
| Fonts, images | StaleWhileRevalidate |
| `/icons/*` | CacheFirst |
| Public pages (non-admin / non-platform) | NetworkFirst |
| `/api/*` (non-auth) | NetworkFirst |
| Auth-sensitive APIs | NetworkFirst only (short timeout) |
| Offline documents | Fallback to `/offline` |

### Deploy / glitch prevention checklist

1. After changing `sw.ts` or Serwist config, confirm `/serwist/sw.js` starts with Serwist bundles — not app route helpers.
2. Keep `i.pinimg.com` / `*.pinimg.com` (and other CMS hosts) in `next.config.ts` `images.remotePatterns`.
3. Do not reintroduce “unregister all service workers on every session” — that caused reload flashes against PWA registration.
4. Prefer one coordinated reload path (`checkBuildVersion` + SW `controlling` isUpdate) using `BUILD_RELOAD_KEY`.

## Icons

Generate or refresh PWA icons from the brand logo:

```bash
npm run logo          # optional — refreshes favicon + wordmarks
npm run pwa:icons     # writes public/icons and public/icons/admin
```

Required sizes: 192×192, 512×512, maskable variants for each app.

## Install prompt

`src/components/pwa/install-prompt.tsx`

- Chrome/Android: `beforeinstallprompt` with **Install app** / **Install later**
- iOS: Share → Add to Home Screen instructions
- Dismissal stored in `localStorage` (`tg-pwa-install-dismissed`) for 14 days
- Manual re-install: **Platform → Settings → Install Admin App** (clears dismissal and re-opens the prompt)

## Offline page

- URL: `/offline`
- File: `src/app/offline/page.tsx`
- Used as Serwist navigation fallback when offline

## Web Push (prepared, not fully wired)

### Database

Run migration:

```bash
# supabase/migrations/071_push_subscriptions.sql
```

Table: `push_subscriptions` with `customer_user_id` or `platform_user_id`, `endpoint`, `p256dh`, `auth`, `role`.

### Environment variables

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Add to `.env.local` / Vercel:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ops@truegoshen.com
```

### Client helpers

`src/lib/push/subscription.ts` — `subscribeToPush()`, `persistPushSubscription()`, etc.

### API stub

`POST /api/push/subscribe` — stores subscription (requires customer JWT or platform user session).

`DELETE /api/push/subscribe` — removes by `endpoint`.

### Service worker

Push and `notificationclick` handlers are stubbed in `src/app/sw.ts`. Wire a server sender (e.g. `web-push` npm package) when ready.

### Manual steps when enabling push

1. Apply `071_push_subscriptions.sql` to Supabase.
2. Set VAPID env vars in Vercel.
3. Call `subscribeToPush('customer' | 'admin')` from account/settings UI (UI not included yet).
4. Implement a cron or event handler to call `web-push.sendNotification()` using stored rows.

## iOS limitations

- No `beforeinstallprompt`; users must use Safari **Share → Add to Home Screen**.
- Push on iOS requires iOS 16.4+, installed PWA, and user permission.
- Separate admin/customer manifests mean two distinct home-screen icons if both are installed.

## Security notes

- Admin dashboard remains behind existing middleware + platform auth.
- Auth-sensitive API routes are not aggressively cached.
- Push subscribe requires authenticated customer or platform user (owner bootstrap excluded for admin push).

## Local verification

```bash
npm run pwa:icons
npm run build
npm run start
```

Chrome DevTools → Application → Manifest / Service Workers.

## Deploy

Production deploy uses the standard Vercel pipeline. Ensure `public/icons/**` is committed after `npm run pwa:icons`.
