import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", organization: "", role: "analyst" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSubmitting(true);
    try {
      await register(form);
      toast.success("Cuenta creada");
      navigate("/app");
    } catch (err) {
      setError(err.response?.data?.detail || "Error al registrar");
    } finally { setSubmitting(false); }
  };

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 text-white p-12 flex-col justify-between relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 grid-pattern" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="h-8 w-8 bg-white text-slate-950 flex items-center justify-center rounded-md">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="font-display font-bold">SynkData</span>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter mb-4 leading-tight">
            Crear cuenta corporativa
          </h2>
          <p className="text-slate-400 max-w-md leading-relaxed">
            Una vez registrada tu organización tendrás acceso a la consola completa con todos los módulos.
          </p>
        </div>
        <div className="relative text-xs text-slate-500 font-mono">© 2026 SynkData</div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={onSubmit} className="w-full max-w-md space-y-5" data-testid="register-form">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tighter text-slate-950 mb-2">Crear cuenta</h1>
            <p className="text-sm text-slate-500">Tu organización tendrá acceso completo a la plataforma.</p>
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-700" data-testid="register-error">
              <AlertCircle className="h-4 w-4 mt-0.5" />{error}
            </div>
          )}
          <div className="space-y-4">
            {[
              ["full_name", "Nombre completo", "text", "Juan Pérez"],
              ["email", "Email", "email", "tu@empresa.com"],
              ["organization", "Organización", "text", "Mi Empresa SA de CV"],
              ["password", "Contraseña (mín. 6)", "password", "••••••••"],
            ].map(([k, l, t, p]) => (
              <div key={k}>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">{l}</label>
                <input
                  type={t} value={form[k]} onChange={upd(k)} placeholder={p}
                  required={k !== "organization"}
                  data-testid={`register-${k}`}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 focus:border-slate-950 outline-none transition-all"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">Rol</label>
              <select
                value={form.role} onChange={upd("role")}
                data-testid="register-role"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 focus:border-slate-950 outline-none"
              >
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <button
            type="submit" disabled={submitting} data-testid="register-submit"
            className="w-full bg-slate-950 text-white py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            {submitting ? "Creando..." : <>Crear cuenta <ArrowRight className="h-4 w-4" /></>}
          </button>
          <div className="text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-semibold text-slate-950 hover:underline" data-testid="register-go-login">
              Iniciar sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
