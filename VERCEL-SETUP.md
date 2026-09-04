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
