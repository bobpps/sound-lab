import clsx from "clsx";
import { useState, type ReactNode } from "react";

export interface TabDefinition<T extends string = string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string = string> {
  tabs: readonly TabDefinition<T>[];
  defaultTab?: T;
  children: (activeTab: T) => ReactNode;
}

export function Tabs<T extends string = string>({ tabs, defaultTab, children }: TabsProps<T>) {
  const initialTab = (defaultTab ?? tabs[0]?.id ?? "") as T;
  const [activeTab, setActiveTab] = useState<T>(initialTab);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div
        aria-label="Provider types"
        className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              aria-selected={isActive}
              className={clsx(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{children(activeTab)}</div>
    </div>
  );
}
