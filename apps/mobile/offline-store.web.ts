const META_LOCALE_KEY = "wfp:locale";
const META_DEVICE_ID_KEY = "wfp:deviceId";
const AUTH_SESSION_KEY = "wfp:authSession";
const WORKSPACE_CACHE_KEY = "wfp:workspaceCache";
const SYNC_QUEUE_KEY = "wfp:syncQueue";

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

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function readJson<T>(key: string): T | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
}

function removeValue(key: string) {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(key);
}

function defaultWorkspaceCache(): WorkspaceCache {
  return {
    masterData: null,
    plans: [],
    crews: [],
    assignments: [],
    dailyFacts: [],
    selectedPlanId: "",
    updatedAt: new Date().toISOString(),
  };
}

function getQueuedRecords(): SyncQueueRecord[] {
  return readJson<SyncQueueRecord[]>(SYNC_QUEUE_KEY) ?? [];
}

function saveQueuedRecords(records: SyncQueueRecord[]) {
  writeJson(SYNC_QUEUE_KEY, records);
}

export async function loadStoredLocale(): Promise<"en" | "tr" | null> {
  const value = getStorage()?.getItem(META_LOCALE_KEY);
  return value === "en" || value === "tr" ? value : null;
}

export async function saveStoredLocale(locale: "en" | "tr") {
  writeJson(META_LOCALE_KEY, locale);
}

export async function loadStoredDeviceId() {
  const storage = getStorage();
  if (!storage) {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const existing = storage.getItem(META_DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = `device-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
  storage.setItem(META_DEVICE_ID_KEY, generated);
  return generated;
}

export async function loadSession(): Promise<StoredSession | null> {
  return readJson<StoredSession>(AUTH_SESSION_KEY);
}

export async function saveSession(session: { token: string; user: unknown; deviceId: string }) {
  writeJson(AUTH_SESSION_KEY, {
    token: session.token,
    user: session.user,
    deviceId: session.deviceId,
    updatedAt: new Date().toISOString(),
  } satisfies StoredSession);
  writeJson(META_DEVICE_ID_KEY, session.deviceId);
}

export async function clearSession() {
  removeValue(AUTH_SESSION_KEY);
}

export async function loadWorkspaceCache<T extends WorkspaceCache>(): Promise<T> {
  return (readJson<T>(WORKSPACE_CACHE_KEY) ?? defaultWorkspaceCache()) as T;
}

export async function saveWorkspaceCache(cache: WorkspaceCache) {
  writeJson(WORKSPACE_CACHE_KEY, cache);
}

export async function clearWorkspaceCache() {
  removeValue(WORKSPACE_CACHE_KEY);
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
  const records = getQueuedRecords();
  const nextRecord: SyncQueueRecord = {
    ...record,
    status: "PENDING_SYNC",
    retryCount: 0,
  };
  const existingIndex = records.findIndex((item) => item.localId === record.localId);
  if (existingIndex >= 0) {
    records[existingIndex] = nextRecord;
  } else {
    records.push(nextRecord);
  }
  saveQueuedRecords(records);
}

export async function listQueuedSyncRecords() {
  return getQueuedRecords().filter((record) =>
    ["PENDING_SYNC", "FAILED", "CONFLICT"].includes(record.status)
  );
}

export async function markQueuedRecordStatus(
  localId: string,
  patch: Partial<
    Pick<
      SyncQueueRecord,
      "status" | "retryCount" | "errorMessage" | "serverId" | "serverVersion" | "lastAttemptAt" | "syncedAt"
    >
  >
) {
  const records = getQueuedRecords();
  const index = records.findIndex((record) => record.localId === localId);
  if (index < 0) return;

  records[index] = {
    ...records[index],
    ...patch,
    retryCount: patch.retryCount ?? records[index].retryCount,
  };
  saveQueuedRecords(records);
}

export async function removeQueuedRecord(localId: string) {
  saveQueuedRecords(getQueuedRecords().filter((record) => record.localId !== localId));
}

export async function clearQueuedRecords() {
  removeValue(SYNC_QUEUE_KEY);
}

export async function pendingSyncCount() {
  return (await listQueuedSyncRecords()).length;
}
