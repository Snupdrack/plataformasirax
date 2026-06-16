import { BookText, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const endpoints = [
  { method: "POST", path: "/api/auth/login", desc: "Iniciar sesión y obtener JWT" },
  { method: "POST", path: "/api/auth/register", desc: "Crear nueva cuenta" },
  { method: "GET",  path: "/api/auth/me", desc: "Perfil del usuario actual" },
  { method: "POST", path: "/api/checks", desc: "Background check completo (master endpoint)" },
  { method: "GET",  path: "/api/checks", desc: "Listar checks con filtros (?q, ?risk_level)" },
  { method: "GET",  path: "/api/checks/{id}", desc: "Obtener un check específico" },
  { method: "POST", path: "/api/identity/curp", desc: "Validar CURP (formato + dígito verificador)" },
  { method: "POST", path: "/api/identity/rfc", desc: "Validar RFC (PF / PM)" },
  { method: "POST", path: "/api/government/renapo", desc: "Consulta RENAPO" },
  { method: "POST", path: "/api/government/sat", desc: "Consulta SAT (situación fiscal)" },
  { method: "POST", path: "/api/government/imss", desc: "Consulta IMSS (info autorizada)" },
  { method: "POST", path: "/api/government/rnd", desc: "Consulta RND (SSPC)" },
  { method: "POST", path: "/api/sanctions/screen", desc: "Screening de sanciones + PEP" },
  { method: "GET",  path: "/api/sanctions/lists", desc: "Listas restrictivas integradas" },
  { method: "POST", path: "/api/digital/email", desc: "Email intelligence (HIBP, Hunter, MX)" },
  { method: "POST", path: "/api/digital/phone", desc: "Phone intelligence (operador, spam)" },
  { method: "POST", path: "/api/digital/username", desc: "Username discovery (Sherlock/Maigret)" },
  { method: "GET",  path: "/api/analytics/dashboard", desc: "Métricas para dashboard ejecutivo" },
];

const sample = `curl -X POST "https://api.synkdata.mx/api/checks" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "full_name": "Juan Carlos López Hernández",
    "first_name": "Juan Carlos",
    "paternal_surname": "López",
    "maternal_surname": "Hernández",
    "birth_date": "15/03/1985",
    "curp": "LOHJ850315HDFPRN03",
    "rfc": "LOHJ850315A12",
    "email": "juan@empresa.mx",
    "phone": "+525512345678",
    "username": "jclopez",
    "include_government": true,
    "include_sanctions": true,
    "include_digital_identity": true,
    "include_digital_footprint": true,
    "include_relationship": true,
    "include_ai_report": true
  }'`;

const METHOD_COLOR = {
  GET: "bg-blue-100 text-blue-800 border-blue-200",
  POST: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PUT: "bg-amber-100 text-amber-800 border-amber-200",
  DELETE: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function ApiDocs() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sample).then(() => {
          setCopied(true); toast.success("Copiado al portapapeles");
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => toast.error("No se pudo copiar (permiso denegado)"));
      } else {
        toast.error("Clipboard no disponible en este contexto");
      }
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6" data-testid="api-docs-page">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Developers</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tighter text-slate-950">API & Integraciones</h1>
        <p className="text-sm text-slate-500 mt-1">Endpoints REST autenticados con JWT. Integra SynkData en tu CRM, ERP, fintech o banca.</p>
      </div>

      <div className="bg-slate-950 text-white border border-slate-800 rounded-lg p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Ejemplo · Background Check completo</div>
          <button onClick={copy} className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 hover:bg-slate-900" data-testid="copy-sample">
            <Copy className="h-3 w-3" /> {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <pre className="text-xs font-mono leading-relaxed text-slate-200 overflow-x-auto">{sample}</pre>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <BookText className="h-4 w-4 text-slate-500" />
          <div className="text-sm font-bold text-slate-950">Endpoints disponibles</div>
        </div>
        <div className="divide-y divide-slate-100">
          {endpoints.map((e, i) => (
            <div key={i} className="px-5 py-3 grid grid-cols-12 gap-3 items-center" data-testid={`endpoint-${i}`}>
              <div className="col-span-2">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${METHOD_COLOR[e.method]}`}>{e.method}</span>
              </div>
              <div className="col-span-5 text-sm font-mono text-slate-950">{e.path}</div>
              <div className="col-span-5 text-sm text-slate-500">{e.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-600 font-bold mb-2">Autenticación</div>
          <h3 className="font-display font-bold text-slate-950 mb-2">JWT Bearer Token</h3>
          <p className="text-sm text-slate-500 mb-3">Incluye el header en cada request:</p>
          <pre className="text-xs font-mono bg-slate-50 border border-slate-200 rounded p-3 text-slate-700">Authorization: Bearer {`<JWT_TOKEN>`}</pre>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-600 font-bold mb-2">Rate Limits</div>
          <h3 className="font-display font-bold text-slate-950 mb-2">Por plan</h3>
          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex justify-between"><span>Starter</span><span className="font-mono">100/min</span></div>
            <div className="flex justify-between"><span>Business</span><span className="font-mono">1,000/min</span></div>
            <div className="flex justify-between"><span>Enterprise</span><span className="font-mono">∞</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
