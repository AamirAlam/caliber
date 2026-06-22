# @helm/web — frontend

The Helm control surface: a polished marketing landing page plus a dashboard
shell, built with Next.js (App Router), TypeScript, and Tailwind CSS.

## Pages

- `/` — landing page: hero, product explanation, how it works, architecture
  preview, trust & guardrails, CTA. Design language is institutional and calm.
- `/dashboard` — dashboard shell with placeholder panels for policy, live
  signals, the latest recommendation, and run history (static demo data).

## Develop

```bash
cp .env.example .env.local
pnpm --filter @helm/web dev    # http://localhost:3000
```

## Notes

- Shared domain types come from `@helm/shared`.
- The dashboard renders static demo data from `src/lib/mockData.ts`. Wire it to
  the services API (`NEXT_PUBLIC_SERVICES_URL`) for live data.
- Design tokens live in `tailwind.config.ts` (ink base, single teal accent).
