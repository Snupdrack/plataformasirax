/* =============================================================================
   SynkData — Shared JavaScript utilities + Alpine.js components
   --------------------------------------------------------------------------
   Exposes:
     window.api           — fetch wrapper with JWT auth and 401 handling
     window.showToast     — toast notifications
     window.formatDate    — ISO → Spanish date
     window.formatScore   — score with color coding
     window.getUser       — current user from localStorage
     window.requireAuth   — redirect to /login if unauthenticated
     window.logout        — clears session and redirects

   Alpine.js components:
     loginForm(), adminPanel(), clientDashboard(), verificationModal()
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------------
   * Storage keys
   * ------------------------------------------------------------------------- */
  const TOKEN_KEY = 'synkdata_token';
  const USER_KEY = 'synkdata_user';

  /* ---------------------------------------------------------------------------
   * API wrapper
   * ------------------------------------------------------------------------- */
  const API_BASE = '/api/v1';

  function _headers(extra) {
    const headers = Object.assign({}, extra || {});
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async function _request(method, url, body, opts) {
    opts = opts || {};
    const finalUrl = url.startsWith('http') || url.startsWith('/api')
      ? url
      : `${API_BASE}${url}`;

    const init = { method, headers: _headers(opts.headers), credentials: 'same-origin' };

    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        init.body = body;
      } else {
        init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
    }

    let response;
    try {
      response = await fetch(finalUrl, init);
    } catch (networkErr) {
      showToast('Error de red', 'No se pudo conectar con el servidor. Intente más tarde.', 'error');
      throw networkErr;
    }

    if (response.status === 401) {
      // Token invalid or expired
      _clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        showToast('Sesión expirada', 'Debe iniciar sesión nuevamente.', 'warning');
        window.location.href = '/login';
      }
      const err = new Error('No autorizado');
      err.status = 401;
      throw err;
    }

    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await response.json().catch(() => null);
    } else if (response.status !== 204) {
      payload = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const detail = (payload && (payload.detail || payload.message)) ||
        `Error ${response.status}`;
      const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  const api = {
    get:  (url, opts)         => _request('GET',    url, null, opts),
    post: (url, data, opts)   => _request('POST',   url, data, opts),
    patch:(url, data, opts)   => _request('PATCH',  url, data, opts),
    put:  (url, data, opts)   => _request('PUT',    url, data, opts),
    delete:(url, opts)        => _request('DELETE', url, null, opts),
    raw:  _request,
    API_BASE
  };
  window.api = api;

  /* ---------------------------------------------------------------------------
   * Session helpers
   * ------------------------------------------------------------------------- */
  function _clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }
  window.getUser = getUser;

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  window.setSession = setSession;

  function requireAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = getUser();
    if (!token || !user) {
      _clearSession();
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
      return false;
    }
    return true;
  }
  window.requireAuth = requireAuth;

  async function logout() {
    // Best-effort server-side revoke; ignore errors so user always exits.
    try { await api.post('/auth/logout', {}); } catch (_e) { /* ignore */ }
    _clearSession();
    window.location.href = '/';
  }
  window.logout = logout;

  /* ---------------------------------------------------------------------------
   * Toast notifications
   * ------------------------------------------------------------------------- */
  function _ensureToaster() {
    let el = document.getElementById('sd-toaster');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sd-toaster';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    return el;
  }

  const TOAST_ICONS = {
    success: '<svg class="sd-toast-icon" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error:   '<svg class="sd-toast-icon" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg class="sd-toast-icon" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info:    '<svg class="sd-toast-icon" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const TOAST_TITLES = {
    success: 'Correcto',
    error: 'Error',
    warning: 'Atención',
    info: 'Información'
  };

  function showToast(message, options, type) {
    // Allow showToast(message, type) shorthand
    if (typeof options === 'string') { type = options; options = {}; }
    options = options || {};
    type = type || 'info';
    const title = options.title || TOAST_TITLES[type] || 'Aviso';
    const duration = options.duration || 4200;

    const toaster = _ensureToaster();
    const toast = document.createElement('div');
    toast.className = `sd-toast sd-toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      ${TOAST_ICONS[type] || TOAST_ICONS.info}
      <div class="flex-1 min-w-0">
        <div class="sd-toast-title">${escapeHtml(title)}</div>
        ${message ? `<div class="sd-toast-message">${escapeHtml(String(message))}</div>` : ''}
      </div>
      <button class="text-slate-400 hover:text-slate-600 transition" aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    const close = () => {
      toast.classList.add('sd-toast-leave');
      setTimeout(() => toast.remove(), 280);
    };
    toast.querySelector('button').addEventListener('click', close);
    toaster.appendChild(toast);
    if (duration > 0) setTimeout(close, duration);
    return toast;
  }
  window.showToast = showToast;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  window.escapeHtml = escapeHtml;

  /* ---------------------------------------------------------------------------
   * Formatters
   * ------------------------------------------------------------------------- */
  const MONTHS_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  function formatDate(date, opts) {
    opts = opts || {};
    if (!date) return opts.fallback || '—';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return opts.fallback || '—';

    const day = d.getDate();
    const month = MONTHS_ES[d.getMonth()];
    const year = d.getFullYear();
    if (opts.dateOnly) return `${day} de ${month} de ${year}`;

    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  }
  window.formatDate = formatDate;

  function formatRelative(date) {
    if (!date) return '—';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'hace unos segundos';
    const min = Math.floor(sec / 60);
    if (min < 60) return `hace ${min} min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `hace ${hr} h`;
    const days = Math.floor(hr / 24);
    if (days < 30) return `hace ${days} d`;
    return formatDate(date, { dateOnly: true });
  }
  window.formatRelative = formatRelative;

  function formatScore(score, opts) {
    opts = opts || {};
    const n = (typeof score === 'number') ? score : parseFloat(score);
    if (isNaN(n)) return opts.fallback || '—';
    const rounded = Math.round(n * 10) / 10;
    return rounded.toFixed(opts.decimals != null ? opts.decimals : 1);
  }
  window.formatScore = formatScore;

  function scoreColor(score, inverse) {
    // inverse=true → for risk (higher = worse)
    const n = parseFloat(score);
    if (isNaN(n)) return '#94A3B8';
    if (inverse) {
      if (n >= 70) return '#EF4444';
      if (n >= 40) return '#F59E0B';
      return '#10B981';
    }
    if (n >= 70) return '#10B981';
    if (n >= 40) return '#F59E0B';
    return '#EF4444';
  }
  window.scoreColor = scoreColor;

  function recommendationBadge(rec) {
    const r = String(rec || '').toUpperCase();
    if (r === 'APPROVE' || r === 'APROBAR' || r === 'OK')
      return { cls: 'sd-badge-success', label: 'APROBAR', dot: '#10B981' };
    if (r === 'REVIEW' || r === 'REVISAR')
      return { cls: 'sd-badge-warning', label: 'REVISAR', dot: '#F59E0B' };
    if (r === 'REJECT' || r === 'RECHAZAR')
      return { cls: 'sd-badge-danger', label: 'RECHAZAR', dot: '#EF4444' };
    return { cls: 'sd-badge-neutral', label: r || 'N/A', dot: '#94A3B8' };
  }
  window.recommendationBadge = recommendationBadge;

  function initials(name) {
    if (!name) return '??';
    return name.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(s => s[0].toUpperCase()).join('');
  }
  window.initials = initials;

  /* ---------------------------------------------------------------------------
   * Skeleton helper
   * ------------------------------------------------------------------------- */
  function skeletonRows(count, cols) {
    return Array.from({ length: count }).map(() =>
      `<tr>${Array.from({ length: cols }).map(() =>
        `<td><div class="sd-skeleton" style="height:14px;width:80%"></div></td>`).join('')}</tr>`
    ).join('');
  }
  window.skeletonRows = skeletonRows;

  /* ===========================================================================
   * Alpine.js components
   * ======================================================================== */

  /* ---- loginForm --------------------------------------------------------- */
  window.loginForm = function loginForm(nextPath) {
    return {
      email: '',
      password: '',
      showPassword: false,
      loading: false,
      error: '',
      nextPath: nextPath || '',

      init() {
        // Pre-fill from querystring handled server-side via data attr fallback
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        if (next) this.nextPath = next;
      },

      get emailValid() {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
      },
      get passwordValid() { return this.password.length >= 1; },
      get formValid() { return this.emailValid && this.passwordValid; },

      async submit() {
        this.error = '';
        if (!this.formValid) {
          this.error = 'Verifique su correo electrónico y contraseña.';
          return;
        }
        this.loading = true;
        try {
          const data = await api.post('/auth/login', {
            email: this.email.trim(),
            password: this.password
          });
          if (!data || !data.access_token) throw new Error('Respuesta inválida del servidor.');
          setSession(data.access_token, data.user);
          showToast(`Bienvenido(a), ${data.user.full_name.split(' ')[0]}`, 'success');

          const role = (data.user.role || '').toUpperCase();
          let target = this.nextPath;
          if (!target || target === '/login') {
            target = role === 'ADMIN' ? '/admin' : '/dashboard';
          }
          setTimeout(() => { window.location.href = target; }, 350);
        } catch (err) {
          this.error = err.message || 'No se pudo iniciar sesión.';
        } finally {
          this.loading = false;
        }
      }
    };
  };

  /* ---- adminPanel -------------------------------------------------------- */
  window.adminPanel = function adminPanel(user) {
    return {
      user: user || getUser(),
      activeTab: 'dashboard',
      mobileSidebarOpen: false,
      loadingStats: true,
      stats: null,
      statsError: '',

      // access requests
      loadingRequests: true,
      requests: [],
      requestsFilter: 'PENDING',
      requestsError: '',

      // users
      loadingUsers: true,
      users: [],
      usersError: '',
      userSearch: '',
      userRoleFilter: '',
      userStatusFilter: '',

      // activity
      loadingActivity: true,
      activity: [],
      activityError: '',

      // modals
      approveModal: { open: false, request: null, loading: false, form: { password: '', role: 'CLIENT' } },
      rejectModal: { open: false, request: null, loading: false, reason: '' },
      userDetailModal: { open: false, loading: false, user: null, detail: null },

      init() {
        if (!requireAuth()) return;
        // Ensure ADMIN role
        if (this.user && this.user.role !== 'ADMIN') {
          showToast('Acceso denegado', 'Su cuenta no tiene permisos de administrador.', 'error');
          setTimeout(() => { window.location.href = '/dashboard'; }, 800);
          return;
        }
        this.loadAll();
        this.$watch('requestsFilter', () => this.loadRequests());
      },

      async loadAll() {
        await Promise.allSettled([
          this.loadStats(),
          this.loadRequests(),
          this.loadUsers(),
          this.loadActivity()
        ]);
      },

      async loadStats() {
        this.loadingStats = true; this.statsError = '';
        try {
          this.stats = await api.get('/admin/stats');
        } catch (e) {
          this.statsError = e.message || 'Error al cargar estadísticas.';
        } finally { this.loadingStats = false; }
      },

      async loadRequests() {
        this.loadingRequests = true; this.requestsError = '';
        try {
          const qs = this.requestsFilter ? `?status=${this.requestsFilter}` : '';
          this.requests = await api.get(`/admin/access-requests${qs}`);
        } catch (e) {
          this.requestsError = e.message || 'Error al cargar solicitudes.';
        } finally { this.loadingRequests = false; }
      },

      async loadUsers() {
        this.loadingUsers = true; this.usersError = '';
        try {
          const params = new URLSearchParams();
          if (this.userRoleFilter) params.set('role', this.userRoleFilter);
          params.set('limit', '200');
          this.users = await api.get(`/admin/users?${params.toString()}`);
        } catch (e) {
          this.usersError = e.message || 'Error al cargar usuarios.';
        } finally { this.loadingUsers = false; }
      },

      async loadActivity() {
        this.loadingActivity = true; this.activityError = '';
        try {
          this.activity = await api.get('/admin/activity?limit=20');
        } catch (e) {
          this.activityError = e.message || 'Error al cargar actividad.';
        } finally { this.loadingActivity = false; }
      },

      get filteredUsers() {
        let list = this.users || [];
        if (this.userStatusFilter === 'active')   list = list.filter(u => u.is_active);
        if (this.userStatusFilter === 'inactive') list = list.filter(u => !u.is_active);
        const q = this.userSearch.trim().toLowerCase();
        if (q) {
          list = list.filter(u =>
            (u.full_name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.company || '').toLowerCase().includes(q)
          );
        }
        return list;
      },

      openApprove(req) {
        this.approveModal = {
          open: true, request: req, loading: false,
          form: { password: this._genPassword(), role: 'CLIENT' }
        };
      },
      async confirmApprove() {
        if (!this.approveModal.request) return;
        const f = this.approveModal.form;
        if (!f.password || f.password.length < 8) {
          showToast('La contraseña debe tener al menos 8 caracteres.', 'error');
          return;
        }
        this.approveModal.loading = true;
        try {
          const req = this.approveModal.request;
          // First, mark the access request as APPROVED
          await api.patch(`/admin/access-requests/${req.id}`, {
            status: 'APPROVED',
            admin_notes: 'Cuenta creada desde el panel de administración.'
          });
          // Then create the user
          const payload = {
            email: req.email,
            full_name: req.full_name,
            phone: req.phone || null,
            company: req.company || null,
            position: req.position || null,
            curp: req.curp || null,
            rfc: req.rfc || null,
            password: f.password,
            role: f.role,
            from_access_request_id: req.id
          };
          await api.post('/admin/users', payload);
          showToast('Usuario creado y solicitud aprobada.', 'success');
          this.approveModal.open = false;
          await this.loadAll();
        } catch (e) {
          showToast(e.message || 'Error al aprobar la solicitud.', 'error');
        } finally {
          this.approveModal.loading = false;
        }
      },

      openReject(req) {
        this.rejectModal = { open: true, request: req, loading: false, reason: '' };
      },
      async confirmReject() {
        if (!this.rejectModal.request) return;
        if (!this.rejectModal.reason.trim()) {
          showToast('Debe indicar un motivo de rechazo.', 'warning');
          return;
        }
        this.rejectModal.loading = true;
        try {
          await api.patch(`/admin/access-requests/${this.rejectModal.request.id}`, {
            status: 'REJECTED',
            rejection_reason: this.rejectModal.reason.trim()
          });
          showToast('Solicitud rechazada.', 'success');
          this.rejectModal.open = false;
          await this.loadRequests();
          await this.loadStats();
        } catch (e) {
          showToast(e.message || 'Error al rechazar la solicitud.', 'error');
        } finally {
          this.rejectModal.loading = false;
        }
      },

      async viewRequest(req) {
        try {
          const detail = await api.get(`/admin/access-requests/${req.id}`);
          this.userDetailModal = { open: true, loading: false, user: null, detail, mode: 'request' };
        } catch (e) {
          showToast(e.message || 'No se pudo cargar el detalle.', 'error');
        }
      },

      async viewUser(user) {
        this.userDetailModal = { open: true, loading: true, user, detail: null, mode: 'user' };
        try {
          this.userDetailModal.detail = await api.get(`/admin/users/${user.id}`);
        } catch (e) {
          showToast(e.message || 'No se pudo cargar el detalle del usuario.', 'error');
        } finally {
          this.userDetailModal.loading = false;
        }
      },

      async toggleUserActive(user) {
        if (!confirm(user.is_active
          ? `¿Desactivar a ${user.full_name}?`
          : `¿Reactivar a ${user.full_name}?`)) return;
        try {
          if (user.is_active) {
            await api.delete(`/admin/users/${user.id}`);
            showToast('Usuario desactivado.', 'success');
          } else {
            await api.patch(`/admin/users/${user.id}`, {});
            showToast('Usuario reactivado.', 'success');
          }
          await this.loadUsers();
        } catch (e) {
          showToast(e.message || 'Error al cambiar el estado del usuario.', 'error');
        }
      },

      async exportUsers() {
        try {
          const token = localStorage.getItem(TOKEN_KEY);
          const resp = await fetch(`${API_BASE}/admin/users/export?format=csv`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!resp.ok) throw new Error('No se pudo exportar.');
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'synkdata_usuarios.csv';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (e) {
          showToast(e.message || 'Error al exportar.', 'error');
        }
      },

      _genPassword() {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let out = 'Sd';
        for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
        out += '1!';
        return out;
      },

      switchTab(tab) {
        this.activeTab = tab;
        this.mobileSidebarOpen = false;
      },

      async doLogout() { await logout(); }
    };
  };

  /* ---- clientDashboard --------------------------------------------------- */
  window.clientDashboard = function clientDashboard(user) {
    return {
      user: user || getUser(),
      activeTab: 'overview',
      mobileSidebarOpen: false,

      loadingOverview: true,
      overview: null,
      overviewError: '',

      loadingVerifications: true,
      verifications: [],
      verificationsError: '',

      loadingRisk: true,
      riskSummary: null,
      riskError: '',

      loadingAnalytics: true,
      analytics: null,
      analyticsError: '',

      // New verification modal
      verifyModal: {
        open: false,
        loading: false,
        form: { curp: '', rfc: '', name: '', birth_date: '', gender: '' },
        result: null,
        error: ''
      },

      // Verification detail modal
      detailModal: { open: false, loading: false, item: null, detail: null },

      // Charts
      _riskChart: null,
      _trendChart: null,

      init() {
        if (!requireAuth()) return;
        this.loadAll();
        this.$watch('activeTab', (tab) => {
          // Re-render charts when entering the risk tab, since canvases
          // inside x-show="false" containers may have 0 dimensions on
          // initial load. Chart.js (responsive) will re-fit on resize.
          if (tab === 'risk') {
            this.$nextTick(() => this._renderCharts());
          }
        });
      },

      async loadAll() {
        await Promise.allSettled([
          this.loadOverview(),
          this.loadVerifications(),
          this.loadRisk(),
          this.loadAnalytics()
        ]);
      },

      async loadOverview() {
        this.loadingOverview = true; this.overviewError = '';
        try {
          this.overview = await api.get('/dashboard/overview');
        } catch (e) { this.overviewError = e.message; }
        finally { this.loadingOverview = false; }
      },

      async loadVerifications() {
        this.loadingVerifications = true; this.verificationsError = '';
        try {
          this.verifications = await api.get('/dashboard/verifications?limit=20');
        } catch (e) { this.verificationsError = e.message; }
        finally { this.loadingVerifications = false; }
      },

      async loadRisk() {
        this.loadingRisk = true; this.riskError = '';
        try {
          this.riskSummary = await api.get('/dashboard/risk-summary');
        } catch (e) { this.riskError = e.message; }
        finally { this.loadingRisk = false; }
      },

      async loadAnalytics() {
        this.loadingAnalytics = true; this.analyticsError = '';
        try {
          this.analytics = await api.get('/dashboard/analytics');
          this.$nextTick(() => this._renderCharts());
        } catch (e) { this.analyticsError = e.message; }
        finally { this.loadingAnalytics = false; }
      },

      get approvalRate() {
        const r = this.riskSummary;
        if (!r || !r.total_assessments) return 0;
        return Math.round((r.approve_count / r.total_assessments) * 1000) / 10;
      },

      get riskDistribution() {
        const r = this.riskSummary;
        if (!r) return { approve: 0, review: 0, reject: 0 };
        return {
          approve: r.approve_count || 0,
          review: r.review_count || 0,
          reject: r.reject_count || 0
        };
      },

      openVerifyModal(prefill) {
        this.verifyModal = {
          open: true, loading: false,
          form: Object.assign({ curp: '', rfc: '', name: '', birth_date: '', gender: '' }, prefill || {}),
          result: null, error: ''
        };
      },

      async submitVerification() {
        const f = this.verifyModal.form;
        if (!f.curp && !f.rfc && !f.name) {
          this.verifyModal.error = 'Proporcione al menos CURP, RFC o nombre.';
          return;
        }
        this.verifyModal.loading = true;
        this.verifyModal.error = '';
        this.verifyModal.result = null;
        try {
          const payload = {};
          if (f.curp) payload.curp = f.curp.toUpperCase().trim();
          if (f.rfc)  payload.rfc  = f.rfc.toUpperCase().trim();
          if (f.name) payload.name = f.name.trim();
          if (f.birth_date) payload.birth_date = f.birth_date;
          if (f.gender) payload.gender = f.gender;
          const result = await api.post('/verify/', payload);
          this.verifyModal.result = result;
          showToast('Verificación completada.', 'success');
        } catch (e) {
          this.verifyModal.error = e.message || 'Error durante la verificación.';
        } finally {
          this.verifyModal.loading = false;
        }
      },

      closeVerifyModal() {
        this.verifyModal.open = false;
        // Refresh lists after a successful verification
        if (this.verifyModal.result) {
          this.loadOverview();
          this.loadVerifications();
          this.loadRisk();
        }
      },

      async viewVerification(item) {
        this.detailModal = { open: true, loading: true, item, detail: null };
        try {
          this.detailModal.detail = await api.get(`/dashboard/verifications/${item.id}`);
          this.$nextTick(() => {
            if (window.SynkCharts) {
              const d = this.detailModal.detail;
              if (d) {
                window.SynkCharts.trustGauge('detail-trust-gauge', d.trust_score);
                window.SynkCharts.riskGauge('detail-risk-gauge', d.risk_score);
              }
            }
          });
        } catch (e) {
          showToast(e.message || 'No se pudo cargar el detalle.', 'error');
        } finally {
          this.detailModal.loading = false;
        }
      },

      async saveProfile(fields) {
        try {
          const updated = await api.patch('/auth/me', fields);
          this.user = updated;
          setSession(localStorage.getItem(TOKEN_KEY), updated);
          showToast('Perfil actualizado.', 'success');
          return true;
        } catch (e) {
          showToast(e.message || 'Error al guardar el perfil.', 'error');
          return false;
        }
      },

      async changePassword(currentPwd, newPwd) {
        try {
          await api.post('/auth/change-password', {
            current_password: currentPwd,
            new_password: newPwd
          });
          showToast('Contraseña actualizada.', 'success');
          return true;
        } catch (e) {
          showToast(e.message || 'Error al cambiar la contraseña.', 'error');
          return false;
        }
      },

      switchTab(tab) {
        this.activeTab = tab;
        this.mobileSidebarOpen = false;
      },

      _renderCharts() {
        if (!window.SynkCharts) return;
        if (this.riskSummary) {
          this._riskChart = window.SynkCharts.riskDistribution(
            'risk-distribution-chart', this.riskDistribution
          );
          // Secondary chart (shown in risk-analysis tab). No-op if canvas not present.
          window.SynkCharts.riskDistribution(
            'risk-distribution-chart-2', this.riskDistribution
          );
        }
        if (this.analytics && this.analytics.risk_trend && this.analytics.risk_trend.length) {
          this._trendChart = window.SynkCharts.trendsChart(
            'risk-trend-chart', this.analytics.risk_trend
          );
        }
      },

      async doLogout() { await logout(); }
    };
  };

  /* ---- verificationModal (reusable for inline verification) ------------- */
  window.verificationModal = function verificationModal() {
    return {
      open: false,
      loading: false,
      form: { curp: '', rfc: '', name: '', birth_date: '', gender: '' },
      result: null,
      error: '',

      show(prefill) {
        this.form = Object.assign({ curp: '', rfc: '', name: '', birth_date: '', gender: '' }, prefill || {});
        this.result = null; this.error = ''; this.open = true;
      },

      async submit() {
        const f = this.form;
        if (!f.curp && !f.rfc && !f.name) {
          this.error = 'Proporcione al menos CURP, RFC o nombre.';
          return;
        }
        this.loading = true; this.error = ''; this.result = null;
        try {
          const payload = {};
          if (f.curp) payload.curp = f.curp.toUpperCase().trim();
          if (f.rfc)  payload.rfc  = f.rfc.toUpperCase().trim();
          if (f.name) payload.name = f.name.trim();
          if (f.birth_date) payload.birth_date = f.birth_date;
          if (f.gender) payload.gender = f.gender;
          this.result = await api.post('/verify/', payload);
          this.$dispatch('verification-complete', this.result);
        } catch (e) {
          this.error = e.message || 'Error durante la verificación.';
        } finally {
          this.loading = false;
        }
      },

      close() { this.open = false; }
    };
  };

  /* ---------------------------------------------------------------------------
   * Profile editor (used in dashboard profile tab)
   * ------------------------------------------------------------------------- */
  window.profileEditor = function profileEditor(parent) {
    return {
      parent: parent,
      editing: false,
      saving: false,
      form: { full_name: '', company: '', phone: '', position: '' },
      pwd: { current: '', next: '', confirm: '', saving: false },

      init() {
        const u = this.parent.user || {};
        this.form = {
          full_name: u.full_name || '',
          company: u.company || '',
          phone: u.phone || '',
          position: u.position || ''
        };
      },

      toggleEdit() { this.editing = !this.editing; if (this.editing) this.init(); },

      async save() {
        this.saving = true;
        const ok = await this.parent.saveProfile(this.form);
        this.saving = false;
        if (ok) this.editing = false;
      },

      async savePassword() {
        if (this.pwd.next !== this.pwd.confirm) {
          showToast('Las contraseñas no coinciden.', 'warning');
          return;
        }
        if (this.pwd.next.length < 8) {
          showToast('La contraseña debe tener al menos 8 caracteres.', 'warning');
          return;
        }
        this.pwd.saving = true;
        const ok = await this.parent.changePassword(this.pwd.current, this.pwd.next);
        this.pwd.saving = false;
        if (ok) {
          this.pwd = { current: '', next: '', confirm: '', saving: false };
        }
      }
    };
  };

})();
