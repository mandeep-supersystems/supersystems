// ─── PART MODULE: CADDB ───────────────────────────────────────────────────────

async function loadCadDB() {
    const el = document.getElementById('caddbContent');
    if (!el) return;
    el.innerHTML = '<div class="ov-empty"><span class="material-icons-outlined" style="font-size:32px;margin-bottom:8px;">sync</span><br>Loading CadDB status...</div>';
    try {
        const res  = await fetch(API + '/caddb-status', { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { el.innerHTML = '<div class="ov-empty">Failed to load CadDB status</div>'; return; }
        const d = json.data;
        const cats = d.categories || [];

        el.innerHTML = `
        <!-- KPI row -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px;">
            ${_cadKpi('extension',      'Total Parts',        d.total_parts,          '#3b82f6')}
            ${_cadKpi('memory',         'With MPN / Make',   d.total_with_mpn,        '#8b5cf6')}
            ${_cadKpi('sell',           'Priced (Supplier)', d.total_priced,          '#10b981')}
            ${_cadKpi('account_tree',   'With Footprint',    d.total_with_footprint,  '#f59e0b')}
        </div>

        <!-- Setup guide accordion -->
        <div style="margin-bottom:24px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                <span class="material-icons-outlined" style="color:var(--primary);">menu_book</span>
                <h3 style="margin:0;font-size:15px;font-weight:600;">CadDB Setup Guide</h3>
                <span style="font-size:12px;color:var(--text-secondary);margin-left:4px;">Microsoft Access database for Cadence OrCAD / Allegro</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                ${_cadGuideCard('computer','Windows Setup','pyodbc + pywin32 + Access Database Engine',`
                    <p style="margin:0 0 8px;font-size:12px;color:var(--text-secondary);">Install Python libraries:</p>
                    <code style="display:block;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;font-size:12px;margin-bottom:8px;">pip install pyodbc pywin32</code>
                    <p style="margin:0 0 6px;font-size:12px;color:var(--text-secondary);">Download Access Database Engine (64-bit):</p>
                    <a href="https://www.microsoft.com/en-us/download/details.aspx?id=54920" target="_blank"
                       style="font-size:12px;color:var(--primary);word-break:break-all;">microsoft.com/download &rarr; AccessDatabaseEngine_X64.exe</a>
                    <p style="margin:8px 0 4px;font-size:12px;color:var(--text-secondary);">Verify:</p>
                    <code style="display:block;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;font-size:12px;">import pyodbc<br>print([x for x in pyodbc.drivers() if 'Access' in x])</code>
                `)}
                ${_cadGuideCard('terminal','Linux Setup','Java JDK + 4 JAR files + Jackcess',`
                    <p style="margin:0 0 8px;font-size:12px;color:var(--text-secondary);">Install Java JDK (min Java 8):</p>
                    <code style="display:block;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;font-size:12px;margin-bottom:8px;">sudo apt-get install default-jdk</code>
                    <p style="margin:0 0 6px;font-size:12px;color:var(--text-secondary);">Run setup script (downloads 4 JARs + compiles):</p>
                    <code style="display:block;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;font-size:12px;margin-bottom:8px;">cd backend/accdb_builder<br>bash setup.sh</code>
                    <p style="margin:0 0 4px;font-size:12px;color:var(--text-secondary);">Required JARs: jackcess-4.0.7, commons-lang3-3.14.0, commons-logging-1.3.0, json-20240303</p>
                `)}
                ${_cadGuideCard('folder','File Structure','Output path + directory layout',`
                    <p style="margin:0 0 6px;font-size:12px;color:var(--text-secondary);">Set env variable for output path:</p>
                    <code style="display:block;background:var(--bg-secondary);padding:8px 10px;border-radius:6px;font-size:12px;margin-bottom:8px;"># Linux<br>export ACCDB_PATH=/home/ims/cadence/CadDB.accdb<br><br># Windows (.env)<br>ACCDB_PATH=C:\\Users\\ims\\cadence\\CadDB.accdb</code>
                    <p style="margin:0 0 4px;font-size:12px;color:var(--text-secondary);">Builder files go in: <code style="background:var(--bg-secondary);padding:2px 5px;border-radius:3px;">backend/accdb_builder/</code></p>
                `)}
                ${_cadGuideCard('info','Data Rules','What gets written to each table',`
                    <ul style="margin:0;padding-left:16px;font-size:12px;color:var(--text-secondary);line-height:1.8;">
                        <li>All values stored as <strong>TEXT / VARCHAR(255)</strong> — no numbers, no dates</li>
                        <li>Columns <code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;">id</code> and <code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;">schematic_part</code> skipped from PG data</li>
                        <li>3 columns appended from <code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;">part_footprints</code>: Schematic Part, PCB Footprint, 3D Step File</li>
                        <li>Only rows where <code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;">part_number IS NOT NULL</code></li>
                        <li>Primary key index on <strong>Part Number</strong> (unique)</li>
                        <li>Null/nan/none/null strings cleaned to empty string</li>
                    </ul>
                `)}
            </div>
        </div>

        <!-- Trigger info -->
        <div style="background:var(--bg-secondary);border-radius:8px;padding:14px 16px;margin-bottom:24px;border-left:4px solid var(--primary);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span class="material-icons-outlined" style="font-size:16px;color:var(--primary);">bolt</span>
                <strong style="font-size:13px;">Auto-Rebuild Triggers</strong>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${['POST /api/footprints/<part_number>','POST /api/footprints/update/<id>','POST /api/footprints/delete/<id>','POST /api/sync_accdb (manual)'].map(t =>
                    `<span style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;padding:3px 8px;font-size:11px;font-family:monospace;">${t}</span>`
                ).join('')}
            </div>
        </div>

        <!-- Per-category table -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span class="material-icons-outlined" style="color:var(--primary);">table_chart</span>
            <h3 style="margin:0;font-size:15px;font-weight:600;">Category → CadDB Table Mapping</h3>
            <span style="font-size:12px;color:var(--text-secondary);margin-left:4px;">${cats.length} categories</span>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Category (PostgreSQL)</th>
                        <th>CadDB Table Name</th>
                        <th>Series</th>
                        <th>Parts</th>
                        <th>MPN / Make</th>
                        <th>MPN Coverage</th>
                    </tr>
                </thead>
                <tbody>
                    ${cats.length === 0 ? '<tr><td colspan="6" class="empty">No categories found</td></tr>' :
                      cats.map(c => `
                        <tr>
                            <td><span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;color:var(--text-secondary);margin-right:4px;">folder</span>${esc(c.category)}</td>
                            <td><code style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;font-size:12px;">${esc(c.caddb_table)}</code></td>
                            <td><span style="font-size:12px;color:var(--text-secondary);">${esc(String(c.series_prefix))}</span></td>
                            <td><strong>${c.part_count.toLocaleString()}</strong></td>
                            <td>${c.mpn_count.toLocaleString()}</td>
                            <td>
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:3px;min-width:60px;">
                                        <div style="height:100%;width:${c.mpn_pct}%;background:${c.mpn_pct>=80?'#10b981':c.mpn_pct>=40?'#f59e0b':'#ef4444'};border-radius:3px;transition:width .4s;"></div>
                                    </div>
                                    <span style="font-size:11px;color:var(--text-secondary);min-width:32px;">${c.mpn_pct}%</span>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    } catch(e) {
        el.innerHTML = '<div class="ov-empty">Error loading CadDB status</div>';
        console.error('CadDB load error:', e);
    }
}

function _cadKpi(icon, label, value, color) {
    return `<div style="background:var(--bg-primary);border-radius:8px;padding:14px 16px;border-left:4px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.06);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span class="material-icons-outlined" style="font-size:18px;color:${color};">${icon}</span>
            <span style="font-size:11px;color:var(--text-secondary);">${label}</span>
        </div>
        <div style="font-size:26px;font-weight:700;color:${color};">${(value||0).toLocaleString()}</div>
    </div>`;
}

function _cadGuideCard(icon, title, subtitle, body) {
    return `<div style="background:var(--bg-primary);border-radius:8px;padding:16px;border:1px solid var(--border-color);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span class="material-icons-outlined" style="font-size:16px;color:var(--primary);">${icon}</span>
            <strong style="font-size:13px;">${title}</strong>
        </div>
        <p style="margin:0 0 10px;font-size:11px;color:var(--text-secondary);">${subtitle}</p>
        ${body}
    </div>`;
}
