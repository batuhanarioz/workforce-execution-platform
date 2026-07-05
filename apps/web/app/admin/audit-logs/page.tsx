"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../../components/workspace-header";
import { ApiError, apiFetch } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n";

type AuditLogRow = {
  id: string;
  userId: string | null;
  user?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  actorRole?: string;
  entityType: string;
  entityId: string;
  action: string;
  source: string;
  locationId?: string | null;
  requestId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
};

type AuditLogsResponse = {
  success: boolean;
  data: AuditLogRow[];
  pageInfo: {
    page: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
};

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function prettyValue(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeValue(value: unknown) {
  if (value == null) return "-";
  try {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  } catch {
    return String(value);
  }
}

function resolveActorLabel(row: AuditLogRow) {
  const explicitLabel = row.user?.fullName ?? row.user?.email;
  if (explicitLabel) {
    return explicitLabel;
  }

  if (row.newValue && typeof row.newValue === "object") {
    const candidate = (row.newValue as Record<string, unknown>).email;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return row.userId ?? "-";
}

function getChangedKeys(oldValue: unknown, newValue: unknown) {
  if (!oldValue || !newValue || typeof oldValue !== "object" || typeof newValue !== "object") {
    return [];
  }

  const before = oldValue as Record<string, unknown>;
  const after = newValue as Record<string, unknown>;
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter((key) => {
    try {
      return JSON.stringify(before[key]) !== JSON.stringify(after[key]);
    } catch {
      return before[key] !== after[key];
    }
  });
}

function translateAction(value: string, locale: string) {
  const labels: Record<string, { en: string; tr: string }> = {
    ALL: { en: "All", tr: "Tümü" },
    LOGIN_SUCCESS: { en: "Login success", tr: "Giriş başarılı" },
    LOGIN_FAILED: { en: "Login failed", tr: "Giriş başarısız" },
    PLAN_CREATED: { en: "Plan created", tr: "Plan oluşturuldu" },
    PLAN_ASSIGNED: { en: "Plan assigned", tr: "Plan atandı" },
    FACT_SUBMITTED: { en: "Fact submitted", tr: "Fiş gönderildi" },
    FACT_APPROVED: { en: "Fact approved", tr: "Fiş onaylandı" },
    ACCESS_DENIED: { en: "Access denied", tr: "Erişim reddedildi" },
    REPORT_VIEWED: { en: "Report viewed", tr: "Rapor görüntülendi" },
  };

  return labels[value]?.[locale === "en" ? "en" : "tr"] ?? value;
}

function translateEntity(value: string, locale: string) {
  const labels: Record<string, { en: string; tr: string }> = {
    ALL: { en: "All", tr: "Tümü" },
    auth: { en: "Auth", tr: "Kimlik" },
    "daily-plan": { en: "Daily plan", tr: "Günlük plan" },
    "daily-fact": { en: "Daily fact", tr: "Günlük fiş" },
    approval: { en: "Approval", tr: "Onay" },
    sync: { en: "Sync", tr: "Senkron" },
    report: { en: "Report", tr: "Rapor" },
    system: { en: "System", tr: "Sistem" },
  };

  return labels[value]?.[locale === "en" ? "en" : "tr"] ?? value;
}

function translateSource(value: string, locale: string) {
  const labels: Record<string, { en: string; tr: string }> = {
    ALL: { en: "All", tr: "Tümü" },
    web: { en: "Web", tr: "Web" },
    mobile: { en: "Mobile", tr: "Mobil" },
    api: { en: "API", tr: "API" },
    system: { en: "System", tr: "Sistem" },
  };

  return labels[value]?.[locale === "en" ? "en" : "tr"] ?? value;
}

function translateRole(value: string, locale: string) {
  const labels: Record<string, { en: string; tr: string }> = {
    ALL: { en: "All", tr: "Tümü" },
    TECH_OFFICE: { en: "Technical Office", tr: "Teknik Ofis" },
    HEAD_OF_MASTER: { en: "Head of Master", tr: "Usta başı" },
    SITE_CHIEF: { en: "Site Chief", tr: "Şantiye Şefi" },
    PROJECT_MANAGER: { en: "Project Manager", tr: "Proje Yöneticisi" },
    ADMIN: { en: "Admin", tr: "Yönetici" },
  };

  return labels[value]?.[locale === "en" ? "en" : "tr"] ?? value;
}

export default function AuditLogsPage() {
  const [locale] = useLocale();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [pageInfo, setPageInfo] = useState<AuditLogsResponse["pageInfo"]>({
    page: 1,
    limit: 20,
    totalCount: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("ALL");
  const [entityType, setEntityType] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [entityId, setEntityId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        if (action !== "ALL") query.set("action", action);
        if (entityType !== "ALL") query.set("entityType", entityType);
        if (source !== "ALL") query.set("source", source);
        if (role !== "ALL") query.set("role", role);
        if (entityId.trim()) query.set("entityId", entityId.trim());
        if (dateFrom) query.set("dateFrom", dateFrom);
        if (dateTo) query.set("dateTo", dateTo);
        query.set("page", String(page));
        query.set("limit", "20");

        const response = await apiFetch<AuditLogsResponse>(`/audit-logs?${query.toString()}`);
        if (cancelled) return;

        setPageInfo(response.pageInfo);
        setRows((current) => (page === 1 ? response.data : [...current, ...response.data]));
        if (page === 1 && response.data.length > 0) {
          setSelectedId(response.data[0]?.id ?? null);
        }
        if (page === 1 && response.data.length === 0) {
          setSelectedId(null);
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          window.location.href = "/login";
          return;
        }
        if (!cancelled) {
          setError(err instanceof Error ? err.message : locale === "en" ? "Audit logs could not be loaded." : "Audit kayıtları yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [action, dateFrom, dateTo, entityId, entityType, locale, page, role, search, source]);

  const summaries = useMemo(() => {
    const byAction = new Map<string, number>();
    const bySource = new Map<string, number>();
    for (const row of rows) {
      byAction.set(row.action, (byAction.get(row.action) ?? 0) + 1);
      bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);
    }
    return { byAction, bySource };
  }, [rows]);

  const selectedRow = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const changedKeys = selectedRow ? getChangedKeys(selectedRow.oldValue, selectedRow.newValue) : [];
  const filtersActive = Boolean(search.trim() || action !== "ALL" || entityType !== "ALL" || source !== "ALL" || role !== "ALL" || entityId.trim() || dateFrom || dateTo);

  const actionOptions = ["ALL", "LOGIN_SUCCESS", "LOGIN_FAILED", "PLAN_CREATED", "PLAN_ASSIGNED", "FACT_SUBMITTED", "FACT_APPROVED", "ACCESS_DENIED", "REPORT_VIEWED"];
  const entityOptions = ["ALL", "auth", "daily-plan", "daily-fact", "approval", "sync", "report", "system"];
  const sourceOptions = ["ALL", "web", "mobile", "api", "system"];
  const roleOptions = ["ALL", "TECH_OFFICE", "HEAD_OF_MASTER", "SITE_CHIEF", "PROJECT_MANAGER", "ADMIN"];

  function resetFilters() {
    setSearch("");
    setAction("ALL");
    setEntityType("ALL");
    setSource("ALL");
    setRole("ALL");
    setEntityId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={locale === "en" ? "Audit trail" : "Audit izi"}
        title={locale === "en" ? "Review activity without digging through code." : "Kod kurcalamadan işlem geçmişini incele."}
        lead={
          locale === "en"
            ? "Critical actions, access denials, report views, failed logins, and sync events are recorded here."
            : "Kritik aksiyonlar, erişim denemeleri, rapor görüntülemeleri, başarısız girişler ve sync olayları burada tutulur."
        }
        meta={
          <>
            <span className="pill">
              {loading ? (locale === "en" ? "Loading..." : "Yükleniyor...") : `${pageInfo.totalCount} ${locale === "en" ? "records" : "kayıt"}`}
            </span>
            <span className="pill">{locale === "en" ? "Live audit view" : "Canlı audit görünümü"}</span>
            <span className="pill">{pageInfo.hasMore ? (locale === "en" ? "More available" : "Daha fazlası var") : (locale === "en" ? "End reached" : "Sonuç bitti")}</span>
          </>
        }
        actions={
          <>
            <Link className="button secondary" href="/admin/users">
              {locale === "en" ? "Back to users" : "Kullanıcılara dön"}
            </Link>
          </>
        }
      />

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Visible rows" : "Görünen satır"}</span>
          <strong className="stat-value">{rows.length}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Top action" : "En sık aksiyon"}</span>
          <strong className="stat-value">{Array.from(summaries.byAction.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Top source" : "En sık kaynak"}</span>
          <strong className="stat-value">{Array.from(summaries.bySource.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"}</strong>
        </article>
      </section>

      <section className="card pad" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div>
            <p className="section-title">{locale === "en" ? "Filters" : "Filtreler"}</p>
            <div className="muted" style={{ marginTop: 4 }}>
              {locale === "en" ? "Use filters to isolate a real incident path." : "Filtrelerle gerçek olay yolunu ayır."}
            </div>
          </div>
          <div className="actions" style={{ gap: 8 }}>
            {filtersActive ? (
              <button className="button secondary" type="button" onClick={resetFilters}>
                {locale === "en" ? "Clear filters" : "Filtreleri temizle"}
              </button>
            ) : null}
            <button className="button secondary" type="button" onClick={() => setPage(1)}>
              {locale === "en" ? "Refresh" : "Yenile"}
            </button>
          </div>
        </div>

        <div className="grid cols-4" style={{ marginTop: 12 }}>
          <label className="field">
            <span>{locale === "en" ? "Search" : "Ara"}</span>
            <input className="input" value={search} onChange={(event) => updateFilter(setSearch, event.currentTarget.value)} placeholder={locale === "en" ? "User, action, entity" : "Kullanıcı, aksiyon, kayıt"} />
          </label>
          <label className="field">
            <span>{locale === "en" ? "Action" : "Aksiyon"}</span>
            <select className="input" value={action} onChange={(event) => updateFilter(setAction, event.currentTarget.value)}>
              {actionOptions.map((item) => (
                <option key={item} value={item}>
                  {translateAction(item, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{locale === "en" ? "Entity" : "Kayıt"}</span>
            <select className="input" value={entityType} onChange={(event) => updateFilter(setEntityType, event.currentTarget.value)}>
              {entityOptions.map((item) => (
                <option key={item} value={item}>
                  {translateEntity(item, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{locale === "en" ? "Source" : "Kaynak"}</span>
            <select className="input" value={source} onChange={(event) => updateFilter(setSource, event.currentTarget.value)}>
              {sourceOptions.map((item) => (
                <option key={item} value={item}>
                  {translateSource(item, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid cols-4" style={{ marginTop: 12 }}>
          <label className="field">
            <span>{locale === "en" ? "Role" : "Rol"}</span>
            <select className="input" value={role} onChange={(event) => updateFilter(setRole, event.currentTarget.value)}>
              {roleOptions.map((item) => (
                <option key={item} value={item}>
                  {translateRole(item, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{locale === "en" ? "Entity id" : "Kayıt id"}</span>
            <input className="input" value={entityId} onChange={(event) => updateFilter(setEntityId, event.currentTarget.value)} placeholder={locale === "en" ? "plan-1" : "plan-1"} />
          </label>
          <label className="field">
            <span>{locale === "en" ? "Date from" : "Başlangıç"}</span>
            <input className="input" type="date" value={dateFrom} onChange={(event) => updateFilter(setDateFrom, event.currentTarget.value)} />
          </label>
          <label className="field">
            <span>{locale === "en" ? "Date to" : "Bitiş"}</span>
            <input className="input" type="date" value={dateTo} onChange={(event) => updateFilter(setDateTo, event.currentTarget.value)} />
          </label>
        </div>

        {filtersActive ? (
          <div className="notice" style={{ marginTop: 12 }}>
            <strong>{locale === "en" ? "Active filters" : "Aktif filtreler"}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {[
                search ? `${locale === "en" ? "Search" : "Ara"}: ${search}` : null,
                action !== "ALL" ? `${locale === "en" ? "Action" : "Aksiyon"}: ${translateAction(action, locale)}` : null,
                entityType !== "ALL" ? `${locale === "en" ? "Entity" : "Kayıt"}: ${translateEntity(entityType, locale)}` : null,
                source !== "ALL" ? `${locale === "en" ? "Source" : "Kaynak"}: ${translateSource(source, locale)}` : null,
                role !== "ALL" ? `${locale === "en" ? "Role" : "Rol"}: ${translateRole(role, locale)}` : null,
                entityId ? `${locale === "en" ? "Entity id" : "Kayıt id"}: ${entityId}` : null,
                dateFrom ? `${locale === "en" ? "From" : "Başlangıç"}: ${dateFrom}` : null,
                dateTo ? `${locale === "en" ? "To" : "Bitiş"}: ${dateTo}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        ) : null}
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <div className="card-header">
            <p className="section-title">{locale === "en" ? "Audit records" : "Audit kayıtları"}</p>
            <span className="pill">
              {rows.length} {locale === "en" ? "visible" : "görünen"}
            </span>
          </div>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "When" : "Zaman"}</th>
                  <th>{locale === "en" ? "Actor" : "Aktör"}</th>
                  <th>{locale === "en" ? "Action" : "Aksiyon"}</th>
                  <th>{locale === "en" ? "Entity" : "Kayıt"}</th>
                  <th>{locale === "en" ? "Source" : "Kaynak"}</th>
                  <th>{locale === "en" ? "Details" : "Detay"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    style={{ cursor: "pointer", background: selectedId === row.id ? "rgba(47, 107, 255, 0.06)" : undefined }}
                  >
                    <td title={formatDateTime(row.createdAt, locale)}>{formatDateTime(row.createdAt, locale)}</td>
                    <td>
                      <div title={resolveActorLabel(row)}>{resolveActorLabel(row)}</div>
                      <div className="muted" title={row.user?.role ?? row.actorRole ?? "-"}>{row.user?.role ?? row.actorRole ?? "-"}</div>
                    </td>
                    <td><span className="pill" title={row.action}>{row.action}</span></td>
                    <td>
                      <div title={row.entityType}>{row.entityType}</div>
                      <div className="muted" title={row.entityId}>{row.entityId}</div>
                    </td>
                    <td title={row.source}>{row.source}</td>
                    <td>
                      <div className="muted" title={prettyValue(row.oldValue)}>
                        {locale === "en" ? "Before" : "Önce"}: {summarizeValue(row.oldValue)}
                      </div>
                      <div className="muted" title={prettyValue(row.newValue)}>
                        {locale === "en" ? "After" : "Sonra"}: {summarizeValue(row.newValue)}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="notice">{locale === "en" ? "No audit records match the filters." : "Filtrelerle eşleşen audit kaydı yok."}</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="actions" style={{ marginTop: 16, justifyContent: "space-between" }}>
            <div className="muted">
              {locale === "en"
                ? `Page ${pageInfo.page} of ${Math.max(1, Math.ceil(pageInfo.totalCount / pageInfo.limit))}`
                : `Sayfa ${pageInfo.page} / ${Math.max(1, Math.ceil(pageInfo.totalCount / pageInfo.limit))}`}
            </div>
            <div className="actions">
              {pageInfo.hasMore ? (
                <button className="button secondary" type="button" onClick={() => setPage((current) => current + 1)} disabled={loading}>
                  {loading ? (locale === "en" ? "Loading..." : "Yükleniyor...") : (locale === "en" ? "Load more" : "Daha fazla yükle")}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card pad">
          <div className="card-header">
            <p className="section-title">{locale === "en" ? "Record detail" : "Kayıt detayı"}</p>
            {selectedRow ? <span className="pill">{selectedRow.action}</span> : <span className="pill">{locale === "en" ? "Nothing selected" : "Seçim yok"}</span>}
          </div>

          {selectedRow ? (
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <div className="notice">
                <strong>{locale === "en" ? "Actor" : "Aktör"}:</strong>{" "}
                {resolveActorLabel(selectedRow)}
                <br />
                <strong>{locale === "en" ? "Role" : "Rol"}:</strong> {selectedRow.user?.role ?? selectedRow.actorRole ?? "-"}
                <br />
                <strong>{locale === "en" ? "Source" : "Kaynak"}:</strong> {selectedRow.source}
                <br />
                <strong>{locale === "en" ? "Request id" : "İstek id"}:</strong> {selectedRow.requestId ?? "-"}
                <br />
                <strong>{locale === "en" ? "Time" : "Zaman"}:</strong> {formatDateTime(selectedRow.createdAt, locale)}
              </div>

              <div className="grid cols-2">
                <div className="notice">
                  <strong>{locale === "en" ? "Before" : "Önce"}</strong>
                  <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontFamily: "inherit" }}>{prettyValue(selectedRow.oldValue)}</pre>
                </div>
                <div className="notice">
                  <strong>{locale === "en" ? "After" : "Sonra"}</strong>
                  <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontFamily: "inherit" }}>{prettyValue(selectedRow.newValue)}</pre>
                </div>
              </div>

              <div className="notice">
                <strong>{locale === "en" ? "Changed keys" : "Değişen alanlar"}</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  {changedKeys.length > 0 ? changedKeys.join(" · ") : locale === "en" ? "No field-level diff available." : "Alan bazlı fark yok."}
                </div>
              </div>
            </div>
          ) : (
            <div className="notice" style={{ marginTop: 12 }}>
              {locale === "en" ? "Select a row to inspect the full audit payload." : "Tam audit verisini incelemek için bir satır seç."}
            </div>
          )}
        </div>
      </section>

      {error ? <div className="notice danger" style={{ marginTop: 18 }}>{error}</div> : null}
    </main>
  );
}
