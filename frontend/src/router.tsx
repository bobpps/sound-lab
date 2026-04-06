import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/layout/AppLayout.tsx";
import { DatasetsPage } from "./features/datasets/components/DatasetsPage.tsx";
import { DialogEditor } from "./features/datasets/components/DialogEditor.tsx";
import { TtsPage } from "./pages/TtsPage.tsx";
import { RealtimePage } from "./pages/RealtimePage.tsx";
import { ProvidersPage } from "./pages/ProvidersPage.tsx";

export function AppRouteTree() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/datasets" replace />} />
        <Route path="datasets" element={<DatasetsPage />} />
        <Route path="datasets/dialogs/:dialogId" element={<DialogEditor />} />
        <Route path="tts" element={<TtsPage />} />
        <Route path="realtime" element={<RealtimePage />} />
        <Route path="providers" element={<ProvidersPage />} />
      </Route>
    </Routes>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AppRouteTree />
    </BrowserRouter>
  );
}
