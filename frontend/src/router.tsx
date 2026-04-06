import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/layout/AppLayout.tsx";
import { DatasetsPage } from "./pages/DatasetsPage.tsx";
import { TtsPage } from "./pages/TtsPage.tsx";
import { RealtimePage } from "./pages/RealtimePage.tsx";
import { ProvidersPage } from "./pages/ProvidersPage.tsx";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/datasets" replace />} />
          <Route path="datasets/*" element={<DatasetsPage />} />
          <Route path="tts" element={<TtsPage />} />
          <Route path="realtime" element={<RealtimePage />} />
          <Route path="providers" element={<ProvidersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
