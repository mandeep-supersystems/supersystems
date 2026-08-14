// ─── PROJECT MODULE: OVERVIEW ───

let currentOvPeriod = 'month';

function setOvPeriod(period, btn) {
    if (btn) {
        document.querySelectorAll('.ov-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    currentOvPeriod = period;
    loadOverview();
}

// Format date for banner
function updateOvDate() {
    const el = document.getElementById('ovDate');
    if(el) el.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Animate numbers
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

async function loadOverview() {
    updateOvDate();
    try {
        const res = await fetch(API + `/overview?period=${currentOvPeriod}`, { headers: HEADERS });
        const data = await res.json();
        if (!data.success) return;
        const d = data.data;

        // ── KPI Cards ───────────────────────────────────────────────────────
        animateValue('kpiTotalProjects', 0, d.total_projects, 1000);
        animateValue('kpiOpenProjects', 0, d.open_projects, 1000);
        animateValue('kpiCompletedProjects', 0, d.completed_projects, 1000);
        animateValue('kpiTotalTasks', 0, d.total_tasks, 1000);
        animateValue('kpiTotalOrgs', 0, d.total_organizations, 1000);

        // ── Recent Activity (Timeline) ──────────────────────────────────────
        const actEl = document.getElementById('overviewActivity');
        if (d.recent_activity && d.recent_activity.length) {
            actEl.innerHTML = d.recent_activity.map((a, i) => `
                <div class="ov-timeline-item" style="animation-delay: ${i*0.05}s">
                    <div class="ov-timeline-dot-col">
                        <div class="ov-timeline-dot dot-${(a.action||'').toLowerCase()}"></div>
                        <div class="ov-timeline-line"></div>
                    </div>
                    <div class="ov-timeline-content">
                        <div class="ov-timeline-action-row">
                            <span class="ov-timeline-badge b-${(a.action||'').toLowerCase()}">${esc(a.action)}</span>
                            <span class="ov-timeline-entity">${esc(a.entity_type)}</span>
                        </div>
                        <div class="ov-timeline-meta">${esc(a.entity_id)}</div>
                    </div>
                    <div class="ov-timeline-time">${formatTime(a.created_at)}</div>
                </div>
            `).join('');
        } else {
            actEl.innerHTML = '<div class="ov-empty"><span class="material-icons-outlined">inbox</span>No recent activity found</div>';
        }

        // ── Quick Actions ───────────────────────────────────────────────────
        _renderQuickActions();

        // ── Status Donut Chart (CSS) ────────────────────────────────────────
        const sb = d.status_breakdown || {};
        const statusColors = {
            open: '#1976D2', in_progress: '#F57C00', completed: '#2E7D32',
            on_hold: '#C62828', cancelled: '#9e9e9e'
        };
        const totalProj = Object.values(sb).reduce((a,b)=>a+b,0);
        document.getElementById('ovDonutTotal').textContent = totalProj.toLocaleString();
        
        const ring = document.getElementById('ovDonutRing');
        const leg = document.getElementById('ovDonutLegend');
        if (totalProj === 0) {
            ring.style.background = '#e5e7eb';
            leg.innerHTML = '';
        } else {
            let gradientStr = '';
            let currentPct = 0;
            let legHtml = '';
            Object.entries(sb).forEach(([k,v]) => {
                const pct = (v/totalProj)*100;
                const c = statusColors[k] || '#90caf9';
                gradientStr += `${c} ${currentPct}% ${currentPct+pct}%, `;
                currentPct += pct;
                legHtml += `<div class="ov-donut-legend-item"><span class="ov-donut-legend-dot" style="background:${c}"></span><span>${k.replace('_',' ')}</span><strong>${v}</strong></div>`;
            });
            ring.style.background = `conic-gradient(${gradientStr.slice(0,-2)})`;
            leg.innerHTML = legHtml;
        }

        // ── Org PO Value Bar Chart (Canvas) ─────────────────────────────────
        const orgs = d.top_orgs || [];
        _drawBar('orgBarCanvas',
            orgs.map(o => o.name.length > 14 ? o.name.slice(0,14)+'…' : o.name),
            orgs.map(o => o.po_value),
            orgs.map(o => o.projects));

        // ── Monthly trend (Canvas) ──────────────────────────────────────────
        const mp = d.monthly_projects || [];
        _drawLine('monthlyLineCanvas', mp.map(m => m.month), mp.map(m => m.count));

        // ── Top Org Table ───────────────────────────────────────────────────
        const orgTbl = document.getElementById('orgValueTable');
        if (orgTbl) {
            orgTbl.innerHTML = orgs.length ? orgs.map((o, i) => `
                <div class="ov-org-row2">
                    <span class="ov-org-rank2">#${i+1}</span>
                    <span class="ov-org-name2">${esc(o.name)}</span>
                    <span class="ov-org-proj2">${o.projects} proj</span>
                    <span class="ov-org-val2">₹ ${o.po_value.toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
                </div>`).join('')
            : '<div class="ov-empty"><span class="material-icons-outlined">inbox</span>No org data found</div>';
        }

    } catch (e) { console.error('Overview error:', e); }
}

// ── Role-gated Quick Actions ─────────────────────────────────────────────────
function _renderQuickActions() {
    const container = document.getElementById('quickActionsGrid');
    if (!container) return;
    let role = 'viewer';
    try {
        const stored = JSON.parse(localStorage.getItem('module_access') || '{}');
        role = stored['project_management']?.role || 'viewer';
    } catch(e) {}

    const allActions = [
        { label: 'New Project',     icon: 'add_circle',     section: 'addproject',    need: 'addproject' },
        { label: 'All Projects',    icon: 'folder_special', section: 'projects',      need: 'projects' },
        { label: 'Organizations',   icon: 'business',       section: 'organizations', need: 'organizations' },
        { label: 'Audit Logs',      icon: 'history',        section: 'auditlogs',     need: 'auditlogs' },
    ];
    const PROJ_ROLE_SECTIONS = {
        module_admin: ['overview','projects','addproject','organizations','auditlogs'],
        editor:       ['overview','projects','addproject','organizations','auditlogs'],
        viewer:       ['overview','projects','organizations']
    };
    const allowed = PROJ_ROLE_SECTIONS[role] || PROJ_ROLE_SECTIONS['viewer'];
    const visible = allActions.filter(a => allowed.includes(a.need));
    container.innerHTML = visible.map(a => `
        <button class="ov-quick-btn" onclick="showSection('${a.section}')">
            <span class="material-icons-outlined">${a.icon}</span>
            <span>${a.label}</span>
        </button>`).join('');
}

// ── Canvas Chart Helpers ─────────────────────────────────────────────────────
function _drawBar(canvasId, labels, values, projCounts) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    if (!values.length) return;
    const pad = { l:10, r:10, t:16, b:40 };
    const bw = (W - pad.l - pad.r) / values.length;
    const maxV = Math.max(...values) || 1;
    const accent = '#1a73e8';
    values.forEach((v, i) => {
        const bh = ((v/maxV) * (H - pad.t - pad.b)) || 2;
        const x = pad.l + i*bw + bw*0.15;
        const y = H - pad.b - bh;
        const bwActual = bw * 0.7;
        ctx.fillStyle = accent + (i%2===0?'dd':'99');
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x,y,bwActual,bh,4) : ctx.rect(x,y,bwActual,bh);
        ctx.fill();
        ctx.fillStyle = '#6b7280'; ctx.font = '10px Arial'; ctx.textAlign='center';
        ctx.fillText(labels[i] || '', x+bwActual/2, H-pad.b+14);
        if (v > 0) {
            ctx.fillStyle = '#1f2937'; ctx.font = 'bold 10px Arial';
            const lbl = v >= 100000 ? '₹'+(v/100000).toFixed(1)+'L' : v >= 1000 ? '₹'+(v/1000).toFixed(0)+'K' : '₹'+v;
            ctx.fillText(lbl, x+bwActual/2, y-6);
        }
    });
}

function _drawLine(canvasId, labels, values) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    if (!values.length) return;
    const pad = { l:24, r:16, t:16, b:32 };
    const maxV = Math.max(...values, 1);
    const pts = values.map((v,i) => ({
        x: pad.l + (i/(values.length-1||1)) * (W-pad.l-pad.r),
        y: H - pad.b - (v/maxV)*(H-pad.t-pad.b)
    }));
    ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1;
    [0,0.25,0.5,0.75,1].forEach(f => {
        const y = H-pad.b - f*(H-pad.t-pad.b);
        ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    });
    ctx.strokeStyle='#1a73e8'; ctx.lineWidth=2.5; ctx.lineJoin='round';
    ctx.beginPath(); pts.forEach((p,i) => i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    ctx.fillStyle='rgba(26,115,232,0.08)';
    ctx.beginPath(); ctx.moveTo(pts[0].x, H-pad.b);
    pts.forEach(p => ctx.lineTo(p.x,p.y));
    ctx.lineTo(pts[pts.length-1].x, H-pad.b); ctx.closePath(); ctx.fill();
    pts.forEach((p,i) => {
        ctx.fillStyle='#1a73e8'; ctx.beginPath(); ctx.arc(p.x,p.y,3.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#6b7280'; ctx.font='10px Arial'; ctx.textAlign='center';
        ctx.fillText(labels[i]||'', p.x, H-pad.b+14);
        if (values[i]>0) { ctx.fillStyle='#1f2937'; ctx.font='bold 10px Arial'; ctx.fillText(values[i], p.x, p.y-8); }
    });
}
