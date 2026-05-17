import type {
  AccessValidation,
  ChangeRequest,
  HealthStatus,
  InventorySnapshot,
  LedgerEntry,
  SecurityPolicy,
} from "../core/types.js";

export interface ProviderAdapter {
  readonly name: string;

  getInventory(): Promise<InventorySnapshot>;
  applyPolicy(policy: SecurityPolicy): Promise<ChangeRequest>;
  revertPolicy(version: string): Promise<ChangeRequest>;
  validatePolicy(policy: SecurityPolicy): Promise<{ ok: boolean; errors: string[] }>;
  generateDiff(policy: SecurityPolicy): Promise<string>;

  healthCheck(): Promise<HealthStatus>;
  validateAccess(): Promise<AccessValidation>;

  getAuditLog(since: Date): Promise<LedgerEntry[]>;
  recordChange(entry: LedgerEntry): Promise<void>;
}
