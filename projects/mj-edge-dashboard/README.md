# MJ Edge Dashboard Prototype

This folder now includes a static frontend **and** a local backend stub so the UI can monitor tenants/subscriptions from API calls.

## What this adds

- Tenant and subscription monitoring table.
- KPI cards for active users, active subscriptions, MRR, and churn risk.
- Self-service customer action surface.
- Command/event log panel for operational oversight.
- Local API endpoints for integration rehearsal:
  - `GET /api/tenants`
  - `GET /api/events`

## Run locally (integrated)

```bash
cd projects/mj-edge-dashboard
python3 server.py
# open http://localhost:8080
```

The UI defaults to token `mj-local-dev-token`.
API calls require header: `Authorization: Bearer mj-local-dev-token`.

## Quick API checks

```bash
curl -H 'Authorization: Bearer mj-local-dev-token' http://localhost:8080/api/tenants
curl -H 'Authorization: Bearer mj-local-dev-token' http://localhost:8080/api/events
```

## Next completion steps

1. Replace stub auth token with real auth (OIDC/session/JWT).
2. Back endpoints with persistent tenant/subscription stores.
3. Add role-based access control (admin/customer).
4. Add E2E checks for tab switching/search/commands/API errors.
