// ── ASSET SECTIONS (Depreciation, Transfers, Disposal, Maintenance) ──

function assetLoadDepreciation() {
    const el = document.getElementById('assetDepreciationBody');
    if (el) el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No depreciation records yet.</td></tr>';
}

function assetLoadTransfers() {
    const el = document.getElementById('assetTransfersBody');
    if (el) el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No transfer records yet.</td></tr>';
}

function assetLoadDisposal() {
    const el = document.getElementById('assetDisposalBody');
    if (el) el.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No disposal records yet.</td></tr>';
}

function assetLoadMaintenance() {
    const el = document.getElementById('assetMaintenanceBody');
    if (el) el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No maintenance schedules yet.</td></tr>';
}
