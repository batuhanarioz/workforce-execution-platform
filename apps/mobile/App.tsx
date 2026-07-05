import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Platform,
  View,
} from "react-native";
import {
  clearQueuedRecords,
  clearSession,
  clearWorkspaceCache,
  enqueueSyncRecord,
  listQueuedSyncRecords,
  loadSession,
  loadStoredDeviceId,
  loadStoredLocale,
  loadWorkspaceCache,
  markQueuedRecordStatus,
  pendingSyncCount,
  removeQueuedRecord,
  saveSession,
  saveStoredLocale,
  saveWorkspaceCache,
} from "./offline-store";
import {
  buildWelcomeMessage,
  persistLoginSession,
  resolveApiUrl,
  summarizeSyncResults,
} from "./lib/app-helpers";
import { getMobileRoleCapabilities, getMobileRoleOverviewKey, getMobileWorkspaceVisibility } from "./lib/role-flows";

const API_URL = resolveApiUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  scriptUrl: NativeModules?.SourceCode?.scriptURL ?? "",
});

let activeRequestLocale: "en" | "tr" = "en";

function setActiveRequestLocale(locale: "en" | "tr") {
  activeRequestLocale = locale;
}

type MobileUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  locations: Array<{ id: string; code: string; name: string }>;
};

type MasterData = {
  locations: Array<{ id: string; code: string; name: string }>;
  workerTypes: Array<{ id: string; name: string }>;
  zzzDetails: Array<{ id: string; code: string; name: string }>;
};

type DailyPlan = {
  id: string;
  planDate: string;
  locationId: string;
  projectId: string;
  unit: string;
  plannedQuantity: number;
  plannedManDay: number;
  status: string;
  version?: number;
};

type DailyFact = {
  id: string;
  dailyPlanId: string;
  factQuantity: number;
  factManDay: number;
  overtime: number;
  actualStatus: string;
  comment?: string;
  zzzDetailId?: string;
  status: string;
};

type Crew = {
  id: string;
  name: string;
  locationId: string;
  headOfMasterId: string;
  workerTypeId: string;
  isActive: boolean;
  createdAt: string;
};

type WorkerAssignment = {
  id: string;
  dailyPlanId: string;
  crewId: string;
  workerTypeId: string;
  workerCount: number;
  assignedByUserId: string;
  createdAt: string;
};

type WorkspaceSnapshot = {
  masterData: MasterData | null;
  plans: DailyPlan[];
  crews: Crew[];
  assignments: WorkerAssignment[];
  dailyFacts: DailyFact[];
  selectedPlanId: string;
  updatedAt: string;
  lastSyncedAt?: string;
};

type SyncResult = {
  localId: string;
  status: "SYNCED" | "FAILED" | "CONFLICT" | "DUPLICATE_IGNORED";
  serverId?: string;
  error?: string;
  message?: string;
  serverVersion?: number;
};

function SingleLineText({
  children,
  style,
}: {
  children: string;
  style?: object;
}) {
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      adjustsFontSizeToFit
      minimumFontScale={0.78}
      style={style}
    >
      {children}
    </Text>
  );
}

function isAccessDeniedMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("no access") ||
    normalized.includes("do not have access") ||
    normalized.includes("not have access") ||
    normalized.includes("yetkin yok") ||
    normalized.includes("erişim") ||
    normalized.includes("access denied")
  );
}

async function apiFetch<T>(
  path: string,
  auth?: { token?: string; user?: MobileUser | null },
  init?: RequestInit
) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-client-platform", "mobile");
  if (auth?.token) {
    headers.set("Authorization", `Bearer ${auth.token}`);
  }
  if (auth?.user) {
    headers.set("x-user-id", auth.user.id);
    headers.set("x-user-name", auth.user.fullName);
    headers.set("x-user-email", auth.user.email);
    headers.set("x-user-role", auth.user.role);
    const primaryLocation = auth.user.locations?.[0];
    if (primaryLocation) {
      headers.set("x-user-location-id", primaryLocation.id);
      headers.set("x-user-location-code", primaryLocation.code);
      headers.set("x-user-location-name", primaryLocation.name);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (networkError) {
    const offlineMessage = activeRequestLocale === "en"
      ? "Cannot reach the server right now. Please try again."
      : "Sunucuya şu anda ulaşılamıyor. Lütfen tekrar dene.";
    throw new Error(offlineMessage);
  }

  if (!response.ok) {
    let message = activeRequestLocale === "en" ? "Something went wrong. Please try again." : "Bir sorun oluştu. Lütfen tekrar dene.";
    if (response.status === 401) {
      message = activeRequestLocale === "en" ? "Session ended. Please sign in again." : "Oturum sona erdi. Lütfen tekrar giriş yap.";
    } else if (response.status === 403) {
      message = activeRequestLocale === "en" ? "You do not have access to this action." : "Bu işlem için yetkin yok.";
    } else if (response.status === 404) {
      message = activeRequestLocale === "en" ? "This data is not available right now." : "Bu veri şu anda kullanılamıyor.";
    }

    try {
      const raw = await response.text();
      if (raw) {
        const parsed = JSON.parse(raw) as { message?: string; error?: string };
        const apiMessage = parsed.message ?? parsed.error;
        if (apiMessage && response.status >= 500) {
          message = apiMessage;
        }
      }
    } catch {
      // Keep the friendly fallback.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

const demoAccountsByLocale = {
  en: [
    { label: "Head of Master", email: "hom@icn.com" },
    { label: "Technical Office", email: "techoffice@icn.com" },
    { label: "Site Chief", email: "sitechief@icn.com" },
    { label: "Project Manager", email: "pm@icn.com" },
    { label: "Admin", email: "admin@icn.com" },
  ],
  tr: [
    { label: "Usta başı", email: "hom@icn.com" },
    { label: "Teknik Ofis", email: "techoffice@icn.com" },
    { label: "Şantiye Şefi", email: "sitechief@icn.com" },
    { label: "Proje Yöneticisi", email: "pm@icn.com" },
    { label: "Yönetici", email: "admin@icn.com" },
  ],
} as const;

const copy = {
  en: {
    eyebrow: "Mobile execution",
    title: "Select a plan, then report the day in one clean form.",
    lanesTitle: "Work lanes",
    planningLane: "Planning",
    executionLane: "Execution",
    approvalLane: "Approvals",
    planningLaneHelp: "Plans and assignments.",
    executionLaneHelp: "Fact entry and sync.",
    approvalLaneHelp: "Review and decide.",
    signIn: "Sign in",
    currentUser: "Current user",
    roleHub: "Role lane",
    planPicker: "Pick a plan",
    factForm: "Daily fact form",
    actualStatus: "Actual status",
    factQuantity: "Fact quantity",
    factManDay: "Fact man-day",
    overtime: "Overtime",
    zzzDetail: "ZZZ detail",
    comment: "Comment",
    saveDraft: "Save draft",
    submit: "Submit",
    working: "Working...",
    ready: "Ready",
    signingIn: "Signing in...",
    openWorkspace: "Sign in",
    stepCurrentUser: "1. Current user",
    stepPlanPicker: "2. Pick a plan",
    stepFactForm: "3. Fill and submit",
    planStatus: "Status",
    location: "Location",
    project: "Project",
    noPlanSelected: "No plan selected yet",
    noData: "Loading master data...",
    noFactLoaded: "No fact loaded",
    none: "None",
    noDetail: "No detail",
    crewBuilder: "Crew workspace",
    workerAssignment: "Assignment workspace",
    crewName: "Crew name",
    crewLocation: "Location",
    crewWorkerType: "Worker type",
    selectPlan: "Select a plan",
    selectCrew: "Select a crew",
    workerCount: "Worker count",
    createCrew: "Create crew",
    assignWorkers: "Assign workers",
    logout: "Switch account",
    headMasterOverview: "Head of Master",
    techOfficeOverview: "Technical Office",
    siteChiefOverview: "Site Chief",
    projectManagerOverview: "Project Manager",
    adminOverview: "Admin",
    statusLabels: {
      DRAFT: "Draft",
      SUBMITTED: "Submitted",
      APPROVED_BY_HEAD_OF_MASTER: "Approved by Head of Master",
      APPROVED_BY_SITE_CHIEF: "Approved by Site Chief",
      APPROVED_BY_PROJECT_MANAGER: "Approved by PM",
      RETURNED_FOR_REVISION: "Returned",
      REJECTED: "Rejected",
    },
  },
  tr: {
    eyebrow: "Mobil yürütme",
    title: "Önce planı seç, sonra günü tek ve sade bir formda bildir.",
    lanesTitle: "Çalışma hatları",
    planningLane: "Planlama",
    executionLane: "Yürütme",
    approvalLane: "Onaylar",
    planningLaneHelp: "Plan ve atama.",
    executionLaneHelp: "Fiş ve senkron.",
    approvalLaneHelp: "İncele ve karar ver.",
    signIn: "Giriş yap",
    currentUser: "Geçerli kullanıcı",
    roleHub: "Rol alanı",
    planPicker: "Plan seç",
    factForm: "Günlük fiş formu",
    actualStatus: "Gerçek durum",
    factQuantity: "Fiş miktarı",
    factManDay: "Fiş adam-gün",
    overtime: "Fazla mesai",
    zzzDetail: "ZZZ detayı",
    comment: "Yorum",
    saveDraft: "Taslak kaydet",
    submit: "Gönder",
    working: "İşleniyor...",
    ready: "Hazır",
    signingIn: "Giriş yapılıyor...",
    openWorkspace: "Giriş yap",
    stepCurrentUser: "1. Geçerli kullanıcı",
    stepPlanPicker: "2. Planı seç",
    stepFactForm: "3. Doldur ve gönder",
    planStatus: "Durum",
    location: "Lokasyon",
    project: "Proje",
    noPlanSelected: "Henüz plan seçilmedi",
    noData: "Master data yükleniyor...",
    noFactLoaded: "Fiş yüklenmedi",
    none: "Yok",
    noDetail: "Detay yok",
    crewBuilder: "Crew alanı",
    workerAssignment: "Atama alanı",
    crewName: "Crew adı",
    crewLocation: "Lokasyon",
    crewWorkerType: "Worker type",
    selectPlan: "Plan seç",
    selectCrew: "Crew seç",
    workerCount: "Worker count",
    createCrew: "Crew oluştur",
    assignWorkers: "Worker ata",
    logout: "Hesap değiştir",
    headMasterOverview: "Usta başı",
    techOfficeOverview: "Teknik Ofis",
    siteChiefOverview: "Şantiye Şefi",
    projectManagerOverview: "Proje Yöneticisi",
    adminOverview: "Yönetici",
    statusLabels: {
      DRAFT: "Taslak",
      SUBMITTED: "Gönderildi",
      APPROVED_BY_HEAD_OF_MASTER: "Usta başı onayladı",
      APPROVED_BY_SITE_CHIEF: "Site Chief onayladı",
      APPROVED_BY_PROJECT_MANAGER: "PM onayladı",
      RETURNED_FOR_REVISION: "Geri gönderildi",
      REJECTED: "Reddedildi",
    },
  },
} as const;

export default function App() {
  const [locale, setLocale] = useState<"en" | "tr">("en");
  const demoAccounts = demoAccountsByLocale[locale];
  const [email, setEmail] = useState<string>(demoAccountsByLocale.en[0].email);
  const [password, setPassword] = useState("seeded-password");
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<MobileUser | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([]);
  const [dailyFacts, setDailyFacts] = useState<DailyFact[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [fact, setFact] = useState<DailyFact | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [crewName, setCrewName] = useState("");
  const [crewLocationId, setCrewLocationId] = useState("");
  const [crewWorkerTypeId, setCrewWorkerTypeId] = useState("");
  const [assignmentPlanId, setAssignmentPlanId] = useState("");
  const [assignmentCrewId, setAssignmentCrewId] = useState("");
  const [assignmentWorkerTypeId, setAssignmentWorkerTypeId] = useState("");
  const [assignmentWorkerCount, setAssignmentWorkerCount] = useState("1");
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((item) => item.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );
  const visiblePlans = useMemo(() => {
    if (!user?.locations?.length) {
      return plans;
    }

    const locationIds = new Set(user.locations.map((location) => location.id));
    const scopedPlans = plans.filter((plan) => locationIds.has(plan.locationId));
    return scopedPlans.length > 0 ? scopedPlans : plans;
  }, [plans, user]);
  const strings = copy[locale];
  const currentRole = user?.role ?? "";
  const roleCapabilities = getMobileRoleCapabilities(currentRole);
  const roleVisibility = getMobileWorkspaceVisibility(currentRole);
  const isHeadOfMaster = roleCapabilities.isHeadOfMaster;
  const isTechOffice = roleCapabilities.isTechOffice;
  const isSiteChief = roleCapabilities.isSiteChief;
  const isProjectManager = roleCapabilities.isProjectManager;
  const isAdmin = roleCapabilities.isAdmin;
  const actualStatusOptions =
    locale === "en"
      ? [
        { value: "COMPLETED", label: "Completed" },
        { value: "PARTIALLY_COMPLETED", label: "Partial" },
        { value: "NOT_STARTED", label: "Not started" },
      ]
      : [
        { value: "COMPLETED", label: "Tamamlandı" },
        { value: "PARTIALLY_COMPLETED", label: "Kısmi" },
        { value: "NOT_STARTED", label: "Başlamadı" },
      ];

  async function refreshPendingCount() {
    setPendingCount(await pendingSyncCount());
  }

  async function persistSnapshot(next: Partial<WorkspaceSnapshot>) {
    const current = await loadWorkspaceCache<WorkspaceSnapshot>();
    const snapshot: WorkspaceSnapshot = {
      masterData: next.masterData ?? current.masterData,
      plans: next.plans ?? current.plans,
      crews: next.crews ?? current.crews,
      assignments: next.assignments ?? current.assignments,
      dailyFacts: next.dailyFacts ?? current.dailyFacts,
      selectedPlanId: next.selectedPlanId ?? current.selectedPlanId ?? "",
      updatedAt: new Date().toISOString(),
      lastSyncedAt: next.lastSyncedAt ?? current.lastSyncedAt,
    };
    await saveWorkspaceCache(snapshot);
    await refreshPendingCount();
    return snapshot;
  }

  async function applySnapshot(snapshot: WorkspaceSnapshot) {
    setMasterData(snapshot.masterData);
    setPlans(snapshot.plans);
    setCrews(snapshot.crews);
    setAssignments(snapshot.assignments);
    setDailyFacts(snapshot.dailyFacts);
    setSelectedPlanId(snapshot.selectedPlanId);
    setLastSyncedAt(snapshot.lastSyncedAt ?? "");
    setFact(snapshot.dailyFacts.find((item) => item.dailyPlanId === snapshot.selectedPlanId) ?? null);
  }

  async function refreshFactFromCache(planId: string) {
    const cached = await loadWorkspaceCache<WorkspaceSnapshot>();
    const cachedFact = cached.dailyFacts.find((item) => item.dailyPlanId === planId) ?? null;
    setFact(cachedFact);
  }

  async function syncQueuedRecords() {
    if (!token || !user || !deviceId) {
      return summarizeSyncResults(locale, []);
    }

    const queued = await listQueuedSyncRecords();
    if (!queued.length) {
      await refreshPendingCount();
      return summarizeSyncResults(locale, []);
    }

    try {
      const response = await apiFetch<{
        success: boolean;
        data: { results: SyncResult[] };
      }>(
        "/sync/push",
        { token, user },
        {
          method: "POST",
          body: JSON.stringify({
            deviceId,
            records: queued.map((record) => ({
              localId: record.localId,
              idempotencyKey: record.idempotencyKey,
              entityType: record.entityType,
              operation: record.operation,
              baseVersion: record.baseVersion,
              payload: record.payload,
              createdAt: record.createdAt,
            })),
          }),
        }
      );

      const resultMap = new Map(response.data.results.map((result) => [result.localId, result]));
      for (const record of queued) {
        const result = resultMap.get(record.localId);
        if (!result) continue;
        if (result.status === "SYNCED" || result.status === "DUPLICATE_IGNORED") {
          await removeQueuedRecord(record.localId);
          continue;
        }
        await markQueuedRecordStatus(record.localId, {
          status: result.status,
          errorMessage: result.message ?? result.error,
          serverId: result.serverId,
          serverVersion: result.serverVersion,
          retryCount: record.retryCount + 1,
          lastAttemptAt: new Date().toISOString(),
        });
      }

      await refreshPendingCount();
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      await persistSnapshot({ lastSyncedAt: syncedAt });
      return summarizeSyncResults(
        locale,
        response.data.results.map((result) => ({ status: result.status }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      for (const record of queued) {
        await markQueuedRecordStatus(record.localId, {
          status: "FAILED",
          errorMessage: message,
          retryCount: record.retryCount + 1,
          lastAttemptAt: new Date().toISOString(),
        });
      }
      await refreshPendingCount();
      return summarizeSyncResults(
        locale,
        queued.map(() => ({ status: "FAILED", error: message }))
      );
    }
  }

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const [storedLocale, session, snapshot, maybeDeviceId] = await Promise.all([
        loadStoredLocale(),
        loadSession(),
        loadWorkspaceCache<WorkspaceSnapshot>(),
        loadStoredDeviceId(),
      ]);

      if (!mounted) {
        return;
      }

      if (storedLocale) {
        setLocale(storedLocale);
      }

      setDeviceId(maybeDeviceId);
      setPendingCount(await pendingSyncCount());
      await applySnapshot(snapshot);

      if (session) {
        const restoredUser = session.user as MobileUser;
        setToken(session.token);
        setUser(restoredUser);
        setMessage(buildWelcomeMessage(storedLocale ?? locale, restoredUser.fullName));
      }

      setOfflineReady(true);
    }

    restore();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    saveStoredLocale(locale);
  }, [locale]);

  useEffect(() => {
    setActiveRequestLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const requests: Array<Promise<unknown>> = [
          apiFetch<{ success: boolean; data: MasterData }>("/master-data", { token, user }),
          apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans", { token, user }),
        ];
        if (isHeadOfMaster || isAdmin) {
          requests.push(apiFetch<{ success: boolean; data: Crew[] }>("/crews", { token, user }));
          requests.push(apiFetch<{ success: boolean; data: WorkerAssignment[] }>("/worker-assignments", { token, user }));
        }

        const results = await Promise.all(requests);
        const masterResponse = results[0] as { success: boolean; data: MasterData };
        const plansResponse = results[1] as { success: boolean; data: DailyPlan[] };
        const nextCrews = isHeadOfMaster || isAdmin ? (results[2] as { success: boolean; data: Crew[] }).data : crews;
        const nextAssignments = isHeadOfMaster || isAdmin ? (results[3] as { success: boolean; data: WorkerAssignment[] }).data : assignments;

        if (cancelled) return;

        setMasterData(masterResponse.data);
        setPlans(plansResponse.data);
        if (!selectedPlanId && plansResponse.data[0]) {
          setSelectedPlanId(plansResponse.data[0].id);
        }
        if (isHeadOfMaster || isAdmin) {
          setCrews(nextCrews);
          setAssignments(nextAssignments);
          setCrewLocationId((current) => current || masterResponse.data.locations[0]?.id || "");
          setCrewWorkerTypeId((current) => current || masterResponse.data.workerTypes[0]?.id || "");
          setAssignmentWorkerTypeId((current) => current || masterResponse.data.workerTypes[0]?.id || "");
          setAssignmentPlanId((current) => current || plansResponse.data[0]?.id || "");
          setAssignmentCrewId((current) => current || nextCrews[0]?.id || "");
        }

        const snapshot = await persistSnapshot({
          masterData: masterResponse.data,
          plans: plansResponse.data,
          crews: nextCrews,
          assignments: nextAssignments,
          selectedPlanId: selectedPlanId || plansResponse.data[0]?.id || "",
          lastSyncedAt: new Date().toISOString(),
        });
        setLastSyncedAt(snapshot.lastSyncedAt ?? snapshot.updatedAt);
        const syncSummary = await syncQueuedRecords();
        if (syncSummary.total > 0) {
          setMessage(syncSummary.message);
        }
      } catch (err) {
        if (cancelled) return;
        const cache = await loadWorkspaceCache<WorkspaceSnapshot>();
        await applySnapshot(cache);
        handleError(err, "Failed to load workspace");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, user, isHeadOfMaster, isAdmin]);

  useEffect(() => {
    if (!visiblePlans.length) {
      return;
    }

    if (!selectedPlanId || !visiblePlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(visiblePlans[0].id);
    }
  }, [selectedPlanId, visiblePlans]);

  useEffect(() => {
    if (!selectedPlanId) {
      setFact(null);
      return;
    }

    const cachedFact = dailyFacts.find((item) => item.dailyPlanId === selectedPlanId);
    if (cachedFact) {
      setFact(cachedFact);
      return;
    }

    if (!token || !user || !(isHeadOfMaster || isAdmin)) {
      setFact(null);
      return;
    }

    const activeUser = user;

    let cancelled = false;

    async function loadFact() {
      try {
        const response = await apiFetch<{ success: boolean; data: DailyFact | null }>(
          `/daily-facts/plan/${selectedPlanId}`,
          { token, user }
        );
        if (cancelled) return;
        const fallback =
          response.data ?? {
            id: "",
            dailyPlanId: selectedPlanId,
            factQuantity: 0,
            factManDay: 0,
            overtime: 0,
            actualStatus: "COMPLETED",
            comment: "",
            zzzDetailId: "",
            status: "DRAFT",
            submittedByUserId: activeUser.id,
          };
        setFact(fallback);
        const nextDailyFacts = [fallback, ...dailyFacts.filter((item) => item.dailyPlanId !== selectedPlanId)];
        setDailyFacts(nextDailyFacts);
        await persistSnapshot({ dailyFacts: nextDailyFacts });
      } catch {
        if (!cancelled) {
          setFact(cachedFact ?? null);
        }
      }
    }

    loadFact();

    return () => {
      cancelled = true;
    };
  }, [token, user, selectedPlanId, dailyFacts, isHeadOfMaster, isAdmin]);

  async function login() {
    try {
      setLoading(true);
      setError("");
      setMessage(strings.signingIn);
      const normalizedEmail = email.trim();
      const response = await apiFetch<{
        success: boolean;
        data: { accessToken: string; user: MobileUser };
      }>("/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const resolvedDeviceId = deviceId || `device-${response.data.user.id ?? "mobile"}`;
      setDeviceId(resolvedDeviceId);
      setToken(response.data.accessToken);
      setUser(response.data.user);
      setMessage(buildWelcomeMessage(locale, response.data.user.fullName));
      await persistLoginSession(saveSession, {
        token: response.data.accessToken,
        user: response.data.user,
        deviceId: resolvedDeviceId,
      });
      setMessage(buildWelcomeMessage(locale, response.data.user.fullName));
    } catch (err) {
      setMessage("");
      handleError(
        err,
        locale === "en"
          ? "Login failed. Check your email and password."
          : "Giriş başarısız. E-posta ve şifreni kontrol et."
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await clearSession();
    await clearWorkspaceCache();
    await clearQueuedRecords();
    setToken("");
    setUser(null);
    setFact(null);
    setDailyFacts([]);
    setCrews([]);
    setAssignments([]);
    setPlans([]);
    setMasterData(null);
    setMessage(strings.ready);
    setError("");
    setSelectedPlanId("");
    setCrewName("");
    setCrewLocationId("");
    setCrewWorkerTypeId("");
    setAssignmentPlanId("");
    setAssignmentCrewId("");
    setAssignmentWorkerTypeId("");
    setAssignmentWorkerCount("1");
    setPendingCount(0);
    setMessage("");
  }

  async function refreshPlans() {
    if (!token || !user) return;
    try {
      const response = await apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans", { token, user });
      setPlans(response.data);
      await persistSnapshot({ plans: response.data, selectedPlanId: response.data[0]?.id ?? selectedPlanId });
    } catch {
      const cache = await loadWorkspaceCache<WorkspaceSnapshot>();
      setPlans(cache.plans);
    }
  }

  async function refreshCrewWorkspace() {
    if (!token || !user || !(isHeadOfMaster || isAdmin)) return;
    try {
      const [crewResponse, assignmentResponse] = await Promise.all([
        apiFetch<{ success: boolean; data: Crew[] }>("/crews", { token, user }),
        apiFetch<{ success: boolean; data: WorkerAssignment[] }>("/worker-assignments", { token, user }),
      ]);
      setCrews(crewResponse.data);
      setAssignments(assignmentResponse.data);
      await persistSnapshot({ crews: crewResponse.data, assignments: assignmentResponse.data });
    } catch {
      const cache = await loadWorkspaceCache<WorkspaceSnapshot>();
      setCrews(cache.crews);
      setAssignments(cache.assignments);
    }
  }

  async function createCrew() {
    if (!token || !user || !crewName.trim() || !crewLocationId || !crewWorkerTypeId) {
      setError(locale === "en" ? "Fill crew name, location, and worker type." : "Crew adı, lokasyon ve worker type alanlarını doldur.");
      return;
    }

    try {
      const localCrewId = `crew-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const crewRecord: Crew = {
        id: localCrewId,
        name: crewName.trim(),
        locationId: crewLocationId,
        headOfMasterId: user.id,
        workerTypeId: crewWorkerTypeId,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const nextCrews = [crewRecord, ...crews.filter((item) => item.id !== crewRecord.id)];
      setCrews(nextCrews);
      await persistSnapshot({ crews: nextCrews });
      await enqueueSyncRecord({
        localId: crewRecord.id,
        idempotencyKey: `${deviceId || "device"}-${crewRecord.id}-CREATE`,
        entityType: "CREW",
        operation: "CREATE",
        payload: {
          ...crewRecord,
          headOfMasterId: user.id,
        },
        createdAt: crewRecord.createdAt,
      });
      await syncQueuedRecords();
      setCrewName("");
      setMessage(locale === "en" ? "Crew created." : "Crew oluşturuldu.");
      await refreshCrewWorkspace();
    } catch (err) {
      handleError(err, locale === "en" ? "Crew creation failed" : "Crew oluşturulamadı");
    }
  }

  async function assignWorkers() {
    if (!token || !user || !assignmentPlanId || !assignmentCrewId || !assignmentWorkerTypeId) {
      setError(locale === "en" ? "Select a plan, crew, and worker type." : "Plan, crew ve worker type seç.");
      return;
    }

    try {
      const localAssignmentId = `assign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const assignmentRecord: WorkerAssignment = {
        id: localAssignmentId,
        dailyPlanId: assignmentPlanId,
        crewId: assignmentCrewId,
        workerTypeId: assignmentWorkerTypeId,
        workerCount: Number(assignmentWorkerCount || 0),
        assignedByUserId: user.id,
        createdAt: new Date().toISOString(),
      };
      const nextAssignments = [assignmentRecord, ...assignments.filter((item) => item.id !== assignmentRecord.id)];
      setAssignments(nextAssignments);
      await persistSnapshot({ assignments: nextAssignments });
      await enqueueSyncRecord({
        localId: assignmentRecord.id,
        idempotencyKey: `${deviceId || "device"}-${assignmentRecord.id}-CREATE`,
        entityType: "WORKER_ASSIGNMENT",
        operation: "CREATE",
        payload: assignmentRecord,
        createdAt: assignmentRecord.createdAt,
      });
      await syncQueuedRecords();
      setMessage(locale === "en" ? "Workers assigned." : "Worker ataması yapıldı.");
      await refreshCrewWorkspace();
    } catch (err) {
      handleError(err, locale === "en" ? "Assignment failed" : "Atama başarısız");
    }
  }

  async function saveDraft() {
    if (!token || !user || !selectedPlanId || !fact) return;

    try {
      setLoading(true);
      const draft = {
        ...fact,
        dailyPlanId: selectedPlanId,
        status: "DRAFT",
        submittedByUserId: user.id,
      } as DailyFact;
      const nextDailyFacts = [draft, ...dailyFacts.filter((item) => item.dailyPlanId !== selectedPlanId)];
      setFact(draft);
      setDailyFacts(nextDailyFacts);
      await persistSnapshot({ dailyFacts: nextDailyFacts });
      await apiFetch(
        `/daily-facts/draft/${selectedPlanId}`,
        { token, user },
        {
          method: "POST",
          body: JSON.stringify({
            dailyPlanId: selectedPlanId,
            factQuantity: Number(fact.factQuantity),
            factManDay: Number(fact.factManDay),
            overtime: Number(fact.overtime),
            actualStatus: fact.actualStatus,
            comment: fact.comment || undefined,
            zzzDetailId: fact.zzzDetailId || undefined,
          }),
        }
      );
      setMessage(locale === "en" ? "Draft saved." : "Taslak kaydedildi.");
      await refreshPlans();
    } catch (err) {
      setMessage(locale === "en" ? "Draft saved locally." : "Taslak yerelde kaydedildi.");
      setError("");
    } finally {
      setLoading(false);
    }
  }

  async function submitFact() {
    if (!token || !user || !selectedPlanId || !fact) return;

    try {
      setLoading(true);
      const localFactId = fact.id || `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const queuedFact = {
        ...fact,
        id: localFactId,
        dailyPlanId: selectedPlanId,
        status: "SUBMITTED",
        submittedByUserId: user.id,
      } as DailyFact;
      const nextDailyFacts = [queuedFact, ...dailyFacts.filter((item) => item.dailyPlanId !== selectedPlanId)];
      setFact(queuedFact);
      setDailyFacts(nextDailyFacts);
      await persistSnapshot({ dailyFacts: nextDailyFacts });
      await enqueueSyncRecord({
        localId: localFactId,
        idempotencyKey: `${deviceId || "device"}-${localFactId}-CREATE`,
        entityType: "DAILY_FACT",
        operation: "CREATE",
        baseVersion: plans.find((plan) => plan.id === selectedPlanId)?.version ?? undefined,
        payload: {
          id: localFactId,
          dailyPlanId: selectedPlanId,
          factQuantity: Number(fact.factQuantity),
          factManDay: Number(fact.factManDay),
          overtime: Number(fact.overtime),
          actualStatus: fact.actualStatus,
          comment: fact.comment || undefined,
          zzzDetailId: fact.zzzDetailId || undefined,
        },
        createdAt: new Date().toISOString(),
      });
      const syncSummary = await syncQueuedRecords();
      setMessage(
        locale === "en"
          ? `Fact submitted. ${syncSummary.message}`
          : `Fiş gönderildi. ${syncSummary.message}`
      );
      await refreshFactFromCache(selectedPlanId);
      await refreshPlans();
    } catch (err) {
      handleError(err, locale === "en" ? "Submit failed" : "Gönderim başarısız");
    } finally {
      setLoading(false);
    }
  }

  const factStatusLabel = fact
    ? strings.statusLabels[fact.status as keyof typeof strings.statusLabels] ?? fact.status
    : strings.noFactLoaded;
  const roleOverviewKey = getMobileRoleOverviewKey(currentRole);
  const roleOverviewMap = {
    headMasterOverview: strings.headMasterOverview,
    techOfficeOverview: strings.techOfficeOverview,
    siteChiefOverview: strings.siteChiefOverview,
    projectManagerOverview: strings.projectManagerOverview,
    adminOverview: strings.adminOverview,
  } as const;
  const roleOverview = roleOverviewMap[roleOverviewKey] ?? strings.noData;
  const roleLabel = roleOverview;

  function showToast(text: string) {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }

    setToastMessage(text);
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }).start(() => {
          setToastVisible(false);
          setToastMessage("");
        });
      }, 2000);
    });
  }

  function handleError(err: unknown, fallbackMessage: string) {
    const nextMessage = err instanceof Error ? err.message : fallbackMessage;
    if (isAccessDeniedMessage(nextMessage)) {
      showToast(nextMessage);
      setError("");
      return;
    }

    setError(nextMessage);
  }

  return (
    <View style={styles.screen}>
      {toastVisible ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <ScrollView contentContainerStyle={styles.container}>
        {message ? (
          <View style={styles.topBanner}>
            <Text style={styles.topBannerText}>{message}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{strings.eyebrow}</Text>
            <Text style={styles.title}>{strings.title}</Text>
          </View>
          <View style={styles.langRow}>
            <Pressable style={[styles.langChip, locale === "en" && styles.langChipActive]} onPress={() => setLocale("en")}>
              <Image
                source={{ uri: "https://flagcdn.com/w20/gb.png" }}
                style={styles.langFlag}
                resizeMode="cover"
              />
              <SingleLineText style={styles.langChipText}>EN</SingleLineText>
            </Pressable>
            <Pressable style={[styles.langChip, locale === "tr" && styles.langChipActive]} onPress={() => setLocale("tr")}>
              <Image
                source={{ uri: "https://flagcdn.com/w20/tr.png" }}
                style={styles.langFlag}
                resizeMode="cover"
              />
              <SingleLineText style={styles.langChipText}>TR</SingleLineText>
            </Pressable>
          </View>
        </View>
        <View style={styles.laneStrip}>
          <View style={styles.lanePill}>
            <SingleLineText style={styles.laneTitle}>{strings.planningLane}</SingleLineText>
            <Text style={styles.laneHelp}>{strings.planningLaneHelp}</Text>
          </View>
          <View style={styles.lanePillActive}>
            <SingleLineText style={styles.laneTitle}>{strings.executionLane}</SingleLineText>
            <Text style={styles.laneHelp}>{strings.executionLaneHelp}</Text>
          </View>
          <View style={styles.lanePill}>
            <SingleLineText style={styles.laneTitle}>{strings.approvalLane}</SingleLineText>
            <Text style={styles.laneHelp}>{strings.approvalLaneHelp}</Text>
          </View>
        </View>

      </View>

      {!token ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{strings.signIn}</Text>
          <View style={styles.demoRow}>
            {demoAccounts.map((account) => (
              <Pressable key={account.email} style={styles.demoChip} onPress={() => setEmail(account.email)}>
                <SingleLineText style={styles.demoChipText}>{account.label}</SingleLineText>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
          <Pressable style={styles.primaryButton} onPress={login} disabled={loading}>
            <SingleLineText style={styles.primaryButtonText}>{loading ? strings.signingIn : strings.openWorkspace}</SingleLineText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionStep}>{strings.stepCurrentUser}</Text>
            <Text style={styles.sectionTitle}>{strings.currentUser}</Text>
            <Text style={styles.help}>
              {user?.fullName} · {user?.role}
            </Text>
            <Text style={styles.meta}>{roleLabel}</Text>
            <View style={styles.syncSummary}>
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeLabel}>{locale === "en" ? "Workspace" : "Çalışma alanı"}</Text>
                <SingleLineText style={styles.syncBadgeValue}>
                  {offlineReady ? (locale === "en" ? "Ready" : "Hazır") : locale === "en" ? "Loading" : "Yükleniyor"}
                </SingleLineText>
              </View>
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeLabel}>{locale === "en" ? "Queue" : "Kuyruk"}</Text>
                <SingleLineText style={styles.syncBadgeValue}>
                  {`${pendingCount} ${locale === "en" ? "pending" : "bekleyen"}`}
                </SingleLineText>
              </View>
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeLabel}>{locale === "en" ? "Last sync" : "Son eşitleme"}</Text>
                <SingleLineText style={styles.syncBadgeValue}>
                  {lastSyncedAt
                    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(lastSyncedAt))
                    : locale === "en"
                      ? "Not yet"
                      : "Henüz yok"}
                </SingleLineText>
              </View>
            </View>
            <Text style={styles.help}>
              {offlineReady
                ? locale === "en"
                  ? "Local cache is active. Sync runs in the background."
                  : "Yerel önbellek aktif. Senkron arka planda çalışır."
                : locale === "en"
                  ? "Preparing offline cache..."
                  : "Yerel cache hazırlanıyor..."}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={logout}>
                <SingleLineText style={styles.secondaryButtonText}>{strings.logout}</SingleLineText>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={refreshPlans}>
                <SingleLineText style={styles.primaryButtonText}>{locale === "en" ? "Refresh data" : "Veriyi yenile"}</SingleLineText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={syncQueuedRecords}>
                <SingleLineText style={styles.secondaryButtonText}>{locale === "en" ? "Sync queue" : "Kuyruğu eşitle"}</SingleLineText>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionStep}>{strings.stepPlanPicker}</Text>
            <Text style={styles.sectionTitle}>{strings.planPicker}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
              {visiblePlans.map((plan) => (
                <Pressable
                  key={plan.id}
                  style={[styles.planChip, selectedPlanId === plan.id && styles.planChipActive]}
                  onPress={() => setSelectedPlanId(plan.id)}
                >
                  <SingleLineText style={styles.planChipText}>{plan.status}</SingleLineText>
                  <SingleLineText style={styles.planChipSub}>{plan.planDate.slice(0, 10)}</SingleLineText>
                  <SingleLineText style={styles.planChipSub}>{plan.unit}</SingleLineText>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.meta}>
              {selectedPlan ? `${selectedPlan.locationId} · ${selectedPlan.projectId}` : strings.noPlanSelected}
            </Text>
          </View>

          {roleVisibility.showCrewWorkspace ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{strings.crewBuilder}</Text>
                <Text style={styles.label}>{strings.crewName}</Text>
                <TextInput style={styles.input} value={crewName} onChangeText={setCrewName} placeholder={locale === "en" ? "North crew" : "Kuzey ekibi"} />
                <Text style={styles.label}>{strings.crewLocation}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
                  {masterData?.locations.map((location) => (
                    <Pressable
                      key={location.id}
                      style={[styles.planChip, crewLocationId === location.id && styles.planChipActive]}
                      onPress={() => setCrewLocationId(location.id)}
                    >
                      <SingleLineText style={styles.planChipText}>{location.code}</SingleLineText>
                      <SingleLineText style={styles.planChipSub}>{location.name}</SingleLineText>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.label}>{strings.crewWorkerType}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
                  {masterData?.workerTypes.map((workerType) => (
                    <Pressable
                      key={workerType.id}
                      style={[styles.planChip, crewWorkerTypeId === workerType.id && styles.planChipActive]}
                      onPress={() => setCrewWorkerTypeId(workerType.id)}
                    >
                      <SingleLineText style={styles.planChipText}>{workerType.name}</SingleLineText>
                      <SingleLineText style={styles.planChipSub}>{locale === "en" ? "Selected for crew" : "Crew için seçildi"}</SingleLineText>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.buttonRow}>
                  <Pressable style={styles.primaryButton} onPress={createCrew} disabled={loading}>
                    <SingleLineText style={styles.primaryButtonText}>{strings.createCrew}</SingleLineText>
                  </Pressable>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{strings.workerAssignment}</Text>
                <Text style={styles.label}>{strings.selectPlan}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
                  {visiblePlans.map((plan) => (
                    <Pressable
                      key={plan.id}
                      style={[styles.planChip, assignmentPlanId === plan.id && styles.planChipActive]}
                      onPress={() => setAssignmentPlanId(plan.id)}
                    >
                      <SingleLineText style={styles.planChipText}>{plan.status}</SingleLineText>
                      <SingleLineText style={styles.planChipSub}>{plan.planDate.slice(0, 10)}</SingleLineText>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.label}>{strings.selectCrew}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
                  {crews.map((crew) => (
                    <Pressable
                      key={crew.id}
                      style={[styles.planChip, assignmentCrewId === crew.id && styles.planChipActive]}
                      onPress={() => setAssignmentCrewId(crew.id)}
                    >
                      <SingleLineText style={styles.planChipText}>{crew.name}</SingleLineText>
                      <SingleLineText style={styles.planChipSub}>{crew.locationId}</SingleLineText>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.label}>{strings.crewWorkerType}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
                  {masterData?.workerTypes.map((workerType) => (
                    <Pressable
                      key={workerType.id}
                      style={[styles.planChip, assignmentWorkerTypeId === workerType.id && styles.planChipActive]}
                      onPress={() => setAssignmentWorkerTypeId(workerType.id)}
                    >
                      <SingleLineText style={styles.planChipText}>{workerType.name}</SingleLineText>
                      <SingleLineText style={styles.planChipSub}>{locale === "en" ? "assignment type" : "atama tipi"}</SingleLineText>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.label}>{strings.workerCount}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={assignmentWorkerCount}
                  onChangeText={setAssignmentWorkerCount}
                />
                <View style={styles.buttonRow}>
                  <Pressable style={styles.primaryButton} onPress={assignWorkers} disabled={loading}>
                    <SingleLineText style={styles.primaryButtonText}>{strings.assignWorkers}</SingleLineText>
                  </Pressable>
                </View>
                <Text style={styles.meta}>
                  {selectedPlan ? `${selectedPlan.id}` : strings.noPlanSelected}
                </Text>
              </View>
            </>
          ) : null}

          {roleVisibility.showFactForm ? (
            <View style={styles.card}>
              <Text style={styles.sectionStep}>{strings.stepFactForm}</Text>
              <Text style={styles.sectionTitle}>{strings.factForm}</Text>
              <Text style={styles.meta}>{strings.planStatus}: {factStatusLabel}</Text>

              <Text style={styles.label}>{strings.actualStatus}</Text>
              <View style={styles.demoRow}>
                {actualStatusOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[styles.demoChip, fact?.actualStatus === option.value && styles.demoChipActive]}
                    onPress={() => setFact((current) => (current ? { ...current, actualStatus: option.value } : current))}
                  >
                    <SingleLineText style={styles.demoChipText}>{option.label}</SingleLineText>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>{strings.factQuantity}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(fact?.factQuantity ?? 0)}
                onChangeText={(value) =>
                  setFact((current) =>
                    current ? { ...current, factQuantity: Number(value || 0) } : current
                  )
                }
              />
              <Text style={styles.label}>{strings.factManDay}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(fact?.factManDay ?? 0)}
                onChangeText={(value) =>
                  setFact((current) =>
                    current ? { ...current, factManDay: Number(value || 0) } : current
                  )
                }
              />
              <Text style={styles.label}>{strings.overtime}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(fact?.overtime ?? 0)}
                onChangeText={(value) =>
                  setFact((current) => (current ? { ...current, overtime: Number(value || 0) } : current))
                }
              />
              <Text style={styles.label}>{strings.zzzDetail}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
                <Pressable
                  style={[styles.planChip, !fact?.zzzDetailId && styles.planChipActive]}
                  onPress={() => setFact((current) => (current ? { ...current, zzzDetailId: "" } : current))}
                >
                  <SingleLineText style={styles.planChipText}>{strings.none}</SingleLineText>
                  <SingleLineText style={styles.planChipSub}>{strings.noDetail}</SingleLineText>
                </Pressable>
                {masterData?.zzzDetails.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.planChip, fact?.zzzDetailId === item.id && styles.planChipActive]}
                    onPress={() => setFact((current) => (current ? { ...current, zzzDetailId: item.id } : current))}
                  >
                    <SingleLineText style={styles.planChipText}>{item.code}</SingleLineText>
                    <SingleLineText style={styles.planChipSub}>{item.name}</SingleLineText>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>{strings.comment}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={fact?.comment ?? ""}
                onChangeText={(value) => setFact((current) => (current ? { ...current, comment: value } : current))}
                multiline
                placeholder={locale === "en" ? "What happened on site?" : "Sahada ne oldu?"}
              />

              <View style={styles.buttonRow}>
                <Pressable style={styles.secondaryButton} onPress={saveDraft} disabled={loading}>
                  <SingleLineText style={styles.secondaryButtonText}>{strings.saveDraft}</SingleLineText>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={submitFact} disabled={loading}>
                  <SingleLineText style={styles.primaryButtonText}>{loading ? strings.working : strings.submit}</SingleLineText>
                </Pressable>
              </View>
            </View>
          ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{strings.roleHub}</Text>
            <View style={styles.demoRow}>
              <View style={styles.demoChip}>
                <SingleLineText style={styles.demoChipText}>{isTechOffice ? strings.roleHub : strings.currentUser}</SingleLineText>
              </View>
              <View style={styles.demoChip}>
                <SingleLineText style={styles.demoChipText}>{selectedPlan ? selectedPlan.status : strings.noPlanSelected}</SingleLineText>
              </View>
            </View>
          </View>
        )}
      </>
      )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 16,
    backgroundColor: "#f4f7fb",
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
  },
  laneStrip: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  lanePill: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(24, 75, 130, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
    gap: 2,
  },
  lanePillActive: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(47, 107, 255, 0.12)",
    borderWidth: 1,
    borderColor: "#2f6bff",
    gap: 2,
  },
  laneTitle: {
    color: "#122033",
    fontWeight: "800",
    fontSize: 12,
  },
  laneHelp: {
    color: "#5c6c80",
    fontSize: 11,
    lineHeight: 15,
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    color: "#184b82",
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#122033",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5c6c80",
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#122033",
  },
  sectionStep: {
    color: "#184b82",
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 11,
    marginBottom: -2,
  },
  help: {
    color: "#5c6c80",
    lineHeight: 20,
  },
  meta: {
    color: "#2f6bff",
    fontWeight: "700",
  },
  label: {
    fontWeight: "700",
    color: "#122033",
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    color: "#122033",
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#184b82",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "rgba(24, 75, 130, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  secondaryButtonText: {
    color: "#122033",
    fontWeight: "700",
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "column",
    gap: 10,
  },
  syncSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  syncBadge: {
    flexGrow: 1,
    flexBasis: "31%",
    minWidth: 96,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(24, 75, 130, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
    gap: 3,
  },
  syncBadgeLabel: {
    fontSize: 11,
    color: "#5c6c80",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  syncBadgeValue: {
    color: "#122033",
    fontWeight: "800",
  },
  demoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  demoChip: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(24, 75, 130, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
    flexGrow: 1,
    flexBasis: "48%",
  },
  demoChipActive: {
    backgroundColor: "rgba(47, 107, 255, 0.14)",
    borderColor: "#2f6bff",
  },
  demoChipText: {
    color: "#122033",
    fontWeight: "700",
  },
  planRow: {
    gap: 10,
    paddingVertical: 4,
  },
  planChip: {
    minWidth: 132,
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
  },
  planChipActive: {
    backgroundColor: "rgba(47, 107, 255, 0.12)",
    borderColor: "#2f6bff",
  },
  planChipText: {
    fontWeight: "800",
    color: "#122033",
  },
  planChipSub: {
    color: "#5c6c80",
    fontSize: 12,
  },
  message: {
    color: "#184b82",
    fontWeight: "700",
  },
  error: {
    color: "#cc4f4f",
    fontWeight: "700",
  },
  screen: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },
  topBanner: {
    backgroundColor: "rgba(47, 107, 255, 0.95)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  topBannerText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(204, 79, 79, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(204, 79, 79, 0.24)",
  },
  errorBannerText: {
    color: "#b02f2f",
    fontWeight: "700",
  },
  toast: {
    position: "absolute",
    top: 12,
    right: 16,
    maxWidth: 240,
    zIndex: 90,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(18, 32, 51, 0.94)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  toastText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  langRow: {
    flexDirection: "row",
    gap: 3,
  },
  langChip: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 7,
    backgroundColor: "rgba(24, 75, 130, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(18, 32, 51, 0.1)",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  langChipActive: {
    backgroundColor: "rgba(47, 107, 255, 0.14)",
    borderColor: "#2f6bff",
  },
  langChipText: {
    color: "#122033",
    fontWeight: "800",
    fontSize: 10,
  },
  langFlag: {
    width: 11,
    height: 11,
    borderRadius: 2,
  },
});
