import { createHash, createHmac, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
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
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, data + "\n");
  }

  async read(key: string): Promise<string | null> {
    const path = `${this.basePath}/${key}`;
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  }

  async list(prefix: string): Promise<string[]> {
    const root = join(this.basePath, prefix);
    if (!existsSync(root)) return [];

    const keys: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        keys.push(fullPath.slice(this.basePath.length + 1));
      }
    };
    walk(root);
    return keys.sort();
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
    const payload = canonicalStringify(entry);
    const signature = createHmac("sha256", this.ledgerKey)
      .update(payload)
      .digest("hex");
    return { entry, signature };
  }

  verify(signed: SignedEntry): boolean {
    const recomputed = createHmac("sha256", this.ledgerKey)
      .update(canonicalStringify(signed.entry))
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
    const entries = await this.readSignedLedgerEntries(provider);
    if (entries.length > 0) return entries;

    const adapter = this.adapters.get(provider);
    if (!adapter) return [];
    return adapter.getAuditLog(since);
  }

  private detectDrift(
    currentState: InventorySnapshot,
    authorizedChanges: LedgerEntry[],
  ): DriftChange[] {
    const baselineEntry = [...authorizedChanges]
      .reverse()
      .find((entry) => entry.result === "success" && isInventorySnapshot(entry.payload.postInventory));

    if (!baselineEntry || !isInventorySnapshot(baselineEntry.payload.postInventory)) {
      return [{
        resource: "inventory-baseline",
        type: "modified",
        current: hashValue(currentState.resources),
        expected: "signed-ledger-baseline",
      }];
    }

    const expectedInventory = baselineEntry.payload.postInventory;
    const currentHash = hashValue(currentState.resources);
    const expectedHash = hashValue(expectedInventory.resources);

    if (currentHash === expectedHash) return [];

    return [{
      resource: `${currentState.provider}:inventory`,
      type: "modified",
      current: currentHash,
      expected: expectedHash,
    }];
  }

  getAdapter(provider: ProviderName): ProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  private async readSignedLedgerEntries(provider: ProviderName): Promise<LedgerEntry[]> {
    const keys = await this.storageBackend.list(`ledger/${provider}`);
    const entries: LedgerEntry[] = [];

    for (const key of keys) {
      const content = await this.storageBackend.read(key);
      if (!content) continue;

      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const signed = JSON.parse(line) as SignedEntry;
          if (!this.verify(signed)) continue;
          const entryTime = new Date(signed.entry.ts);
          if (Number.isNaN(entryTime.getTime())) continue;
          entries.push(signed.entry);
        } catch {
          continue;
        }
      }
    }

    return entries.sort((a, b) => a.ts.localeCompare(b.ts));
  }
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function isInventorySnapshot(value: unknown): value is InventorySnapshot {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof (value as Partial<InventorySnapshot>).provider === "string"
    && typeof (value as Partial<InventorySnapshot>).timestamp === "string"
    && Boolean((value as Partial<InventorySnapshot>).resources)
    && typeof (value as Partial<InventorySnapshot>).resources === "object";
}
