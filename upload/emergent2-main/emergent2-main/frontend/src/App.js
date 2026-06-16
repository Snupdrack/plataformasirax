import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import NewCheck from "@/pages/NewCheck";
import CheckResults from "@/pages/CheckResults";
import History from "@/pages/History";
import CurpValidator from "@/pages/CurpValidator";
import RfcValidator from "@/pages/RfcValidator";
import SanctionsScreening from "@/pages/SanctionsScreening";
import ApiDocs from "@/pages/ApiDocs";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-slate-500">Cargando...</div>;
  if (!user) return <Navigate to={`/login?from=${encodeURIComponent(window.location.pathname)}`} replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/app" element={<Protected><Dashboard /></Protected>} />
          <Route path="/app/new-check" element={<Protected><NewCheck /></Protected>} />
          <Route path="/app/checks/:id" element={<Protected><CheckResults /></Protected>} />
          <Route path="/app/history" element={<Protected><History /></Protected>} />
          <Route path="/app/curp" element={<Protected><CurpValidator /></Protected>} />
          <Route path="/app/rfc" element={<Protected><RfcValidator /></Protected>} />
          <Route path="/app/sanctions" element={<Protected><SanctionsScreening /></Protected>} />
          <Route path="/app/api" element={<Protected><ApiDocs /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
