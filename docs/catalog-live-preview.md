# V4.0.2 — server-backed catalog preview

Dedicated test Supabase project: KADUKOV-TECH (qlggbdzodqagtxqifslg). Catalog schema migration applied; RLS enabled, published-only public reads and administrator + AAL2 writes. No user accounts or customer data provisioned. The main storefront is unchanged.

- /admin/ remains local-only demo.
- /admin/live.html is an experimental server-backed editor (Supabase JS 2.119.2, version pinned). No credentials stored in browser persistence. A test admin account must be provisioned in project Auth and assigned catalog_role=admin in trusted app_metadata. The owner must enroll TOTP. Never use user_metadata for roles, never share passwords/OTP/TOTP secrets in chat. Do not create real customer accounts in this test region.
- Drafts are default; published flag allows test API read, but is not connected to main storefront yet. Editing uses updated_at optimistic concurrency. No hard delete UI.
- Verify live browser login, MFA, write/read and session expiry before commercial use. Vendor/bundle dependency with lockfile and integrity checks before production; public test preview currently uses pinned CDN.
- SQL role simulations executed in rolled-back transaction; anonymous and non-admin writes denied, admin with AAL2 allowed. Security advisor returned no lints. The catalog is empty after rollback.
