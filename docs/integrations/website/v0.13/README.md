# Central login and website event operations

Connected websites reuse a Logi login through OIDC authorization code flow with S256 PKCE and a nonce. Websites keep their own backend sessions and cookies. Login does not confer workspace administrator access.

- [SSO provider contract](../sso-provider-contract.md): issuer, clients, tokens, sessions, and revocation.
- [Membership reads](../v0.7/README.md): current guild roles, game scope, and freshness.
- [Actor-backed event commands](../event-commands.md): current actor authorization, service-key policy, revision checks, and durable command receipts.
- [Minimal summaries](../v0.4/README.md): website projections of native operational data.

API keys cannot create user sessions. Roster, attendance, result review, and Discord side effects retain their own authorization boundaries; event-command permission does not authorize them.
