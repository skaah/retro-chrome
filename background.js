/**
 * Background Script - Gère le mode auto et le stockage
 */

// État global
let autoMode = false;
let scrapedData = {
  items: [],
  panoplies: [],
  totalScraped: 0
};

// URLs déjà scrapées (évite les doublons)
let scrapedUrls = new Set();

// Initialisation
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔥 DofusBook Retro Scraper v1.1.0 installé');
  
  // Charger les données sauvegardées
  chrome.storage.local.get(['scrapedData', 'scrapedUrls', 'autoMode'], (result) => {
    if (result.scrapedData) scrapedData = result.scrapedData;
    if (result.scrapedUrls) scrapedUrls = new Set(result.scrapedUrls);
    if (result.autoMode) autoMode = result.autoMode;
  });
});

// Écouter les messages du content script et popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getData':
      sendResponse({
        scrapedData: scrapedData,
        scrapedUrls: Array.from(scrapedUrls),
        autoMode: autoMode
      });
      break;
      
    case 'saveData':
      if (message.data) {
        saveScrapedData(message.data);
        sendResponse({ success: true });
      }
      break;
      
    case 'toggleAutoMode':
      autoMode = !autoMode;
      chrome.storage.local.set({ autoMode: autoMode });
      
      // Informer tous les onglets
      chrome.tabs.query({ url: "https://retro.dofusbook.net/*" }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'autoModeChanged', 
            enabled: autoMode 
          }).catch(() => {});
        });
      });
      
      sendResponse({ autoMode: autoMode });
      break;
      
    case 'getAutoMode':
      sendResponse({ autoMode: autoMode });
      break;
      
    case 'clearData':
      scrapedData = { items: [], panoplies: [], totalScraped: 0 };
      scrapedUrls = new Set();
      chrome.storage.local.set({ 
        scrapedData: scrapedData, 
        scrapedUrls: [] 
      });
      sendResponse({ success: true });
      break;
      
    case 'exportAll':
      exportAllData();
      sendResponse({ success: true });
      break;
      
    case 'isUrlScraped':
      sendResponse({ scraped: scrapedUrls.has(message.url) });
      break;
  }
  
  return true; // Keep channel open for async
});

// Sauvegarder les données scrapées
function saveScrapedData(data) {
  const url = data.url || data.dofusbook_url;
  
  // Éviter les doublons
  if (url && scrapedUrls.has(url)) {
    console.log('⏭️ URL déjà scrapée:', url);
    return;
  }
  
  // Marquer comme scrapée
  if (url) scrapedUrls.add(url);
  
  // Ajouter aux données
  if (data.type === 'item' || data.items) {
    const items = data.items || [data];
    items.forEach(item => {
      if (!scrapedData.items.find(i => i.name === item.name)) {
        scrapedData.items.push(item);
        scrapedData.totalScraped++;
      }
    });
  }
  
  if (data.type === 'panoplie' || data.panoplie) {
    const panoplie = data.panoplie || data;
    if (!scrapedData.panoplies.find(p => p.name === panoplie.name)) {
      scrapedData.panoplies.push(panoplie);
      scrapedData.totalScraped++;
    }
  }
  
  // Sauvegarder
  chrome.storage.local.set({
    scrapedData: scrapedData,
    scrapedUrls: Array.from(scrapedUrls)
  });
  
  // Notification
  chrome.notifications?.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '🔥 DofusBook Scraper',
    message: `✅ ${data.name || 'Item'} scrapé ! Total: ${scrapedData.totalScraped}`
  });
  
  console.log('💾 Données sauvegardées:', data.name, '| Total:', scrapedData.totalScraped);
}

// Exporter toutes les données
function exportAllData() {
  if (scrapedData.totalScraped === 0) {
    console.log('⚠️ Aucune donnée à exporter');
    return;
  }
  
  const exportData = {
    export_date: new Date().toISOString(),
    source: 'DofusBook Retro Scraper - Mode Auto',
    total_items: scrapedData.items.length,
    total_panoplies: scrapedData.panoplies.length,
    items: scrapedData.items,
    panoplies: scrapedData.panoplies
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: `dofusbook_auto_export_${Date.now()}.json`,
    saveAs: true
  });
  
  console.log('📤 Export de', scrapedData.totalScraped, 'éléments');
}

// Détecter la navigation sur DofusBook
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!autoMode) return;
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.includes('retro.dofusbook.net')) return;
  
  // Vérifier si c'est une page d'item ou panoplie
  const isItemPage = tab.url.includes('/items/');
  const isSetPage = tab.url.includes('/panoplies/');
  
  if (isItemPage || isSetPage) {
    // Attendre que la page soit complètement chargée
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { 
        action: 'autoScrape',
        url: tab.url 
      }).catch(err => console.log('Tab not ready:', err));
    }, 2000);
  }
});

console.log('🔥 Background script loaded');
