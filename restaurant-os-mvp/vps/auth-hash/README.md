# VPS password-check service

The Cloudflare Workers (free plan, ~10 ms CPU per request) can't run Argon2.
They send password and PIN checks to this small Node service on the VPS,
through the Cloudflare Tunnel, authenticated with a shared secret.

## One-time setup

From your Mac, in the `restaurant-os-mvp` folder:

```bash
scp -r vps/auth-hash root@72.61.250.231:/root/dineinone-auth-hash
```

This also copies `.env`, which holds `AUTH_HASH_SECRET`. The same value is in
`.dev.vars` and `super-admin/.dev.vars`.

On the VPS (`ssh root@72.61.250.231`):

```bash
node -v && pm2 -v                 # both must print a version
cd /root/dineinone-auth-hash
npm install --omit=dev
pm2 start server.mjs --name dine-in-one-auth-hash
pm2 save
curl -s http://127.0.0.1:8020/health   # -> {"ok":true}
```

In Cloudflare, add a **published application** route to the `dineinone-vps` tunnel:
hostname `hash.dineinone.com`, service `http://localhost:8020`.

## Updating

Copy `server.mjs` again, then run `pm2 restart dine-in-one-auth-hash` on the VPS.

## Changing the secret

1. Edit `AUTH_HASH_SECRET` in `/root/dineinone-auth-hash/.env`, then run `pm2 restart dine-in-one-auth-hash`.
2. Put the same value in both `.dev.vars` files.
3. Run `npx wrangler secret bulk .dev.vars`, and the same inside `super-admin/`.
