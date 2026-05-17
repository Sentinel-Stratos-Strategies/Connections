import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface CapabilityVisa {
  id: string;
  agent: string;
  scope: string;
  zone: string;
  ttl_minutes: number;
  max_mutations: number;
  mutations_used: number;
  receipt_required: boolean;
  issued_at: string;
  expires_at: string;
  reason: string;
  status: "active" | "consumed" | "expired" | "revoked";
  signature: string;
}

export interface VisaRequest {
  agent: string;
  scope: string;
  zone: string;
  ttl_minutes?: number;
  max_mutations?: number;
  receipt_required?: boolean;
  reason: string;
}

export interface VisaValidation {
  valid: boolean;
  reason?: string;
  remaining_mutations?: number;
  remaining_seconds?: number;
}

interface VisaStore {
  visas: CapabilityVisa[];
}

export class VisaEngine {
  private storeFile: string;
  private signingKey: string;
  private store: VisaStore;

  constructor(storeFile: string, signingKey: string) {
    this.storeFile = storeFile;
    this.signingKey = signingKey;
    this.store = this.loadStore();
  }

  mint(request: VisaRequest): CapabilityVisa {
    const now = new Date();
    const ttl = request.ttl_minutes ?? 15;
    const expires = new Date(now.getTime() + ttl * 60000);

    const visa: CapabilityVisa = {
      id: `visa-${randomUUID().slice(0, 12)}`,
      agent: request.agent,
      scope: request.scope,
      zone: request.zone,
      ttl_minutes: ttl,
      max_mutations: request.max_mutations ?? 1,
      mutations_used: 0,
      receipt_required: request.receipt_required ?? true,
      issued_at: now.toISOString(),
      expires_at: expires.toISOString(),
      reason: request.reason,
      status: "active",
      signature: "",
    };

    visa.signature = this.sign(visa);
    this.store.visas.push(visa);
    this.saveStore();

    return visa;
  }

  validate(visaId: string): VisaValidation {
    const visa = this.store.visas.find((v) => v.id === visaId);
    if (!visa) {
      return { valid: false, reason: "Visa not found" };
    }

    if (visa.status === "revoked") {
      return { valid: false, reason: "Visa has been revoked" };
    }

    if (visa.status === "consumed") {
      return { valid: false, reason: "Visa fully consumed (max mutations reached)" };
    }

    const now = new Date();
    const expires = new Date(visa.expires_at);
    if (now > expires) {
      visa.status = "expired";
      this.saveStore();
      return { valid: false, reason: `Visa expired at ${visa.expires_at}` };
    }

    const expectedSig = this.sign({ ...visa, signature: "" });
    if (visa.signature !== expectedSig) {
      return { valid: false, reason: "Visa signature invalid — possible tampering" };
    }

    const remainingMutations = visa.max_mutations - visa.mutations_used;
    const remainingSeconds = Math.floor((expires.getTime() - now.getTime()) / 1000);

    return {
      valid: true,
      remaining_mutations: remainingMutations,
      remaining_seconds: remainingSeconds,
    };
  }

  consume(visaId: string): VisaValidation {
    const validation = this.validate(visaId);
    if (!validation.valid) return validation;

    const visa = this.store.visas.find((v) => v.id === visaId)!;
    visa.mutations_used++;

    if (visa.mutations_used >= visa.max_mutations) {
      visa.status = "consumed";
    }

    visa.signature = this.sign({ ...visa, signature: "" });
    this.saveStore();

    return {
      valid: true,
      remaining_mutations: visa.max_mutations - visa.mutations_used,
      remaining_seconds: Math.floor(
        (new Date(visa.expires_at).getTime() - Date.now()) / 1000,
      ),
    };
  }

  revoke(visaId: string): boolean {
    const visa = this.store.visas.find((v) => v.id === visaId);
    if (!visa) return false;
    visa.status = "revoked";
    visa.signature = this.sign({ ...visa, signature: "" });
    this.saveStore();
    return true;
  }

  listActive(): CapabilityVisa[] {
    this.expireStale();
    return this.store.visas.filter((v) => v.status === "active");
  }

  listAll(): CapabilityVisa[] {
    this.expireStale();
    return [...this.store.visas];
  }

  getByAgent(agent: string): CapabilityVisa[] {
    this.expireStale();
    return this.store.visas.filter((v) => v.agent === agent);
  }

  formatVisa(visa: CapabilityVisa): string {
    const lines = [
      `# Capability Visa: ${visa.id}`,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Agent | ${visa.agent} |`,
      `| Scope | ${visa.scope} |`,
      `| Zone | ${visa.zone} |`,
      `| Status | ${visa.status} |`,
      `| TTL | ${visa.ttl_minutes} min |`,
      `| Mutations | ${visa.mutations_used}/${visa.max_mutations} |`,
      `| Receipt Required | ${visa.receipt_required} |`,
      `| Issued | ${visa.issued_at} |`,
      `| Expires | ${visa.expires_at} |`,
      `| Reason | ${visa.reason} |`,
      `| Signature | \`${visa.signature.slice(0, 16)}...\` |`,
    ];
    return lines.join("\n");
  }

  formatActiveList(): string {
    const active = this.listActive();
    if (active.length === 0) return "No active visas.";

    const lines = [
      "# Active Capability Visas",
      "",
      "| ID | Agent | Scope | Zone | Mutations | Expires |",
      "|----|-------|-------|------|-----------|---------|",
    ];

    for (const v of active) {
      const remaining = v.max_mutations - v.mutations_used;
      lines.push(`| ${v.id} | ${v.agent} | ${v.scope} | ${v.zone} | ${remaining} left | ${v.expires_at} |`);
    }

    return lines.join("\n");
  }

  private sign(visa: CapabilityVisa): string {
    const payload = JSON.stringify({
      id: visa.id,
      agent: visa.agent,
      scope: visa.scope,
      zone: visa.zone,
      ttl_minutes: visa.ttl_minutes,
      max_mutations: visa.max_mutations,
      mutations_used: visa.mutations_used,
      receipt_required: visa.receipt_required,
      issued_at: visa.issued_at,
      expires_at: visa.expires_at,
      reason: visa.reason,
      status: visa.status,
    });

    return createHmac("sha256", this.signingKey).update(payload).digest("hex");
  }

  private expireStale(): void {
    const now = new Date();
    let changed = false;

    for (const visa of this.store.visas) {
      if (visa.status === "active" && new Date(visa.expires_at) < now) {
        visa.status = "expired";
        changed = true;
      }
    }

    if (changed) this.saveStore();
  }

  private loadStore(): VisaStore {
    if (!existsSync(this.storeFile)) return { visas: [] };
    try {
      return JSON.parse(readFileSync(this.storeFile, "utf-8")) as VisaStore;
    } catch {
      return { visas: [] };
    }
  }

  private saveStore(): void {
    mkdirSync(dirname(this.storeFile), { recursive: true });
    writeFileSync(this.storeFile, JSON.stringify(this.store, null, 2));
  }
}
