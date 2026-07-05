"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../../components/workspace-header";
import { ApiError, apiFetch, type StoredUser } from "../../../lib/api";
import { copy, useLocale } from "../../../lib/i18n";

type DirectoryUser = StoredUser & {
  tokenVersion?: number;
};

type DirectoryResponse = {
  success: boolean;
  data: DirectoryUser[];
};

type RoleFilter = "ALL" | "TECH_OFFICE" | "HEAD_OF_MASTER" | "SITE_CHIEF" | "PROJECT_MANAGER" | "ADMIN";

const roleOrder: RoleFilter[] = ["ALL", "TECH_OFFICE", "HEAD_OF_MASTER", "SITE_CHIEF", "PROJECT_MANAGER", "ADMIN"];

export default function AdminUsersPage() {
  const [locale, setLocale] = useLocale();
  const strings = copy[locale].adminUsers;
  const common = copy[locale].common;
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const response = await apiFetch<DirectoryResponse>("/auth/directory");
        if (cancelled) return;
        setUsers(response.data);
        setSelectedUserId((current) => current || response.data[0]?.id || "");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          window.location.href = "/login";
          return;
        }
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users");
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
  }, []);

  const allLocations = useMemo(() => {
    const locations = new Map<string, string>();
    for (const user of users) {
      for (const location of user.locations ?? []) {
        if (location?.id && !locations.has(location.id)) {
          locations.set(location.id, location.name ?? location.code ?? location.id);
        }
      }
    }
    return Array.from(locations.entries()).map(([id, label]) => ({ id, label }));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !query ||
        [user.fullName, user.email, user.role, ...(user.locations ?? []).map((location) => location.name ?? location.code ?? "")]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .some((value) => value.toLowerCase().includes(query));
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesLocation =
        locationFilter === "ALL" || (user.locations ?? []).some((location) => location.id === locationFilter);
      return matchesQuery && matchesRole && matchesLocation;
    });
  }, [users, search, roleFilter, locationFilter]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? users[0] ?? null,
    [users, selectedUserId, filteredUsers]
  );

  const roleCounts = useMemo(() => {
    const entries = roleOrder
      .filter((role) => role !== "ALL")
      .map((role) => [role, users.filter((user) => user.role === role).length] as const);
    return Object.fromEntries(entries);
  }, [users]);

  const selectedLocations = selectedUser?.locations ?? [];
  const accessTotals = useMemo(
    () =>
      users.reduce(
        (acc, user) => {
          acc.totalAccess += user.locations?.length ?? 0;
          if ((user.locations?.length ?? 0) > 0) acc.withAccess += 1;
          return acc;
        },
        { totalAccess: 0, withAccess: 0 }
      ),
    [users]
  );

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">{loading ? common.loadingUser : `${filteredUsers.length} ${common.records}`}</span>
            <span className="pill">{common.workspaceStandard}</span>
          </>
        }
        actions={
          <>
            <Link className="button secondary" href="/dashboard">
              {strings.action}
            </Link>
            <Link className="button primary" href="/admin/audit-logs">
              {locale === "en" ? "Audit log" : "Audit kaydı"}
            </Link>
          </>
        }
      />

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        {roleOrder.filter((role) => role !== "ALL").map((role) => (
          <article key={role} className="stat">
            <span className="muted">{role}</span>
            <strong className="stat-value">{roleCounts[role] ?? 0}</strong>
          </article>
        ))}
      </section>

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        <article className="stat">
          <span className="muted">{strings.directoryTitle}</span>
          <strong className="stat-value">{users.length}</strong>
        </article>
        <article className="stat">
          <span className="muted">{strings.accessSnapshot}</span>
          <strong className="stat-value">{accessTotals.withAccess}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Total location links" : "Toplam lokasyon bağlantısı"}</span>
          <strong className="stat-value">{accessTotals.totalAccess}</strong>
        </article>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <div className="card-header">
            <div>
              <p className="section-title">{strings.directoryTitle}</p>
            </div>
            <span className="pill">{users.length} {common.records}</span>
          </div>

          <div className="split" style={{ marginTop: 12 }}>
            <label className="field">
              <span>{locale === "en" ? "Search" : "Ara"}</span>
              <input
                className="input"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={locale === "en" ? "Name, email, role, location" : "Ad, e-posta, rol, lokasyon"}
              />
            </label>
            <label className="field">
              <span>{locale === "en" ? "Location" : "Lokasyon"}</span>
              <select className="input" value={locationFilter} onChange={(event) => setLocationFilter(event.currentTarget.value)}>
                <option value="ALL">{locale === "en" ? "All locations" : "Tüm lokasyonlar"}</option>
                {allLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {roleOrder.map((role) => (
              <button
                key={role}
                type="button"
                className={roleFilter === role ? "button primary" : "button secondary"}
                onClick={() => setRoleFilter(role)}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="notice" style={{ marginTop: 12 }}>
            <strong>{strings.roleSummary}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {roleOrder.filter((role) => role !== "ALL").map((role) => `${role}: ${roleCounts[role] ?? 0}`).join(" · ")}
            </div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "User" : "Kullanıcı"}</th>
                  <th>{locale === "en" ? "Role" : "Rol"}</th>
                  <th>{locale === "en" ? "Locations" : "Lokasyonlar"}</th>
                  <th>{locale === "en" ? "Access" : "Erişim"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id ?? user.email ?? user.fullName}>
                    <td>
                      <button className="button ghost" type="button" onClick={() => setSelectedUserId(user.id ?? "")} style={{ width: "100%", justifyContent: "flex-start" }}>
                        <div style={{ textAlign: "left", display: "grid", gap: 2 }}>
                          <div>{user.fullName ?? user.email ?? common.none}</div>
                          <div className="muted">{user.email ?? common.none}</div>
                        </div>
                      </button>
                    </td>
                    <td><span className="pill">{user.role ?? common.none}</span></td>
                    <td>
                      <div>{(user.locations ?? []).map((location) => location.code ?? location.name).filter(Boolean).join(", ") || common.none}</div>
                    </td>
                    <td>{user.locations?.length ?? 0}</td>
                  </tr>
                ))}
                {!loading && filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="notice">{locale === "en" ? "No matching users." : "Eşleşen kullanıcı yok."}</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {error ? <div className="notice danger" style={{ marginTop: 16 }}>{error}</div> : null}
        </div>

        <div className="stack">
          <div className="card pad">
            <p className="section-title">{strings.selectedUserTitle}</p>
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="notice">
                <strong>{selectedUser?.fullName ?? common.none}</strong>
                <div className="muted">{selectedUser?.email ?? common.none}</div>
              </div>
              <div className="notice warn">{selectedUser?.role ?? common.none}</div>
              <div className="notice">
                {locale === "en"
                  ? `Accessible locations: ${selectedLocations.length}`
                  : `Erişilen lokasyon: ${selectedLocations.length}`}
              </div>
              <div className="notice">
                {locale === "en"
                  ? `Token version: ${selectedUser?.tokenVersion ?? 0}`
                  : `Token sürümü: ${selectedUser?.tokenVersion ?? 0}`}
              </div>
              <div className="notice">
                {locale === "en"
                  ? `Primary access: ${selectedLocations[0]?.code ?? common.none}`
                  : `Birincil erişim: ${selectedLocations[0]?.code ?? common.none}`}
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
