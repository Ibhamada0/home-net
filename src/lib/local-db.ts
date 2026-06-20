// Local IndexedDB store (Dexie) — replaces Supabase for all app data.
// Everything lives 100% in the user's browser.

import Dexie, { type Table } from "dexie";

export type UUID = string;
export const uid = (): UUID =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---------- table types ----------
export interface AppUser {
  id: UUID;
  username: string;          // login
  full_name: string;
  password_hash: string;     // bcrypt
  role: "admin" | "staff";
  created_at: string;
}

export interface Customer {
  id: UUID;
  username: string;
  password: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  service_type: "pppoe" | "hotspot";
  package_id: UUID | null;
  ip_address: string | null;
  status: "active" | "suspended" | "expired";
  expire_at: string | null;
  created_at: string;
}

export interface Package {
  id: UUID;
  name: string;
  speed_down_mbps: number;
  speed_up_mbps: number;
  price: number;
  duration_days: number;
  service_type: "pppoe" | "hotspot";
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Invoice {
  id: UUID;
  invoice_number: string;
  customer_id: UUID;
  package_id: UUID | null;
  amount: number;
  status: "unpaid" | "paid" | "cancelled";
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

export interface TrafficUsage {
  id: UUID;
  customer_id: UUID;
  period_start: string;
  upload_bytes: number;
  download_bytes: number;
  last_synced_at: string;
}

export interface BlockedDomain {
  id: UUID;
  scope: "global" | "package";
  package_id: UUID | null;
  domain: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RouterConfig {
  id: UUID;
  name: string;
  connection_mode: "local" | "cloud";
  host: string;
  port: number;
  cloud_hostname: string | null;
  username: string;
  password: string;
  use_https: boolean;
  is_active: boolean;
  proxy_url: string;          // local proxy URL (e.g. http://localhost:8080)
  created_at: string;
}

export interface ActivityLog {
  id: UUID;
  action: string;
  severity: "info" | "warning" | "error";
  created_at: string;
}

// ---------- Dexie database ----------
class HomeNetDB extends Dexie {
  users!: Table<AppUser, UUID>;
  customers!: Table<Customer, UUID>;
  packages!: Table<Package, UUID>;
  invoices!: Table<Invoice, UUID>;
  traffic_usage!: Table<TrafficUsage, UUID>;
  blocked_domains!: Table<BlockedDomain, UUID>;
  router_config!: Table<RouterConfig, UUID>;
  activity_log!: Table<ActivityLog, UUID>;

  constructor() {
    super("homenet");
    this.version(1).stores({
      users:           "id, username, role",
      customers:       "id, username, service_type, status, package_id, created_at",
      packages:        "id, name, service_type, is_active, price",
      invoices:        "id, invoice_number, customer_id, status, created_at",
      traffic_usage:   "id, customer_id, period_start, [customer_id+period_start]",
      blocked_domains: "id, scope, package_id, is_active, created_at",
      router_config:   "id, is_active",
      activity_log:    "id, created_at, severity",
    });
  }
}

export const db = new HomeNetDB();

// Logging helper used by mutations.
export async function logActivity(action: string, severity: ActivityLog["severity"] = "info") {
  await db.activity_log.add({
    id: uid(),
    action,
    severity,
    created_at: new Date().toISOString(),
  });
}

// Export full DB → JSON (for backup).
export async function exportBackup() {
  const tables = ["users","customers","packages","invoices","traffic_usage","blocked_domains","router_config","activity_log"] as const;
  const out: Record<string, unknown[]> = {};
  for (const t of tables) out[t] = await (db as any)[t].toArray();
  return out;
}

// Import JSON backup (replaces existing data).
export async function importBackup(data: Record<string, unknown[]>) {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = data[t.name];
      if (Array.isArray(rows) && rows.length) await t.bulkAdd(rows as any);
    }
  });
}
