import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, FileSearch, ShieldCheck, History, Scale,
  Network, BookText, LogOut, Menu, X, IdCard, Building2,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard" },
  { to: "/app/new-check", icon: FileSearch, label: "Nuevo Check", testid: "nav-new-check" },
  { to: "/app/history", icon: History, label: "Historial", testid: "nav-history" },
  { to: "/app/curp", icon: IdCard, label: "CURP Validator", testid: "nav-curp" },
  { to: "/app/rfc", icon: Building2, label: "RFC Validator", testid: "nav-rfc" },
  { to: "/app/sanctions", icon: Scale, label: "Sanctions Screening", testid: "nav-sanctions" },
  { to: "/app/api", icon: BookText, label: "API & Docs", testid: "nav-api" },
];

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 transition-transform flex flex-col`}
        data-testid="sidebar"
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
          <Link to="/app" className="flex items-center gap-2" data-testid="sidebar-logo">
            <div className="h-8 w-8 bg-slate-950 text-white flex items-center justify-center rounded-md">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="font-display font-bold tracking-tight text-slate-950">SynkData</div>
          </Link>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)} data-testid="sidebar-close-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Plataforma</div>
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/app"}
              onClick={() => setMobileOpen(false)}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? "bg-slate-950 text-white font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`
              }
            >
              <it.icon className="h-4 w-4" strokeWidth={1.75} />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2 mb-2 rounded-md bg-slate-50 border border-slate-200" data-testid="sidebar-user">
            <div className="text-sm font-semibold text-slate-950 truncate">{user?.full_name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            <div className="mt-1.5 inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-slate-950 text-white">
              {user?.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-950/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 sticky top-0 z-20">
          <button className="lg:hidden mr-3" onClick={() => setMobileOpen(true)} data-testid="sidebar-open-btn">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Console</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-950">Identity Intelligence</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              API operativa
            </div>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
