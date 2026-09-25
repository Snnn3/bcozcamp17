import type { ReactElement } from "react";

export interface NavigationItem {
  label: string;
  href: string;
  current?: boolean;
}

interface NavigationProps {
  items: NavigationItem[];
  ariaLabel: string;
}

export function Navigation({ items, ariaLabel }: NavigationProps): ReactElement {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={item.current === true ? "page" : undefined}
              className={
                item.current === true
                  ? "rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
                  : "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
