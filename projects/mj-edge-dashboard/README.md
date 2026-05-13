# MJ Edge Dashboard (Phases 3-6 complete)

This implementation now includes:
- **Phase 3**: SQLite-backed tenant/event data + login + RBAC.
- **Phase 4**: Frontend wired to auth/API with role-aware views.
- **Phase 5**: security hardening controls (password hashing, rate limiting, CORS/security headers, CSRF header checks, audit logs).
- **Phase 6**: deploy package (Dockerfile, compose, env template, health endpoint).

## Local run

```bash
cd projects/mj-edge-dashboard
python3 server.py
# open http://localhost:8080
```

## Docker run

```bash
cd projects/mj-edge-dashboard
docker compose up --build
```

## Demo users

- Admin: `admin@mj.local` / `admin123`
- Customer: `owner@alpha.io` / `alpha123`

## API

- `POST /api/login`
- `GET /api/tenants?q=<term>`
- `GET /api/events`
- `GET /api/audit` (admin only)
- `GET /api/audit.csv` (admin only)
- `GET /healthz`

All `/api/*` routes require `Authorization: Bearer <token>` after login.

## Security controls now present

- Password hashing using PBKDF2-HMAC-SHA256.
- Token TTL enforcement.
- Request rate limiting by source IP.
- CORS allowlist and secure response headers.
- Basic CSRF header check for non-login POST actions.
- Audit log persistence and export.

## Production next checks

1. Replace demo credentials and seed logic.
2. Move token/session store to Redis or DB.
3. Add TLS termination and reverse-proxy auth in front of service.
4. Add browser E2E + API integration test suite.
