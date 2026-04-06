import { Outlet } from "react-router";
import { Header } from "./Header.tsx";
import { Sidebar } from "./Sidebar.tsx";

export function AppLayout() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
