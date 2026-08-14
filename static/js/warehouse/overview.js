// WAREHOUSE OVERVIEW JS
async function loadOverviewStats() {
    try {
        const res = await fetch(API + '/overview-stats', { headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            const data = json.data;
            document.getElementById('statBins').innerText = data.total_bins;
        }
    } catch (e) { console.error(e); }
}
