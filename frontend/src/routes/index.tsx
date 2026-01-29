import { Routes, Route, Navigate } from "react-router-dom";
import DashboardHome from "../pages/DashboardHome";
import UploadInvoicePage from "../pages/UploadInvoicePage";
import ExtractPreviewPage from "../pages/ExtractPreviewPage";
import InterpretationPage from "../pages/InterpretationPage";
import SolarInvestBillPage from "../pages/SolarInvestBillPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardHome />} />
      <Route path="/upload" element={<UploadInvoicePage />} />
      <Route path="/extract" element={<ExtractPreviewPage />} />
      <Route path="/interpret" element={<InterpretationPage />} />
      <Route path="/bill" element={<SolarInvestBillPage />} />
    </Routes>
  );
}

export default AppRoutes;
