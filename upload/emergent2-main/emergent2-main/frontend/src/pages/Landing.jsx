import { Link } from "react-router-dom";
import {
  ShieldCheck, ArrowRight, IdCard, Scale, Globe2, Network,
  Brain, BarChart3, Plug, Lock, Eye, CheckCircle2, ChevronRight,
} from "lucide-react";

const Module = ({ icon: Icon, title, desc, items, testid }) => (
  <div
    className="group p-6 bg-white border border-slate-200 rounded-lg hover:border-slate-950 transition-colors"
    data-testid={testid}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="h-10 w-10 bg-slate-950 text-white flex items-center justify-center rounded-md group-hover:scale-110 transition-transform">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-950 group-hover:translate-x-1 transition-all" />
    </div>
    <h3 className="font-display font-bold text-slate-950 text-lg mb-2">{title}</h3>
    <p className="text-sm text-slate-500 mb-3 leading-relaxed">{desc}</p>
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it} className="text-xs text-slate-600 font-mono flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />{it}
        </li>
      ))}
    </ul>
  </div>
);

export default function Landing() {
  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-logo">
            <div className="h-8 w-8 bg-slate-950 text-white flex items-center justify-center rounded-md">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="font-display font-bold tracking-tight text-slate-950">SynkData</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Identity Intelligence</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#modulos" className="text-slate-600 hover:text-slate-950">Módulos</a>
            <a href="#cobertura" className="text-slate-600 hover:text-slate-950">Cobertura</a>
            <a href="#api" className="text-slate-600 hover:text-slate-950">API</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="nav-login-btn" className="text-sm font-medium text-slate-600 hover:text-slate-950">Iniciar sesión</Link>
            <Link to="/register" data-testid="nav-register-btn" className="text-sm font-semibold bg-slate-950 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-slate-950 text-white pt-32 pb-24 overflow-hidden noise-overlay">
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700 bg-slate-900/50 text-xs font-medium text-slate-300 mb-6">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Plataforma operativa · México y LATAM
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-[1.05] mb-6">
              Identity Intelligence.<br />
              <span className="text-slate-400">Background Checks.</span><br />
              Risk Intelligence.
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-xl mb-8 leading-relaxed">
              SynkData centraliza fuentes gubernamentales, listas regulatorias internacionales,
              inteligencia digital y análisis relacional para entregar una visión completa de
              identidad y riesgo en segundos.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                data-testid="hero-cta-register"
                className="inline-flex items-center gap-2 bg-white text-slate-950 px-5 py-3 rounded-md font-semibold text-sm hover:-translate-y-0.5 transition-transform"
              >
                Comenzar ahora <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                data-testid="hero-cta-login"
                className="inline-flex items-center gap-2 border border-slate-700 px-5 py-3 rounded-md font-semibold text-sm hover:bg-slate-900 transition-colors"
              >
                Acceder a la consola
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              {[
                { v: "+15", l: "Fuentes integradas" },
                { v: "<2s", l: "Tiempo de respuesta" },
                { v: "99.9%", l: "Disponibilidad" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-2xl font-bold tracking-tight">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-5 shadow-2xl">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Live demo · Trust Score</div>
              <div className="flex items-end gap-6 mb-5">
                <div className="font-display text-7xl font-extrabold tracking-tighter">92</div>
                <div>
                  <div className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white">BAJO RIESGO</div>
                  <div className="text-xs text-slate-400 mt-1">Recomendación: APROBAR</div>
                </div>
              </div>
              <div className="space-y-2.5 text-xs">
                {[
                  ["CURP", "Verificado RENAPO", "ok"],
                  ["RFC", "Activo en SAT", "ok"],
                  ["OFAC / ONU", "Sin coincidencias", "ok"],
                  ["RND", "Sin registros", "ok"],
                  ["Email", "Corporativo, 0 brechas", "ok"],
                  ["LinkedIn", "Perfil profesional verificado", "ok"],
                  ["GitHub", "Cuenta activa · 4 años", "ok"],
                ].map(([k, v, s]) => (
                  <div key={k} className="flex items-center justify-between p-2 rounded border border-slate-800 bg-slate-950/40">
                    <span className="text-slate-400">{k}</span>
                    <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modulos" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-3">Arquitectura</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 mb-4">
              Una sola plataforma. Diez módulos de inteligencia.
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Identity Verification, Government Intelligence, Compliance, Digital Identity,
              Digital Footprint, Relationship Graph, AI Investigation, Risk Engine y APIs — todo conectado.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Module testid="module-identity" icon={IdCard} title="Identity Verification" desc="Validación de identidad oficial mexicana con algoritmo y registros."
              items={["CURP · dígito verificador", "RFC PF · PM · Homoclave", "RENAPO · SAT · IMSS"]} />
            <Module testid="module-government" icon={ShieldCheck} title="Government Intelligence" desc="Consulta de fuentes gubernamentales y registros oficiales."
              items={["RENAPO · SAT · IMSS", "RND (SSPC)", "DOF · SCJN"]} />
            <Module testid="module-compliance" icon={Scale} title="Compliance Intelligence" desc="Screening contra listas restrictivas globales y locales."
              items={["OFAC · ONU · Interpol", "OpenSanctions · EU · UK", "SAT 69-B · PEP México"]} />
            <Module testid="module-digital-id" icon={Globe2} title="Digital Identity Intelligence" desc="Verificación profunda de email, teléfono y aliases."
              items={["HIBP · Hunter · MX Records", "Operador · spam · línea", "Sherlock · Maigret"]} />
            <Module testid="module-footprint" icon={Eye} title="Digital Footprint" desc="Descubrimiento de presencia en plataformas sociales."
              items={["LinkedIn · GitHub · X", "Instagram · Reddit · TikTok", "Discord · Telegram · Medium"]} />
            <Module testid="module-relationship" icon={Network} title="Relationship Intelligence" desc="Knowledge graph con detección de patrones sospechosos."
              items={["Entity Resolution", "Cytoscape visualization", "Detección de redes ocultas"]} />
            <Module testid="module-risk" icon={BarChart3} title="Risk Intelligence Engine" desc="Trust Score y Risk Score ponderados con recomendación."
              items={["Trust 0-100 · Risk 0-100", "Identity Confidence", "APPROVE · REVIEW · REJECT"]} />
            <Module testid="module-ai" icon={Brain} title="AI Investigation Engine" desc="Reportes automáticos en español con Claude Sonnet 4.5."
              items={["Resumen ejecutivo", "Análisis multi-fuente", "Recomendación final"]} />
            <Module testid="module-api" icon={Plug} title="API & Integrations" desc="REST API documentada para CRMs, ERPs, fintechs y bancos."
              items={["POST /verify · /curp · /rfc", "POST /screening · /identity", "Webhooks · SDKs (roadmap)"]} />
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section id="cobertura" className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-3">Cobertura</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 mb-5">
              Sin reemplazar tus integraciones. Las potencia.
            </h2>
            <p className="text-slate-500 mb-6 leading-relaxed">
              SynkData se diseñó como capa unificadora: consume tus integraciones existentes
              (RENAPO, SAT, RND, OpenSanctions, HIBP, Hunter) y las correlaciona en una vista
              360° del sujeto con scoring estandarizado y reporte AI.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {["RENAPO", "SAT", "IMSS", "RND", "OFAC", "ONU", "OpenSanctions", "SAT 69-B", "DOF", "SCJN", "HaveIBeenPwned", "Hunter.io", "NumVerify", "Sherlock", "Maigret", "WhatsMyName"].map((s) => (
                <div key={s} className="px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-700">
                  {s}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1591096866498-6288ad5da7ca?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Network graph"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-md bg-slate-950/85 backdrop-blur-md text-white">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">Knowledge Graph</div>
                <div className="font-display font-bold">Entity Resolution & Pattern Detection</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API CTA */}
      <section id="api" className="py-24 bg-slate-950 text-white relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 grid-pattern" />
        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Lock className="h-7 w-7 mb-4 text-blue-400" strokeWidth={1.75} />
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Una API. Toda la inteligencia.
            </h2>
            <p className="text-slate-400 mb-8 max-w-md">
              Diseñada para CRMs, fintechs, ERPs, bancos, marketplaces y plataformas de RH.
              Verifica identidad, evalúa riesgo y obtén un reporte AI en una sola llamada.
            </p>
            <Link
              to="/register"
              data-testid="footer-cta-register"
              className="inline-flex items-center gap-2 bg-white text-slate-950 px-5 py-3 rounded-md font-semibold text-sm hover:-translate-y-0.5 transition-transform"
            >
              Solicitar acceso <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 font-mono text-xs leading-6 text-slate-300">
            <div className="text-slate-500 mb-1"># Background check completo</div>
            <div><span className="text-rose-400">POST</span> /api/checks</div>
            <div className="text-slate-500 mt-3">{"{"}</div>
            <div className="pl-3">
              <span className="text-blue-400">{'"full_name"'}</span>: <span className="text-emerald-400">{'"Juan Pérez García"'}</span>,<br />
              <span className="text-blue-400">{'"curp"'}</span>: <span className="text-emerald-400">{'"PEGJ800101HDFRRN09"'}</span>,<br />
              <span className="text-blue-400">{'"rfc"'}</span>: <span className="text-emerald-400">{'"PEGJ800101AB1"'}</span>,<br />
              <span className="text-blue-400">{'"email"'}</span>: <span className="text-emerald-400">{'"juan@empresa.mx"'}</span>,<br />
              <span className="text-blue-400">{'"include_ai_report"'}</span>: <span className="text-amber-400">true</span>
            </div>
            <div className="text-slate-500">{"}"}</div>
            <div className="mt-3 pt-3 border-t border-slate-800 text-slate-500"># Response</div>
            <div className="text-emerald-400">trust_score: 92  ·  risk_level: BAJO  ·  recommendation: APPROVE</div>
          </div>
        </div>
      </section>

      <footer className="py-8 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-3 items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            <span>© 2026 SynkData · Identity Intelligence Platform · México</span>
          </div>
          <div className="flex items-center gap-5 font-mono">
            <a href="#api" className="hover:text-slate-950">API</a>
            <Link to="/login" className="hover:text-slate-950">Console</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
