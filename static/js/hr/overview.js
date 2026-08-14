async function loadHROverview() {
    try {
        const [empRes, critRes] = await Promise.all([
            fetch(API + '/employees', { headers: headers() }),
            fetch(API + '/code-criteria', { headers: headers() })
        ]);
        const empJson = await empRes.json();
        const critJson = await critRes.json();

        const emps = empJson.success ? empJson.data : [];
        const total = emps.length;
        const active = emps.filter(e => e.status === 'active').length;
        const inactive = total - active;
        const depts = [...new Set(emps.map(e => e.department).filter(Boolean))].length;
        const criteria = critJson.success ? critJson.data.length : 0;
        const activePct = total ? Math.round((active / total) * 100) : 0;

        // KPI cards
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('ovr-total', total);
        set('ovr-active', active);
        set('ovr-inactive', inactive);
        set('ovr-depts', depts);
        set('ovr-criteria', criteria);
        set('ovr-active-pct', total ? `${activePct}% of workforce` : '');
        set('ovr-subtitle', `${total} employee${total !== 1 ? 's' : ''} across ${depts} department${depts !== 1 ? 's' : ''}`);

        const BAR_COLORS = ['#1a73e8','#2e7d32','#e65100','#6a1b9a','#00838f','#c62828','#f9a825','#37474f'];

        function renderBars(containerId, map, total) {
            const el = document.getElementById(containerId);
            if (!el) return;
            const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
            if (!entries.length) { el.innerHTML = '<div class="ovr-empty">No data available</div>'; return; }
            el.innerHTML = entries.map(([label, count], i) => `
                <div class="ovr-bar-row">
                    <div class="ovr-bar-label" title="${label}">${label}</div>
                    <div class="ovr-bar-track">
                        <div class="ovr-bar-fill" style="width:${total ? Math.round((count/total)*100) : 0}%;background:${BAR_COLORS[i % BAR_COLORS.length]};"></div>
                    </div>
                    <div class="ovr-bar-count">${count}</div>
                    <div class="ovr-bar-pct">${total ? Math.round((count/total)*100) : 0}%</div>
                </div>`).join('');
        }

        // Department breakdown
        const deptMap = {};
        emps.forEach(e => { const d = e.department || 'Unassigned'; deptMap[d] = (deptMap[d] || 0) + 1; });
        renderBars('ovr-dept-list', deptMap, total);

        // Employment type
        const typeLabels = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Intern' };
        const typeMap = {};
        emps.forEach(e => { const t = typeLabels[e.employment_type] || e.employment_type || 'Unknown'; typeMap[t] = (typeMap[t] || 0) + 1; });
        renderBars('ovr-type-list', typeMap, total);

        // Gender distribution
        const genderLabels = { male: 'Male', female: 'Female', other: 'Other' };
        const genderMap = {};
        emps.forEach(e => { const g = genderLabels[e.gender] || (e.gender ? e.gender : 'Not Specified'); genderMap[g] = (genderMap[g] || 0) + 1; });
        renderBars('ovr-gender-list', genderMap, total);

        // Recent employees
        const recentEl = document.getElementById('ovr-recent-list');
        if (recentEl) {
            const sorted = [...emps].sort((a, b) => (b.date_of_joining || '').localeCompare(a.date_of_joining || '')).slice(0, 8);
            if (!sorted.length) {
                recentEl.innerHTML = '<div class="ovr-empty">No employees yet</div>';
            } else {
                const avatarColors = ['#1a73e8','#2e7d32','#e65100','#6a1b9a','#00838f','#c62828','#f9a825'];
                recentEl.innerHTML = sorted.map((e, i) => {
                    const initials = `${(e.first_name || '?')[0]}${(e.last_name || '')[0] || ''}`.toUpperCase();
                    const color = avatarColors[i % avatarColors.length];
                    const doj = e.date_of_joining ? new Date(e.date_of_joining).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
                    const isActive = e.status === 'active';
                    return `
                    <div class="ovr-recent-row">
                        <div class="ovr-recent-avatar" style="background:${color};">${initials}</div>
                        <div class="ovr-recent-info">
                            <div class="ovr-recent-name">${e.first_name || ''} ${e.last_name || ''}</div>
                            <div class="ovr-recent-meta">
                                ${e.designation || 'No Designation'}
                                ${e.department ? ` &middot; ${e.department}` : ''}
                            </div>
                        </div>
                        <div class="ovr-recent-right">
                            <div class="ovr-recent-code">${e.emp_code || '—'}</div>
                            <div class="ovr-recent-doj">
                                <span class="ovr-status-dot ${isActive ? 'active' : 'inactive'}"></span>
                                Joined ${doj}
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

    } catch (e) {
        console.error('HR Overview error:', e);
    }
}
