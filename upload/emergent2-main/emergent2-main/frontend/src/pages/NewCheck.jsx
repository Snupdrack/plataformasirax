import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, User, IdCard, AtSign, Settings2, FileSearch, Loader2 } from "lucide-react";

const STEPS = [
  { id: 1, title: "Datos personales", icon: User },
  { id: 2, title: "Identificación", icon: IdCard },
  { id: 3, title: "Contacto y digital", icon: AtSign },
  { id: 4, title: "Módulos a ejecutar", icon: Settings2 },
];

const Field = ({ label, children, hint, testid }) => (
  <div data-testid={testid}>
    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">{label}</label>
    {children}
    {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
  </div>
);

const Input = (props) => (
  <input {...props} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 focus:border-slate-950 outline-none transition-all" />
);

const Toggle = ({ checked, onChange, label, desc, testid }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    data-testid={testid}
    className={`w-full flex items-start gap-3 p-4 rounded-md border text-left transition-colors ${checked ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-400"}`}
  >
    <div className={`h-5 w-5 rounded mt-0.5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${checked ? "bg-white text-slate-950" : "bg-slate-200 text-slate-400"}`}>
      {checked ? "✓" : ""}
    </div>
    <div>
      <div className="text-sm font-semibold">{label}</div>
      <div className={`text-xs ${checked ? "text-slate-300" : "text-slate-500"}`}>{desc}</div>
    </div>
  </button>
);

export default function NewCheck() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    first_name: "",
    paternal_surname: "",
    maternal_surname: "",
    birth_date: "",
    curp: "",
    rfc: "",
    email: "",
    phone: "",
    username: "",
    address: "",
    state: "CIUDAD DE MEXICO",
    include_government: true,
    include_sanctions: true,
    include_digital_identity: true,
    include_digital_footprint: true,
    include_relationship: true,
    include_ai_report: true,
  });

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const tog = (k) => (v) => setForm({ ...form, [k]: v });

  const canNext = () => {
    if (step === 1) return form.full_name.trim().length >= 3;
    return true;
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/checks", form);
      toast.success("Background check completado");
      navigate(`/app/checks/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear check");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto" data-testid="new-check-page">
      <div className="mb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Wizard</div>
        <h1 className="font-display text-3xl font-extrabold tracking-tighter text-slate-950">Nuevo Background Check</h1>
        <p className="text-sm text-slate-500 mt-1">Completa los datos del sujeto para ejecutar la verificación integral.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center" data-testid={`step-${s.id}`}>
            <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md ${step === s.id ? "bg-slate-950 text-white" : step > s.id ? "text-emerald-700" : "text-slate-400"}`}>
              <s.icon className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-xs font-semibold whitespace-nowrap">{s.id}. {s.title}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-px w-8 mx-1 ${step > s.id ? "bg-emerald-500" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 lg:p-8 space-y-6" data-testid="new-check-form">
        {step === 1 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Field label="Nombre completo *" hint="Como aparece en documentos oficiales" testid="field-full-name">
                <Input value={form.full_name} onChange={upd("full_name")} placeholder="Juan Carlos López Hernández" data-testid="input-full-name" />
              </Field>
            </div>
            <Field label="Nombre(s)" testid="field-first-name">
              <Input value={form.first_name} onChange={upd("first_name")} placeholder="Juan Carlos" data-testid="input-first-name" />
            </Field>
            <Field label="Apellido paterno" testid="field-paternal">
              <Input value={form.paternal_surname} onChange={upd("paternal_surname")} placeholder="López" data-testid="input-paternal" />
            </Field>
            <Field label="Apellido materno" testid="field-maternal">
              <Input value={form.maternal_surname} onChange={upd("maternal_surname")} placeholder="Hernández" data-testid="input-maternal" />
            </Field>
            <Field label="Fecha de nacimiento" hint="DD/MM/AAAA" testid="field-birth">
              <Input value={form.birth_date} onChange={upd("birth_date")} placeholder="15/03/1985" data-testid="input-birth" />
            </Field>
            <Field label="Entidad" testid="field-state">
              <Input value={form.state} onChange={upd("state")} data-testid="input-state" />
            </Field>
            <Field label="Dirección" testid="field-address">
              <Input value={form.address} onChange={upd("address")} placeholder="Av. Reforma 100, CDMX" data-testid="input-address" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="CURP" hint="18 caracteres" testid="field-curp">
              <Input value={form.curp} onChange={upd("curp")} placeholder="LOHJ850315HDFPRN03" maxLength={18} className="font-mono uppercase" data-testid="input-curp" />
            </Field>
            <Field label="RFC" hint="12 (moral) o 13 (física)" testid="field-rfc">
              <Input value={form.rfc} onChange={upd("rfc")} placeholder="LOHJ850315A12" maxLength={13} className="font-mono uppercase" data-testid="input-rfc" />
            </Field>
            <div className="sm:col-span-2 p-4 rounded-md bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-900">
                <strong>Tip:</strong> Si no tienes CURP/RFC, el sistema aún ejecutará screening de sanciones,
                inteligencia digital y análisis relacional con los datos disponibles.
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Email" testid="field-email">
              <Input type="email" value={form.email} onChange={upd("email")} placeholder="usuario@dominio.com" data-testid="input-email" />
            </Field>
            <Field label="Teléfono" hint="Con código de país" testid="field-phone">
              <Input value={form.phone} onChange={upd("phone")} placeholder="+525512345678" data-testid="input-phone" />
            </Field>
            <Field label="Username / Alias" hint="Para descubrir presencia digital" testid="field-username">
              <Input value={form.username} onChange={upd("username")} placeholder="juanlopez" data-testid="input-username" />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Toggle testid="toggle-government" checked={form.include_government} onChange={tog("include_government")} label="Government Intelligence" desc="RENAPO · SAT · IMSS · RND" />
            <Toggle testid="toggle-sanctions" checked={form.include_sanctions} onChange={tog("include_sanctions")} label="Sanctions Screening" desc="OFAC · ONU · OpenSanctions · PEP · SAT 69-B" />
            <Toggle testid="toggle-digital-identity" checked={form.include_digital_identity} onChange={tog("include_digital_identity")} label="Digital Identity" desc="Email · Phone · Username intelligence" />
            <Toggle testid="toggle-digital-footprint" checked={form.include_digital_footprint} onChange={tog("include_digital_footprint")} label="Digital Footprint" desc="LinkedIn · GitHub · social profiles" />
            <Toggle testid="toggle-relationship" checked={form.include_relationship} onChange={tog("include_relationship")} label="Relationship Graph" desc="Knowledge graph + suspicious patterns" />
            <Toggle testid="toggle-ai-report" checked={form.include_ai_report} onChange={tog("include_ai_report")} label="AI Investigation" desc="Reporte automático con Claude Sonnet 4.5" />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button" onClick={() => setStep(step - 1)} disabled={step === 1}
            data-testid="wizard-prev"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </button>
          {step < 4 ? (
            <button
              type="button" onClick={() => setStep(step + 1)} disabled={!canNext()}
              data-testid="wizard-next"
              className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button" onClick={onSubmit} disabled={submitting}
              data-testid="wizard-submit"
              className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</> : <><FileSearch className="h-4 w-4" /> Ejecutar Background Check</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
