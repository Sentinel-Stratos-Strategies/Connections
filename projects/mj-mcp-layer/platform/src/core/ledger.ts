import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import type {
  DriftChange,
  DriftReport,
  InventorySnapshot,
  LedgerEntry,
  ProviderName,
  SignedEntry,
} from "./types.js";
import type { ProviderAdapter } from "../adapters/provider.interface.js";

export interface LedgerBackend {
  append(key: string, data: string): Promise<void>;
  read(key: string): Promise<string | null>;
  list(prefix: string): Promise<string[]>;
}

export class FileLedgerBackend implements LedgerBackend {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async append(key: string, data: string): Promise<void> {
    const path = `${this.basePath}/${key}`;
    appendFileSync(path, data + "\n");
  }

  async read(key: string): Promise<string | null> {
    const path = `${this.basePath}/${key}`;
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  }

  async list(_prefix: string): Promise<string[]> {
    return [];
  }
}

export class UniversalLedger {
  private storageBackend: LedgerBackend;
  private ledgerKey: string;
  private adapters: Map<ProviderName, ProviderAdapter>;

  constructor(
    storageBackend: LedgerBackend,
    ledgerKey: string,
    adapters: Map<ProviderName, ProviderAdapter>,
  ) {
    this.storageBackend = storageBackend;
    this.ledgerKey = ledgerKey;
    this.adapters = adapters;
  }

  async recordEntry(entry: LedgerEntry): Promise<void> {
    const key = `ledger/${entry.provider}/${entry.ts}-${entry.changeId}.jsonl`;
    const signed = this.sign(entry);
    await this.storageBackend.append(key, JSON.stringify(signed));
  }

  async getDrift(provider: ProviderName, since: Date): Promise<DriftReport> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      return {
        provider,
        timestamp: new Date().toISOString(),
        unauthorizedChanges: [],
        severity: "ok",
      };
    }

    const currentState = await adapter.getInventory();
    const authorizedChanges = await this.getAuthorizedChanges(provider, since);
    const unauthorized = this.detectDrift(currentState, authorizedChanges);

    const severity = unauthorized.length === 0
      ? "ok"
      : unauthorized.length < 3
        ? "low"
        : unauthorized.length < 10
          ? "medium"
          : "high";

    return {
      provider,
      timestamp: new Date().toISOString(),
      unauthorizedChanges: unauthorized,
      severity,
    };
  }

  sign(entry: LedgerEntry): SignedEntry {
    const payload = JSON.stringify(entry);
    const signature = createHmac("sha256", this.ledgerKey)
      .update(payload)
      .digest("hex");
    return { entry, signature };
  }

  verify(signed: SignedEntry): boolean {
    const recomputed = createHmac("sha256", this.ledgerKey)
      .update(JSON.stringify(signed.entry))
      .digest("hex");
    try {
      return cryptoTimingSafeEqual(
        Buffer.from(signed.signature, "hex"),
        Buffer.from(recomputed, "hex"),
      );
    } catch {
      return false;
    }
  }

  private async getAuthorizedChanges(provider: ProviderName, since: Date): Promise<LedgerEntry[]> {
    const adapter = this.adapters.get(provider);
    if (!adapter) return [];
    return adapter.getAuditLog(since);
  }

  private detectDrift(
    _currentState: InventorySnapshot,
    _authorizedChanges: LedgerEntry[],
  ): DriftChange[] {
    return [];
  }

  getAdapter(provider: ProviderName): ProviderAdapter | undefined {
    return this.adapters.get(provider);
  }
}
