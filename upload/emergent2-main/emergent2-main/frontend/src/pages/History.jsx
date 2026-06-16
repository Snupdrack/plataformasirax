import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Search, Filter, CheckCircle2, Eye, XCircle, FileSearch } from "lucide-react";

const REC_ICON = {
  APPROVE: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  REVIEW: <Eye className="h-4 w-4 text-amber-500" />,
  REJECT: <XCircle className="h-4 w-4 text-rose-500" />,
};

const LEVEL_PILL = {
  BAJO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIO: "bg-amber-50 text-amber-700 border-amber-200",
  ALTO: "bg-rose-50 text-rose-700 border-rose-200",
  CRITICO: "bg-rose-100 text-rose-800 border-rose-300",
};

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (level) params.risk_level = level;
    try {
      const { data } = await api.get("/checks", { params });
      setItems(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  return (
    <div className="p-6 lg:p-8 space-y-5" data-testid="history-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Histórico</div>
          <h1 className="font-display text-3xl font-extrabold tracking-tighter text-slate-950">Background Checks</h1>
          <p className="text-sm text-slate-500 mt-1">Todas las verificaciones ejecutadas en la plataforma</p>
        </div>
        <Link to="/app/new-check" data-testid="history-new-btn" className="inline-flex items-center gap-2 bg-slate-950 text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-slate-800">
          <FileSearch className="h-4 w-4" /> Nuevo check
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center gap-3" data-testid="history-filters">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md focus-within:ring-2 focus-within:ring-slate-950">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre..."
            className="flex-1 outline-none text-sm"
            data-testid="search-input"
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={level} onChange={(e) => setLevel(e.target.value)}
            data-testid="filter-level"
            className="text-sm outline-none bg-transparent"
          >
            <option value="">Todos los niveles</option>
            <option value="BAJO">BAJO</option>
            <option value="MEDIO">MEDIO</option>
            <option value="ALTO">ALTO</option>
            <option value="CRITICO">CRÍTICO</option>
          </select>
        </div>
        <button onClick={fetchData} data-testid="search-btn" className="bg-slate-950 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-800">
          Aplicar filtros
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm" data-testid="history-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-5 py-3">Sujeto</th>
              <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-5 py-3">Identificación</th>
              <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-5 py-3">Trust</th>
              <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-5 py-3">Risk</th>
              <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-5 py-3">Nivel</th>
              <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-5 py-3">Veredicto</th>
              <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-5 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3,4].map(i => (
                <tr key={i} className="border-b border-slate-100">
                  <td colSpan={7} className="p-3"><div className="h-8 skeleton rounded" /></td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">No hay checks que coincidan</td></tr>
            ) : items.map((c) => (
              <tr
                key={c.id}
                onClick={() => window.location.assign(`/app/checks/${c.id}`)}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                data-testid={`row-${c.id}`}
              >
                <td className="px-5 py-3">
                  <Link to={`/app/checks/${c.id}`} className="font-medium text-slate-950 hover:underline" data-testid={`link-${c.id}`} onClick={(e) => e.stopPropagation()}>
                    {c.subject?.full_name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-xs font-mono text-slate-500">
                  {c.subject?.curp || c.subject?.rfc || "—"}
                </td>
                <td className="px-5 py-3 font-bold text-slate-950">{c.trust_score}</td>
                <td className="px-5 py-3 font-bold text-slate-950">{c.risk_score}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${LEVEL_PILL[c.risk_level]}`}>
                    {c.risk_level}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    {REC_ICON[c.recommendation]} {c.recommendation}
                  </div>
                </td>
                <td className="px-5 py-3 text-xs font-mono text-slate-500">
                  {c.created_at?.slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
