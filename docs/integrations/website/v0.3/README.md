# Scoped website integration

Logi owns operational events, rosters, membership, and results. Connected websites consume scoped API projections and retain their own CMS, publication consent, sessions, and authorization. Use [minimal summaries](../v0.4/README.md) for event and match display and the [integration reference](../README.md) for the supported contracts.

## Access

Create an integration key in the workspace's Website API settings. Restricted keys authorize only explicitly selected resources and games. Keep bearer keys on the consumer backend. Logi validates scope and revocation at the API and persistence boundaries.

The API reference is served at `/api/v1/docs`, with the machine-readable schema at `/api/v1/openapi.json`. Resource-specific contracts are listed in the [integration index](../README.md).

## Ownership

Website projections retain Logi source identities. Discord subjects, Logi records, and provider player IDs are distinct. Collected player IDs do not prove account ownership; use [verified Steam identity](../v0.9/README.md) when attribution requires proof. Public-member consent belongs to the publishing website.

## Synchronization

Collections use bounded pagination. The changes endpoint returns `410 reset_required` on cursor replay; rebuild the permitted scope and preserve website-owned editorial and consent records. See [synchronization and webhooks](../v0.6/README.md).
