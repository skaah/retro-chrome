/**
 * Bulk Detail Scraper - Version Robust
 * Ouvre automatiquement les pages détaillées et scrape
 */

(function() {
  'use strict';

  console.log('🔥 Bulk Detail Scraper v2.0 injecté');

  // État global
  let isRunning = false;
  let itemsToScrape = [];
  let currentIndex = 0;
  let scrapedCount = 0;
  let failedItems = [];
  let currentWindow = null;

  // Configuration
  const CONFIG = {
    DELAY_BETWEEN_PAGES: 4000,  // 4 secondes entre chaque page
    DELAY_AFTER_LOAD: 2500,     // 2.5 secondes après chargement
    MAX_RETRIES: 2
  };

  // Écouter les commandes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Message reçu:', message.action);
    
    switch (message.action) {
      case 'startBulkScrape':
        if (!isRunning) {
          startBulkScraping();
          sendResponse({ success: true, message: 'Démarré' });
        } else {
          sendResponse({ success: false, message: 'Déjà en cours' });
        }
        break;
        
      case 'stopBulkScrape':
        stopBulkScraping();
        sendResponse({ success: true });
        break;
        
      case 'getBulkStatus':
        sendResponse({
          isRunning: isRunning,
          current: currentIndex,
          total: itemsToScrape.length,
          scraped: scrapedCount
        });
        break;
        
      default:
        sendResponse({ success: false, message: 'Action inconnue' });
    }
    return true;
  });

  // Vérifier si on est sur une page de liste
  function isListPage() {
    const url = window.location.href;
    const isItemsList = url.includes('/items') && !url.match(/\/items\/[^/]+$/);
    const isWeaponsList = url.includes('/armes') && !url.match(/\/armes\/[^/]+$/);
    const isSetsList = url.includes('/panoplies') && !url.match(/\/panoplies\/[^/]+$/);
    
    return isItemsList || isWeaponsList || isSetsList;
  }

  // Extraire les liens des items
  function extractItemsFromPage() {
    const items = [];
    const url = window.location.href;
    
    console.log('🔍 Extraction des items...');
    
    // Méthode 1: Chercher les liens avec href contenant /items/, /armes/, /panoplies/
    const allLinks = document.querySelectorAll('a[href*="/encyclopedie/"]');
    console.log(`🔗 ${allLinks.length} liens trouvés`);
    
    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      
      // Matcher les URLs d'items/armes/panoplies
      const match = href.match(/\/encyclopedie\/(items|armes|panoplies)\/([^/]+)/);
      
      if (match && match[2] && match[2] !== 'items' && match[2] !== 'armes' && match[2] !== 'panoplies') {
        const itemName = decodeURIComponent(match[2]).replace(/-/g, ' ');
        const fullUrl = href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`;
        
        // Éviter les doublons
        if (!items.find(i => i.url === fullUrl)) {
          items.push({
            name: itemName,
            url: fullUrl,
            slug: match[2]
          });
        }
      }
    });
    
    // Méthode 2: Chercher les éléments avec data-item-id ou classes spécifiques
    if (items.length === 0) {
      console.log('🔍 Méthode 2: Chercher dans les cartes...');
      
      const cards = document.querySelectorAll('[class*="item"], [class*="card"], .encyclopedia-entry, [data-item-id]');
      
      cards.forEach(card => {
        const link = card.querySelector('a') || card.closest('a');
        if (link) {
          const href = link.getAttribute('href');
          if (href) {
            const match = href.match(/\/encyclopedie\/(items|armes|panoplies)\/([^/]+)/);
            if (match && match[2]) {
              const nameEl = card.querySelector('h3, h4, .name, [class*="title"]') || link;
              const fullUrl = href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`;
              
              if (!items.find(i => i.url === fullUrl)) {
                items.push({
                  name: nameEl.textContent.trim() || match[2],
                  url: fullUrl,
                  slug: match[2]
                });
              }
            }
          }
        }
      });
    }
    
    console.log(`✅ ${items.length} items extraits`);
    return items;
  }

  // Démarrer le scraping
  async function startBulkScraping() {
    if (isRunning) {
      console.log('⏳ Déjà en cours');
      return;
    }
    
    // Vérifier qu'on est sur une page liste
    if (!isListPage()) {
      alert('❌ Vous devez être sur une page liste (/items, /armes, ou /panoplies)');
      return;
    }
    
    isRunning = true;
    itemsToScrape = extractItemsFromPage();
    
    if (itemsToScrape.length === 0) {
      alert('❌ Aucun item trouvé sur cette page');
      isRunning = false;
      return;
    }
    
    currentIndex = 0;
    scrapedCount = 0;
    failedItems = [];
    
    console.log(`🚀 Démarrage bulk scraping: ${itemsToScrape.length} items`);
    
    // Créer l'interface
    createProgressUI();
    
    // Démarrer
    processNextItem();
  }

  // Arrêter
  function stopBulkScraping() {
    isRunning = false;
    console.log('⏹️ Arrêt demandé');
    updateProgressUI('⏹️ Arrêté par l\'utilisateur');
    
    if (currentWindow && !currentWindow.closed) {
      currentWindow.close();
    }
  }

  // Traiter l'item suivant
  async function processNextItem() {
    if (!isRunning) return;
    
    if (currentIndex >= itemsToScrape.length) {
      finishBulkScraping();
      return;
    }
    
    const item = itemsToScrape[currentIndex];
    updateProgressUI(`🔄 Ouverture: ${item.name}`);
    
    try {
      // Ouvrir dans un nouvel onglet
      currentWindow = window.open(item.url, `_dofusbook_bulk_${Date.now()}`);
      
      if (!currentWindow) {
        throw new Error('Popup bloqué - Vérifiez les paramètres de Chrome');
      }
      
      // Attendre et scraper
      await waitAndScrape(item);
      
    } catch (err) {
      console.error(`❌ Erreur sur ${item.name}:`, err);
      failedItems.push({ item: item, error: err.message });
      
      // Continuer malgré l'erreur
      currentIndex++;
      if (isRunning) {
        setTimeout(processNextItem, 1000);
      }
    }
  }

  // Attendre et scraper
  async function waitAndScrape(item) {
    return new Promise((resolve, reject) => {
      let checkCount = 0;
      const maxChecks = 50; // 10 secondes max
      
      const checkInterval = setInterval(() => {
        checkCount++;
        
        try {
          // Vérifier si la fenêtre est fermée
          if (currentWindow.closed) {
            clearInterval(checkInterval);
            reject(new Error('Fenêtre fermée'));
            return;
          }
          
          // Vérifier si la page est chargée
          if (currentWindow.document && currentWindow.document.readyState === 'complete') {
            clearInterval(checkInterval);
            
            updateProgressUI(`⏳ Scraping: ${item.name}`);
            
            // Attendre un peu pour le contenu dynamique
            setTimeout(() => {
              try {
                scrapeInWindow(item);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, CONFIG.DELAY_AFTER_LOAD);
          }
        } catch (err) {
          // Cross-origin ou autre erreur
          clearInterval(checkInterval);
          reject(err);
        }
        
        if (checkCount > maxChecks) {
          clearInterval(checkInterval);
          reject(new Error('Timeout'));
        }
      }, 200);
    });
  }

  // Scraper dans la fenêtre ouverte
  function scrapeInWindow(item) {
    const doc = currentWindow.document;
    const url = item.url;
    
    // Détecter le type
    const isPanoplie = url.includes('/panoplies/');
    
    let data;
    if (isPanoplie) {
      data = scrapePanoplieDetail(doc, url, item.name);
    } else {
      data = scrapeItemDetail(doc, url, item.name);
    }
    
    if (data) {
      // Sauvegarder
      saveScrapedData(data);
      scrapedCount++;
      
      // Fermer la fenêtre
      currentWindow.close();
      currentWindow = null;
      
      // Passer au suivant
      currentIndex++;
      if (isRunning) {
        setTimeout(processNextItem, CONFIG.DELAY_BETWEEN_PAGES);
      }
    } else {
      throw new Error('Aucune donnée extraite');
    }
  }

  // Scraper détail item
  function scrapeItemDetail(doc, url, fallbackName) {
    const data = {
      type: 'item',
      url: url,
      scraped_at: new Date().toISOString()
    };
    
    try {
      // Nom
      const nameEl = doc.querySelector('h1');
      data.name = nameEl ? nameEl.textContent.trim() : fallbackName;
      
      // Chercher dans toute la page pour le niveau
      const bodyText = doc.body.innerText;
      const levelMatch = bodyText.match(/niveau\s+(\d+)/i);
      if (levelMatch) data.level = parseInt(levelMatch[1]);
      
      // Type (chercher dans le texte)
      const typeMatch = bodyText.match(/(Anneau|Amulette|Chapeau|Cape|Ceinture|Bottes|Arme|Epée|Arc|Baguette)/i);
      if (typeMatch) data.item_type = typeMatch[1];
      
      // Image
      const imgEl = doc.querySelector('img[src*="items"], img[src*="armes"]');
      if (imgEl) data.image_url = imgEl.src;
      
      // Description
      const descMatch = bodyText.match(/description[\s:]+([^\n]+)/i);
      if (descMatch) data.description = descMatch[1].trim();
      
      // Stats - chercher tous les nombres avec labels
      data.stats = {};
      const statPatterns = [
        /vitalit[eé][\s:]+(\d+)/i,
        /sagesse[\s:]+(\d+)/i,
        /force[\s:]+(\d+)/i,
        /intelligence[\s:]+(\d+)/i,
        /chance[\s:]+(\d+)/i,
        /agilit[eé][\s:]+(\d+)/i,
        /PA[\s:]+([+-]?\d+)/i,
        /PM[\s:]+([+-]?\d+)/i,
        /Port[eé]e[\s:]+(\d+)/i
      ];
      
      statPatterns.forEach(pattern => {
        const match = bodyText.match(pattern);
        if (match) {
          const statName = pattern.toString().match(/\/\^([a-zA-Z]+)/)[1].toLowerCase();
          data.stats[statName] = parseInt(match[1]);
        }
      });
      
      // Recette - chercher les ingrédients
      data.recipe = [];
      const recipeSection = bodyText.match(/recette[\s\S]*?(?=panoplie|$)/i);
      if (recipeSection) {
        const ingredientMatches = recipeSection[0].matchAll(/(\d+)\s*x?\s*([^,\n]+)/g);
        for (const match of ingredientMatches) {
          if (match[1] && match[2]) {
            data.recipe.push({
              quantity: parseInt(match[1]),
              name: match[2].trim()
            });
          }
        }
      }
      
      console.log('✅ Item scrapé:', data.name, 'Niveau:', data.level);
      return data;
      
    } catch (err) {
      console.error('Erreur scraping:', err);
      return null;
    }
  }

  // Scraper détail panoplie
  function scrapePanoplieDetail(doc, url, fallbackName) {
    const data = {
      type: 'panoplie',
      url: url,
      scraped_at: new Date().toISOString()
    };
    
    try {
      // Nom
      const nameEl = doc.querySelector('h1');
      data.name = nameEl ? nameEl.textContent.trim() : fallbackName;
      
      // Niveau
      const bodyText = doc.body.innerText;
      const levelMatch = bodyText.match(/niveau\s+(\d+)/i);
      if (levelMatch) data.level = parseInt(levelMatch[1]);
      
      // Pièces - chercher tous les liens d'items
      data.pieces = [];
      const pieceLinks = doc.querySelectorAll('a[href*="/items/"]');
      pieceLinks.forEach(link => {
        const name = link.textContent.trim();
        if (name && !data.pieces.find(p => p.name === name)) {
          data.pieces.push({ name: name, type: 'Inconnu' });
        }
      });
      
      // Bonus
      data.bonuses = {};
      const bonusMatch = bodyText.match(/(\d+)\s*items?[\s:]*([\s\S]*?)(?=\d+\s*items?|$)/gi);
      if (bonusMatch) {
        bonusMatch.forEach(match => {
          const numMatch = match.match(/(\d+)\s*items?/);
          if (numMatch) {
            data.bonuses[`${numMatch[1]}_items`] = match;
          }
        });
      }
      
      console.log('✅ Panoplie scrapée:', data.name, 'Pièces:', data.pieces.length);
      return data;
      
    } catch (err) {
      console.error('Erreur scraping panoplie:', err);
      return null;
    }
  }

  // Sauvegarder
  function saveScrapedData(data) {
    // Envoyer au background
    chrome.runtime.sendMessage({
      action: 'saveData',
      data: data
    }).catch(err => console.log('Erreur envoi background:', err));
    
    // Télécharger
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dofusbook_${data.type}_${data.name?.replace(/\s+/g, '_') || Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Interface de progression
  function createProgressUI() {
    const existing = document.getElementById('bulk-scraper-ui');
    if (existing) existing.remove();
    
    const ui = document.createElement('div');
    ui.id = 'bulk-scraper-ui';
    ui.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #e94560 0%, #c73e54 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 8px 30px rgba(233, 69, 96, 0.4);
        min-width: 350px;
        text-align: center;
      ">
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">
          🔥 Bulk Detail Scraper
        </div>
        <div id="bulk-progress-text" style="font-size: 14px; margin-bottom: 10px;">
          0 / ${itemsToScrape.length} items
        </div>
        <div style="
          width: 100%;
          height: 8px;
          background: rgba(255,255,255,0.3);
          border-radius: 4px;
          overflow: hidden;
          margin: 10px 0;
        ">
          <div id="bulk-progress-bar" style="
            width: 0%;
            height: 100%;
            background: white;
            transition: width 0.3s;
          "></div>
        </div>
        <div id="bulk-status" style="font-size: 13px; opacity: 0.9; margin-bottom: 10px;">
          Préparation...
        </div>
        <button id="bulk-stop-btn" style="
          padding: 8px 20px;
          background: rgba(255,255,255,0.2);
          border: 1px solid white;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        ">⏹️ Arrêter</button>
      </div>
    `;
    
    document.body.appendChild(ui);
    
    document.getElementById('bulk-stop-btn').addEventListener('click', stopBulkScraping);
  }

  // Mettre à jour l'interface
  function updateProgressUI(status) {
    const textEl = document.getElementById('bulk-progress-text');
    const barEl = document.getElementById('bulk-progress-bar');
    const statusEl = document.getElementById('bulk-status');
    
    if (textEl) {
      textEl.textContent = `${currentIndex} / ${itemsToScrape.length} items (${scrapedCount} réussis)`;
    }
    
    if (barEl && itemsToScrape.length > 0) {
      const percent = (currentIndex / itemsToScrape.length) * 100;
      barEl.style.width = `${percent}%`;
    }
    
    if (statusEl && status) {
      statusEl.textContent = status;
    }
  }

  // Terminer
  function finishBulkScraping() {
    isRunning = false;
    updateProgressUI(`✅ Terminé ! ${scrapedCount}/${itemsToScrape.length} items scrapés`);
    
    console.log(`✅ Bulk scraping terminé: ${scrapedCount}/${itemsToScrape.length}`);
    
    if (failedItems.length > 0) {
      console.warn('❌ Échecs:', failedItems);
    }
    
    setTimeout(() => {
      const ui = document.getElementById('bulk-scraper-ui');
      if (ui) {
        ui.style.opacity = '0';
        ui.style.transition = 'opacity 0.5s';
        setTimeout(() => ui.remove(), 500);
      }
    }, 5000);
  }

  // Ajouter un bouton bulk sur les pages liste
  function addBulkButton() {
    if (!isListPage()) return;
    if (document.getElementById('dofusbook-bulk-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'dofusbook-bulk-btn';
    btn.innerHTML = '🚀 Scraper tout';
    btn.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 25px;
      font-weight: bold;
      cursor: pointer;
      z-index: 999998;
      box-shadow: 0 4px 15px rgba(74, 222, 128, 0.4);
      font-family: sans-serif;
      font-size: 14px;
    `;
    
    btn.addEventListener('click', () => {
      if (confirm(`🚀 Scraper tous les items de cette page en détail ?\n\nCela ouvrira ${extractItemsFromPage().length} onglets un par un.`)) {
        startBulkScraping();
      }
    });
    
    document.body.appendChild(btn);
    console.log('✅ Bouton bulk ajouté');
  }

  // Initialiser
  if (isListPage()) {
    console.log('📄 Page liste détectée - Ajout du bouton bulk');
    setTimeout(addBulkButton, 1000);
  }

  console.log('🔥 Bulk Detail Scraper v2.0 prêt');

})();
