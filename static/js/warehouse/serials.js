// ─── WAREHOUSE SERIAL NUMBER TRACKING JS ───
async function loadSerials() {
    const tbody = document.getElementById('serialsBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
    try {
        const res = await fetch(`${API}/serials`, { headers: HEADERS });
        const data = await res.json();
        const rows = data.serials || data.data || [];
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No serial numbers found.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(s => `
            <tr>
                <td>${esc(s.serial_no || s.serial_number)}</td>
                <td>${esc(s.part_code || s.part_number || '-')}</td>
                <td>${esc(s.batch_no || s.batch_number || '-')}</td>
                <td>${esc(s.warehouse || '-')}${s.bin_code ? ' / ' + esc(s.bin_code) : ''}</td>
                <td>${esc(s.status || '-')}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Failed to load serial numbers.</td></tr>';
    }
}
