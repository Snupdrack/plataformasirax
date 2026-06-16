import { useState } from "react";
import api from "@/lib/api";
import { Scale, Search, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export default function SanctionsScreening() {
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState(85);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/sanctions/screen", { full_name: name, threshold });
      setResult(data);
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6" data-testid="sanctions-page">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Compliance</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tighter text-slate-950">Sanctions Screening</h1>
        <p className="text-sm text-slate-500 mt-1">Búsqueda inteligente en OFAC, ONU, OpenSanctions, PEP, SAT 69-B, Interpol.</p>
      </div>

      <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4" data-testid="sanctions-form">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">Nombre completo</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Joaquín Guzmán Loera"
              data-testid="sanctions-input"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">Umbral de match (%)</label>
            <input
              type="number" min={60} max={100}
              value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) || 85)}
              data-testid="sanctions-threshold"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 outline-none"
            />
          </div>
        </div>
        <button type="submit" disabled={loading || !name} data-testid="sanctions-submit"
          className="bg-slate-950 text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</> : <><Scale className="h-4 w-4" /> Ejecutar screening</>}
        </button>
      </form>

      {result && (
        <div data-testid="sanctions-result">
          <div className={`p-5 rounded-lg border ${result.is_sanctioned ? "border-rose-200 bg-rose-50" : result.is_pep ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="flex items-center gap-3">
              {result.is_sanctioned || result.is_pep ? <AlertTriangle className="h-6 w-6 text-amber-600" /> : <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
              <div>
                <div className="font-display font-bold text-lg text-slate-950">
                  {result.is_sanctioned ? "COINCIDENCIA EN LISTA DE SANCIONES" :
                   result.is_pep ? "PERSONA EXPUESTA POLÍTICAMENTE (PEP)" :
                   "SIN COINCIDENCIAS"}
                </div>
                <div className="text-sm text-slate-600 mt-0.5">
                  {result.matches?.length || 0} match(es) sobre {result.total_records_screened?.toLocaleString()} registros · Umbral {result.threshold_used}%
                </div>
              </div>
            </div>
          </div>

          {result.matches?.length > 0 && (
            <div className="mt-4 space-y-2">
              {result.matches.map((m, i) => (
                <div key={i} className="bg-white border border-rose-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-950">{m.official_name}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      <span className="font-mono">{m.list_name}</span> · {m.program} · {m.country} · <span className="text-rose-700">{m.type}</span>
                    </div>
                    {m.matched_name !== m.official_name && (
                      <div className="text-[11px] text-slate-500 mt-1">Match con alias: <span className="font-mono">{m.matched_name}</span></div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold text-rose-700">{m.score}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">similitud</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Listas consultadas</div>
            <div className="flex flex-wrap gap-1.5">
              {result.lists_checked?.map(l => <span key={l} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono text-slate-700">{l}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
