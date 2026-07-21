// WAREHOUSE OVERVIEW JS
async function loadOverviewStats() {
    try {
        const res = await fetch(API + '/overview-stats', { headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            const data = json.data;
            document.getElementById('statZones').innerText = data.total_zones;
            document.getElementById('statBins').innerText = data.total_bins;
            document.getElementById('statPickLists').innerText = data.open_picks;
            document.getElementById('statPutaways').innerText = data.pending_putaways;
        }
    } catch (e) { console.error(e); }
}
