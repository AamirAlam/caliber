# @caliber/web — frontend

The Caliber control surface: a polished marketing landing page plus a dashboard
shell, built with Next.js (App Router), TypeScript, and Tailwind CSS.

## Pages

- `/` — landing page: hero, product explanation, how it works, architecture
  preview, trust & guardrails, CTA. Design language is institutional and calm.
- `/dashboard` — treasury monitoring dashboard. Runs and approvals require the
  connected treasury owner wallet.

## Develop

```bash
cp .env.example .env.local
pnpm --filter @caliber/web dev    # http://localhost:3000
```

## Notes

- Shared domain types come from `@caliber/shared`.
- The dashboard shows an unavailable state when the services API cannot be
  reached; it does not substitute mock data.
- In production, point the built-in proxy at the backend with `SERVICES_URL`.
  Set `CALIBER_ADMIN_TOKEN` on the web deployment so authorized POST requests can
  be authenticated server-to-server. Set `WALLET_SESSION_SECRET` so connected
  wallet sessions are signed consistently across server instances.
  `NEXT_PUBLIC_SERVICES_URL` is only needed if you intentionally want the browser
  to call the backend directly.
- Design tokens live in `tailwind.config.ts` (ink base, single teal accent).
