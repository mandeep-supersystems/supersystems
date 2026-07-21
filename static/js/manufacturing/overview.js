// MANUFACTURING OVERVIEW JS
async function loadOverviewStats() {
    try {
        const res = await fetch(API + '/overview-stats', { headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            const data = json.data;
            document.getElementById('statTotalBoms').innerText = data.total_boms;
            document.getElementById('statActiveOrders').innerText = data.active_orders;
            document.getElementById('statWorkCenters').innerText = data.work_centers;
            document.getElementById('statTotalRoutings').innerText = data.total_routings;
        }
    } catch (e) { console.error(e); }
}
