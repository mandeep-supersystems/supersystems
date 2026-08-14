// PURCHASE OVERVIEW JS
async function loadOverviewStats() {
    try {
        const res = await fetch(API + '/overview-stats', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data) {
            const d = json.data;
            document.getElementById('statPendingPRs').innerText = d.pending_prs || 0;
            document.getElementById('subtextPendingPRs').innerText = `${d.prs_today || 0} received today`;
            
            document.getElementById('statConvertedPRs').innerText = d.converted_prs || 0;
            document.getElementById('subtextConvertedPRs').innerText = `${d.converted_today || 0} converted today`;
            
            document.getElementById('statActivePOs').innerText = d.active_pos || 0;
            document.getElementById('subtextActivePOs').innerText = `${d.po_drafts || 0} drafts pending`;
            
            document.getElementById('statLeadTimeRevisions').innerText = d.lead_time_revisions || 0;
            document.getElementById('subtextLeadTimeRevisions').innerText = 'Across active logistics';
            
            document.getElementById('statPendingInvoices').innerText = d.pending_invoices || 0;
            document.getElementById('subtextPendingInvoices').innerText = `${d.invoices_today || 0} received today`;
        }
    } catch (e) { console.error(e); }
}
