---
globs: ["**/api/**", "**/actions/**", "**/lib/supabase/**", "**/*.sql", "**/middleware.*"]
---

# Security Rules

- Always check auth server-side. Never trust client IDs. Derive user from `auth.uid()`.
- Enable RLS on every table. Write policies checking `auth.uid()`. Never expose `service_role` key client-side.
- Validate with Zod. Never use `dangerouslySetInnerHTML`. Never use `eval()`.
- Never hardcode keys. Never commit `.env`.
- Audit that service role key is never imported in any client component.
- Use `lib/supabase/server.ts` for mutations, never `lib/supabase/client.ts`.
