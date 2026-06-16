import { useState } from "react";
import api from "@/lib/api";
import { IdCard, Search, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function CurpValidator() {
  const [curp, setCurp] = useState("");
  const [fullName, setFullName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/identity/curp", { curp, full_name: fullName });
      setResult(data);
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="curp-page">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Identidad</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tighter text-slate-950">CURP Validator</h1>
        <p className="text-sm text-slate-500 mt-1">Algoritmo oficial: formato, dígito verificador, componentes, RENAPO.</p>
      </div>

      <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4" data-testid="curp-form">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">CURP (18 caracteres)</label>
            <input
              value={curp} onChange={(e) => setCurp(e.target.value.toUpperCase())} maxLength={18}
              placeholder="LOHJ850315HDFPRN03"
              data-testid="curp-input"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm font-mono uppercase focus:ring-2 focus:ring-slate-950 outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">Nombre completo (opcional)</label>
            <input
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan López Hernández"
              data-testid="curp-name-input"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 outline-none"
            />
          </div>
        </div>
        <button type="submit" disabled={loading || !curp} data-testid="curp-submit"
          className="bg-slate-950 text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Validando...</> : <><Search className="h-4 w-4" /> Validar CURP</>}
        </button>
      </form>

      {result && (
        <div className={`p-5 rounded-lg border ${result.is_valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`} data-testid="curp-result">
          <div className="flex items-center gap-3 mb-3">
            {result.is_valid ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <XCircle className="h-6 w-6 text-rose-600" />}
            <div>
              <div className={`font-display font-bold text-lg ${result.is_valid ? "text-emerald-900" : "text-rose-900"}`}>
                {result.is_valid ? "CURP VÁLIDA" : "CURP INVÁLIDA"}
              </div>
              <div className={`text-sm ${result.is_valid ? "text-emerald-700" : "text-rose-700"}`}>{result.message}</div>
            </div>
          </div>
          {result.components && (
            <div className="grid sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200">
              {Object.entries(result.components).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{k.replace(/_/g, " ")}</div>
                  <div className="text-sm font-medium text-slate-950 font-mono">{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
