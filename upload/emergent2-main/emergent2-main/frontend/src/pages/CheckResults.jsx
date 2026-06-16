import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Brain,
  Mail, Phone, Globe2, IdCard, Building2, Scale, Network, Database,
  FileText, ExternalLink, Eye,
} from "lucide-react";

const RISK_COLOR = { BAJO: "#10b981", MEDIO: "#f59e0b", ALTO: "#ef4444", CRITICO: "#9f1239" };
const REC_LABEL = { APPROVE: "APROBAR", REVIEW: "REVISAR", REJECT: "RECHAZAR" };
const REC_COLOR = { APPROVE: "bg-emerald-500", REVIEW: "bg-amber-500", REJECT: "bg-rose-600" };

const Section = ({ icon: Icon, title, subtitle, children, testid }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid={testid}>
    <div className="flex items-center gap-2.5 mb-4">
      <div className="h-8 w-8 bg-slate-100 text-slate-950 flex items-center justify-center rounded-md">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="font-display font-bold text-slate-950">{title}</h3>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
    {children}
  </div>
);

const KV = ({ k, v, ok, testid }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0" data-testid={testid}>
    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{k}</span>
    <span className={`text-sm font-medium ${ok === true ? "text-emerald-700" : ok === false ? "text-rose-700" : "text-slate-950"}`}>
      {v ?? "—"}
    </span>
  </div>
);

const Pill = ({ children, variant = "default" }) => {
  const map = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[variant]}`}>{children}</span>;
};

function renderMarkdown(text) {
  if (!text) return null;
  // very small markdown: bold ##, ** and paragraphs
  const blocks = text.split(/\n\n+/);
  return blocks.map((b, i) => {
    if (b.startsWith("## ")) {
      return <h4 key={i} className="font-display font-bold text-slate-950 text-base mt-5 first:mt-0 mb-2">{b.replace(/^##\s+/, "")}</h4>;
    }
    if (b.startsWith("# ")) {
      return <h3 key={i} className="font-display font-bold text-slate-950 text-lg mt-5 first:mt-0 mb-2">{b.replace(/^#\s+/, "")}</h3>;
    }
    const html = b.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return <p key={i} className="text-sm text-slate-700 leading-relaxed mb-3 last:mb-0" dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

export default function CheckResults() {
  const { id } = useParams();
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/checks/${id}`).then(({ data }) => setCheck(data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 space-y-4"><div className="h-40 skeleton rounded-lg" /><div className="h-60 skeleton rounded-lg" /></div>;
  if (!check) return <div className="p-8 text-slate-500">Check no encontrado.</div>;

  const s = check.subject || {};
  const sanctions = check.sanctions || {};
  const di = check.digital_identity || {};
  const df = check.digital_footprint || {};
  const gov = check.government || {};

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="check-results-page">
      <Link to="/app/history" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-950" data-testid="back-link">
        <ArrowLeft className="h-4 w-4" /> Volver al historial
      </Link>

      {/* Header / Verdict */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="verdict-card">
        <div className="p-6 lg:p-8 grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-2">Reporte de Inteligencia</div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter text-slate-950 mb-2">{s.full_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {s.curp && <Pill>CURP: {s.curp}</Pill>}
              {s.rfc && <Pill>RFC: {s.rfc}</Pill>}
              {s.email && <Pill>{s.email}</Pill>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-white text-xs font-bold tracking-wider uppercase ${REC_COLOR[check.recommendation]}`} data-testid="recommendation-pill">
                {check.recommendation === "APPROVE" ? <CheckCircle2 className="h-4 w-4" /> :
                 check.recommendation === "REVIEW" ? <Eye className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                Recomendación: {REC_LABEL[check.recommendation]}
              </span>
              <span className="text-xs text-slate-500 font-mono">{check.id.slice(0,8)} · {check.created_at?.slice(0,16).replace("T"," ")}</span>
            </div>
          </div>
          <div className="lg:col-span-7 grid grid-cols-3 gap-2">
            <ScoreGauge testid="gauge-trust" value={check.trust_score} label="Trust Score" color="#10b981" subtitle="Señales positivas" />
            <ScoreGauge testid="gauge-risk" value={check.risk_score} label="Risk Score" color={RISK_COLOR[check.risk_level]} subtitle={check.risk_level} />
            <ScoreGauge testid="gauge-confidence" value={check.identity_confidence} label="Confianza ID" color="#2563eb" subtitle="Identity Match" />
          </div>
        </div>
        {check.flags?.length > 0 && (
          <div className="border-t border-slate-200 bg-amber-50/50 px-6 py-4 flex items-start gap-3" data-testid="flags-banner">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1 text-sm text-amber-900">
              <strong>{check.flags.length} indicador{check.flags.length === 1 ? "" : "es"}:</strong>{" "}
              {check.flags.map((f, i) => <span key={i}>{f}{i < check.flags.length - 1 ? " · " : ""}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Identity */}
      {(check.curp_validation || check.rfc_validation) && (
        <div className="grid lg:grid-cols-2 gap-5">
          {check.curp_validation && (
            <Section testid="section-curp" icon={IdCard} title="CURP Validation" subtitle="Algoritmo oficial + RENAPO">
              <KV testid="curp-valid" k="Válida" v={check.curp_validation.is_valid ? "Sí" : "No"} ok={check.curp_validation.is_valid} />
              <KV k="CURP" v={check.curp_validation.curp} />
              <KV k="Dígito verificador" v={check.curp_validation.check_digit_valid ? "Correcto" : "Inválido"} ok={check.curp_validation.check_digit_valid} />
              {check.curp_validation.components && (
                <>
                  <KV k="Fecha nacimiento" v={check.curp_validation.components.birth_date} />
                  <KV k="Sexo" v={check.curp_validation.components.sex} />
                  <KV k="Estado" v={check.curp_validation.components.state} />
                </>
              )}
              <div className="mt-3 text-xs text-slate-500">{check.curp_validation.message}</div>
            </Section>
          )}
          {check.rfc_validation && (
            <Section testid="section-rfc" icon={Building2} title="RFC Validation" subtitle="SAT · Constancia">
              <KV testid="rfc-valid" k="Válido" v={check.rfc_validation.is_valid ? "Sí" : "No"} ok={check.rfc_validation.is_valid} />
              <KV k="RFC" v={check.rfc_validation.rfc} />
              <KV k="Tipo" v={check.rfc_validation.type === "fisica" ? "Persona física" : "Persona moral"} />
              {check.rfc_validation.sat_status && <KV k="Estatus SAT" v={check.rfc_validation.sat_status} ok={check.rfc_validation.sat_status === "ACTIVO"} />}
              {check.rfc_validation.regimen_fiscal && <KV k="Régimen fiscal" v={check.rfc_validation.regimen_fiscal} />}
            </Section>
          )}
        </div>
      )}

      {/* Government */}
      {Object.keys(gov).length > 0 && (
        <Section testid="section-government" icon={Database} title="Government Intelligence" subtitle="RENAPO · SAT · IMSS · RND">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gov.renapo && (
              <div className="p-3 rounded-md border border-slate-200" data-testid="gov-renapo">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">RENAPO</div>
                <Pill variant={gov.renapo.found ? "success" : "default"}>{gov.renapo.found ? "Vigente" : "No encontrado"}</Pill>
                {gov.renapo.data && <div className="text-[11px] text-slate-500 mt-2 font-mono">{gov.renapo.data.birth_date} · {gov.renapo.data.sex}</div>}
              </div>
            )}
            {gov.sat && (
              <div className="p-3 rounded-md border border-slate-200" data-testid="gov-sat">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">SAT</div>
                <Pill variant={gov.sat.status === "ACTIVO" ? "success" : "warning"}>{gov.sat.status}</Pill>
                <div className="text-[11px] text-slate-500 mt-2">{gov.sat.regimen_fiscal}</div>
              </div>
            )}
            {gov.imss && (
              <div className="p-3 rounded-md border border-slate-200" data-testid="gov-imss">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">IMSS</div>
                <Pill variant={gov.imss.status === "VIGENTE" ? "success" : "warning"}>{gov.imss.status}</Pill>
                <div className="text-[11px] text-slate-500 mt-2 font-mono">NSS: {gov.imss.nss}</div>
              </div>
            )}
            {gov.rnd && (
              <div className="p-3 rounded-md border border-slate-200" data-testid="gov-rnd">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">RND</div>
                <Pill variant={gov.rnd.sin_resultados ? "success" : "danger"}>{gov.rnd.sin_resultados ? "Sin registros" : "Registros encontrados"}</Pill>
                <div className="text-[11px] text-slate-500 mt-2">Estado: {gov.rnd.estado}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Sanctions */}
      {check.sanctions && (
        <Section testid="section-sanctions" icon={Scale} title="Compliance & Sanctions Screening" subtitle={`${sanctions.lists_checked?.length || 0} listas consultadas`}>
          <div className="flex flex-wrap gap-2 mb-4">
            {sanctions.is_sanctioned ? <Pill variant="danger">Sancionado</Pill> : <Pill variant="success">Sin sanciones</Pill>}
            {sanctions.is_pep && <Pill variant="warning">PEP detectado</Pill>}
            <Pill>{sanctions.total_records_screened?.toLocaleString()} registros analizados</Pill>
          </div>
          {sanctions.matches?.length > 0 ? (
            <div className="space-y-2" data-testid="sanctions-matches">
              {sanctions.matches.map((m, i) => (
                <div key={i} className="p-3 rounded-md border border-rose-200 bg-rose-50/50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-rose-900">{m.official_name}</div>
                    <div className="text-xs text-rose-700">{m.list_name} · {m.program} · {m.country}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-rose-900">{m.score}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-rose-600">match</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No se encontraron coincidencias en listas restringidas.</div>
          )}
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-4 flex flex-wrap gap-2">
            {sanctions.lists_checked?.map(l => <span key={l} className="font-mono">· {l}</span>)}
          </div>
        </Section>
      )}

      {/* Digital Identity */}
      {(di.email || di.phone || di.username) && (
        <div className="grid lg:grid-cols-3 gap-5">
          {di.email && (
            <Section testid="section-email" icon={Mail} title="Email Intelligence">
              <KV k="Dominio" v={di.email.domain} />
              <KV k="Proveedor" v={di.email.provider} />
              <KV k="Desechable" v={di.email.is_disposable ? "Sí" : "No"} ok={!di.email.is_disposable} />
              <KV k="MX records" v={di.email.mx_records_valid ? "Válidos" : "Inválidos"} ok={di.email.mx_records_valid} />
              <KV k="Brechas detectadas" v={di.email.breach_count} ok={di.email.breach_count === 0} />
              {di.email.breach_sources?.length > 0 && (
                <div className="mt-3 text-[11px] text-slate-500">
                  <div className="font-bold uppercase tracking-wider mb-1">Brechas:</div>
                  {di.email.breach_sources.map((b, i) => <div key={i} className="font-mono">· {b}</div>)}
                </div>
              )}
            </Section>
          )}
          {di.phone && (
            <Section testid="section-phone" icon={Phone} title="Phone Intelligence">
              <KV k="País" v={di.phone.country} />
              <KV k="Operador" v={di.phone.carrier} />
              <KV k="Tipo línea" v={di.phone.line_type} />
              <KV k="Spam reportado" v={di.phone.is_spam_reported ? "Sí" : "No"} ok={!di.phone.is_spam_reported} />
              {di.phone.spam_reports > 0 && <KV k="Reportes spam" v={di.phone.spam_reports} />}
            </Section>
          )}
          {di.username && (
            <Section testid="section-username" icon={Globe2} title="Username Intelligence" subtitle={`${di.username.profile_count} perfiles`}>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {di.username.profiles?.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-slate-50">
                    <span className="text-xs font-medium text-slate-700">{p.platform}</span>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Digital Footprint */}
      {df?.presence_score !== undefined && (
        <Section testid="section-footprint" icon={Globe2} title="Digital Footprint" subtitle={`Presence Score: ${df.presence_score}/100`}>
          <div className="grid sm:grid-cols-4 gap-4 mb-4">
            <div className="p-3 rounded-md border border-slate-200">
              <div className="font-display text-2xl font-bold text-slate-950">{df.presence_score}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Presence Score</div>
            </div>
            <div className="p-3 rounded-md border border-slate-200">
              <div className="font-display text-2xl font-bold text-slate-950">{df.social_profiles_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Social profiles</div>
            </div>
            <div className="p-3 rounded-md border border-slate-200">
              <div className="font-display text-2xl font-bold text-slate-950">{df.developer_profiles_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Developer profiles</div>
            </div>
            <div className="p-3 rounded-md border border-slate-200">
              <div className="font-display text-2xl font-bold text-slate-950">{df.professional_presence ? "Sí" : "No"}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Profesional</div>
            </div>
          </div>
        </Section>
      )}

      {/* Knowledge Graph */}
      {check.relationship?.graph && (
        <Section testid="section-graph" icon={Network} title="Relationship Intelligence" subtitle={`${check.relationship.analysis?.total_nodes || 0} nodos · ${check.relationship.analysis?.total_edges || 0} relaciones`}>
          <KnowledgeGraph data={check.relationship.graph} />
          {check.relationship.analysis?.suspicious_patterns?.length > 0 && (
            <div className="mt-4 space-y-2">
              {check.relationship.analysis.suspicious_patterns.map((p, i) => (
                <div key={i} className="p-3 rounded-md border border-rose-200 bg-rose-50 text-sm text-rose-900">
                  <strong>{p.type}:</strong> {p.description}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* AI Report */}
      {check.ai_report && (
        <Section testid="section-ai-report" icon={Brain} title="AI Investigation Report" subtitle="Claude Sonnet 4.5 · Análisis automático">
          <div className="prose prose-sm prose-slate max-w-none">
            {renderMarkdown(check.ai_report)}
          </div>
        </Section>
      )}

      {/* Sources */}
      <Section testid="section-sources" icon={FileText} title="Fuentes consultadas" subtitle={`${check.sources_consulted?.length || 0} fuentes · ${check.processing_time_ms?.toFixed(0)} ms`}>
        <div className="flex flex-wrap gap-2">
          {check.sources_consulted?.map((src, i) => (
            <span key={i} className="px-2.5 py-1 rounded-md bg-slate-100 text-[11px] font-mono text-slate-700">{src}</span>
          ))}
        </div>
      </Section>
    </div>
  );
}
