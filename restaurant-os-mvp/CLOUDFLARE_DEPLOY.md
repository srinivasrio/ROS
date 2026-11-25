# Deploying Dine In One to Cloudflare Workers

The main app (all panels and every `/api` route) and the Super Admin portal run on Cloudflare Workers through the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare). The database is unchanged:
the same Supabase, reached over HTTPS with `@supabase/supabase-js`.

The VPS / PM2 setup (`deploy.sh`, `ecosystem.config.js`) is untouched and still works,
so you can run both side by side and switch DNS when ready.

---

## 0. Requirements

- **Workers Paid plan ($5/month).** The compressed Worker is about 3.5 MB. The free plan
  limit is 3 MB; the paid limit is 10 MB.
- **Cloudflare Images enabled** on the account. Used for `next/image` and for resizing uploads.
  It replaces `sharp`, which can't run on Workers.
- **Node 22** on the machine you deploy from.

## 1. Configure Supabase Cloud (Single Primary Database)

The app connects over HTTPS directly to your Supabase Cloud project (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Set these in `.env.local` (for build-time `NEXT_PUBLIC_*`), `super-admin/.env.local`, and Cloudflare Worker secrets (`npx wrangler secret put`), and remove any legacy VPS / `SECONDARY_SUPABASE_*` overrides.

## 2. One-time Cloudflare setup

```bash
npm install                 # installs @opennextjs/cloudflare + wrangler
npx wrangler login
npx wrangler r2 bucket create dine-in-one-opennext-cache
```

## 3. Secrets

`NEXT_PUBLIC_*` values are **baked into the browser bundle at build time**. Keep them in
`.env.local` (or `.env.production`) on the machine that runs the deploy.

All runtime secrets must also be set on the Worker. The full list is in `.dev.vars.example`.

```bash
cp .dev.vars.example .dev.vars      # fill in real values (never commit .dev.vars)
npx wrangler secret bulk .dev.vars  # uploads them all as Worker secrets
```

**Rate limiting & OTP state (`SECURITY_DO` + native `ratelimits`):** Public endpoints use Cloudflare's native Rate Limiting bindings (`RL_*` in `wrangler.jsonc`), and auth/OTP rate limits + temporary OTPs use the strongly consistent `SECURITY_DO` Durable Object hosted in `workers/realtime`. Always deploy `npm run cf:deploy:realtime` before `npm run cf:deploy`.

## 4. Test locally in the Workers runtime

```bash
npm run cf:preview     # builds, then serves on http://localhost:8787 using workerd
```
Log in to each panel (admin, owner, waiter, KDS, delivery, customer QR menu) and place a test order.

## 5. Deploy

```bash
npm run cf:deploy
```
The first deploy gives you a `*.workers.dev` URL. Test there first.

## 6. Go live (DNS cutover)

In the Worker → Settings → Domains & Routes, add your custom domains (the main domain and
the panel subdomains used by `middleware.ts`). Cloudflare moves traffic from the VPS to the Worker.

**Rollback:** remove the custom domain from the Worker and point DNS back at the VPS. PM2 is still running.

---

## Super Admin (`super-admin/`)

The Super Admin portal is a separate Next.js app, so it deploys as its own Worker,
`dine-in-one-superadmin`. Run these commands inside `super-admin/`.

```bash
cd super-admin
npm install
cp .dev.vars.example .dev.vars      # fill in real values (never commit .dev.vars)
npx wrangler secret bulk .dev.vars
npm run cf:deploy                   # or from the project root: npm run cf:deploy:superadmin
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_R2_PUBLIC_URL` are baked in at build time, so also keep them in
  `super-admin/.env.local` on the deploy machine. Use the same HTTPS Supabase hostname as in step 1.
- Add your Super Admin domain under the Worker → Settings → Domains & Routes.
  `middleware.ts` redirects `localhost` to `control.localhost`. To test with `npm run cf:preview`,
  open `http://control.localhost:8787` rather than `http://localhost:8787`.
- Compressed size is about 2.1 MB. It needs no R2 cache bucket, no Images binding and no Upstash:
  its rate limiter already stores attempts in Supabase, so the limits hold across all Worker instances.

**Code changes in `super-admin/`:**

| Change | Why |
|---|---|
| `next` 16.1.6 → 16.4.6 | The OpenNext adapter requires ≥ 16.4.5 |
| `lib/password-hash.ts`, `lib/runtime.ts` (new), `lib/auth-utils.ts` | Same `argon2` fix as the main app. Existing hashes still verify. |
| Added `@aws-sdk/client-ses` and `react-is@19.2.3` to `package.json` | Super-admin imported these but only found them in the parent project's `node_modules`. The Worker is bundled on its own, so they must be its own dependencies. `react-is` now matches React 19, which recharts needs. |
| `wrangler.jsonc`, `open-next.config.ts`, `.dev.vars.example`, `cf:*` scripts | Cloudflare config |

---

## What changed in the code (and why)

| Change | Why |
|---|---|
| `next` 16.1.6 → 16.4.6 | The OpenNext adapter requires ≥ 16.4.5 |
| `lib/password-hash.ts` (new), `lib/auth-utils.ts` | Native `argon2` can't run on Workers. Uses native argon2 on the VPS and pure-JS `@noble/hashes` on Workers. **All existing hashes still verify.** |
| New hashes use OWASP's Argon2id params (19 MiB, t=2, p=1) | The old params (64 MiB, t=3, p=4) take ~1.5 s CPU and 64 MB RAM per login in pure JS, which risks the 128 MB Worker memory limit when several staff log in at once. Change `ARGON2_PARAMS` in `lib/password-hash.ts` if you want different values. `needsRehash()` is exported for upgrading old hashes on login. |
| `lib/image-optimize.ts` (new), `app/api/upload/route.ts` | `sharp` is native. Uses sharp on the VPS and the Cloudflare Images binding on Workers. |
| `lib/runtime.ts` (new) | Runtime detection, and loading native modules only on Node |
| `lib/rate-limiter.ts` | Module-level `setInterval` isn't allowed on Workers; cleanup now runs lazily |
| `app/api/owner/menu/route.ts` | Menu-cache revalidation wrapped in `after()` so Workers doesn't cancel it once the response is sent |
| `wrangler.jsonc`, `open-next.config.ts`, `.dev.vars.example`, `cf:*` scripts | Cloudflare config |

## Known limits / follow-ups

- **`/api/backup/cron`** dumps the database in memory. On Workers it's limited to 128 MB of RAM,
  so keep running backups from the VPS cron (or move them to a scheduled job outside the Worker).
  Also note Workers doesn't call this route on a schedule by itself.
- **Logins with old (64 MiB) hashes take about 1.5 s** on Workers until they're re-hashed.
- **`middleware.ts`**: Next 16 prints a deprecation warning suggesting `proxy.ts`. **Don't rename it.**
  OpenNext on Cloudflare still needs `middleware.ts`.
- **Original source** before these changes: `.cf-migration-backup/src-snapshot.tgz`.

---

## Password checks on the free Workers plan

The free plan allows about 10 ms of CPU per request, but Argon2 password and PIN checks need 100+ ms.
On Workers, `lib/password-hash.ts` therefore sends them to a small service on the VPS
(`vps/auth-hash/`, see its README). The Worker reaches it at `https://hash.dineinone.com` through
the Cloudflare Tunnel, authenticated by the header `x-auth-hash-secret`.

- Worker secrets: `AUTH_HASH_URL` and `AUTH_HASH_SECRET` (in both `.dev.vars` files).
- VPS: `/root/dineinone-auth-hash`, run by PM2 as `dine-in-one-auth-hash` on `127.0.0.1:8020`.
- If those secrets are removed, the Workers fall back to the `dine-in-one-auth-hash` Worker
  (`workers/auth-hash/`). That fallback needs Workers Paid; deploy it with `npm run cf:deploy:authhash`.
