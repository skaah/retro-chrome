// Popup script pour DofusBook Scraper

document.addEventListener('DOMContentLoaded', async () => {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const autoBtn = document.getElementById('autoBtn');
    const statusEl = document.getElementById('status');
    const statsEl = document.getElementById('stats');
    
    // Charger les stats sauvegardées
    const stats = await chrome.storage.local.get(['itemCount', 'setCount', 'totalCount']);
    updateStats(stats);
    
    // Vérifier si on est sur DofusBook
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isDofusBook = tab.url?.includes('retro.dofusbook.net');
    
    if (!isDofusBook) {
        statusEl.innerHTML = '<span style="color: #ef4444;">❌ Allez sur retro.dofusbook.net</span>';
        scrapeBtn.disabled = true;
    } else {
        statusEl.innerHTML = '<span class="dot"></span><span>✅ Prêt à scraper</span>';
    }
    
    // Bouton Scraper
    scrapeBtn.addEventListener('click', async () => {
        scrapeBtn.classList.add('loading');
        scrapeBtn.textContent = 'Extraction...';
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Envoyer message au content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
            
            if (response?.success) {
                // Mettre à jour les stats
                const data = response.data;
                const newStats = {
                    itemCount: (stats.itemCount || 0) + (data.items?.length || 0),
                    setCount: (stats.setCount || 0) + (data.panoplie ? 1 : 0),
                    totalCount: (stats.totalCount || 0) + 1
                };
                
                await chrome.storage.local.set(newStats);
                updateStats(newStats);
                
                statusEl.innerHTML = `<span style="color: #22c55e;">✅ ${data.items?.length || 1} élément(s) exporté(s)!</span>`;
            }
        } catch (err) {
            statusEl.innerHTML = `<span style="color: #ef4444;">❌ ${err.message}</span>`;
        } finally {
            scrapeBtn.classList.remove('loading');
            scrapeBtn.textContent = '📥 Scraper cette page';
        }
    });
    
    // Bouton Auto (à implémenter)
    autoBtn.addEventListener('click', () => {
        alert('Mode Auto: À venir dans la prochaine version!');
    });
    
    // Ouvrir les options
    document.getElementById('openOptions')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage?.() || alert('Options à venir!');
    });
});

function updateStats(stats) {
    document.getElementById('stats').style.display = 'block';
    document.getElementById('itemCount').textContent = stats.itemCount || 0;
    document.getElementById('setCount').textContent = stats.setCount || 0;
    document.getElementById('totalCount').textContent = stats.totalCount || 0;
}
