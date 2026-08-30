import type { ReactNode } from "react";

type DataPanelProps = {
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
};

export function DataPanel({ title, description, extra, children }: DataPanelProps) {
  const hasHead = title != null || description != null || extra != null;
  return (
    <section className="data-panel">
      {hasHead ? (
        <header className="data-panel-head">
          <div>
            {title != null ? <div className="data-panel-title">{title}</div> : null}
            {description != null ? <div className="data-panel-desc">{description}</div> : null}
          </div>
          {extra ? <div className="data-panel-extra">{extra}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
