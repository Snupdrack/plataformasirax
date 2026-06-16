/* =============================================================================
   SynkData — Chart helpers built on Chart.js (loaded via CDN)
   --------------------------------------------------------------------------
   Exposes window.SynkCharts with:
     riskGauge(canvasId, score)            — circular gauge 0-100
     trustGauge(canvasId, score)           — circular gauge 0-100
     riskDistribution(canvasId, data)      — donut chart
     trendsChart(canvasId, data)           — line chart for risk trend
     color helpers
   ========================================================================== */

(function () {
  'use strict';

  const COLORS = {
    navy:    '#0A0E27',
    blue:    '#2563EB',
    blueSoft:'rgba(37, 99, 235, 0.15)',
    cyan:    '#00D9FF',
    success: '#10B981',
    warning: '#F59E0B',
    danger:  '#EF4444',
    gray:    '#64748B',
    slate:   '#94A3B8',
    border:  '#E2E8F0'
  };

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

  function _gauge(canvasId, score, opts) {
    opts = opts || {};
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    const value = Math.max(0, Math.min(100, parseFloat(score) || 0));
    const color = opts.color || scoreColor(value, opts.inverse);
    const label = opts.label || '';

    // Destroy previous instance if re-rendering
    if (el._chart) { el._chart.destroy(); }

    const ctx = el.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [value, Math.max(0, 100 - value)],
          backgroundColor: [color, 'rgba(226, 232, 240, 0.65)'],
          borderWidth: 0,
          circumference: 270,
          rotation: 225,
          cutout: '78%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 900, easing: 'easeOutQuart' },
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      },
      plugins: [{
        id: 'synkdata-gauge-center',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const cx = (chartArea.left + chartArea.right) / 2;
          const cy = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = COLORS.navy;
          ctx.font = '700 30px Inter, sans-serif';
          ctx.fillText(Math.round(value), cx, cy - 6);
          ctx.fillStyle = COLORS.gray;
          ctx.font = '600 11px Inter, sans-serif';
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
      label: 'Riesgo / 100',
      inverse: true
    });
  }

  function trustGauge(canvasId, score) {
    return _gauge(canvasId, score, {
      color: scoreColor(score, false),
      label: 'Confianza / 100',
      inverse: false
    });
  }

  function riskDistribution(canvasId, data) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    if (el._chart) { el._chart.destroy(); }
    const d = data || { approve: 0, review: 0, reject: 0 };
    const total = (d.approve || 0) + (d.review || 0) + (d.reject || 0);
    const ctx = el.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Aprobar', 'Revisar', 'Rechazar'],
        datasets: [{
          data: [d.approve || 0, d.review || 0, d.reject || 0],
          backgroundColor: [COLORS.success, COLORS.warning, COLORS.danger],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10, boxHeight: 10, padding: 14,
              font: { family: 'Inter', size: 12, weight: '500' },
              color: '#475569', usePointStyle: true, pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: COLORS.navy,
            padding: 12,
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyFont:  { family: 'Inter', size: 12 },
            callbacks: {
              label(ctx) {
                const v = ctx.parsed;
                const pct = total ? Math.round((v / total) * 100) : 0;
                return `${ctx.label}: ${v} (${pct}%)`;
              }
            }
          }
        }
      }
    });
    el._chart = chart;
    return chart;
  }

  function trendsChart(canvasId, data) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    if (el._chart) { el._chart.destroy(); }
    const rows = Array.isArray(data) ? data : [];
    const labels = rows.map(r => {
      const d = r.day ? new Date(r.day) : null;
      if (!d || isNaN(d.getTime())) return '';
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const counts = rows.map(r => r.count || 0);
    const risks = rows.map(r => r.avg_risk || 0);

    const ctx = el.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.00)');

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Verificaciones',
            data: counts,
            borderColor: COLORS.blue,
            backgroundColor: gradient,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: COLORS.blue,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.35,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Riesgo promedio',
            data: risks,
            borderColor: COLORS.cyan,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: COLORS.cyan,
            tension: 0.35,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 800 },
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: {
              boxWidth: 10, boxHeight: 10, padding: 14, usePointStyle: true,
              font: { family: 'Inter', size: 12, weight: '500' },
              color: '#475569'
            }
          },
          tooltip: {
            backgroundColor: COLORS.navy, padding: 12,
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyFont:  { family: 'Inter', size: 12 }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.slate, font: { family: 'Inter', size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false },
            ticks: { color: COLORS.slate, font: { family: 'Inter', size: 11 }, precision: 0 }
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: { color: COLORS.slate, font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
    el._chart = chart;
    return chart;
  }

  function sparkline(canvasId, values, color) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return null;
    if (el._chart) { el._chart.destroy(); }
    const ctx = el.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: values.map((_, i) => i),
        datasets: [{
          data: values,
          borderColor: color || COLORS.cyan,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
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
    sparkline
  };
})();
