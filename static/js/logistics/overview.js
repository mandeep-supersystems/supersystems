// ─── LOGISTICS OVERVIEW JS ───

async function loadLgOverview() {
    try {
        const res = await fetch(API + '/overview', { headers: HEADERS });
        const json = await res.json();
        if (!json.success) return;
        const d = json.data;
        document.getElementById('statPendingPos').textContent    = d.pending_pos_to_receive ?? 0;
        document.getElementById('statTotalGrn').textContent      = d.total_grns ?? 0;
        document.getElementById('statPendingHandover').textContent = d.pending_handover ?? 0;
        document.getElementById('statHandedOver').textContent    = d.handed_over ?? 0;

        // Update sidebar badges
        const bh = document.getElementById('badgeHandover');
        if (bh && d.pending_handover > 0) { bh.textContent = d.pending_handover; bh.style.display = 'inline'; }
        const bp = document.getElementById('badgePendingPos');
        if (bp && d.pending_pos_to_receive > 0) { bp.textContent = d.pending_pos_to_receive; bp.style.display = 'inline'; }
    } catch (e) {
        console.error('Overview load error', e);
    }
}
