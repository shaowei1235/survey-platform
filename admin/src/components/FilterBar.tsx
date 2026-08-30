import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  extra?: ReactNode;
};

export function FilterBar({ children, extra }: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-bar-fields">{children}</div>
      {extra ? <div className="filter-bar-extra">{extra}</div> : null}
    </div>
  );
}
