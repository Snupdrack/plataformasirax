/* =============================================================================
   SynkData — Chart helpers · Sirax Dark Neon Theme
   Palette: #050813 bg · #00D9FF cyan · #2563EB blue · #7C3AED violet
            #10B981 success · #F59E0B warning · #EF4444 danger
   ========================================================================== */

(function () {
  'use strict';

  const COLORS = {
    bg:       '#050813',
    surface:  '#0A0E27',
    surface2: '#0E1340',
    blue:     '#2563EB',
    blueSoft: 'rgba(37,99,235,0.15)',
    cyan:     '#00D9FF',
    cyanSoft: 'rgba(0,217,255,0.15)',
    violet:   '#7C3AED',
    success:  '#10B981',
    warning:  '#F59E0B',
    danger:   '#EF4444',
    gray:     '#4A5568',
    slate:    '#64748B',
    textDim:  '#94A3B8',
    text:     '#E2E8F0',
    border:   'rgba(255,255,255,0.07)',
    borderCyan:'rgba(0,217,255,0.15)',
  };

  // Global Chart.js defaults — dark theme
  function applyGlobalDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = COLORS.textDim;
    Chart.defaults.borderColor = COLORS.border;
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.plugins.tooltip.backgroundColor = COLORS.surface;
    Chart.defaults.plugins.tooltip.borderColor = COLORS.borderCyan;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.titleColor = COLORS.cyan;
    Chart.defaults.plugins.tooltip.bodyColor = COLORS.text;
    Chart.defaults.plugins.tooltip.titleFont = { size: 12, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont  = { size: 12 };
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    Chart.defaults.plugins.tooltip.caretSize = 6;
  }

  function scoreColor(score, inverse) {
    const n = parseFloat(score);
    if (isNaN(n)) return COLORS.slate;
    if (inverse) {
      if (n >= 70) return COLORS.danger;
      if (n >= 40) return COLORS.warning;
      return COLORS.success;
    }
    if (n >= 70) return COLORS.success;
    if (n >= 40) return COLORS.warning;
    return COLORS.danger;
  }

  /* ── Gauge (doughnut arc) ───────────────────────────────────────────────── */
  function _gauge(canvasId, score, opts) {
    opts = opts || {};
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    applyGlobalDefaults();

    const value = Math.max(0, Math.min(100, parseFloat(score) || 0));
    const color = opts.color || scoreColor(value, opts.inverse);
    const label = opts.label || '';

    if (el._chart) el._chart.destroy();
    const ctx = el.getContext('2d');

    // Glow gradient arc
    const grad = ctx.createLinearGradient(0, 0, el.width || 200, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + 'AA');

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [value, Math.max(0, 100 - value)],
          backgroundColor: [grad, 'rgba(255,255,255,0.04)'],
          borderWidth: 0,
          circumference: 270,
          rotation: 225,
          cutout: '80%',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 1000, easing: 'easeOutQuart' },
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      },
      plugins: [{
        id: 'sirax-gauge-center',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const cx = (chartArea.left + chartArea.right) / 2;
          const cy = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Glow effect
          ctx.shadowColor = color;
          ctx.shadowBlur = 16;
          ctx.fillStyle = color;
          ctx.font = '700 30px Inter, sans-serif';
          ctx.fillText(Math.round(value), cx, cy - 6);

          ctx.shadowBlur = 0;
          ctx.fillStyle = COLORS.textDim;
          ctx.font = '600 10px Inter, sans-serif';
          ctx.fillText(label || '/ 100', cx, cy + 16);
          ctx.restore();
        }
      }]
    });
    el._chart = chart;
    return chart;
  }

  function riskGauge(canvasId, score) {
    return _gauge(canvasId, score, {
      color: scoreColor(score, true),
      label: 'Risk Score',
      inverse: true
    });
  }

  function trustGauge(canvasId, score) {
    return _gauge(canvasId, score, {
      color: scoreColor(score, false),
      label: 'Trust Score',
      inverse: false
    });
  }

  /* ── Risk distribution donut ────────────────────────────────────────────── */
  function riskDistribution(canvasId, data) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    applyGlobalDefaults();
    if (el._chart) el._chart.destroy();

    const d = data || { approve: 0, review: 0, reject: 0 };
    const total = (d.approve || 0) + (d.review || 0) + (d.reject || 0);
    const ctx = el.getContext('2d');

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Aprobado', 'Revisión', 'Rechazado'],
        datasets: [{
          data: [d.approve || 0, d.review || 0, d.reject || 0],
          backgroundColor: [
            'rgba(16,185,129,0.85)',
            'rgba(245,158,11,0.85)',
            'rgba(239,68,68,0.85)',
          ],
          hoverBackgroundColor: [COLORS.success, COLORS.warning, COLORS.danger],
          borderColor: COLORS.surface,
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: { duration: 900, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10, boxHeight: 10, padding: 16,
              font: { size: 12, weight: '500' },
              color: COLORS.textDim,
              usePointStyle: true, pointStyle: 'circle',
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.parsed;
                const pct = total ? Math.round((v / total) * 100) : 0;
                return `  ${ctx.label}: ${v} (${pct}%)`;
              }
            }
          }
        }
      },
      plugins: [{
        id: 'sirax-donut-center',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const cx = (chartArea.left + chartArea.right) / 2;
          const cy = (chartArea.top + chartArea.bottom) / 2 - 10;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = COLORS.text;
          ctx.font = '700 26px Inter, sans-serif';
          ctx.fillText(total, cx, cy);
          ctx.fillStyle = COLORS.textDim;
          ctx.font = '500 11px Inter, sans-serif';
          ctx.fillText('Total', cx, cy + 20);
          ctx.restore();
        }
      }]
    });
    el._chart = chart;
    return chart;
  }

  /* ── Trends line chart ──────────────────────────────────────────────────── */
  function trendsChart(canvasId, data) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    applyGlobalDefaults();
    if (el._chart) el._chart.destroy();

    const rows   = Array.isArray(data) ? data : [];
    const labels = rows.map(r => {
      const d = r.day ? new Date(r.day) : null;
      if (!d || isNaN(d.getTime())) return '';
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const counts = rows.map(r => r.count    || 0);
    const risks  = rows.map(r => r.avg_risk || 0);
    const ctx    = el.getContext('2d');

    const blueGrad = ctx.createLinearGradient(0, 0, 0, 280);
    blueGrad.addColorStop(0,   'rgba(37,99,235,0.35)');
    blueGrad.addColorStop(1,   'rgba(37,99,235,0.00)');

    const cyanGrad = ctx.createLinearGradient(0, 0, 0, 280);
    cyanGrad.addColorStop(0,   'rgba(0,217,255,0.2)');
    cyanGrad.addColorStop(1,   'rgba(0,217,255,0.00)');

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Verificaciones',
            data: counts,
            borderColor: COLORS.blue,
            backgroundColor: blueGrad,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: COLORS.blue,
            pointHoverBorderColor: COLORS.surface,
            pointHoverBorderWidth: 2,
            tension: 0.4,
            fill: true,
            yAxisID: 'y',
          },
          {
            label: 'Riesgo promedio',
            data: risks,
            borderColor: COLORS.cyan,
            backgroundColor: cyanGrad,
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: COLORS.cyan,
            pointHoverBorderColor: COLORS.surface,
            pointHoverBorderWidth: 2,
            tension: 0.4,
            fill: false,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 900, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: {
              boxWidth: 10, boxHeight: 10, padding: 16,
              usePointStyle: true, pointStyle: 'circle',
              font: { size: 12, weight: '500' },
              color: COLORS.textDim,
            }
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: COLORS.slate, font: { size: 11 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: COLORS.slate, font: { size: 11 }, precision: 0 },
          },
          y1: {
            position: 'right',
            beginAtZero: true, max: 100,
            grid: { drawOnChartArea: false, drawBorder: false },
            ticks: { color: COLORS.slate, font: { size: 11 } },
          }
        }
      }
    });
    el._chart = chart;
    return chart;
  }

  /* ── Sparkline ──────────────────────────────────────────────────────────── */
  function sparkline(canvasId, values, color) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    if (el._chart) el._chart.destroy();
    const ctx = el.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, el.height || 40);
    grad.addColorStop(0, (color || COLORS.cyan) + '33');
    grad.addColorStop(1, (color || COLORS.cyan) + '00');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: values.map((_, i) => i),
        datasets: [{
          data: values,
          borderColor: color || COLORS.cyan,
          backgroundColor: grad,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
    el._chart = chart;
    return chart;
  }

  /* ── Bar chart for region/category distribution ─────────────────────────── */
  function barChart(canvasId, labels, values, opts) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    applyGlobalDefaults();
    if (el._chart) el._chart.destroy();
    opts = opts || {};
    const ctx = el.getContext('2d');

    const colors = values.map((_, i) => {
      const palette = [COLORS.blue, COLORS.cyan, COLORS.violet, COLORS.success, COLORS.warning];
      return palette[i % palette.length] + 'CC';
    });

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: opts.label || 'Valor',
          data: values,
          backgroundColor: colors,
          borderColor: colors.map(c => c.slice(0,7)),
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.textDim, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: COLORS.textDim, font: { size: 11 }, precision: 0 },
          }
        }
      }
    });
    el._chart = chart;
    return chart;
  }

  window.SynkCharts = {
    COLORS,
    scoreColor,
    riskGauge,
    trustGauge,
    riskDistribution,
    trendsChart,
    sparkline,
    barChart,
    applyGlobalDefaults,
  };
})();
