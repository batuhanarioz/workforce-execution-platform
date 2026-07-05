import * as SecureStore from "expo-secure-store";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

const DB_NAME = "wfp-mobile.sqlite";
const META_LOCALE_KEY = "locale";
const META_DEVICE_ID_KEY = "deviceId";
const AUTH_SESSION_KEY = "authSession";

type StoredSession = {
  token: string;
  user: unknown;
  deviceId: string;
  updatedAt: string;
};

export type WorkspaceCache = {
  masterData: unknown | null;
  plans: unknown[];
  crews: unknown[];
  assignments: unknown[];
  dailyFacts: unknown[];
  selectedPlanId: string;
  updatedAt: string;
  lastSyncedAt?: string;
};

export type SyncQueueRecord = {
  localId: string;
  idempotencyKey: string;
  entityType: string;
  operation: string;
  baseVersion?: number;
  payload: unknown;
  status: "PENDING_SYNC" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";
  retryCount: number;
  errorMessage?: string;
  serverId?: string;
  serverVersion?: number;
  createdAt: string;
  lastAttemptAt?: string;
  syncedAt?: string;
};

let databasePromise: Promise<SQLiteDatabase> | null = null;
let initialized = false;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DB_NAME);
  }

  const database = await databasePromise;
  if (!initialized) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        token TEXT NOT NULL,
        user_json TEXT NOT NULL,
        device_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_cache (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        local_id TEXT PRIMARY KEY NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        base_version INTEGER,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        server_id TEXT,
        server_version INTEGER,
        created_at TEXT NOT NULL,
        last_attempt_at TEXT,
        synced_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created_at
      ON sync_queue(status, created_at);
    `);
    initialized = true;
  }

  return database;
}

async function getMetaValue(key: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

async function setMetaValue(key: string, value: string) {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

async function deleteMetaValue(key: string) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM app_meta WHERE key = ?", [key]);
}

async function canUseSecureStore() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function writeSecret(key: string, value: string) {
  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  await setMetaValue(`secret:${key}`, value);
}

async function readSecret(key: string) {
  if (await canUseSecureStore()) {
    return SecureStore.getItemAsync(key);
  }

  return getMetaValue(`secret:${key}`);
}

async function deleteSecret(key: string) {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  await deleteMetaValue(`secret:${key}`);
}

export async function loadStoredLocale(): Promise<"en" | "tr" | null> {
  const value = await getMetaValue(META_LOCALE_KEY);
  return value === "en" || value === "tr" ? value : null;
}

export async function saveStoredLocale(locale: "en" | "tr") {
  await setMetaValue(META_LOCALE_KEY, locale);
}

export async function loadStoredDeviceId() {
  const database = await getDatabase();
  const session = await database.getFirstAsync<{ device_id: string }>(
    "SELECT device_id FROM auth_session WHERE id = 1"
  );
  if (session?.device_id) {
    return session.device_id;
  }

  const cached = await getMetaValue(META_DEVICE_ID_KEY);
  if (cached) {
    return cached;
  }

  const generated = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setMetaValue(META_DEVICE_ID_KEY, generated);
  return generated;
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await readSecret(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: { token: string; user: unknown; deviceId: string }) {
  await writeSecret(
    AUTH_SESSION_KEY,
    JSON.stringify({
      token: session.token,
      user: session.user,
      deviceId: session.deviceId,
      updatedAt: new Date().toISOString(),
    } satisfies StoredSession)
  );
  await setMetaValue(META_DEVICE_ID_KEY, session.deviceId);
}

export async function clearSession() {
  await deleteSecret(AUTH_SESSION_KEY);
}

export async function loadWorkspaceCache<T extends WorkspaceCache>(): Promise<T> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ json: string }>(
    "SELECT json FROM workspace_cache WHERE id = 1"
  );

  if (!row?.json) {
    return {
      masterData: null,
      plans: [],
      crews: [],
      assignments: [],
      dailyFacts: [],
      selectedPlanId: "",
      updatedAt: new Date().toISOString(),
    } as unknown as T;
  }

  try {
    return JSON.parse(row.json) as T;
  } catch {
    return {
      masterData: null,
      plans: [],
      crews: [],
      assignments: [],
      dailyFacts: [],
      selectedPlanId: "",
      updatedAt: new Date().toISOString(),
    } as unknown as T;
  }
}

export async function saveWorkspaceCache(cache: WorkspaceCache) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO workspace_cache (id, json, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       json = excluded.json,
       updated_at = excluded.updated_at`,
    [JSON.stringify(cache), cache.updatedAt]
  );
}

export async function clearWorkspaceCache() {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM workspace_cache WHERE id = 1");
}

export async function updateWorkspaceCache(
  updater: (cache: WorkspaceCache) => WorkspaceCache | Promise<WorkspaceCache>
) {
  const current = await loadWorkspaceCache();
  const next = await updater(current);
  await saveWorkspaceCache(next);
  return next;
}

export async function enqueueSyncRecord(record: Omit<SyncQueueRecord, "status" | "retryCount">) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO sync_queue (
      local_id,
      idempotency_key,
      entity_type,
      operation,
      base_version,
      payload_json,
      status,
      retry_count,
      error_message,
      server_id,
      server_version,
      created_at,
      last_attempt_at,
      synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING_SYNC', 0, NULL, NULL, NULL, ?, NULL, NULL)
    ON CONFLICT(local_id) DO UPDATE SET
      idempotency_key = excluded.idempotency_key,
      entity_type = excluded.entity_type,
      operation = excluded.operation,
      base_version = excluded.base_version,
      payload_json = excluded.payload_json,
      status = 'PENDING_SYNC',
      retry_count = 0,
      error_message = NULL,
      server_id = NULL,
      server_version = NULL,
      created_at = excluded.created_at,
      last_attempt_at = NULL,
      synced_at = NULL`,
    [
      record.localId,
      record.idempotencyKey,
      record.entityType,
      record.operation,
      record.baseVersion ?? null,
      JSON.stringify(record.payload),
      record.createdAt,
    ]
  );
}

export async function listQueuedSyncRecords() {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    local_id: string;
    idempotency_key: string;
    entity_type: string;
    operation: string;
    base_version: number | null;
    payload_json: string;
    status: SyncQueueRecord["status"];
    retry_count: number;
    error_message: string | null;
    server_id: string | null;
    server_version: number | null;
    created_at: string;
    last_attempt_at: string | null;
    synced_at: string | null;
  }>("SELECT * FROM sync_queue WHERE status IN ('PENDING_SYNC', 'FAILED', 'CONFLICT') ORDER BY created_at ASC");

  return rows.map((row) => ({
    localId: row.local_id,
    idempotencyKey: row.idempotency_key,
    entityType: row.entity_type,
    operation: row.operation,
    baseVersion: row.base_version ?? undefined,
    payload: JSON.parse(row.payload_json) as unknown,
    status: row.status,
    retryCount: row.retry_count,
    errorMessage: row.error_message ?? undefined,
    serverId: row.server_id ?? undefined,
    serverVersion: row.server_version ?? undefined,
    createdAt: row.created_at,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    syncedAt: row.synced_at ?? undefined,
  })) as SyncQueueRecord[];
}

export async function markQueuedRecordStatus(
  localId: string,
  patch: Partial<Pick<SyncQueueRecord, "status" | "retryCount" | "errorMessage" | "serverId" | "serverVersion" | "lastAttemptAt" | "syncedAt">>
) {
  const database = await getDatabase();
  const current = await database.getFirstAsync<{ retry_count: number }>(
    "SELECT retry_count FROM sync_queue WHERE local_id = ?",
    [localId]
  );
  if (!current) {
    return;
  }

  await database.runAsync(
    `UPDATE sync_queue
     SET status = COALESCE(?, status),
         retry_count = COALESCE(?, retry_count),
         error_message = ?,
         server_id = ?,
         server_version = ?,
         last_attempt_at = COALESCE(?, last_attempt_at),
         synced_at = COALESCE(?, synced_at)
     WHERE local_id = ?`,
    [
      patch.status ?? null,
      patch.retryCount ?? null,
      patch.errorMessage ?? null,
      patch.serverId ?? null,
      patch.serverVersion ?? null,
      patch.lastAttemptAt ?? null,
      patch.syncedAt ?? null,
      localId,
    ]
  );
}

export async function removeQueuedRecord(localId: string) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM sync_queue WHERE local_id = ?", [localId]);
}

export async function clearQueuedRecords() {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM sync_queue");
}

export async function pendingSyncCount() {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sync_queue WHERE status IN ('PENDING_SYNC', 'FAILED', 'CONFLICT')"
  );
  return row?.count ?? 0;
}
