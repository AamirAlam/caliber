# @caliber/web — frontend

The Caliber control surface: a polished marketing landing page plus a dashboard
shell, built with Next.js (App Router), TypeScript, and Tailwind CSS.

## Pages

- `/` — landing page: hero, product explanation, how it works, architecture
  preview, trust & guardrails, CTA. Design language is institutional and calm.
- `/dashboard` — read-only public treasury workspace by default. Operator-only
  controls unlock with a server-side access code before runs or approvals can be
  submitted.

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
  be authenticated server-to-server. Set `OPERATOR_ACCESS_CODE` as the dashboard
  unlock code; without it, public visitors can read data but cannot run or
  approve agent actions.
  `NEXT_PUBLIC_SERVICES_URL` is only needed if you intentionally want the browser
  to call the backend directly.
- Design tokens live in `tailwind.config.ts` (ink base, single teal accent).
