'use client'

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import {
  ShieldCheck, ArrowRight, IdCard, Scale, Globe2, Network,
  Brain, BarChart3, Plug, Lock, Eye, CheckCircle2, ChevronRight,
  FileSearch, ShieldAlert, TrendingUp, AlertTriangle, XCircle,
  Search, Phone, Mail, User, MapPin, Calendar, Hash,
  ChevronLeft, Activity, Database, ExternalLink, Copy, RefreshCw,
  Menu, X, LogOut, Plus, Filter, Download, Zap, Target,
  GitBranch, Linkedin, Github, Instagram, Twitter, MessageCircle,
  BookOpen, Code2, Building2, Flag
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts'
import { useToast } from '@/hooks/use-toast'

// ==================== API Helper ====================
const API = {
  get: async (path: string, token?: string) => {
    const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    return res.json()
  },
  post: async (path: string, body: any, token?: string) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    return res.json()
  },
  del: async (path: string, token: string) => {
    const res = await fetch(path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    return res.json()
  },
}

// ==================== Auth Context ====================
type User = { id: string; email: string; full_name: string; role: string; organization?: string }

const AuthContext = createContext<{
  user: User | null; token: string | null; login: (t: string, u: User) => void; logout: () => void
}>({ user: null, token: null, login: () => {}, logout: () => {} })

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Read from localStorage on mount - this is the only safe place
    const t = localStorage.getItem('synkdata_token')
    const u = localStorage.getItem('synkdata_user')
    if (t) setToken(t)
    if (u) {
      try { setUser(JSON.parse(u)) } catch {}
    }
    setReady(true)
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [])

  const login = (t: string, u: User) => {
    localStorage.setItem('synkdata_token', t)
    localStorage.setItem('synkdata_user', JSON.stringify(u))
    setToken(t); setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('synkdata_token')
    localStorage.removeItem('synkdata_user')
    localStorage.removeItem('synkdata_view')
    setToken(null); setUser(null)
  }

  // Show nothing during SSR/hydration to avoid mismatch
  if (!ready) {
    return <div className="min-h-screen bg-white" />
  }

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>
}

function useAuth() { return useContext(AuthContext) }

// Helper to get token - falls back to localStorage if context token is null
function useToken(): string | null {
  const { token } = useAuth()
  if (token) return token
  if (typeof window !== 'undefined') return localStorage.getItem('synkdata_token')
  return null
}

// ==================== View Router ====================
type View = 'landing' | 'login' | 'register' | 'dashboard' | 'new-check' | 'history' | 'check-results' | 'curp' | 'rfc' | 'sanctions' | 'api-docs'

const RouterContext = createContext<{ view: View; navigate: (v: View, data?: any) => void; viewData: any }>({
  view: 'landing', navigate: () => {}, viewData: null
})

function useRouter() { return useContext(RouterContext) }

// ==================== Constants ====================
const RISK_COLORS: Record<string, string> = { BAJO: '#10b981', MEDIO: '#f59e0b', ALTO: '#ef4444', CRITICO: '#9f1239' }
const REC_COLORS: Record<string, string> = { APPROVE: '#10b981', REVIEW: '#f59e0b', REJECT: '#ef4444' }
const REC_LABEL: Record<string, string> = { APPROVE: 'Aprobar', REVIEW: 'Revisar', REJECT: 'Rechazar' }

// ==================== Landing Module Card ====================
function LandingModule({ icon: Icon, title, desc, items }: { icon: any; title: string; desc: string; items: string[] }) {
  return (
    <div className="group p-6 bg-white border border-slate-200 rounded-lg hover:border-slate-950 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 bg-slate-950 text-white flex items-center justify-center rounded-md group-hover:scale-110 transition-transform">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-950 group-hover:translate-x-1 transition-all" />
      </div>
      <h3 className="font-bold text-slate-950 text-lg mb-2">{title}</h3>
      <p className="text-sm text-slate-500 mb-3 leading-relaxed">{desc}</p>
      <ul className="space-y-1">
        {items.map((it: string) => (
          <li key={it} className="text-xs text-slate-600 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />{it}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ==================== Landing Page ====================
function LandingView() {
  const { navigate } = useRouter()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('landing')} className="flex items-center gap-2">
            <div className="h-8 w-8 bg-slate-950 text-white flex items-center justify-center rounded-md">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="font-bold tracking-tight text-slate-950">SynkData</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Identity Intelligence</span>
          </button>
          <div className="flex items-center gap-3">
            {user ? (
              <button onClick={() => navigate('dashboard')} className="text-sm font-semibold bg-slate-950 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors">
                Ir al Dashboard
              </button>
            ) : (
              <>
                <button onClick={() => navigate('login')} className="text-sm font-medium text-slate-600 hover:text-slate-950">Iniciar sesión</button>
                <button onClick={() => navigate('register')} className="text-sm font-semibold bg-slate-950 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition-colors">
                  Crear cuenta
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-slate-950 text-white pt-32 pb-24 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700 bg-slate-900/50 text-xs font-medium text-slate-300 mb-6">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Plataforma operativa · México y LATAM
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-[1.05] mb-6">
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
              <button onClick={() => navigate(user ? 'dashboard' : 'register')} className="inline-flex items-center gap-2 bg-white text-slate-950 px-5 py-3 rounded-md font-semibold text-sm hover:-translate-y-0.5 transition-transform">
                Comenzar ahora <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate('login')} className="inline-flex items-center gap-2 border border-slate-700 px-5 py-3 rounded-md font-semibold text-sm hover:bg-slate-900 transition-colors">
                Acceder a la consola
              </button>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              {[
                { v: '+15', l: 'Fuentes integradas' },
                { v: '<2s', l: 'Tiempo de respuesta' },
                { v: '99.9%', l: 'Disponibilidad' },
              ].map(s => (
                <div key={s.l}>
                  <div className="text-2xl font-bold tracking-tight">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-5 shadow-2xl">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">Live demo · Trust Score</div>
              <div className="flex items-end gap-6 mb-5">
                <div className="text-7xl font-extrabold tracking-tighter">92</div>
                <div>
                  <div className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white">BAJO RIESGO</div>
                  <div className="text-xs text-slate-400 mt-1">Recomendación: APROBAR</div>
                </div>
              </div>
              <div className="space-y-2.5 text-xs">
                {[
                  ['CURP', 'Verificado RENAPO'],
                  ['RFC', 'Activo en SAT'],
                  ['OFAC / ONU', 'Sin coincidencias'],
                  ['RND', 'Sin registros'],
                  ['Email', 'Corporativo, 0 brechas'],
                  ['LinkedIn', 'Perfil profesional'],
                  ['GitHub', 'Cuenta activa · 4 años'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-2 rounded border border-slate-800 bg-slate-950/40">
                    <span className="text-slate-400">{k}</span>
                    <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />{v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-3">Arquitectura</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 mb-4">
              Una sola plataforma. Diez módulos de inteligencia.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <LandingModule icon={IdCard} title="Identity Verification" desc="Validación de identidad oficial mexicana con algoritmo y registros."
              items={['CURP · dígito verificador', 'RFC PF · PM · Homoclave', 'RENAPO · SAT · IMSS']} />
            <LandingModule icon={ShieldCheck} title="Government Intelligence" desc="Consulta de fuentes gubernamentales y registros oficiales."
              items={['RENAPO · SAT · IMSS', 'RND (SSPC)', 'DOF · SCJN']} />
            <LandingModule icon={Scale} title="Compliance Intelligence" desc="Screening contra listas restrictivas globales y locales."
              items={['OFAC · ONU · Interpol', 'OpenSanctions · EU · UK', 'SAT 69-B · PEP México']} />
            <LandingModule icon={Globe2} title="Digital Identity Intelligence" desc="Verificación profunda de email, teléfono y aliases."
              items={['HIBP · Hunter · MX Records', 'Operador · spam · línea', 'Sherlock · Maigret']} />
            <LandingModule icon={Eye} title="Digital Footprint" desc="Descubrimiento de presencia en plataformas sociales."
              items={['LinkedIn · GitHub · X', 'Instagram · Reddit · TikTok', 'Discord · Telegram · Medium']} />
            <LandingModule icon={Network} title="Relationship Intelligence" desc="Knowledge graph con detección de patrones sospechosos."
              items={['Entity Resolution', 'Visualización interactiva', 'Detección de redes ocultas']} />
            <LandingModule icon={BarChart3} title="Risk Intelligence Engine" desc="Trust Score y Risk Score ponderados con recomendación."
              items={['Trust 0-100 · Risk 0-100', 'Identity Confidence', 'APPROVE · REVIEW · REJECT']} />
            <LandingModule icon={Brain} title="AI Investigation Engine" desc="Reportes automáticos en español con análisis multi-fuente."
              items={['Resumen ejecutivo', 'Análisis multi-fuente', 'Recomendación final']} />
            <LandingModule icon={Plug} title="API & Integrations" desc="REST API documentada para CRMs, ERPs, fintechs y bancos."
              items={['POST /verify · /curp · /rfc', 'POST /screening · /identity', 'Webhooks · SDKs']} />
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-3">Cobertura</div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 mb-5">
            Sin reemplazar tus integraciones. Las potencia.
          </h2>
          <p className="text-slate-500 mb-6 leading-relaxed max-w-2xl">
            SynkData se diseñó como capa unificadora: consume tus integraciones existentes
            y las correlaciona en una vista 360° del sujeto con scoring estandarizado y reporte AI.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            {['RENAPO', 'SAT', 'IMSS', 'RND', 'OFAC', 'ONU', 'OpenSanctions', 'SAT 69-B', 'HaveIBeenPwned', 'Hunter.io', 'NumVerify', 'Sherlock'].map(s => (
              <div key={s} className="px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-700">{s}</div>
            ))}
          </div>
        </div>
      </section>

      {/* API CTA */}
      <section className="py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Lock className="h-7 w-7 mb-4 text-blue-400" strokeWidth={1.75} />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Una API. Toda la inteligencia.</h2>
            <p className="text-slate-400 mb-8 max-w-md">
              Diseñada para CRMs, fintechs, ERPs, bancos, marketplaces y plataformas de RH.
              Verifica identidad, evalúa riesgo y obtén un reporte AI en una sola llamada.
            </p>
            <button onClick={() => navigate('register')} className="inline-flex items-center gap-2 bg-white text-slate-950 px-5 py-3 rounded-md font-semibold text-sm hover:-translate-y-0.5 transition-transform">
              Solicitar acceso <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 font-mono text-xs leading-6 text-slate-300">
            <div className="text-slate-500 mb-1"># Background check completo</div>
            <div><span className="text-rose-400">POST</span> /api/checks</div>
            <div className="text-slate-500 mt-3">{'{'}</div>
            <div className="pl-3">
              <span className="text-blue-400">{'"full_name"'}</span>: <span className="text-emerald-400">{'"Juan Pérez García"'}</span>,<br />
              <span className="text-blue-400">{'"curp"'}</span>: <span className="text-emerald-400">{'"PEGJ800101HDFRRN09"'}</span>,<br />
              <span className="text-blue-400">{'"rfc"'}</span>: <span className="text-emerald-400">{'"PEGJ800101AB1"'}</span>,<br />
              <span className="text-blue-400">{'"email"'}</span>: <span className="text-emerald-400">{'"juan@empresa.mx"'}</span>,<br />
              <span className="text-blue-400">{'"include_ai_report"'}</span>: <span className="text-amber-400">true</span>
            </div>
            <div className="text-slate-500">{'}'}</div>
            <div className="mt-3 pt-3 border-t border-slate-800 text-emerald-400">trust_score: 92 · risk_level: BAJO · recommendation: APPROVE</div>
          </div>
        </div>
      </section>

      <footer className="py-8 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-3 items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            <span>© 2026 SynkData · Identity Intelligence Platform · México</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ==================== Login ====================
function LoginView() {
  const { login } = useAuth()
  const { navigate } = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const data = await API.post('/api/auth/login', { email, password })
    if (data.token) {
      login(data.token, data.user)
      navigate('dashboard')
    } else {
      toast({ title: 'Error', description: data.error || 'Credenciales inválidas', variant: 'destructive' })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 text-white flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="relative">
          <ShieldCheck className="h-16 w-16 mb-8" strokeWidth={1.5} />
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">SynkData</h1>
          <p className="text-slate-400 max-w-sm leading-relaxed">Identity Intelligence Platform. Verificación de identidad, background checks y risk intelligence para México y LATAM.</p>
          <div className="mt-8 p-4 rounded-lg border border-slate-800 bg-slate-900/50 text-xs font-mono">
            <div className="text-slate-500 mb-2">Demo credentials:</div>
            <div>Admin: <span className="text-emerald-400">admin@synkdata.mx</span></div>
            <div>Analyst: <span className="text-emerald-400">analyst@synkdata.mx</span></div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button onClick={() => navigate('landing')} className="flex items-center gap-2 mb-8 text-slate-500 hover:text-slate-950 text-sm">
            <ChevronLeft className="h-4 w-4" /> Volver al inicio
          </button>
          <h2 className="text-3xl font-bold text-slate-950 mb-2">Iniciar sesión</h2>
          <p className="text-slate-500 mb-8">Accede a la consola de Identity Intelligence.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                placeholder="tu@email.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-slate-950 text-white py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
              {loading ? 'Verificando...' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="text-sm text-slate-500 mt-6 text-center">
            ¿No tienes cuenta? <button onClick={() => navigate('register')} className="text-slate-950 font-semibold hover:underline">Crear cuenta</button>
          </p>
        </div>
      </div>
    </div>
  )
}

// ==================== Register ====================
function RegisterView() {
  const { login } = useAuth()
  const { navigate } = useRouter()
  const { toast } = useToast()
  const [form, setForm] = useState({ email: '', password: '', fullName: '', organization: '' })
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const data = await API.post('/api/auth/register', { ...form, role: 'analyst' })
    if (data.token) {
      login(data.token, data.user)
      navigate('dashboard')
    } else {
      toast({ title: 'Error', description: data.error || 'No se pudo crear la cuenta', variant: 'destructive' })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 text-white flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl" />
        <div className="relative">
          <ShieldCheck className="h-16 w-16 mb-8" strokeWidth={1.5} />
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">Únete a SynkData</h1>
          <p className="text-slate-400 max-w-sm leading-relaxed">Accede a la plataforma de Identity Intelligence más completa para México y Latinoamérica.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button onClick={() => navigate('landing')} className="flex items-center gap-2 mb-8 text-slate-500 hover:text-slate-950 text-sm">
            <ChevronLeft className="h-4 w-4" /> Volver al inicio
          </button>
          <h2 className="text-3xl font-bold text-slate-950 mb-2">Crear cuenta</h2>
          <p className="text-slate-500 mb-8">Regístrate para acceder a la plataforma.</p>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre completo</label>
              <input type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Organización</label>
              <input type="text" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-slate-950 text-white py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
          <p className="text-sm text-slate-500 mt-6 text-center">
            ¿Ya tienes cuenta? <button onClick={() => navigate('login')} className="text-slate-950 font-semibold hover:underline">Iniciar sesión</button>
          </p>
        </div>
      </div>
    </div>
  )
}

// ==================== Dashboard Layout ====================
function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { navigate, view } = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems: { key: View; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'new-check', label: 'Nuevo Check', icon: Plus },
    { key: 'history', label: 'Historial', icon: Search },
    { key: 'curp', label: 'Validador CURP', icon: IdCard },
    { key: 'rfc', label: 'Validador RFC', icon: Hash },
    { key: 'sanctions', label: 'Screening Sanciones', icon: Scale },
    { key: 'api-docs', label: 'API & Docs', icon: Plug },
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-200">
          <div className="h-8 w-8 bg-slate-950 text-white flex items-center justify-center rounded-md">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="font-bold tracking-tight text-slate-950">SynkData</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(item => (
            <button key={item.key} onClick={() => { navigate(item.key); setMobileOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                view === item.key ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}>
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-950 truncate">{user?.full_name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{user?.role}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('landing') }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-950 transition-colors">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Identity Intelligence Platform</div>
          <div />
        </header>
        <main>{children}</main>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
    </div>
  )
}

// ==================== Stat Card ====================
function StatCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: any; sub?: string; accent?: string }) {
  return (
    <div className="p-5 bg-white border border-slate-200 rounded-lg">
      <div className={`h-9 w-9 flex items-center justify-center rounded-md mb-3 ${accent || 'bg-slate-100 text-slate-950'}`}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="text-3xl font-extrabold tracking-tighter text-slate-950">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-2">{sub}</div>}
    </div>
  )
}

// ==================== Dashboard View ====================
function DashboardView() {
  const { user, token } = useAuth()
  const { navigate } = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      API.get('/api/analytics/dashboard', token).then(d => { setData(d); setLoading(false) })
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [token])

  if (loading) return <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-slate-200 rounded w-64" /><div className="grid grid-cols-4 gap-5">{[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-lg" />)}</div></div></div>

  const riskData = Object.entries(data?.risk_distribution || {}).map(([level, count]: any) => ({ level, count, fill: RISK_COLORS[level] }))
  const recData = Object.entries(data?.recommendation_distribution || {}).map(([rec, count]: any) => ({ name: REC_LABEL[rec] || rec, value: count, fill: REC_COLORS[rec] }))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Dashboard ejecutivo</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-slate-950">
            Bienvenido, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Identity Intelligence en tiempo real</p>
        </div>
        <button onClick={() => navigate('new-check')}
          className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:-translate-y-0.5 transition-transform">
          <FileSearch className="h-4 w-4" /> Nuevo Background Check <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={FileSearch} label="Checks procesados" value={data?.total_checks ?? 0} sub="Histórico total" accent="bg-slate-100 text-slate-950" />
        <StatCard icon={CheckCircle2} label="Trust Score promedio" value={data?.average_trust_score ?? 0} sub="Promedio" accent="bg-emerald-100 text-emerald-700" />
        <StatCard icon={ShieldAlert} label="Risk Score promedio" value={data?.average_risk_score ?? 0} sub="Promedio" accent="bg-amber-100 text-amber-700" />
        <StatCard icon={Scale} label="Coincidencias sanciones" value={data?.sanctions_matches ?? 0} sub={`PEP: ${data?.pep_matches ?? 0}`} accent="bg-rose-100 text-rose-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Distribución</div>
              <h3 className="font-bold text-slate-950">Niveles de riesgo</h3>
            </div>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="level" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 6, color: 'white', fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {riskData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Recomendaciones</div>
            <h3 className="font-bold text-slate-950">Veredicto</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={recData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {recData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 6, color: 'white', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-lg">
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Tendencia</div>
            <h3 className="font-bold text-slate-950">Checks últimos 14 días</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.trend_14_days || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 6, color: 'white', fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#0f172a" strokeWidth={2} dot={{ fill: '#0f172a', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <h3 className="font-bold text-slate-950 mb-1">Checks recientes</h3>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Últimas verificaciones</div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {(data?.recent_checks || []).map((c: any) => (
              <button key={c.id} onClick={() => navigate('check-results', { checkId: c.id })}
                className="flex items-center gap-3 p-2.5 w-full text-left rounded-md hover:bg-slate-50 transition-colors">
                <div className={`w-1 h-9 rounded-full ${c.risk_level === 'BAJO' ? 'bg-emerald-500' : c.risk_level === 'MEDIO' ? 'bg-amber-500' : c.risk_level === 'ALTO' ? 'bg-rose-500' : 'bg-rose-700'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-950 truncate">{c.subject?.full_name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{(c.created_at || '').slice(0, 16).replace('T', ' ')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-slate-950">{c.trust_score}</div>
                  {c.recommendation === 'APPROVE' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                   c.recommendation === 'REVIEW' ? <Eye className="h-4 w-4 text-amber-500" /> :
                   <XCircle className="h-4 w-4 text-rose-500" />}
                </div>
              </button>
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
  )
}

// ==================== New Check Wizard ====================
function NewCheckView() {
  const token = useToken()
  const { navigate } = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '', curp: '', rfc: '', email: '', phone: '', username: '', address: '',
    include_government: true, include_sanctions: true, include_digital: true,
    include_relationship: true, include_ai_report: true,
  })

  const steps = ['Personal', 'Identidad', 'Digital', 'Módulos']
  const stepIcons = [User, IdCard, Globe2, Zap]

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { toast({ title: 'Error', description: 'Nombre completo es requerido', variant: 'destructive' }); return }
    setLoading(true)
    const data = await API.post('/api/checks', form, token)
    if (data.id) {
      toast({ title: 'Check completado', description: `Trust: ${data.trust_score} | Risk: ${data.risk_score} | ${data.recommendation}` })
      navigate('check-results', { checkId: data.id, checkData: data })
    } else {
      toast({ title: 'Error', description: data.error || 'No se pudo crear el check', variant: 'destructive' })
    }
    setLoading(false)
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Background Check</div>
        <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950">Nueva verificación</h1>
        <p className="text-sm text-slate-500 mt-1">Completa los datos del sujeto para el análisis de identidad.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <button onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                i === step ? 'bg-slate-950 text-white' : i < step ? 'bg-emerald-100 text-emerald-700 cursor-pointer' : 'bg-slate-100 text-slate-400'
              }`}>
              {React.createElement(stepIcons[i], { className: 'h-3.5 w-3.5' })}
              {s}
            </button>
            {i < steps.length - 1 && <div className="w-8 h-px bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Personal */}
      {step === 0 && (
        <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="font-bold text-slate-950 text-lg mb-4">Datos personales</h2>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre completo *</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              placeholder="Juan Pérez García" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Dirección</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              placeholder="Ciudad de México, CDMX" />
          </div>
        </div>
      )}

      {/* Step 1: Identity */}
      {step === 1 && (
        <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="font-bold text-slate-950 text-lg mb-4">Datos de identidad</h2>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">CURP</label>
            <input value={form.curp} onChange={e => setForm(f => ({ ...f, curp: e.target.value.toUpperCase() }))} maxLength={18}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-950"
              placeholder="PEGJ800101HDFRRN09" />
            <p className="text-[10px] text-slate-400 mt-1">18 caracteres · Algoritmo de verificación oficial</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">RFC</label>
            <input value={form.rfc} onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))} maxLength={13}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-950"
              placeholder="PEGJ800101AB1" />
            <p className="text-[10px] text-slate-400 mt-1">12 (moral) o 13 (física) caracteres</p>
          </div>
        </div>
      )}

      {/* Step 2: Digital */}
      {step === 2 && (
        <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="font-bold text-slate-950 text-lg mb-4">Identidad digital</h2>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              placeholder="juan@empresa.mx" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Teléfono</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              placeholder="+52 55 1234 5678" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Username / Alias</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
              placeholder="snupdrack" />
          </div>
        </div>
      )}

      {/* Step 3: Modules */}
      {step === 3 && (
        <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="font-bold text-slate-950 text-lg mb-4">Módulos de análisis</h2>
          <p className="text-sm text-slate-500 mb-4">Selecciona qué módulos incluir en la verificación.</p>
          {[
            { key: 'include_government', label: 'Government Intelligence', desc: 'RENAPO, SAT, IMSS, RND', icon: ShieldCheck },
            { key: 'include_sanctions', label: 'Compliance Intelligence', desc: 'OFAC, ONU, PEP, SAT 69-B, Interpol', icon: Scale },
            { key: 'include_digital', label: 'Digital Identity & Footprint', desc: 'Email, teléfono, username, redes sociales', icon: Globe2 },
            { key: 'include_relationship', label: 'Relationship Intelligence', desc: 'Knowledge graph y detección de patrones', icon: Network },
            { key: 'include_ai_report', label: 'AI Investigation Report', desc: 'Reporte automático de investigación', icon: Brain },
          ].map(m => (
            <label key={m.key} className={`flex items-center gap-4 p-4 rounded-md border cursor-pointer transition-colors ${
              (form as any)[m.key] ? 'border-slate-950 bg-slate-50' : 'border-slate-200'
            }`}>
              <input type="checkbox" checked={(form as any)[m.key]}
                onChange={e => setForm(f => ({ ...f, [m.key]: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300" />
              <m.icon className="h-5 w-5 text-slate-600" strokeWidth={1.75} />
              <div>
                <div className="text-sm font-semibold text-slate-950">{m.label}</div>
                <div className="text-xs text-slate-500">{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <button onClick={() => step > 0 ? setStep(step - 1) : navigate('dashboard')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
          <ChevronLeft className="h-4 w-4" /> {step > 0 ? 'Anterior' : 'Cancelar'}
        </button>
        {step < 3 ? (
          <button onClick={() => setStep(step + 1)} disabled={!form.full_name.trim()}
            className="flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50">
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50">
            {loading ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Procesando...</>
            ) : (
              <><Zap className="h-4 w-4" /> Ejecutar verificación</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ==================== Score Gauge ====================
function ScoreGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const data = [{ name: label, value, fill: color }]
  return (
    <div className="text-center">
      <ResponsiveContainer width={140} height={80}>
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={180} endAngle={0}>
          <RadialBar dataKey="value" cornerRadius={10} fill={color} background={{ fill: '#f1f5f9' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-2xl font-extrabold tracking-tighter" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  )
}

// ==================== Check Results ====================
function CheckResultsView() {
  const token = useToken()
  const { navigate } = useRouter()
  const { viewData } = useRouter()
  const [check, setCheck] = useState<any>(viewData?.checkData || null)
  const [loading, setLoading] = useState(!check)

  useEffect(() => {
    if (!check && viewData?.checkId && token) {
      API.get(`/api/checks/${viewData.checkId}`, token).then(d => { setCheck(d); setLoading(false) })
    }
  }, [check, viewData, token])

  if (loading) return <div className="p-8 animate-pulse space-y-4"><div className="h-8 bg-slate-200 rounded w-96" /><div className="h-64 bg-slate-200 rounded-lg" /></div>
  if (!check) return <div className="p-8"><p className="text-slate-500">No se encontró el check.</p></div>

  const riskColor = RISK_COLORS[check.risk_level] || '#64748b'

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <button onClick={() => navigate('history')} className="text-sm text-slate-500 hover:text-slate-950 flex items-center gap-1 mb-2">
            <ChevronLeft className="h-4 w-4" /> Historial
          </button>
          <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950">{check.subject?.full_name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: riskColor }}>{check.risk_level}</div>
            <div className="text-sm text-slate-500">Recomendación: {check.recommendation}</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">{check.created_at?.slice(0, 19).replace('T', ' ')}</div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-4 bg-white p-6 rounded-lg border border-slate-200">
        <ScoreGauge value={check.trust_score} label="Trust Score" color="#10b981" />
        <ScoreGauge value={check.risk_score} label="Risk Score" color={riskColor} />
        <ScoreGauge value={check.identity_confidence} label="Confianza" color="#6366f1" />
      </div>

      {/* Flags */}
      {check.flags?.length > 0 && (
        <div className="p-4 rounded-lg border border-rose-200 bg-rose-50">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm mb-2"><AlertTriangle className="h-4 w-4" /> Alertas</div>
          {check.flags.map((f: string, i: number) => (
            <div key={i} className="text-sm text-rose-600 flex items-center gap-2"><Flag className="h-3 w-3" />{f}</div>
          ))}
        </div>
      )}

      {/* Module results in tabs-like layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CURP */}
        {check.curp_validation && (
          <div className="p-5 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <IdCard className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
              <h3 className="font-bold text-slate-950">CURP</h3>
              {check.curp_validation.is_valid ?
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                <XCircle className="h-4 w-4 text-rose-500" />}
            </div>
            <div className="text-sm font-mono bg-slate-50 p-3 rounded mb-3">{check.curp_validation.curp}</div>
            <div className="text-sm text-slate-600">{check.curp_validation.message}</div>
            {check.curp_validation.components && (
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Fecha nacimiento</span><span className="text-slate-950 font-medium">{check.curp_validation.components.birth_date}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Sexo</span><span className="text-slate-950 font-medium">{check.curp_validation.components.sex}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Estado</span><span className="text-slate-950 font-medium">{check.curp_validation.components.state}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Dígito verificador</span><span className="text-slate-950 font-medium">{check.curp_validation.check_digit_valid ? '✓ Válido' : '✗ Inválido'}</span></div>
              </div>
            )}
          </div>
        )}

        {/* RFC */}
        {check.rfc_validation && (
          <div className="p-5 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
              <h3 className="font-bold text-slate-950">RFC</h3>
              {check.rfc_validation.is_valid ?
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                <XCircle className="h-4 w-4 text-rose-500" />}
            </div>
            <div className="text-sm font-mono bg-slate-50 p-3 rounded mb-3">{check.rfc_validation.rfc}</div>
            <div className="text-sm text-slate-600">{check.rfc_validation.message}</div>
            {check.rfc_validation.components && (
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Tipo</span><span className="text-slate-950 font-medium">{check.rfc_validation.type === 'fisica' ? 'Persona Física' : 'Persona Moral'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">SAT Status</span><span className={`font-medium ${check.rfc_validation.sat_status === 'ACTIVO' ? 'text-emerald-600' : 'text-rose-600'}`}>{check.rfc_validation.sat_status}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Régimen</span><span className="text-slate-950 font-medium">{check.rfc_validation.regimen_fiscal}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Government */}
        {check.government && (
          <div className="p-5 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
              <h3 className="font-bold text-slate-950">Government Intelligence</h3>
            </div>
            <div className="space-y-3">
              {check.government.renapo && (
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">RENAPO</div>
                  <div className="text-sm">{check.government.renapo.found ? <span className="text-emerald-600 font-medium">Registro vigente</span> : <span className="text-slate-500">No encontrado</span>}</div>
                </div>
              )}
              {check.government.sat && (
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">SAT</div>
                  <div className="text-sm">Status: <span className={check.government.sat.status === 'ACTIVO' ? 'text-emerald-600' : 'text-rose-600'}>{check.government.sat.status}</span></div>
                </div>
              )}
              {check.government.rnd && (
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">RND (Detenciones)</div>
                  <div className="text-sm">{check.government.rnd.sin_resultados ? <span className="text-emerald-600">Sin registros</span> : <span className="text-rose-600 font-medium">Registro encontrado</span>}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sanctions */}
        {check.sanctions && (
          <div className="p-5 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
              <h3 className="font-bold text-slate-950">Compliance Intelligence</h3>
              {check.sanctions.is_sanctioned ?
                <XCircle className="h-4 w-4 text-rose-500" /> :
                check.sanctions.is_pep ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            </div>
            <div className="text-sm mb-3">
              {check.sanctions.is_sanctioned ? <span className="text-rose-600 font-semibold">Match en listas de sanciones</span> :
               check.sanctions.is_pep ? <span className="text-amber-600 font-semibold">Persona Expuesta Políticamente (PEP)</span> :
               <span className="text-emerald-600 font-semibold">Sin coincidencias en listas restringidas</span>}
            </div>
            {check.sanctions.matches?.length > 0 && (
              <div className="space-y-2">
                {check.sanctions.matches.map((m: any, i: number) => (
                  <div key={i} className="p-2 rounded border border-slate-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-950">{m.matched_name}</span>
                      <span className="text-slate-400">{m.score}%</span>
                    </div>
                    <div className="text-slate-500">{m.list_name} · {m.type} · {m.country}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-3">{check.sanctions.lists_checked?.length || 0} listas consultadas · {check.sanctions.total_records_screened} registros</div>
          </div>
        )}

        {/* Digital Identity */}
        {check.digital_identity && (
          <div className="p-5 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Globe2 className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
              <h3 className="font-bold text-slate-950">Digital Identity Intelligence</h3>
            </div>
            <div className="space-y-3">
              {check.digital_identity.email && (
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Email</div>
                  <div className="text-sm font-mono">{check.digital_identity.email.email}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {check.digital_identity.email.is_disposable ? <span className="text-rose-600 font-semibold">DESECHEABLE</span> :
                     check.digital_identity.email.is_corporate_business ? <span className="text-emerald-600">Corporativo</span> : 'Personal'}
                    {' · '}{check.digital_identity.email.breach_count} brechas
                  </div>
                </div>
              )}
              {check.digital_identity.phone && (
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Teléfono</div>
                  <div className="text-sm">{check.digital_identity.phone.carrier} · {check.digital_identity.phone.line_type}</div>
                  {check.digital_identity.phone.is_spam_reported && <div className="text-xs text-rose-600 font-semibold">Reportado como spam</div>}
                </div>
              )}
              {check.digital_identity.username?.found && (
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Username: {check.digital_identity.username.username}</div>
                  <div className="text-sm">{check.digital_identity.username.profile_count} perfiles encontrados</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {check.digital_identity.username.profiles?.slice(0, 6).map((p: any) => (
                      <span key={p.platform} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">{p.platform}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Digital Footprint */}
        {check.digital_footprint && (
          <div className="p-5 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
              <h3 className="font-bold text-slate-950">Digital Footprint</h3>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-extrabold tracking-tighter text-slate-950">{check.digital_footprint.presence_score}</div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">Presencia digital</div>
                <div className="text-sm text-slate-600">{check.digital_footprint.social_profiles_count} social · {check.digital_footprint.developer_profiles_count} dev</div>
              </div>
            </div>
            {check.digital_footprint.professional_presence && (
              <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Presencia profesional detectada</div>
            )}
          </div>
        )}
      </div>

      {/* Relationship Graph (simplified visual) */}
      {check.relationship_graph && (
        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
            <h3 className="font-bold text-slate-950">Relationship Intelligence</h3>
            <span className="text-xs text-slate-400 ml-2">{check.relationship_graph.analysis?.total_nodes} nodos · {check.relationship_graph.analysis?.total_edges} conexiones</span>
          </div>
          {check.relationship_graph.analysis?.suspicious_patterns?.length > 0 && (
            <div className="p-3 rounded border border-rose-200 bg-rose-50 mb-4">
              {check.relationship_graph.analysis.suspicious_patterns.map((p: any, i: number) => (
                <div key={i} className="text-sm text-rose-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{p.description}</div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {check.relationship_graph.graph?.nodes?.map((n: any) => (
              <div key={n.data.id}
                className={`px-3 py-2 rounded-md border text-xs font-medium ${
                  n.data.type === 'Person' ? 'bg-slate-100 border-slate-300 text-slate-950' :
                  n.data.type === 'Email' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                  n.data.type === 'Phone' ? 'bg-cyan-50 border-cyan-200 text-cyan-700' :
                  n.data.type === 'Curp' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                  n.data.type === 'Rfc' ? 'bg-violet-50 border-violet-200 text-violet-700' :
                  n.data.type === 'SanctionMatch' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                  n.data.type === 'SocialProfile' ? 'bg-gray-50 border-gray-200 text-gray-700' :
                  'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                {n.data.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Breakdown */}
      {check.breakdown && (
        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
            <h3 className="font-bold text-slate-950">Score Breakdown</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Factores positivos (Trust)</div>
              {check.breakdown.trust_components?.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span className="text-slate-600">{c.label}</span>
                  <span className="text-emerald-600 font-semibold">+{c.points}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">Factores de riesgo</div>
              {check.breakdown.risk_components?.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span className="text-slate-600">{c.label}</span>
                  <span className="text-rose-600 font-semibold">+{c.points}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Report */}
      {check.ai_report && (
        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
            <h3 className="font-bold text-slate-950">AI Investigation Report</h3>
          </div>
          <div className="prose prose-sm max-w-none text-slate-700">
            {check.ai_report.split('\n').map((line: string, i: number) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-slate-950 mt-4 mb-2">{line.slice(3)}</h2>
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-slate-950">{line.replace(/\*\*/g, '')}</p>
              if (line.trim() === '') return <br key={i} />
              return <p key={i} className="mb-1">{line}</p>
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      {check.sources_consulted?.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Fuentes consultadas</div>
          <div className="flex flex-wrap gap-2">
            {check.sources_consulted.map((s: string, i: number) => (
              <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-slate-600">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== History ====================
function HistoryView() {
  const token = useToken()
  const { navigate } = useRouter()
  const [checks, setChecks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  useEffect(() => {
    if (token) {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (riskFilter) params.set('risk_level', riskFilter)
      API.get(`/api/checks?${params.toString()}`, token).then(d => { setChecks(Array.isArray(d) ? d : []); setLoading(false) })
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [token, search, riskFilter])

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Historial</div>
          <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950">Background Checks</h1>
        </div>
        <button onClick={() => navigate('new-check')}
          className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm">
          <Plus className="h-4 w-4" /> Nuevo Check
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            placeholder="Buscar por nombre..." />
        </div>
        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-md text-sm">
          <option value="">Todos los niveles</option>
          <option value="BAJO">Bajo</option>
          <option value="MEDIO">Medio</option>
          <option value="ALTO">Alto</option>
          <option value="CRITICO">Crítico</option>
        </select>
      </div>

      {loading ? <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-200 rounded-lg" />)}</div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Sujeto</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Trust</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Risk</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Nivel</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400"></th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c: any) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => navigate('check-results', { checkId: c.id })}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-950">{c.subject?.full_name}</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600">{c.trust_score}</td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: RISK_COLORS[c.risk_level] }}>{c.risk_score}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: RISK_COLORS[c.risk_level] }}>{c.risk_level}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{c.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3"><ArrowRight className="h-4 w-4 text-slate-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {checks.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <FileSearch className="h-8 w-8 mx-auto mb-3" />
              <p>No hay checks. Crea el primero.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== CURP Validator ====================
function CurpValidatorView() {
  const token = useToken()
  const { toast } = useToast()
  const [curp, setCurp] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const validate = async () => {
    setLoading(true)
    const data = await API.post('/api/identity/curp', { curp }, token)
    setResult(data)
    setLoading(false)
    toast({ title: data.is_valid ? 'CURP Válido' : 'CURP Inválido', description: data.message })
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Herramienta</div>
      <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950 mb-2">Validador de CURP</h1>
      <p className="text-sm text-slate-500 mb-6">Validación contra algoritmo oficial mexicano con dígito verificador.</p>

      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">CURP</label>
          <input value={curp} onChange={e => setCurp(e.target.value.toUpperCase())} maxLength={18}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-950"
            placeholder="PEGJ800101HDFRRN09" />
        </div>
        <button onClick={validate} disabled={loading || !curp}
          className="bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Validando...' : 'Validar CURP'}
        </button>
      </div>

      {result && (
        <div className={`mt-6 p-6 rounded-lg border ${result.is_valid ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            {result.is_valid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
            <span className="font-bold text-lg">{result.is_valid ? 'CURP Válido' : 'CURP Inválido'}</span>
          </div>
          <p className="text-sm">{result.message}</p>
          {result.components && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Fecha nacimiento</span><span className="font-medium">{result.components.birth_date}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sexo</span><span className="font-medium">{result.components.sex}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estado</span><span className="font-medium">{result.components.state}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Dígito verificador</span><span className="font-medium">{result.check_digit_valid ? '✓ Correcto' : '✗ Incorrecto'}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== RFC Validator ====================
function RfcValidatorView() {
  const token = useToken()
  const { toast } = useToast()
  const [rfc, setRfc] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const validate = async () => {
    setLoading(true)
    const data = await API.post('/api/identity/rfc', { rfc }, token)
    setResult(data)
    setLoading(false)
    toast({ title: data.is_valid ? 'RFC Válido' : 'RFC Inválido', description: data.message })
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Herramienta</div>
      <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950 mb-2">Validador de RFC</h1>
      <p className="text-sm text-slate-500 mb-6">Validación para persona física (13) y moral (12) con verificación SAT.</p>

      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">RFC</label>
          <input value={rfc} onChange={e => setRfc(e.target.value.toUpperCase())} maxLength={13}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-950"
            placeholder="PEGJ800101AB1" />
        </div>
        <button onClick={validate} disabled={loading || !rfc}
          className="bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Validando...' : 'Validar RFC'}
        </button>
      </div>

      {result && (
        <div className={`mt-6 p-6 rounded-lg border ${result.is_valid ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            {result.is_valid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
            <span className="font-bold text-lg">{result.is_valid ? 'RFC Válido' : 'RFC Inválido'}</span>
          </div>
          <p className="text-sm">{result.message}</p>
          {result.components && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Tipo</span><span className="font-medium">{result.type === 'fisica' ? 'Persona Física' : 'Persona Moral'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fecha</span><span className="font-medium">{result.components.date}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">SAT Status</span><span className={`font-medium ${result.sat_status === 'ACTIVO' ? 'text-emerald-600' : 'text-rose-600'}`}>{result.sat_status}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== Sanctions Screening ====================
function SanctionsView() {
  const token = useToken()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const screen = async () => {
    setLoading(true)
    const data = await API.post('/api/sanctions/screen', { full_name: name }, token)
    setResult(data)
    setLoading(false)
    toast({ title: data.is_sanctioned ? 'ALERTA' : 'Limpio', description: data.is_sanctioned ? 'Match en listas de sanciones' : data.is_pep ? 'PEP detectado' : 'Sin coincidencias' })
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Herramienta</div>
      <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950 mb-2">Screening de Sanciones</h1>
      <p className="text-sm text-slate-500 mb-6">Fuzzy matching contra OFAC, ONU, PEP, SAT 69-B, Interpol y más.</p>

      <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre completo</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
            placeholder="Juan Pérez García" />
        </div>
        <button onClick={screen} disabled={loading || !name}
          className="bg-slate-950 text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Screening...' : 'Ejecutar Screening'}
        </button>
      </div>

      {result && (
        <div className={`mt-6 p-6 rounded-lg border ${result.is_sanctioned ? 'border-rose-200 bg-rose-50' : result.is_pep ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            {result.is_sanctioned ? <XCircle className="h-5 w-5 text-rose-600" /> : result.is_pep ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            <span className="font-bold text-lg">
              {result.is_sanctioned ? 'Match en Listas de Sanciones' : result.is_pep ? 'Persona Expuesta Políticamente' : 'Sin Coincidencias'}
            </span>
          </div>

          {result.matches?.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-bold text-slate-950">Coincidencias:</h4>
              {result.matches.map((m: any, i: number) => (
                <div key={i} className="p-3 bg-white rounded border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-950">{m.matched_name}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100">{m.score}%</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{m.list_name} · {m.type} · {m.country} · {m.program}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 text-xs text-slate-400">
            {result.lists_checked?.length} listas consultadas · {result.total_records_screened} registros · Threshold: {result.threshold_used}%
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== API Docs ====================
function ApiDocsView() {
  const endpoints = [
    { method: 'POST', path: '/api/auth/register', desc: 'Crear cuenta', body: '{ email, password, fullName }' },
    { method: 'POST', path: '/api/auth/login', desc: 'Iniciar sesión', body: '{ email, password }' },
    { method: 'POST', path: '/api/identity/curp', desc: 'Validar CURP', body: '{ curp, full_name? }' },
    { method: 'POST', path: '/api/identity/rfc', desc: 'Validar RFC', body: '{ rfc }' },
    { method: 'POST', path: '/api/government/renapo', desc: 'Consulta RENAPO', body: '{ curp }' },
    { method: 'POST', path: '/api/government/sat', desc: 'Consulta SAT', body: '{ rfc }' },
    { method: 'POST', path: '/api/sanctions/screen', desc: 'Screening sanciones', body: '{ full_name, threshold? }' },
    { method: 'POST', path: '/api/digital/email', desc: 'Inteligencia de email', body: '{ email }' },
    { method: 'POST', path: '/api/digital/phone', desc: 'Inteligencia de teléfono', body: '{ phone }' },
    { method: 'POST', path: '/api/digital/username', desc: 'Descubrimiento de username', body: '{ username }' },
    { method: 'POST', path: '/api/checks', desc: 'Background check completo', body: '{ full_name, curp?, rfc?, email?, phone?, username?, include_*? }' },
    { method: 'GET', path: '/api/checks', desc: 'Listar checks', body: '?q=&risk_level=' },
    { method: 'GET', path: '/api/checks/:id', desc: 'Detalle de check', body: '' },
    { method: 'GET', path: '/api/analytics/dashboard', desc: 'Dashboard analytics', body: '' },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1.5">Documentación</div>
      <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950 mb-2">API Reference</h1>
      <p className="text-sm text-slate-500 mb-6">REST API para integraciones con CRMs, ERPs, fintechs y bancos.</p>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Method</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Endpoint</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Descripción</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Body / Params</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ep.method === 'POST' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{ep.method}</span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-950">{ep.path}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{ep.desc}</td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{ep.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 p-6 bg-slate-950 rounded-lg text-white">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Ejemplo: Background Check completo</div>
        <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">{`curl -X POST /api/checks \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "full_name": "Juan Pérez García",
    "curp": "PEGJ800101HDFRRN09",
    "rfc": "PEGJ800101AB1",
    "email": "juan@empresa.mx",
    "include_ai_report": true
  }'

# Response:
# trust_score: 92 | risk_level: BAJO | recommendation: APPROVE`}</pre>
      </div>
    </div>
  )
}

// ==================== Seed Admin User ====================
function useSeedAdmin() {
  const { token } = useAuth()
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (!seeded) {
      API.post('/api/auth/register', {
        email: 'admin@synkdata.mx', password: 'Admin2026!', fullName: 'Admin SynkData', role: 'admin', organization: 'SynkData'
      }).then(() => setSeeded(true)).catch(() => setSeeded(true))
    }
  }, [seeded])
}

// ==================== Main App ====================
export default function Home() {
  const [view, setView] = useState<View>('landing')
  const [viewData, setViewData] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const { user, login: authLogin, logout: authLogout } = useAuth()

  // After mount, read localStorage and set correct view
  useEffect(() => {
    const savedView = localStorage.getItem('synkdata_view') as View | null
    const token = localStorage.getItem('synkdata_token')
    if (token && user) {
      setView(savedView && savedView !== 'landing' && savedView !== 'login' && savedView !== 'register' ? savedView : 'dashboard')
    } else if (token && !user) {
      // Token exists but user not loaded yet - will be handled by auth provider
      setView('dashboard')
    } else {
      setView('landing')
    }
    setMounted(true)
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [])

  // Also redirect when user changes after mount
  useEffect(() => {
    if (!mounted) return
    if (user && (view === 'landing' || view === 'login' || view === 'register')) {
      setView('dashboard')
      localStorage.setItem('synkdata_view', 'dashboard')
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [user, mounted, view])

  const navigate = useCallback((v: View, data?: any) => {
    setView(v)
    setViewData(data || null)
    if (typeof window !== 'undefined') {
      localStorage.setItem('synkdata_view', v)
    }
  }, [])

  const renderView = () => {
    // If not mounted yet (SSR/hydration), show nothing
    if (!mounted) return <div className="min-h-screen bg-white" />

    switch (view) {
      case 'landing': return <LandingView />
      case 'login': return user ? <DashboardLayout><DashboardView /></DashboardLayout> : <LoginView />
      case 'register': return user ? <DashboardLayout><DashboardView /></DashboardLayout> : <RegisterView />
      case 'dashboard': return <DashboardLayout><DashboardView /></DashboardLayout>
      case 'new-check': return <DashboardLayout><NewCheckView /></DashboardLayout>
      case 'check-results': return <DashboardLayout><CheckResultsView /></DashboardLayout>
      case 'history': return <DashboardLayout><HistoryView /></DashboardLayout>
      case 'curp': return <DashboardLayout><CurpValidatorView /></DashboardLayout>
      case 'rfc': return <DashboardLayout><RfcValidatorView /></DashboardLayout>
      case 'sanctions': return <DashboardLayout><SanctionsView /></DashboardLayout>
      case 'api-docs': return <DashboardLayout><ApiDocsView /></DashboardLayout>
      default: return <LandingView />
    }
  }

  return (
    <RouterContext.Provider value={{ view, navigate, viewData }}>
      {renderView()}
    </RouterContext.Provider>
  )
}
