const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export type StoredUser = {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
  locations?: Array<{ id?: string; code?: string; name?: string }>;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getUiLocale() {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem("wfp_locale");
  if (stored === "tr" || stored === "en") {
    return stored;
  }

  return document.documentElement.lang === "tr" ? "tr" : "en";
}

function friendlyMessage(status: number, fallback: string) {
  const locale = getUiLocale();

  if (status === 401) return locale === "en" ? "Your session ended. Please sign in again." : "Oturumun sona erdi. Lütfen tekrar giriş yap.";
  if (status === 403) return locale === "en" ? "You do not have permission to open this screen." : "Bu ekranı açma yetkin yok.";
  if (status === 404) return locale === "en" ? "This section is not available right now." : "Bu bölüm şu anda kullanılamıyor.";
  if (status >= 500) return locale === "en" ? "The server is temporarily unavailable. Please try again." : "Sunucu şu anda yanıt vermiyor. Lütfen tekrar dene.";
  return fallback;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: string };
      return parsed.message ?? parsed.error ?? raw;
    } catch {
      return raw;
    }
  }

  return raw;
}

export function getApiUrl() {
  return DEFAULT_API_URL;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawUser = window.localStorage.getItem("wfp_user");
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as StoredUser;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-client-platform", "web");

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("wfp_access_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const user = getStoredUser();
    if (user) {
      if (user.id) headers.set("x-user-id", user.id);
      if (user.fullName) headers.set("x-user-name", user.fullName);
      if (user.email) headers.set("x-user-email", user.email);
      if (user.role) headers.set("x-user-role", user.role);
      const primaryLocation = user.locations?.[0];
      if (primaryLocation?.id) headers.set("x-user-location-id", primaryLocation.id);
      if (primaryLocation?.code) headers.set("x-user-location-code", primaryLocation.code);
      if (primaryLocation?.name) headers.set("x-user-location-name", primaryLocation.name);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${DEFAULT_API_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      const locale = getUiLocale();
      throw new ApiError(
        locale === "en"
          ? "Cannot reach the server right now. Please try again."
          : "Sunucuya şu anda ulaşılamıyor. Lütfen tekrar dene.",
        0
      );
    }

    throw error;
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(friendlyMessage(response.status, message || `Request failed with status ${response.status}`), response.status);
  }

  return (await response.json()) as T;
}
