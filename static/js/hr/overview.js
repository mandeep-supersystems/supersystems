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
        const inactive = emps.filter(e => e.status !== 'active').length;
        const depts = [...new Set(emps.map(e => e.department).filter(Boolean))].length;
        const criteria = critJson.success ? critJson.data.length : 0;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('ovr-total', total);
        set('ovr-active', active);
        set('ovr-inactive', inactive);
        set('ovr-depts', depts);
        set('ovr-criteria', criteria);

        // Dept breakdown
        const deptMap = {};
        emps.forEach(e => { const d = e.department || 'Unassigned'; deptMap[d] = (deptMap[d] || 0) + 1; });
        const deptBody = document.getElementById('ovr-dept-body');
        if (deptBody) {
            deptBody.innerHTML = Object.entries(deptMap).sort((a,b) => b[1]-a[1]).map(([d, c]) => `
                <tr>
                    <td>${d}</td>
                    <td><strong>${c}</strong></td>
                    <td>
                        <div style="background:var(--border-color);border-radius:4px;height:6px;width:120px;">
                            <div style="background:var(--accent);width:${Math.round((c/total)*100)}%;height:6px;border-radius:4px;"></div>
                        </div>
                    </td>
                </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No data</td></tr>';
        }

        // Recent employees
        const recentBody = document.getElementById('ovr-recent-body');
        if (recentBody) {
            recentBody.innerHTML = emps.slice(0, 8).map(e => `
                <tr>
                    <td><strong>${e.emp_code || '-'}</strong></td>
                    <td>${e.first_name} ${e.last_name}</td>
                    <td style="font-size:12px;">${e.email || '-'}</td>
                    <td>${e.designation || '-'}</td>
                    <td>${e.department || '-'}</td>
                    <td>${e.date_of_joining || '-'}</td>
                    <td><span class="badge ${e.status === 'active' ? 'badge-success' : 'badge-danger'}">${e.status}</span></td>
                </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No employees yet</td></tr>';
        }

        // Employment type breakdown
        const typeMap = {};
        emps.forEach(e => { const t = e.employment_type || 'Unknown'; typeMap[t] = (typeMap[t] || 0) + 1; });
        const typeBody = document.getElementById('ovr-type-body');
        if (typeBody) {
            const labels = { full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', intern: 'Intern' };
            typeBody.innerHTML = Object.entries(typeMap).map(([t, c]) => `
                <tr>
                    <td>${labels[t] || t}</td>
                    <td><strong>${c}</strong></td>
                    <td><span class="badge badge-info">${Math.round((c/total)*100)}%</span></td>
                </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No data</td></tr>';
        }

    } catch (e) {
        console.error('HR Overview error:', e);
    }
}
