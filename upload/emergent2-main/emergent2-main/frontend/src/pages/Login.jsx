import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("admin@synkdata.mx");
  const [password, setPassword] = useState("Admin2026!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("from") || "/app";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Sesión iniciada");
      navigate(redirectTo);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left: marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 text-white p-12 flex-col justify-between relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 grid-pattern" />
        <Link to="/" className="relative flex items-center gap-2" data-testid="login-back-home">
          <div className="h-8 w-8 bg-white text-slate-950 flex items-center justify-center rounded-md">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="font-display font-bold tracking-tight">SynkData</span>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter mb-4 leading-tight">
            Identity Intelligence<br />
            <span className="text-slate-400">en tiempo real.</span>
          </h2>
          <p className="text-slate-400 max-w-md leading-relaxed">
            Background checks completos integrando fuentes gubernamentales, listas regulatorias,
            digital footprint y AI risk assessment en una sola consola.
          </p>
        </div>
        <div className="relative text-xs text-slate-500 font-mono">
          <div className="text-slate-300 mb-1.5">Cuentas demo:</div>
          <div>admin@synkdata.mx · Admin2026!</div>
          <div>analyst@synkdata.mx · Analyst2026!</div>
        </div>
      </div>

      {/* Right: form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={onSubmit} className="w-full max-w-md space-y-6" data-testid="login-form">
          <div>
            <Link to="/" className="lg:hidden inline-flex items-center gap-2 mb-8" data-testid="login-mobile-logo">
              <div className="h-8 w-8 bg-slate-950 text-white flex items-center justify-center rounded-md">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-display font-bold">SynkData</span>
            </Link>
            <h1 className="font-display text-3xl font-extrabold tracking-tighter text-slate-950 mb-2">
              Acceso a la consola
            </h1>
            <p className="text-sm text-slate-500">Identity Intelligence Platform · México & LATAM</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-700" data-testid="login-error">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 focus:border-slate-950 outline-none transition-all"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-slate-950 focus:border-slate-950 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            data-testid="login-submit"
            className="w-full bg-slate-950 text-white py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            {submitting ? "Verificando..." : <>Iniciar sesión <ArrowRight className="h-4 w-4" /></>}
          </button>

          <div className="text-center text-sm text-slate-500">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="font-semibold text-slate-950 hover:underline" data-testid="login-go-register">
              Crear cuenta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
