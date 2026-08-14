// ── ASSET OVERVIEW ───────────────────────────────────
let _catData   = [];
let _catSortBy = 'items';
let _catExpanded = false;

const _BAR_COLORS = [
    '#1976d2','#7b1fa2','#388e3c','#f57c00','#c62828','#00796b',
    '#0288d1','#5d4037','#e91e63','#546e7a','#ff6f00','#2e7d32',
    '#6a1b9a','#ad1457','#00838f','#558b2f','#4527a0','#d84315',
];

async function assetLoadOverview() {
    try {
        const res  = await fetch(ASSET_API + '/overview-stats', { headers: ASSET_HEADERS() });
        const json = await res.json();
        if (!json.success) return;
        const d = json.data;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val ?? '—'; };
        set('assetStatTotal',       d.total_assets);
        set('assetStatSeries',      d.total_series);
        set('assetStatActive',      d.active);
        set('assetStatDisposed',    d.disposed);
        set('assetStatUnderRepair', d.under_repair);
        set('assetStatTotalQty',    d.total_qty);

        const total = d.total_assets || 1;
        set('assetStatAvgQty',     (d.total_qty / total).toFixed(1));
        set('assetStatAvgSeries',  d.total_series ? (total / d.total_series).toFixed(1) : '—');
        set('assetStatActiveRate', Math.round((d.active / total) * 100) + '%');
        set('assetStatCatCount',   (d.by_category || []).length);

        // Status bar
        const active   = d.active       || 0;
        const repair   = d.under_repair || 0;
        const disposed = d.disposed     || 0;
        const inactive = Math.max(0, total - active - repair - disposed);
        const bar = document.getElementById('assetStatusBar');
        if (bar) {
            const pct = n => Math.max(0, Math.round((n / total) * 100));
            bar.innerHTML = `
                <div class="asset-status-bar-seg" style="background:#388e3c;width:${pct(active)}%;"></div>
                <div class="asset-status-bar-seg" style="background:#f57c00;width:${pct(repair)}%;"></div>
                <div class="asset-status-bar-seg" style="background:#c62828;width:${pct(disposed)}%;"></div>
                <div class="asset-status-bar-seg" style="background:#9e9e9e;width:${pct(inactive)}%;"></div>`;
        }
        const legend = document.getElementById('assetStatusLegend');
        if (legend) {
            legend.innerHTML = [
                ['#388e3c','Active',active],['#f57c00','Under Repair',repair],
                ['#c62828','Disposed',disposed],['#9e9e9e','Inactive',inactive],
            ].map(([c,l,n]) => `
                <div class="asset-status-legend-item">
                    <div class="asset-status-dot" style="background:${c};"></div>
                    <span>${l} <strong>${n}</strong></span>
                </div>`).join('');
        }

        // Category chart
        _catData     = d.by_category || [];
        _catExpanded = false;
        const countEl = document.getElementById('assetCatCount');
        if (countEl) countEl.textContent = _catData.length + ' categories';
        _renderCatChart();

    } catch (e) { console.error('Asset overview error', e); }
}

function assetChartSort(by) {
    _catSortBy   = by;
    _catExpanded = false;
    _renderCatChart();
}

function assetChartToggle() {
    _catExpanded = !_catExpanded;
    const rest      = document.getElementById('assetCatChartRest');
    const label     = document.getElementById('assetCatChartToggleLabel');
    const icon      = document.getElementById('assetCatChartToggleIcon');
    const remaining = _catData.length - 5;
    if (_catExpanded) {
        // measure natural height then set it
        rest.style.maxHeight = rest.scrollHeight + 'px';
        label.textContent = 'Show less';
        icon.textContent  = 'expand_less';
    } else {
        rest.style.maxHeight = '0';
        label.textContent = `Show all ${remaining} more`;
        icon.textContent  = 'expand_more';
    }
}

function _makeBarRow(c, i, maxVal) {
    const val   = _catSortBy === 'qty' ? c.total_qty : c.item_count;
    const pct   = maxVal > 0 ? (val / maxVal) * 100 : 0;
    const color = _BAR_COLORS[i % _BAR_COLORS.length];
    const rank  = i < 5 ? `<span style="display:inline-flex;align-items:center;justify-content:center;
        width:18px;height:18px;border-radius:50%;background:${color};color:#fff;
        font-size:10px;font-weight:700;flex-shrink:0;margin-right:4px;">${i+1}</span>` : '';
    const safeC = JSON.stringify(c).replace(/"/g, '&quot;');
    return `
        <div class="asset-chart-row"
             onmouseenter="assetShowChartTip(event,${safeC})"
             onmousemove="assetMoveChartTip(event)"
             onmouseleave="assetHideChartTip()">
            <div class="asset-chart-label">${rank}<span title="${c.category}">${c.category}</span></div>
            <div class="asset-chart-bar-wrap">
                <div class="asset-chart-bar" style="width:${pct}%;background:${color};"></div>
            </div>
            <div class="asset-chart-val">${val}</div>
        </div>`;
}

function _renderCatChart() {
    const topEl    = document.getElementById('assetCatChartTop');
    const restEl   = document.getElementById('assetCatChartRest');
    const toggleEl = document.getElementById('assetCatChartToggle');
    const label    = document.getElementById('assetCatChartToggleLabel');
    const icon     = document.getElementById('assetCatChartToggleIcon');
    if (!topEl || !restEl) return;

    const sorted = [..._catData].sort((a, b) =>
        _catSortBy === 'qty' ? b.total_qty - a.total_qty : b.item_count - a.item_count
    );
    const maxVal = sorted.length ? (_catSortBy === 'qty' ? sorted[0].total_qty : sorted[0].item_count) : 1;

    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);

    topEl.innerHTML  = top5.map((c, i) => _makeBarRow(c, i, maxVal)).join('');
    restEl.innerHTML = rest.map((c, i) => _makeBarRow(c, i + 5, maxVal)).join('');

    // reset scroll state
    restEl.style.maxHeight = '0';

    if (rest.length > 0) {
        toggleEl.style.display = 'block';
        label.textContent = `Show all ${rest.length} more`;
        icon.textContent  = 'expand_more';
    } else {
        toggleEl.style.display = 'none';
    }
}

function assetShowChartTip(e, c) {
    const tip = document.getElementById('assetChartTooltip');
    if (!tip) return;
    tip.innerHTML = `
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;
            border-bottom:1px solid rgba(255,255,255,.15);padding-bottom:6px;">${c.category}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;">
            <div>
                <div style="color:rgba(255,255,255,.55);font-size:10px;text-transform:uppercase;letter-spacing:.4px;">Items</div>
                <div style="font-size:20px;font-weight:700;">${c.item_count}</div>
            </div>
            <div>
                <div style="color:rgba(255,255,255,.55);font-size:10px;text-transform:uppercase;letter-spacing:.4px;">Total Units</div>
                <div style="font-size:20px;font-weight:700;">${c.total_qty}</div>
            </div>
            <div>
                <div style="color:rgba(255,255,255,.55);font-size:10px;text-transform:uppercase;letter-spacing:.4px;">Series</div>
                <div style="font-size:20px;font-weight:700;">${c.series_count}</div>
            </div>
            <div>
                <div style="color:rgba(255,255,255,.55);font-size:10px;text-transform:uppercase;letter-spacing:.4px;">Avg Units</div>
                <div style="font-size:20px;font-weight:700;">${c.item_count ? (c.total_qty/c.item_count).toFixed(1) : '—'}</div>
            </div>
        </div>`;
    tip.style.display = 'block';
    assetMoveChartTip(e);
}

function assetMoveChartTip(e) {
    const tip = document.getElementById('assetChartTooltip');
    if (!tip) return;
    const x = e.clientX + 16, y = e.clientY - 10;
    tip.style.left = (x + tip.offsetWidth  > window.innerWidth  ? x - tip.offsetWidth  - 32 : x) + 'px';
    tip.style.top  = (y + tip.offsetHeight > window.innerHeight ? y - tip.offsetHeight      : y) + 'px';
}

function assetHideChartTip() {
    const tip = document.getElementById('assetChartTooltip');
    if (tip) tip.style.display = 'none';
}
