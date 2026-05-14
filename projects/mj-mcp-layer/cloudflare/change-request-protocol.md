# Change Request Protocol — for subordinate agents

Other agents (Cursor, Gemini, Antigravity, MCP clients, future tools) **may not** modify `ellis-aegis.us` directly. They submit a change request to Codex. Codex validates, executes, and returns a receipt.

---

## Submission
Drop a JSON file into `inbox/` (or POST to the Codex intake worker if deployed):

```json
{
  "request_id": "uuid-v4",
  "requested_by": "agent-name-or-id",
  "timestamp": "ISO-8601 UTC",
  "intent": "add_dns_record | modify_dns_record | delete_dns_record | add_waf_rule | modify_waf_rule | request_readonly_token | request_temporary_write | other",
  "details": {
    "// shape depends on intent": ""
  },
  "justification": "human-readable why",
  "rollback_plan": "human-readable how to undo",
  "expires_at": "ISO-8601 UTC (optional — for token requests)"
}
```

### Intent schemas

**`add_dns_record`**
```json
{
  "type": "A | AAAA | CNAME | TXT | MX | SRV | CAA",
  "name": "fqdn",
  "content": "value",
  "ttl": 3600,
  "proxied": true | false
}
```

**`modify_waf_rule`**
```json
{
  "description": "exact rule description from baseline.yaml",
  "new_expression": "...",
  "new_action": "block | challenge | log | skip"
}
```

**`request_readonly_token`**
```json
{
  "scope": ["zone:read", "dns:read"],
  "ttl_hours": 24,
  "purpose": "what this token will be used for"
}
```

---

## Codex's response

For every request, Codex writes a receipt to `artifacts/receipts/<request_id>.json`:

```json
{
  "request_id": "...",
  "status": "approved_executed | approved_pending | denied | escalated",
  "executed_at": "ISO-8601 UTC",
  "ledger_entry_hash": "sha256:...",
  "cf_request_ids": ["..."],
  "result": { "...": "..." },
  "denial_reason": "if denied"
}
```

---

## Default policy

**Allowed without operator approval (auto-execute):**
- `request_readonly_token` with TTL ≤ 24h
- `add_dns_record` for TXT records under `_acme-challenge.*` (cert validation)

**Requires operator approval (queues for Joe):**
- All DNS records that are not ACME validation
- All WAF rule changes
- All worker route changes
- Any token with write scopes
- Any TTL > 24h on a token

**Always denied:**
- Requests to modify `docs/security-baseline.yaml`
- Requests for the master CF API token
- Requests to disable Codex's own scan/ledger
- Requests from agents not in `docs/authorized-agents.yaml`

---

## Receipt verification (for the requesting agent)

The receipt is signed using Codex's signing key. The requesting agent verifies:
```
codex-verify --receipt receipts/<request_id>.json
```
If verification fails, the receipt is forged — escalate to Joe.

---

## Failure modes
- Malformed JSON → rejected, no receipt
- Schema validation fail → denied receipt with details
- Unknown agent → denied + logged as suspicious
- Cloudflare API failure during execute → `approved_pending` receipt, retry queue
