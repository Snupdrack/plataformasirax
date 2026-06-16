import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  FileSearch, ShieldAlert, Scale, TrendingUp, ArrowRight,
  AlertTriangle, CheckCircle2, Eye, XCircle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const StatCard = ({ icon: Icon, label, value, sub, accent, testid }) => (
  <div className="p-5 bg-white border border-slate-200 rounded-lg" data-testid={testid}>
    <div className="flex items-center justify-between mb-3">
      <div className={`h-9 w-9 flex items-center justify-center rounded-md ${accent || "bg-slate-100 text-slate-950"}`}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
    </div>
    <div className="font-display text-3xl font-extrabold tracking-tighter text-slate-950">{value}</div>
    <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-1">{label}</div>
    {sub && <div className="text-xs text-slate-400 mt-2">{sub}</div>}
  </div>
);

const RISK_COLORS = { BAJO: "#10b981", MEDIO: "#f59e0b", ALTO: "#ef4444", CRITICO: "#9f1239" };
const REC_COLORS = { APPROVE: "#10b981", REVIEW: "#f59e0b", REJECT: "#ef4444" };
const REC_LABEL = { APPROVE: "Aprobar", REVIEW: "Revisar", REJECT: "Rechazar" };

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/dashboard")
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 lg:p-8" data-testid="dashboard-loading">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 skeleton rounded-lg" />)}
      </div>
    </div>
  );

  const riskData = Object.entries(data?.risk_distribution || {}).map(([level, count]) => ({ level, count, fill: RISK_COLORS[level] }));
  const recData = Object.entries(data?.recommendation_distribution || {}).map(([rec, count]) => ({ name: REC_LABEL[rec] || rec, value: count, fill: REC_COLORS[rec] }));

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="dashboard">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Dashboard ejecutivo</div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter text-slate-950">
            Bienvenido, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Identity Intelligence en tiempo real</p>
        </div>
        <Link
          to="/app/new-check"
          data-testid="dashboard-new-check-btn"
          className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:-translate-y-0.5 transition-transform"
        >
          <FileSearch className="h-4 w-4" /> Nuevo Background Check <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard testid="stat-total" icon={FileSearch} label="Checks procesados" value={data?.total_checks ?? 0} sub="Histórico total" accent="bg-slate-100 text-slate-950" />
        <StatCard testid="stat-trust" icon={CheckCircle2} label="Trust Score promedio" value={data?.average_trust_score ?? 0} sub="Últimos 500 checks" accent="bg-emerald-100 text-emerald-700" />
        <StatCard testid="stat-risk" icon={ShieldAlert} label="Risk Score promedio" value={data?.average_risk_score ?? 0} sub="Últimos 500 checks" accent="bg-amber-100 text-amber-700" />
        <StatCard testid="stat-sanctions" icon={Scale} label="Coincidencias sanciones" value={data?.sanctions_matches ?? 0} sub={`PEP: ${data?.pep_matches ?? 0}`} accent="bg-rose-100 text-rose-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-lg" data-testid="chart-risk-distribution">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Distribución</div>
              <h3 className="font-display font-bold text-slate-950">Niveles de riesgo</h3>
            </div>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="level" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 6, color: "white", fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg" data-testid="chart-recommendation">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Recomendaciones</div>
            <h3 className="font-display font-bold text-slate-950">Veredicto</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={recData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {recData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 6, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-lg" data-testid="chart-trend">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Tendencia</div>
            <h3 className="font-display font-bold text-slate-950">Checks últimos 14 días</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.trend_14_days || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 6, color: "white", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#0f172a" strokeWidth={2} dot={{ fill: "#0f172a", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg" data-testid="recent-checks">
          <h3 className="font-display font-bold text-slate-950 mb-1">Checks recientes</h3>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Últimas verificaciones</div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {(data?.recent_checks || []).map((c) => (
              <Link
                key={c.id}
                to={`/app/checks/${c.id}`}
                data-testid={`recent-check-${c.id}`}
                className="flex items-center gap-3 p-2.5 -mx-2.5 rounded-md hover:bg-slate-50 transition-colors"
              >
                <div className={`w-1 h-9 rounded-full ${
                  c.risk_level === "BAJO" ? "bg-emerald-500" :
                  c.risk_level === "MEDIO" ? "bg-amber-500" :
                  c.risk_level === "ALTO" ? "bg-rose-500" : "bg-rose-700"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-950 truncate">{c.subject?.full_name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{(c.created_at || "").slice(0, 16).replace("T", " ")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-950">{c.trust_score}</div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400">Trust</div>
                  </div>
                  {c.recommendation === "APPROVE" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                   c.recommendation === "REVIEW" ? <Eye className="h-4 w-4 text-amber-500" /> :
                   <XCircle className="h-4 w-4 text-rose-500" />}
                </div>
              </Link>
            ))}
            {(!data?.recent_checks || data.recent_checks.length === 0) && (
              <div className="text-sm text-slate-400 text-center py-6 flex flex-col items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Aún no hay checks. Crea el primero.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
