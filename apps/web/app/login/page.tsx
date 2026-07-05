"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { WorkspaceHeader } from "../../components/workspace-header";
import { ApiError, apiFetch, type StoredUser } from "../../lib/api";
import { copy, useLocale } from "../../lib/i18n";
import { getLoginLandingPath } from "../../lib/role-flows";

type LoginResponse = {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: StoredUser;
  };
};

const workspaceProfilesByLocale = {
  en: [
    { label: "Technical Office", email: "techoffice@icn.com" },
    { label: "Head of Master", email: "hom@icn.com" },
    { label: "Site Chief", email: "sitechief@icn.com" },
    { label: "Project Manager", email: "pm@icn.com" },
    { label: "Admin", email: "admin@icn.com" },
  ],
  tr: [
    { label: "Teknik Ofis", email: "techoffice@icn.com" },
    { label: "Usta başı", email: "hom@icn.com" },
    { label: "Şantiye Şefi", email: "sitechief@icn.com" },
    { label: "Proje Yöneticisi", email: "pm@icn.com" },
    { label: "Yönetici", email: "admin@icn.com" },
  ],
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [locale] = useLocale();
  const workspaceProfiles = workspaceProfilesByLocale[locale];
  const [email, setEmail] = useState<string>(workspaceProfiles[0].email);
  const [password, setPassword] = useState("seeded-password");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const activeProfile = workspaceProfiles.find((profile) => profile.email === email) ?? workspaceProfiles[0];
  const strings = copy[locale].login;
  const common = copy[locale].common;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      window.localStorage.setItem("wfp_access_token", result.data.accessToken);
      window.localStorage.setItem("wfp_user", JSON.stringify(result.data.user));
      setMessage(
        locale === "en"
          ? `Welcome, ${result.data.user.fullName ?? result.data.user.email}.`
          : `${result.data.user.fullName ?? result.data.user.email} hoş geldin.`
      );
      router.push(getLoginLandingPath(result.data.user.role));
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(locale === "en" ? "Login failed. Check your email and password." : "Giriş başarısız. E-posta ve şifreni kontrol et.");
        return;
      }
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.subtitle}
        actions={
          <>
            <Link className="button secondary" href="/">
              {common.backToOverview}
            </Link>
          </>
        }
      />

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <p className="section-title">{strings.demoAccountsTitle}</p>
          <div className="stack" style={{ marginTop: 12 }}>
            {workspaceProfiles.map((account) => (
              <button
                key={account.email}
                type="button"
                className="secondary"
                style={{ justifyContent: "space-between", width: "100%", alignItems: "flex-start", gap: 12 }}
                onClick={() => setEmail(account.email)}
              >
                <span style={{ display: "grid", gap: 4, textAlign: "left" }}>
                  <span>{account.label}</span>
                </span>
                <span className="muted" style={{ whiteSpace: "nowrap" }}>
                  {account.email}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card pad">
          <p className="section-title">{strings.signInTitle}</p>
          <form className="stack" onSubmit={onSubmit} style={{ marginTop: 18 }}>
            <label className="field">
              <span>{strings.email}</span>
              <input
                className="input"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                autoComplete="username"
              />
            </label>

            <label className="field">
              <span>{strings.password}</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete="current-password"
              />
            </label>

            <button className="primary" type="submit" disabled={loading}>
              {loading ? strings.signingIn : strings.enterWorkspace}
            </button>
          </form>

          {message ? <div className="notice" style={{ marginTop: 16 }}>{message}</div> : null}
        </div>
      </section>
    </main>
  );
}
