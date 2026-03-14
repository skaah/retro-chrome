/**
 * Popup Script - Interface utilisateur
 */

let currentTab = null;
let scrapedData = { items: [], panoplies: [], totalScraped: 0 };

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  // Récupérer l'onglet actif
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  
  // Charger les données
  await loadData();
  
  // Vérifier si on est sur DofusBook
  checkDofusBookPage();
  
  // Event listeners
  document.getElementById('scrapeBtn').addEventListener('click', scrapeCurrentPage);
  document.getElementById('autoModeToggle').addEventListener('change', toggleAutoMode);
  document.getElementById('exportBtn').addEventListener('click', exportAllData);
  document.getElementById('clearBtn').addEventListener('click', clearAllData);
  
  // Bouton bulk scrape
  const bulkBtn = document.getElementById('bulkScrapeBtn');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', startBulkScrape);
  }
  
  // Charger l'état du mode auto
  loadAutoModeState();
});

// Charger les données du background
async function loadData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getData' });
    if (response) {
      scrapedData = response.scrapedData || { items: [], panoplies: [], totalScraped: 0 };
      updateStats();
    }
  } catch (err) {
    console.error('Erreur chargement données:', err);
  }
}

// Vérifier si on est sur une page DofusBook
function checkDofusBookPage() {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const bulkBtn = document.getElementById('bulkScrapeBtn');
  
  if (!currentTab?.url?.includes('retro.dofusbook.net')) {
    statusEl.className = 'status error';
    statusText.textContent = '⚠️ Allez sur retro.dofusbook.net';
    document.getElementById('scrapeBtn').disabled = true;
    if (bulkBtn) bulkBtn.style.display = 'none';
    return false;
  }
  
  const isItemPage = currentTab.url.includes('/items/') && currentTab.url.match(/\/items\/[^/]+$/);
  const isWeaponPage = currentTab.url.includes('/armes/') && currentTab.url.match(/\/armes\/[^/]+$/);
  const isSetPage = currentTab.url.includes('/panoplies/') && currentTab.url.match(/\/panoplies\/[^/]+$/);
  
  const isListPage = (currentTab.url.includes('/items') && !isItemPage) ||
                     (currentTab.url.includes('/armes') && !isWeaponPage) ||
                     (currentTab.url.includes('/panoplies') && !isSetPage);
  
  if (isItemPage || isWeaponPage || isSetPage) {
    statusEl.className = 'status success';
    statusText.textContent = '✅ Page détail détectée';
    document.getElementById('scrapeBtn').disabled = false;
    if (bulkBtn) bulkBtn.style.display = 'none';
    return true;
  } else if (isListPage) {
    statusEl.className = 'status success';
    statusText.textContent = '✅ Page liste détectée';
    document.getElementById('scrapeBtn').disabled = true;
    if (bulkBtn) {
      bulkBtn.style.display = 'flex';
      bulkBtn.textContent = '🚀 Scraper tout en détail';
    }
    return true;
  } else {
    statusEl.className = 'status warning';
    statusText.textContent = 'ℹ️ Naviguez vers une page';
    document.getElementById('scrapeBtn').disabled = true;
    if (bulkBtn) bulkBtn.style.display = 'none';
    return false;
  }
}

// Charger l'état du mode auto
async function loadAutoModeState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAutoMode' });
    const toggle = document.getElementById('autoModeToggle');
    toggle.checked = response?.autoMode || false;
    updateAutoModeDesc(response?.autoMode);
  } catch (err) {
    console.error('Erreur chargement mode auto:', err);
  }
}

// Toggle mode auto
async function toggleAutoMode() {
  const toggle = document.getElementById('autoModeToggle');
  const isEnabled = toggle.checked;
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'toggleAutoMode' });
    toggle.checked = response?.autoMode || false;
    updateAutoModeDesc(response?.autoMode);
    
    if (response?.autoMode) {
      showNotification('🤖 Mode Auto activé !', 'Les pages se scraperont automatiquement.');
    } else {
      showNotification('⏹️ Mode Auto désactivé', 'Retour au mode manuel.');
    }
  } catch (err) {
    console.error('Erreur toggle mode auto:', err);
    toggle.checked = !isEnabled;
  }
}

// Mettre à jour la description du mode auto
function updateAutoModeDesc(enabled) {
  const desc = document.getElementById('autoModeDesc');
  if (enabled) {
    desc.textContent = '✅ Actif - Navigation automatique activée';
    desc.className = 'auto-mode-desc active';
  } else {
    desc.textContent = 'Scrape automatiquement chaque page DofusBook visitée';
    desc.className = 'auto-mode-desc';
  }
}

// Scraper la page actuelle
async function scrapeCurrentPage() {
  const btn = document.getElementById('scrapeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Scraping...';
  
  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'scrape' });
    
    if (response?.success) {
      showNotification('✅ Succès !', `${response.data?.name || 'Item'} scrapé.`);
      await loadData();
    } else {
      showNotification('❌ Erreur', response?.error || 'Impossible de scraper');
    }
  } catch (err) {
    console.error('Erreur scraping:', err);
    showNotification('❌ Erreur', 'Rechargez la page et réessayez');
  } finally {
    btn.disabled = false;
    btn.textContent = '📥 Scraper cette page';
  }
}

// Démarrer le bulk scraping
async function startBulkScrape() {
  const btn = document.getElementById('bulkScrapeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Préparation...';
  
  try {
    // Envoyer le message au content script
    await chrome.tabs.sendMessage(currentTab.id, { action: 'startBulkScrape' });
    
    showNotification('🚀 Bulk Scraper', 'Démarrage du scraping en masse...');
    
    // Fermer le popup
    window.close();
  } catch (err) {
    console.error('Erreur bulk scrape:', err);
    showNotification('❌ Erreur', 'Impossible de démarrer le bulk scrape');
    btn.disabled = false;
    btn.textContent = '🚀 Scraper tout en détail';
  }
}

// Exporter toutes les données
async function exportAllData() {
  const btn = document.getElementById('exportBtn');
  
  if (scrapedData.totalScraped === 0) {
    showNotification('⚠️ Vide', 'Aucune donnée à exporter');
    return;
  }
  
  btn.disabled = true;
  btn.textContent = '⏳ Export...';
  
  try {
    await chrome.runtime.sendMessage({ action: 'exportAll' });
    showNotification('📤 Exporté !', `${scrapedData.totalScraped} éléments exportés.`);
  } catch (err) {
    console.error('Erreur export:', err);
    showNotification('❌ Erreur', 'Export échoué');
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 Exporter tout';
  }
}

// Vider toutes les données
async function clearAllData() {
  if (!confirm('⚠️ Voulez-vous vraiment supprimer toutes les données scrapées ?')) {
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({ action: 'clearData' });
    scrapedData = { items: [], panoplies: [], totalScraped: 0 };
    updateStats();
    showNotification('🗑️ Supprimé', 'Toutes les données ont été effacées');
  } catch (err) {
    console.error('Erreur suppression:', err);
  }
}

// Mettre à jour les stats affichées
function updateStats() {
  document.getElementById('itemCount').textContent = scrapedData.items?.length || 0;
  document.getElementById('setCount').textContent = scrapedData.panoplies?.length || 0;
  document.getElementById('totalCount').textContent = scrapedData.totalScraped || 0;
  
  // Afficher la liste récente
  updateRecentList();
}

// Mettre à jour la liste récente
function updateRecentList() {
  const recentDiv = document.getElementById('recentItems');
  const recentList = document.getElementById('recentList');
  
  if (scrapedData.totalScraped === 0) {
    recentDiv.style.display = 'none';
    return;
  }
  
  recentDiv.style.display = 'block';
  recentList.innerHTML = '';
  
  // Prendre les 5 derniers items
  const recent = [...(scrapedData.items || []), ...(scrapedData.panoplies || [])]
    .slice(-5)
    .reverse();
  
  recent.forEach(item => {
    const li = document.createElement('li');
    const level = item.level ? ` (Niv ${item.level})` : '';
    li.textContent = `${item.name}${level}`;
    recentList.appendChild(li);
  });
}

// Afficher une notification
function showNotification(title, message) {
  // Simple alert pour l'instant
  console.log(`${title}: ${message}`);
  
  // Mettre à jour le status temporairement
  const statusText = document.getElementById('statusText');
  const originalText = statusText.textContent;
  statusText.textContent = `${title} ${message}`;
  
  setTimeout(() => {
    statusText.textContent = originalText;
  }, 3000);
}
