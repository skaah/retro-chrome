/**
 * Bulk Detail Scraper - Content Script
 * Ouvre automatiquement les pages détaillées et scrape
 */

(function() {
  'use strict';

  // Éviter les doubles injections
  if (window.bulkScraperInjected) return;
  window.bulkScraperInjected = true;

  console.log('🔥 Bulk Detail Scraper injecté');

  let isRunning = false;
  let itemsToScrape = [];
  let currentIndex = 0;
  let scrapedCount = 0;
  let failedItems = [];

  // Configuration
  const CONFIG = {
    DELAY_BETWEEN_PAGES: 3000,  // 3 secondes entre chaque page
    DELAY_AFTER_LOAD: 2000,     // 2 secondes après chargement
    MAX_RETRIES: 2,
    AUTO_CLOSE: true            // Ferme l'onglet après scraping
  };

  // Écouter les commandes du popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'startBulkScrape':
        startBulkScraping(message.items);
        sendResponse({ started: true });
        break;
        
      case 'stopBulkScrape':
        stopBulkScraping();
        sendResponse({ stopped: true });
        break;
        
      case 'getBulkStatus':
        sendResponse({
          isRunning: isRunning,
          current: currentIndex,
          total: itemsToScrape.length,
          scraped: scrapedCount,
          failed: failedItems
        });
        break;
        
      case 'pageScraped':
        // Message reçu d'un onglet enfant
        handleChildScraped(message.data);
        sendResponse({ received: true });
        break;
    }
    return true;
  });

  // Vérifier si on est sur une page de liste
  function isListPage() {
    const url = window.location.href;
    return url.includes('/items') && !url.match(/\/items\/[^/]+$/) ||
           url.includes('/armes') && !url.match(/\/armes\/[^/]+$/) ||
           url.includes('/panoplies') && !url.match(/\/panoplies\/[^/]+$/);
  }

  // Extraire les liens des items de la page actuelle
  function extractItemsFromPage() {
    const items = [];
    const url = window.location.href;
    
    // Détecter le type de page
    let baseUrl = '';
    if (url.includes('/panoplies')) {
      baseUrl = 'https://retro.dofusbook.net/fr/encyclopedie/panoplies/';
    } else if (url.includes('/armes')) {
      baseUrl = 'https://retro.dofusbook.net/fr/encyclopedie/armes/';
    } else {
      baseUrl = 'https://retro.dofusbook.net/fr/encyclopedie/items/';
    }
    
    // Chercher tous les liens vers des items
    const links = document.querySelectorAll('a[href*="/encyclopedie/"]');
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      const match = href.match(/\/encyclopedie\/(items|armes|panoplies)\/([^/]+)/);
      
      if (match && match[2]) {
        const itemName = match[2];
        const displayName = link.textContent.trim() || itemName;
        
        // Éviter les doublons
        if (!items.find(i => i.url === href)) {
          items.push({
            name: displayName,
            url: href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`,
            slug: itemName
          });
        }
      }
    });
    
    // Alternative: chercher dans les data attributes ou les éléments avec les noms
    if (items.length === 0) {
      // Essayer de trouver les items dans les éléments de liste
      const itemElements = document.querySelectorAll('[class*="item"], [class*="card"], .encyclopedia-item');
      
      itemElements.forEach(el => {
        const nameEl = el.querySelector('h3, h4, .name, [class*="title"]');
        const linkEl = el.querySelector('a');
        
        if (nameEl && linkEl) {
          const href = linkEl.getAttribute('href');
          if (href) {
            items.push({
              name: nameEl.textContent.trim(),
              url: href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`,
              slug: href.split('/').pop()
            });
          }
        }
      });
    }
    
    console.log(`🔍 ${items.length} items trouvés sur la page`);
    return items;
  }

  // Démarrer le scraping en masse
  async function startBulkScraping(providedItems) {
    if (isRunning) {
      console.log('⏳ Déjà en cours');
      return;
    }
    
    isRunning = true;
    
    // Utiliser les items fournis ou extraire de la page
    if (providedItems && providedItems.length > 0) {
      itemsToScrape = providedItems;
    } else {
      itemsToScrape = extractItemsFromPage();
    }
    
    if (itemsToScrape.length === 0) {
      console.error('❌ Aucun item trouvé');
      showNotification('❌ Erreur', 'Aucun item trouvé sur cette page');
      isRunning = false;
      return;
    }
    
    currentIndex = 0;
    scrapedCount = 0;
    failedItems = [];
    
    console.log(`🚀 Démarrage du bulk scraping: ${itemsToScrape.length} items`);
    showNotification('🚀 Bulk Scraper', `${itemsToScrape.length} items à scraper`);
    
    // Créer l'interface de suivi
    createProgressUI();
    
    // Démarrer le processus
    processNextItem();
  }

  // Arrêter le scraping
  function stopBulkScraping() {
    isRunning = false;
    console.log('⏹️ Scraping arrêté');
    updateProgressUI();
  }

  // Traiter l'item suivant
  async function processNextItem() {
    if (!isRunning) return;
    
    if (currentIndex >= itemsToScrape.length) {
      // Terminé
      finishBulkScraping();
      return;
    }
    
    const item = itemsToScrape[currentIndex];
    updateProgressUI();
    
    try {
      console.log(`📄 [${currentIndex + 1}/${itemsToScrape.length}] Ouverture: ${item.name}`);
      
      // Ouvrir dans un nouvel onglet
      const newWindow = window.open(item.url, `_dofusbook_${Date.now()}`);
      
      if (!newWindow) {
        throw new Error('Popup bloqué');
      }
      
      // Attendre que la page charge et scrape
      await waitAndScrape(newWindow, item);
      
    } catch (err) {
      console.error(`❌ Erreur sur ${item.name}:`, err);
      failedItems.push({ item: item, error: err.message });
    }
    
    // Passer au suivant
    currentIndex++;
    
    // Délai avant le prochain
    if (isRunning && currentIndex < itemsToScrape.length) {
      setTimeout(processNextItem, CONFIG.DELAY_BETWEEN_PAGES);
    } else if (currentIndex >= itemsToScrape.length) {
      finishBulkScraping();
    }
  }

  // Attendre et scraper une page
  async function waitAndScrape(newWindow, item) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        try {
          // Vérifier si la page est chargée
          if (newWindow.document.readyState === 'complete') {
            clearInterval(checkInterval);
            
            // Attendre un peu plus pour le contenu dynamique
            setTimeout(() => {
              try {
                // Injecter le script de scraping dans le nouvel onglet
                const scrapedData = scrapeDetailPage(newWindow.document, item.url);
                
                if (scrapedData) {
                  // Sauvegarder
                  saveScrapedData(scrapedData);
                  scrapedCount++;
                  
                  // Fermer l'onglet si activé
                  if (CONFIG.AUTO_CLOSE) {
                    newWindow.close();
                  }
                  
                  resolve();
                } else {
                  reject(new Error('Scraping a échoué'));
                }
              } catch (err) {
                reject(err);
              }
            }, CONFIG.DELAY_AFTER_LOAD);
          }
        } catch (err) {
          // La fenêtre a peut-être été fermée ou cross-origin
          clearInterval(checkInterval);
          reject(err);
        }
        
        // Timeout après 10 secondes
        if (attempts > 50) {
          clearInterval(checkInterval);
          reject(new Error('Timeout de chargement'));
        }
      }, 200);
    });
  }

  // Scraper une page détaillée
  function scrapeDetailPage(doc, url) {
    const isPanoplie = url.includes('/panoplies/');
    
    if (isPanoplie) {
      return scrapePanoplieDetail(doc, url);
    } else {
      return scrapeItemDetail(doc, url);
    }
  }

  // Scraper détail d'un item
  function scrapeItemDetail(doc, url) {
    const data = {
      type: 'item',
      url: url,
      scraped_at: new Date().toISOString()
    };
    
    // Nom
    const nameEl = doc.querySelector('h1, .item-name, [item-name]');
    data.name = nameEl ? nameEl.textContent.trim() : 'Unknown';
    
    // Niveau
    const levelEl = doc.querySelector('.item-level, [item-level]');
    if (levelEl) {
      const match = levelEl.textContent.match(/(\d+)/);
      if (match) data.level = parseInt(match[1]);
    }
    
    // Type
    const typeEl = doc.querySelector('.item-type, [item-type]');
    data.item_type = typeEl ? typeEl.textContent.trim() : 'Inconnu';
    
    // Image
    const imgEl = doc.querySelector('.item-image img, [item-image] img');
    if (imgEl) data.image_url = imgEl.src;
    
    // Description
    const descEl = doc.querySelector('.item-description, [item-description]');
    if (descEl) data.description = descEl.textContent.trim();
    
    // Stats
    data.stats = {};
    const statsEls = doc.querySelectorAll('.stat, [class*="stat"]');
    statsEls.forEach(el => {
      const text = el.textContent;
      const match = text.match(/([^:]+):\s*(.+)/);
      if (match) {
        data.stats[normalizeStatName(match[1])] = match[2].trim();
      }
    });
    
    // Conditions
    const conditionsEl = doc.querySelector('.item-conditions, [item-conditions]');
    if (conditionsEl) {
      data.conditions = conditionsEl.textContent.trim();
    }
    
    // Recette
    data.recipe = [];
    const recipeEls = doc.querySelectorAll('.ingredient, .recipe-item');
    recipeEls.forEach(el => {
      const name = el.querySelector('.name, .ingredient-name')?.textContent?.trim();
      const qty = el.querySelector('.quantity, .qty')?.textContent?.trim();
      if (name) {
        data.recipe.push({ name, quantity: parseInt(qty) || 1 });
      }
    });
    
    return data;
  }

  // Scraper détail d'une panoplie
  function scrapePanoplieDetail(doc, url) {
    const data = {
      type: 'panoplie',
      url: url,
      scraped_at: new Date().toISOString()
    };
    
    // Nom
    const nameEl = doc.querySelector('h1, .set-name, [set-name]');
    data.name = nameEl ? nameEl.textContent.trim() : 'Unknown';
    
    // Niveau
    const levelEl = doc.querySelector('.set-level, [set-level]');
    if (levelEl) {
      const match = levelEl.textContent.match(/(\d+)/);
      if (match) data.level = parseInt(match[1]);
    }
    
    // Pièces
    data.pieces = [];
    const pieceEls = doc.querySelectorAll('.piece, [piece], .set-piece');
    pieceEls.forEach(el => {
      const name = el.querySelector('.name, .piece-name')?.textContent?.trim();
      const type = el.querySelector('.type, .piece-type')?.textContent?.trim();
      if (name) {
        data.pieces.push({ name, type: type || 'Inconnu' });
      }
    });
    
    // Bonus
    data.bonuses = {};
    const bonusEls = doc.querySelectorAll('.bonus, [bonus], .set-bonus');
    bonusEls.forEach(el => {
      const countMatch = el.textContent.match(/(\d+)\s*items?/i);
      if (countMatch) {
        const numItems = countMatch[1];
        const bonuses = {};
        
        el.querySelectorAll('.bonus-stat').forEach(statEl => {
          const text = statEl.textContent;
          const match = text.match(/([^:]+):\s*(.+)/);
          if (match) {
            bonuses[normalizeStatName(match[1])] = match[2].trim();
          }
        });
        
        if (Object.keys(bonuses).length > 0) {
          data.bonuses[`${numItems}_items`] = bonuses;
        }
      }
    });
    
    return data;
  }

  // Normaliser le nom d'une stat
  function normalizeStatName(name) {
    const mapping = {
      'vitalité': 'vitalite', 'vita': 'vitalite',
      'sagesse': 'sagesse', 'sag': 'sagesse',
      'force': 'force', 'for': 'force',
      'intelligence': 'intelligence', 'int': 'intelligence',
      'chance': 'chance', 'cha': 'chance',
      'agilité': 'agilite', 'agi': 'agilite',
      'pa': 'pa', 'points d\'action': 'pa',
      'pm': 'pm', 'points de mouvement': 'pm',
      'po': 'po', 'portée': 'po',
      'invocations': 'invocations', 'invoc': 'invocations',
      'initiative': 'initiative', 'init': 'initiative',
      'prospection': 'prospection', 'pp': 'prospection'
    };
    return mapping[name.toLowerCase().trim()] || name.toLowerCase().trim();
  }

  // Sauvegarder les données scrapées
  function saveScrapedData(data) {
    // Envoyer au background pour stockage
    chrome.runtime.sendMessage({
      action: 'saveData',
      data: data
    });
    
    // Télécharger aussi
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dofusbook_${data.type}_${data.name?.replace(/\s+/g, '_') || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Créer l'interface de suivi
  function createProgressUI() {
    // Supprimer l'ancienne UI si existe
    const oldUI = document.getElementById('bulk-scraper-ui');
    if (oldUI) oldUI.remove();
    
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
        padding: 15px 25px;
        border-radius: 12px;
        z-index: 999999;
        font-family: sans-serif;
        box-shadow: 0 4px 20px rgba(233, 69, 96, 0.4);
        min-width: 300px;
        text-align: center;
      ">
        <div style="font-weight: bold; margin-bottom: 10px;">🔥 Bulk Detail Scraper</div>
        <div id="bulk-progress-text">0 / 0 items</div>
        <div style="
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.3);
          border-radius: 3px;
          margin: 10px 0;
          overflow: hidden;
        ">
          <div id="bulk-progress-bar" style="
            width: 0%;
            height: 100%;
            background: white;
            transition: width 0.3s;
          "></div>
        </div>
        <div id="bulk-status" style="font-size: 12px; opacity: 0.9;">En attente...</div>
        <button id="bulk-stop-btn" style="
          margin-top: 10px;
          padding: 5px 15px;
          background: rgba(255,255,255,0.2);
          border: 1px solid white;
          color: white;
          border-radius: 6px;
          cursor: pointer;
        ">Arrêter</button>
      </div>
    `;
    
    document.body.appendChild(ui);
    
    // Event listener pour le bouton stop
    document.getElementById('bulk-stop-btn').addEventListener('click', stopBulkScraping);
  }

  // Mettre à jour l'interface
  function updateProgressUI() {
    const textEl = document.getElementById('bulk-progress-text');
    const barEl = document.getElementById('bulk-progress-bar');
    const statusEl = document.getElementById('bulk-status');
    
    if (textEl) {
      textEl.textContent = `${currentIndex} / ${itemsToScrape.length} items`;
    }
    
    if (barEl && itemsToScrape.length > 0) {
      const percent = (currentIndex / itemsToScrape.length) * 100;
      barEl.style.width = `${percent}%`;
    }
    
    if (statusEl) {
      if (!isRunning) {
        statusEl.textContent = '⏹️ Arrêté';
      } else if (currentIndex >= itemsToScrape.length) {
        statusEl.textContent = '✅ Terminé !';
      } else {
        statusEl.textContent = `🔄 Scraping: ${itemsToScrape[currentIndex]?.name || '...'}`;
      }
    }
  }

  // Terminer le scraping
  function finishBulkScraping() {
    isRunning = false;
    updateProgressUI();
    
    console.log(`✅ Bulk scraping terminé: ${scrapedCount}/${itemsToScrape.length} items scrapés`);
    showNotification('✅ Terminé !', `${scrapedCount} items scrapés avec succès`);
    
    if (failedItems.length > 0) {
      console.warn('❌ Items en échec:', failedItems);
    }
    
    // Garder l'UI visible quelques secondes puis la cacher
    setTimeout(() => {
      const ui = document.getElementById('bulk-scraper-ui');
      if (ui) {
        ui.style.opacity = '0';
        ui.style.transition = 'opacity 0.5s';
        setTimeout(() => ui.remove(), 500);
      }
    }, 5000);
  }

  // Afficher une notification
  function showNotification(title, message) {
    // Créer une notification toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #1a1a2e;
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      z-index: 999999;
      font-family: sans-serif;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      border-left: 4px solid #e94560;
      max-width: 300px;
    `;
    toast.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
      <div style="font-size: 13px; opacity: 0.9;">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Gérer un enfant scrapé
  function handleChildScraped(data) {
    console.log('📥 Enfant a scrapé:', data.name);
    scrapedCount++;
    updateProgressUI();
  }

  // Ajouter un bouton "Bulk Scrape" à l'interface existante
  function addBulkButton() {
    if (!isListPage()) return;
    
    // Attendre que le bouton flottant existe
    const checkInterval = setInterval(() => {
      const floatBtn = document.getElementById('dofusbook-scraper-float');
      if (floatBtn) {
        clearInterval(checkInterval);
        
        // Créer le bouton bulk
        const bulkBtn = document.createElement('div');
        bulkBtn.id = 'dofusbook-bulk-scrape-btn';
        bulkBtn.innerHTML = '🚀';
        bulkBtn.title = 'Scraper tous les items en détail';
        bulkBtn.style.cssText = `
          position: fixed;
          bottom: 80px;
          right: 20px;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          cursor: pointer;
          z-index: 999998;
          box-shadow: 0 4px 15px rgba(74, 222, 128, 0.4);
          transition: all 0.3s ease;
        `;
        
        bulkBtn.addEventListener('click', () => {
          startBulkScraping();
        });
        
        document.body.appendChild(bulkBtn);
      }
    }, 500);
  }

  // Initialiser
  if (isListPage()) {
    addBulkButton();
  }

  console.log('🔥 Bulk Detail Scraper prêt');

})();
