// PURCHASE OVERVIEW JS
async function loadOverviewStats() {
    try {
        const res = await fetch(API + '/overview-stats', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data) {
            const d = json.data;
            document.getElementById('statTotalDemands').innerText = d.total_demands;
            document.getElementById('statOccupiedQty').innerText = d.total_occupied_qty;
            document.getElementById('statNetShortage').innerText = d.net_shortage_qty;
            document.getElementById('statActivePOs').innerText = d.active_pos;
            document.getElementById('statLeadTimeRevisions').innerText = d.lead_time_revisions;
        }
    } catch (e) { console.error(e); }
}
