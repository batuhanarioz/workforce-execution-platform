export type LoginLocale = "en" | "tr";

export type LoginSession = {
  token: string;
  user: unknown;
  deviceId: string;
};

type ResolveApiUrlOptions = {
  envUrl?: string;
  platform: "android" | "ios" | "web" | string;
  scriptUrl?: string | null;
};

export function resolveApiUrl({ envUrl, platform, scriptUrl }: ResolveApiUrlOptions) {
  if (envUrl) {
    return envUrl;
  }

  if (platform === "web") {
    return "http://localhost:3001/api";
  }

  const host = scriptUrl ? scriptUrl.replace(/^https?:\/\//, "").split(":")[0] : "";
  if (platform === "android" && (host === "localhost" || host === "127.0.0.1")) {
    return "http://10.0.2.2:3001/api";
  }
  if (host) {
    return `http://${host}:3001/api`;
  }

  if (platform === "android") {
    return "http://10.0.2.2:3001/api";
  }

  return "http://localhost:3001/api";
}

export function buildWelcomeMessage(locale: LoginLocale, fullName: string) {
  return locale === "en" ? `Welcome, ${fullName}` : `Hoş geldin, ${fullName}`;
}

export async function persistLoginSession(
  saveSession: (session: LoginSession) => Promise<void>,
  session: LoginSession
) {
  try {
    await saveSession(session);
    return true;
  } catch {
    return false;
  }
}

export type SyncResult = {
  status: "SYNCED" | "FAILED" | "CONFLICT" | "DUPLICATE_IGNORED";
  message?: string;
  error?: string;
};

export type SyncSummary = {
  synced: number;
  failed: number;
  conflicted: number;
  duplicateIgnored: number;
  total: number;
  emptyQueue: boolean;
  message: string;
};

export function summarizeSyncResults(locale: LoginLocale, results: SyncResult[]) {
  const summary: SyncSummary = {
    synced: 0,
    failed: 0,
    conflicted: 0,
    duplicateIgnored: 0,
    total: results.length,
    emptyQueue: results.length === 0,
    message: "",
  };

  for (const result of results) {
    if (result.status === "SYNCED") {
      summary.synced += 1;
    } else if (result.status === "FAILED") {
      summary.failed += 1;
    } else if (result.status === "CONFLICT") {
      summary.conflicted += 1;
    } else if (result.status === "DUPLICATE_IGNORED") {
      summary.duplicateIgnored += 1;
    }
  }

  if (summary.emptyQueue) {
    summary.message = locale === "en" ? "Sync queue is empty." : "Senkron kuyruğu boş.";
    return summary;
  }

  const cleared = summary.synced + summary.duplicateIgnored;
  const issues = summary.conflicted + summary.failed;

  if (issues > 0) {
    summary.message =
      locale === "en"
        ? `${cleared} item${cleared === 1 ? "" : "s"} synced. ${issues} item${issues === 1 ? "" : "s"} need attention.`
        : `${cleared} kayıt eşitlendi. ${issues} kayıt işlem bekliyor.`;
    return summary;
  }

  summary.message =
    locale === "en"
      ? `Workspace synced. ${cleared} item${cleared === 1 ? "" : "s"} cleared.`
      : `Çalışma alanı eşitlendi. ${cleared} kayıt temizlendi.`;
  return summary;
}
