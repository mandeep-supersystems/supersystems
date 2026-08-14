/* ═══════════════════════════════════════════════════════
   nav.js — shared helpers: tooltip + dark/light toggle + favicon
═══════════════════════════════════════════════════════ */

/* ── FAVICON (inline SVG, switches with theme) ── */
function setFavicon(dark) {
  const bg   = dark ? '#0ea5e9' : '#0284c7';
  const text = dark ? '#fff'    : '#fff';
  const svg  = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
    <rect width='32' height='32' rx='8' fill='${bg}'/>
    <text x='16' y='22' font-size='18' font-family='Segoe UI,sans-serif'
      font-weight='900' fill='${text}' text-anchor='middle'>S</text>
  </svg>`;
  const url = 'data:image/svg+xml,' + encodeURIComponent(svg);
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

/* ── THEME ── */
function applyTheme(dark) {
  if (dark) {
    document.body.classList.remove('light');
  } else {
    document.body.classList.add('light');
  }
  setFavicon(dark);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('ss-theme', dark ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem('ss-theme');
  const dark  = saved ? saved === 'dark' : true; /* default dark */
  applyTheme(dark);
  return dark;
}

function toggleTheme() {
  const isDark = !document.body.classList.contains('light');
  applyTheme(!isDark); /* flip */
}

/* ── TOOLTIP ── */
function initTooltip() {
  const tip = document.createElement('div');
  tip.id = 'fc-tooltip';
  document.body.appendChild(tip);
  document.addEventListener('mousemove', e => {
    const x = e.clientX + 16;
    const y = e.clientY + 16;
    /* keep inside viewport */
    tip.style.left = Math.min(x, window.innerWidth  - 310) + 'px';
    tip.style.top  = Math.min(y, window.innerHeight - 160) + 'px';
  });
  return tip;
}

function showTip(tip, title, rows, why) {
  tip.innerHTML =
    `<div class="tt-title">${title}</div>` +
    rows.map(r => `<div class="tt-row"><b>${r[0]}:</b> ${r[1]}</div>`).join('') +
    (why ? `<div class="tt-why">💡 <b>Why:</b> ${why}</div>` : '');
  tip.classList.add('show');
}

function hideTip(tip) { tip.classList.remove('show'); }

/* ── AUTO-INIT on DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setFavicon(!document.body.classList.contains('light'));
});
