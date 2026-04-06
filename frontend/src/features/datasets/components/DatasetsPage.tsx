import { useState } from "react";
import { DialogList } from "./DialogList.tsx";

type DatasetTab = "dialogs" | "prompts";

const tabs: Array<{ id: DatasetTab; label: string }> = [
  { id: "dialogs", label: "Dialogs" },
  { id: "prompts", label: "Prompts" },
];

export function DatasetsPage() {
  const [activeTab, setActiveTab] = useState<DatasetTab>("dialogs");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Datasets</h1>
        <p className="mt-2 text-gray-600">
          Manage dialog datasets for TTS testing and keep prompt tooling in the
          same workspace.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                className={[
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                ].join(" ")}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "dialogs" ? (
        <DialogList />
      ) : (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Prompts</h2>
          <p className="mt-2 text-sm text-gray-600">
            Prompt management lands in the next task. The tab is already wired
            so the page structure stays stable.
          </p>
        </section>
      )}
    </div>
  );
}
