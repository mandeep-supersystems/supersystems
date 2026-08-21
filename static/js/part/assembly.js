// ─── PART MODULE: ASSEMBLY ───
let _assemblyParts = [];
let _assemblySeriesFilter = '';

async function loadAssembly() {
    const tbody = document.getElementById('assemblyTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading...</td></tr>';
    try {
        // Fetch all parts from assembly categories (901, 902, 903)
        const cats = categories.filter(c => ['901','902','903'].includes(String(c.series_prefix)));
        if (!cats.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty">No assembly categories found.</td></tr>';
            return;
        }
        const catIds = cats.map(c => c.id).join(',');
        const res = await fetch(API + '/all-parts?category_ids=' + encodeURIComponent(catIds), { headers: HEADERS });
        const data = await res.json();
        _assemblyParts = data.data || [];
        renderAssemblyTable(_assemblyParts);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Error loading assemblies.</td></tr>';
    }
}

function renderAssemblyTable(parts) {
    const tbody = document.getElementById('assemblyTableBody');
    const filtered = _assemblySeriesFilter
        ? parts.filter(p => p.part_number.startsWith(_assemblySeriesFilter + '.'))
        : parts;
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No assembly parts found.</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(p => {
        const isObs = (p.status || '').toLowerCase() === 'obsolete';
        const series = p.part_number.split('.')[0];
        return `<tr style="${isObs ? 'opacity:0.6' : ''}">
            <td>
                <a href="/assembly/detail/${encodeURIComponent(p.part_number)}" style="font-family:monospace;font-weight:700;color:var(--accent);text-decoration:none">
                    ${esc(p.part_number)}
                </a>
                <span style="font-size:10px;margin-left:6px;padding:1px 7px;border-radius:10px;background:#e3f2fd;color:#1565c0;font-weight:700">${esc(series)}</span>
            </td>
            <td><span class="cat-badge">${esc(p.subcategory || '-')}</span></td>
            <td>${esc(p.value || '—')}</td>
            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.description || '—')}</td>
            <td><span class="pd-status-badge ${isObs ? 'pd-status-obsolete' : 'pd-status-active'}">${isObs ? 'Obsolete' : 'Active'}</span></td>
            <td style="font-size:12px;color:var(--text-muted)">${p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
            <td class="actions-cell">
                <a href="/assembly/detail/${encodeURIComponent(p.part_number)}" class="btn-action" title="View Detail"><span class="material-icons-outlined">open_in_new</span></a>
            </td>
        </tr>`;
    }).join('');
}

function filterAssemblySeries(series) {
    _assemblySeriesFilter = series;
    document.querySelectorAll('#assemblySeriesFilter .col-tag').forEach(btn => {
        const active = btn.dataset.series === series;
        btn.style.borderColor = active ? 'var(--accent)' : 'var(--border-color)';
        btn.style.background = active ? 'var(--accent-light)' : 'var(--bg-primary)';
        btn.style.color = active ? 'var(--accent)' : 'var(--text-secondary)';
        btn.style.fontWeight = active ? '700' : '400';
    });
    renderAssemblyTable(_assemblyParts);
}

function filterAssemblyTable(query) {
    const q = query.toLowerCase().trim();
    if (!q) { renderAssemblyTable(_assemblyParts); return; }
    const filtered = _assemblyParts.filter(p =>
        (p.part_number || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.subcategory || '').toLowerCase().includes(q) ||
        (p.value || '').toLowerCase().includes(q)
    );
    renderAssemblyTable(filtered);
}
