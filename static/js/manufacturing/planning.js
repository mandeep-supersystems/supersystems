// PLANNING JS
async function loadPlanning() {
    const tbody = document.getElementById('planningBody');
    try {
        const res = await fetch(API + '/planning', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(p => {
                const pct = p.planned_qty > 0 ? Math.min(100, Math.round((p.produced_qty / p.planned_qty) * 100)) : 0;
                return `
                    <tr>
                        <td><strong>${p.order_no}</strong></td>
                        <td>${p.fg_part_number}</td>
                        <td>${p.planned_start} ➔ ${p.planned_end}</td>
                        <td><span class="badge badge-info">${p.priority}</span></td>
                        <td style="width:200px;">
                            <div style="font-size:11px; font-weight:600;">${pct}% (${p.produced_qty}/${p.planned_qty})</div>
                            <div class="timeline-bar"><div class="timeline-progress" style="width:${pct}%;"></div></div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No planning schedule items.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading planning.</td></tr>';
    }
}
