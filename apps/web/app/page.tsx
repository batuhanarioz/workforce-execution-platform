"use client";

import Link from "next/link";
import { WorkspaceHeader } from "../components/workspace-header";
import { useLocale } from "../lib/i18n";

export default function Page() {
  const [locale] = useLocale();
  const strings = locale === "en"
    ? {
        eyebrow: "Workforce execution platform",
        title: "Planning, execution, approvals, and reporting in one workspace.",
        lead: "Choose a lane, complete the task, and move on.",
        start: "Sign in",
        dashboard: "Dashboard",
        lanesTitle: "Choose your lane",
        laneCards: [
          {
            title: "Planning",
            description: "Daily plans and assignments.",
            href: "/daily-plans",
            action: "Planning",
          },
          {
            title: "Execution",
            description: "Mobile fact entry and sync.",
            href: "/head-of-master",
            action: "Execution",
          },
          {
            title: "Approvals",
            description: "Review and decide.",
            href: "/approvals",
            action: "Approvals",
          },
        ],
      }
    : {
        eyebrow: "İş gücü yürütme platformu",
        title: "Planlama, saha yürütme, onay ve raporlama tek çalışma alanında.",
        lead: "Bir hat seç, işi tamamla ve devam et.",
        start: "Giriş yap",
        dashboard: "Pano",
        lanesTitle: "Hattını seç",
        laneCards: [
          {
            title: "Planlama",
            description: "Günlük plan ve atama.",
            href: "/daily-plans",
            action: "Planlama",
          },
          {
            title: "Yürütme",
            description: "Mobil fiş ve senkron.",
            href: "/head-of-master",
            action: "Yürütme",
          },
          {
            title: "Onaylar",
            description: "İncele ve karar ver.",
            href: "/approvals",
            action: "Onaylar",
          },
        ],
      };

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={<span className="pill">{strings.lanesTitle}</span>}
        actions={
          <>
            <Link className="button primary" href="/login">{strings.start}</Link>
            <Link className="button secondary" href="/dashboard">{strings.dashboard}</Link>
          </>
        }
      />

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        {strings.laneCards.map((lane) => (
          <article key={lane.title} className="card pad">
            <p className="section-title">{lane.title}</p>
            <p className="section-help">{lane.description}</p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <Link className="button secondary" href={lane.href}>
                {lane.action}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
