// ─── PART MODULE: CADDB ───────────────────────────────────────────────────────

async function downloadCadDB() {
    showToast('Building CadDB.accdb — please wait...', 'info');
    try {
        const res = await fetch(API + '/caddb-download', { headers: HEADERS });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'CadDB download failed', 'error');
            return;
        }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'CadDB.accdb';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('CadDB.accdb downloaded', 'success');
    } catch (e) {
        showToast('CadDB download failed: ' + e.message, 'error');
    }
}
