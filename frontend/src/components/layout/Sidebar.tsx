import { NavLink } from "react-router";
import clsx from "clsx";

const navItems = [
  { to: "/datasets", label: "Datasets" },
  { to: "/tts", label: "TTS Testing" },
  { to: "/realtime", label: "Realtime" },
  { to: "/realtime-gemini", label: "Realtime Gemini" },
  { to: "/providers", label: "Providers" },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gray-900">
      <div className="flex h-12 items-center px-4">
        <span className="text-lg font-semibold text-white">Sound Lab</span>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "block rounded px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-white",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
