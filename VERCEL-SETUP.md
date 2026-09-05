# Vercel Setup — Nabus Motors

## Quick fix for 404 NOT_FOUND

That error means **no successful deployment** exists at the URL. Fix:

1. **Settings → General → Root Directory** → leave **empty** (blank)
2. **Framework Preset** → **Next.js**
3. **Settings → Git** → connect `mccaesartech/Nabus-Motors`, branch `master`
4. **Deployments → Redeploy** (or push to GitHub)
5. Open the URL from a deployment marked **Ready** (green)

## Required environment variables

Copy from your `.env.local` into **Settings → Environment Variables** (Production + Preview):

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL until custom domain |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `233279940200` |
| `ADMIN_PASSWORD` | Admin login |
| `ADMIN_SECRET` | Random secret string |

Redeploy after adding or changing env vars.

## Disable Deployment Protection (required to view the site)

If you see a Vercel login page instead of the site:

1. **Settings → Deployment Protection**
2. Set **Production** to **Standard Protection** off, or allow public access
3. Redeploy

Preview URLs with deployment hashes may still require login until protection is disabled.

## Fix "We're verifying your browser" (spinner never finishes)

Vercel's **System Mitigations** (DDoS protection) can show a Security Checkpoint that spins forever.

1. Open [Vercel Dashboard](https://vercel.com/mccaesartech/nabus-motors) → **Firewall**
2. If **System Mitigations** are active, click **Pause for 24 hours** (or use CLI: `npx vercel firewall system-mitigations pause`)
3. Or see [Vercel's checkpoint fix guide](https://vercel.link/security-checkpoint)
4. Hard-refresh the site (Ctrl+Shift+R)

Also ensure `NEXT_PUBLIC_SITE_URL` is set to `https://nabusmotors.vercel.app` until the custom domain is connected — otherwise the site may redirect in a loop or send visitors to the old GoDaddy site.

## Deploy from CLI

```powershell
cd "C:\Users\PC1\OneDrive\Desktop\Nabus\truegoshenauto"
npx vercel link
npx vercel deploy --prod
```

## Verify

- `/` — homepage
- `/auto/inventory` — vehicles from Supabase
- `/admin` — admin login
- `/api/health/ready` — should return 200 when configured
