"use client";

import type { ReactNode } from "react";

type WorkspaceHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function WorkspaceHeader({ eyebrow, title, lead, meta, actions }: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div className="workspace-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {lead ? <p className="page-lead">{lead}</p> : null}
        {meta ? <div className="workspace-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="workspace-actions">{actions}</div> : null}
    </header>
  );
}
