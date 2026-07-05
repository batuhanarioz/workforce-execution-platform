"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../../components/workspace-header";
import { ApiError, apiFetch } from "../../../lib/api";
import { copy, useLocale } from "../../../lib/i18n";

type DailyReportRow = {
  dailyPlanId: string;
  dailyFactId: string;
  planDate: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  typeOfWorkId: string;
  typeOfWorkCode: string;
  typeOfWorkName: string;
  subTypeOfWorkId: string;
  subTypeOfWorkCode: string;
  subTypeOfWorkName: string;
  subSubTypeOfWorkId: string;
  subSubTypeOfWorkCode: string;
  subSubTypeOfWorkName: string;
  unit: string;
  planStatus: string;
  factStatus: string;
  actualStatus: string;
  plannedQuantity: number;
  factQuantity: number;
  plannedManDay: number;
  factManDay: number;
  overtime: number;
  quantityVariance: number;
  manDayVariance: number;
  productivityRatio: number;
  submittedAt?: string;
};

type DailyReportSummary = {
  totalPlannedQuantity: number;
  totalFactQuantity: number;
  totalPlannedManDay: number;
  totalFactManDay: number;
  totalOvertime: number;
  quantityCompletionRate: number;
  productivityRatio: number;
  rowCount: number;
};

type DailyReportResponse = {
  rows: DailyReportRow[];
  summary: DailyReportSummary;
};

type MasterData = {
  locations: Array<{ id: string; code: string; name: string }>;
  projects: Array<{ id: string; code: string; name: string; locationId: string }>;
  typeOfWorks: Array<{ id: string; code: string; name: string; sortOrder: number }>;
  subTypeOfWorks: Array<{ id: string; code: string; name: string; typeOfWorkId: string; sortOrder: number }>;
  subSubTypeOfWorks: Array<{ id: string; code: string; name: string; subTypeOfWorkId: string; unit: string }>;
};

type MasterDataResponse = {
  success: boolean;
  data: MasterData;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default function DailyReportPage() {
  const [locale, setLocale] = useLocale();
  const strings = copy[locale].dailyReport;
  const common = copy[locale].common;
  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [summary, setSummary] = useState<DailyReportSummary | null>(null);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locationId, setLocationId] = useState("ALL");
  const [projectId, setProjectId] = useState("ALL");
  const [typeOfWorkId, setTypeOfWorkId] = useState("ALL");
  const [subTypeOfWorkId, setSubTypeOfWorkId] = useState("ALL");
  const [subSubTypeOfWorkId, setSubSubTypeOfWorkId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedRowId, setSelectedRowId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMasterData() {
      try {
        const response = await apiFetch<MasterDataResponse>("/master-data");
        if (!cancelled) {
          setMasterData(response.data);
        }
      } catch {
        if (!cancelled) {
          setError(locale === "en" ? "Master data could not be loaded." : "Master data yüklenemedi.");
        }
      }
    }

    loadMasterData();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        const response = await apiFetch<{ success: boolean; data: DailyReportResponse }>(
          `/reports/daily${buildQuery({
            dateFrom,
            dateTo,
            locationId: locationId === "ALL" ? undefined : locationId,
            projectId: projectId === "ALL" ? undefined : projectId,
            typeOfWorkId: typeOfWorkId === "ALL" ? undefined : typeOfWorkId,
            subTypeOfWorkId: subTypeOfWorkId === "ALL" ? undefined : subTypeOfWorkId,
            subSubTypeOfWorkId: subSubTypeOfWorkId === "ALL" ? undefined : subSubTypeOfWorkId,
          })}`
        );
        if (cancelled) return;
        setRows(response.data.rows);
        setSummary(response.data.summary);
        setSelectedRowId((current) => current || response.data.rows[0]?.dailyFactId || "");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          window.location.href = "/login";
          return;
        }
        if (!cancelled) {
          setError(err instanceof Error ? err.message : locale === "en" ? "Failed to load reporting data" : "Raporlama verisi yüklenemedi");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, locationId, projectId, typeOfWorkId, subTypeOfWorkId, subSubTypeOfWorkId, locale]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!query) return true;
      const haystack = [
        row.planDate,
        row.locationCode,
        row.locationName,
        row.projectCode,
        row.projectName,
        row.typeOfWorkCode,
        row.typeOfWorkName,
        row.subTypeOfWorkCode,
        row.subTypeOfWorkName,
        row.subSubTypeOfWorkCode,
        row.subSubTypeOfWorkName,
        row.unit,
        row.factStatus,
        row.actualStatus,
        row.dailyFactId,
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search]);

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.dailyFactId === selectedRowId) ?? filteredRows[0] ?? null,
    [filteredRows, selectedRowId]
  );

  const locationOptions = masterData?.locations ?? [];
  const projectOptions = (masterData?.projects ?? []).filter((project) => locationId === "ALL" || project.locationId === locationId);
  const typeOptions = masterData?.typeOfWorks ?? [];
  const subTypeOptions = (masterData?.subTypeOfWorks ?? []).filter((item) => typeOfWorkId === "ALL" || item.typeOfWorkId === typeOfWorkId);
  const subSubTypeOptions = (masterData?.subSubTypeOfWorks ?? []).filter((item) => subTypeOfWorkId === "ALL" || item.subTypeOfWorkId === subTypeOfWorkId);

  const selectedMetrics = summary ?? {
    totalPlannedQuantity: 0,
    totalFactQuantity: 0,
    totalPlannedManDay: 0,
    totalFactManDay: 0,
    totalOvertime: 0,
    quantityCompletionRate: 0,
    productivityRatio: 0,
    rowCount: 0,
  };
  const activeFilterLabels = [
    dateFrom ? `${locale === "en" ? "From" : "Başlangıç"}: ${dateFrom}` : null,
    dateTo ? `${locale === "en" ? "To" : "Bitiş"}: ${dateTo}` : null,
    locationId !== "ALL" ? `${locale === "en" ? "Location" : "Lokasyon"}: ${locationOptions.find((item) => item.id === locationId)?.code ?? locationId}` : null,
    projectId !== "ALL" ? `${locale === "en" ? "Project" : "Proje"}: ${projectOptions.find((item) => item.id === projectId)?.code ?? projectId}` : null,
    typeOfWorkId !== "ALL" ? `${locale === "en" ? "Type" : "Tür"}: ${typeOptions.find((item) => item.id === typeOfWorkId)?.code ?? typeOfWorkId}` : null,
    subTypeOfWorkId !== "ALL" ? `${locale === "en" ? "Sub type" : "Alt tür"}: ${subTypeOptions.find((item) => item.id === subTypeOfWorkId)?.code ?? subTypeOfWorkId}` : null,
    subSubTypeOfWorkId !== "ALL" ? `${locale === "en" ? "Sub-sub type" : "Alt alt tür"}: ${subSubTypeOptions.find((item) => item.id === subSubTypeOfWorkId)?.code ?? subSubTypeOfWorkId}` : null,
  ].filter(Boolean) as string[];
  const filterSummary = activeFilterLabels.length
    ? activeFilterLabels.join(" · ")
    : locale === "en"
      ? "No filters applied"
      : "Filtre uygulanmadı";

  function exportCsv() {
    if (!filteredRows.length) return;
    const headers = [
      "planDate",
      "location",
      "project",
      "typeOfWork",
      "subTypeOfWork",
      "subSubTypeOfWork",
      "unit",
      "plannedQuantity",
      "factQuantity",
      "plannedManDay",
      "factManDay",
      "overtime",
      "quantityVariance",
      "manDayVariance",
      "productivityRatio",
    ];
    const csv = [
      headers,
      ...filteredRows.map((row) => [
        row.planDate,
        `${row.locationCode} ${row.locationName}`,
        `${row.projectCode} ${row.projectName}`,
        `${row.typeOfWorkCode} ${row.typeOfWorkName}`,
        `${row.subTypeOfWorkCode} ${row.subTypeOfWorkName}`,
        `${row.subSubTypeOfWorkCode} ${row.subSubTypeOfWorkName}`,
        row.unit,
        row.plannedQuantity,
        row.factQuantity,
        row.plannedManDay,
        row.factManDay,
        row.overtime,
        row.quantityVariance,
        row.manDayVariance,
        row.productivityRatio,
      ]),
    ]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `daily-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(locale === "en" ? "CSV exported." : "CSV dışa aktarıldı.");
  }

  const powerBiUrl = process.env.NEXT_PUBLIC_POWER_BI_URL;

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">{loading ? common.loadingUser : `${filteredRows.length} ${common.records}`}</span>
            <span className="pill">{selectedMetrics.rowCount} {locale === "en" ? "approved" : "onaylı"}</span>
            <span className="pill">{common.workspaceStandard}</span>
          </>
        }
        actions={
          <>
            <button className="button secondary" type="button" onClick={exportCsv} disabled={!filteredRows.length}>
              {locale === "en" ? "Export CSV" : "CSV dışa aktar"}
            </button>
            <a className={`button ${powerBiUrl ? "ghost" : "secondary"}`} href={powerBiUrl ?? "#"} target="_blank" rel="noreferrer" aria-disabled={!powerBiUrl}>
              {locale === "en" ? "Open Power BI" : "Power BI aç"}
            </a>
            <Link className="button ghost" href="/dashboard">
              {strings.action}
            </Link>
          </>
        }
      />

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Total planned quantity" : "Toplam planlanan miktar"}</span>
          <strong className="stat-value">{formatNumber(selectedMetrics.totalPlannedQuantity)}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Total fact quantity" : "Toplam fiş miktarı"}</span>
          <strong className="stat-value">{formatNumber(selectedMetrics.totalFactQuantity)}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Completion rate" : "Tamamlanma oranı"}</span>
          <strong className="stat-value">{formatPercent(selectedMetrics.quantityCompletionRate)}</strong>
        </article>
      </section>

      <section className="grid cols-4" style={{ marginTop: 18 }}>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Planned man-day" : "Planlanan adam-gün"}</span>
          <strong className="stat-value">{formatNumber(selectedMetrics.totalPlannedManDay)}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Fact man-day" : "Fiş adam-gün"}</span>
          <strong className="stat-value">{formatNumber(selectedMetrics.totalFactManDay)}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Overtime" : "Fazla mesai"}</span>
          <strong className="stat-value">{formatNumber(selectedMetrics.totalOvertime)}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Productivity ratio" : "Verimlilik oranı"}</span>
          <strong className="stat-value">{formatNumber(selectedMetrics.productivityRatio)}</strong>
        </article>
      </section>

      <section className="card pad" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div>
            <p className="section-title">{strings.reportContract}</p>
          </div>
          <span className="pill">{filterSummary}</span>
        </div>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <div className="card-header">
            <div>
              <p className="section-title">{locale === "en" ? "Daily report rows" : "Günlük rapor satırları"}</p>
            </div>
            <span className="pill">{filteredRows.length} {common.records}</span>
          </div>

          <div className="field-grid" style={{ marginTop: 12 }}>
            <label className="field">
              <span>{locale === "en" ? "Date from" : "Başlangıç tarihi"}</span>
              <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
            </label>
            <label className="field">
              <span>{locale === "en" ? "Date to" : "Bitiş tarihi"}</span>
              <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
            </label>
            <label className="field">
              <span>{locale === "en" ? "Location" : "Lokasyon"}</span>
              <select className="input" value={locationId} onChange={(event) => {
                setLocationId(event.currentTarget.value);
                setProjectId("ALL");
              }}>
                <option value="ALL">{locale === "en" ? "All locations" : "Tüm lokasyonlar"}</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} · {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{locale === "en" ? "Project" : "Proje"}</span>
              <select className="input" value={projectId} onChange={(event) => setProjectId(event.currentTarget.value)}>
                <option value="ALL">{locale === "en" ? "All projects" : "Tüm projeler"}</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} · {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{locale === "en" ? "Type of work" : "İş türü"}</span>
              <select className="input" value={typeOfWorkId} onChange={(event) => {
                setTypeOfWorkId(event.currentTarget.value);
                setSubTypeOfWorkId("ALL");
                setSubSubTypeOfWorkId("ALL");
              }}>
                <option value="ALL">{locale === "en" ? "All types" : "Tüm türler"}</option>
                {typeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} · {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{locale === "en" ? "Sub type of work" : "Alt iş türü"}</span>
              <select className="input" value={subTypeOfWorkId} onChange={(event) => {
                setSubTypeOfWorkId(event.currentTarget.value);
                setSubSubTypeOfWorkId("ALL");
              }}>
                <option value="ALL">{locale === "en" ? "All sub types" : "Tüm alt türler"}</option>
                {subTypeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} · {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{locale === "en" ? "Sub sub type" : "Alt alt tür"}</span>
              <select className="input" value={subSubTypeOfWorkId} onChange={(event) => setSubSubTypeOfWorkId(event.currentTarget.value)}>
                <option value="ALL">{locale === "en" ? "All sub sub types" : "Tüm alt alt türler"}</option>
                {subSubTypeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{locale === "en" ? "Search" : "Ara"}</span>
              <input
                className="input"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={locale === "en" ? "Plan, location, project, comment" : "Plan, lokasyon, proje, yorum"}
              />
            </label>
          </div>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Plan date" : "Plan tarihi"}</th>
                  <th>{locale === "en" ? "Location / Project" : "Lokasyon / Proje"}</th>
                  <th>{locale === "en" ? "Work hierarchy" : "İş hiyerarşisi"}</th>
                  <th>{locale === "en" ? "Numbers" : "Sayılar"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.dailyFactId}>
                    <td>
                      <button className="button ghost" type="button" onClick={() => setSelectedRowId(row.dailyFactId)}>
                        <div style={{ textAlign: "left" }}>
                          <div>{formatDate(row.planDate, locale)}</div>
                          <div className="muted">{row.unit}</div>
                        </div>
                      </button>
                    </td>
                    <td>
                      <div>{row.locationCode} · {row.locationName}</div>
                      <div className="muted">{row.projectCode} · {row.projectName}</div>
                    </td>
                    <td>
                      <div>{row.typeOfWorkCode} · {row.typeOfWorkName}</div>
                      <div className="muted">{row.subTypeOfWorkCode} · {row.subTypeOfWorkName}</div>
                      <div className="muted">{row.subSubTypeOfWorkCode} · {row.subSubTypeOfWorkName}</div>
                    </td>
                    <td>
                      <div>{row.plannedQuantity} / {row.factQuantity}</div>
                      <div className="muted">{row.plannedManDay} / {row.factManDay} / {row.overtime}</div>
                      <div className="muted">
                        {locale === "en" ? "Variance" : "Fark"}: {row.quantityVariance} / {row.manDayVariance}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="notice">{locale === "en" ? "No reporting rows match the filters." : "Filtrelerle eşleşen rapor satırı yok."}</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {message ? <div className="notice" style={{ marginTop: 16 }}>{message}</div> : null}
          {error ? <div className="notice danger" style={{ marginTop: 16 }}>{error}</div> : null}
        </div>

        <div className="stack">
          <div className="card pad">
            <p className="section-title">{strings.selectedRowTitle}</p>
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="notice">{selectedRow?.dailyFactId ?? common.none}</div>
              <div className="notice">{selectedRow?.locationCode ?? common.none}</div>
              <div className="notice">{selectedRow?.projectCode ?? common.none}</div>
              <div className="notice warn">{selectedRow?.productivityRatio ? formatNumber(selectedRow.productivityRatio) : common.none}</div>
              <div className="notice">
                <strong>{strings.sourceRecord}</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  {selectedRow
                    ? `${selectedRow.locationCode} · ${selectedRow.projectCode} · ${selectedRow.typeOfWorkCode} · ${selectedRow.subSubTypeOfWorkCode}`
                    : common.none}
                </div>
              </div>
            </div>
          </div>

          <div className="card pad">
            <p className="section-title">{strings.note}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
