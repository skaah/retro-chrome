/**
 * DofusBook Bulk Scraper - v3.0
 * Scrape automatiquement tous les items d'une page liste
 * 
 * UTILISATION:
 * 1. Copie ce script dans la console DevTools (F12 > Console)
 * 2. Appuie sur Entrée
 * 3. Le scraping démarre automatiquement
 */

(function() {
  'use strict';
  
  if (window.bulkScraperRunning) {
    console.log('⚠️ Déjà en cours');
    return;
  }
  
  window.bulkScraperRunning = true;
  
  // Configuration
  const CONFIG = {
    DELAY_BETWEEN_PAGES: 5000,  // 5 secondes entre chaque page
    DELAY_AFTER_LOAD: 3000      // 3 secondes après chargement
  };
  
  let items = [];
  let currentIndex = 0;
  let scrapedCount = 0;
  let allData = [];
  
  console.log('🔥 DofusBook Bulk Scraper v3.0');
  console.log('📍 Page:', window.location.href);
  
  // =============================================================================
  // ÉTAPE 1: EXTRAIRE LES LIENS
  // =============================================================================
  
  function extractItems() {
    console.log('🔍 Recherche des items...');
    
    // Méthode 1: Chercher les liens avec l'icône "fa-right-to-bracket" (flèche vers droite)
    const arrowLinks = document.querySelectorAll('a:has(.fa-right-to-bracket), a:has([data-icon="right-to-bracket"])');
    console.log(`➡️  Trouvé ${arrowLinks.length} liens avec flèche`);
    
    arrowLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !items.find(i => i.url === href)) {
        // Chercher le nom de l'item dans les éléments parents ou frères
        let name = 'Unknown';
        
        // Essayer de trouver le nom dans l'élément parent
        const card = link.closest('[class*="item"], [class*="card"], tr, li');
        if (card) {
          const nameEl = card.querySelector('h3, h4, .name, [class*="title"], strong');
          if (nameEl) {
            name = nameEl.textContent.trim();
          }
        }
        
        // Si pas trouvé, utiliser le slug de l'URL
        if (name === 'Unknown') {
          const slug = href.split('/').pop();
          name = decodeURIComponent(slug).replace(/-/g, ' ');
        }
        
        items.push({
          name: name,
          url: href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`,
          slug: href.split('/').pop()
        });
      }
    });
    
    // Méthode 2: Chercher tous les liens vers /items/, /armes/, /panoplies/ qui ne sont pas la page actuelle
    if (items.length === 0) {
      const allLinks = document.querySelectorAll('a[href*="/encyclopedie/"]');
      
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Matcher les URLs d'items/armes/panoplies détaillées (avec un slug après)
        const match = href.match(/\/encyclopedie\/(items|armes|panoplies)\/([^/]+)$/);
        
        if (match && match[2]) {
          const slug = match[2];
          // Éviter les pages génériques
          if (['items', 'armes', 'panoplies'].includes(slug)) return;
          
          const fullUrl = href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`;
          
          if (!items.find(i => i.url === fullUrl)) {
            const name = link.textContent.trim() || decodeURIComponent(slug).replace(/-/g, ' ');
            items.push({ name, url: fullUrl, slug });
          }
        }
      });
    }
    
    // Méthode 3: Chercher les lignes de tableau ou cartes
    if (items.length === 0) {
      const rows = document.querySelectorAll('tr, [class*="row"], [class*="item"]');
      
      rows.forEach(row => {
        const link = row.querySelector('a[href*="/items/"], a[href*="/armes/"], a[href*="/panoplies/"]');
        if (link) {
          const href = link.getAttribute('href');
          const fullUrl = href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`;
          
          if (!items.find(i => i.url === fullUrl)) {
            const name = link.textContent.trim();
            items.push({ name, url: fullUrl, slug: href.split('/').pop() });
          }
        }
      });
    }
    
    console.log(`✅ ${items.length} items trouvés`);
    items.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.name}`);
    });
    
    return items;
  }
  
  // =============================================================================
  // ÉTAPE 2: INTERFACE UTILISATEUR
  // =============================================================================
  
  function createUI() {
    const ui = document.createElement('div');
    ui.id = 'bulk-scraper-ui';
    ui.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
        padding: 25px;
        border-radius: 15px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        min-width: 400px;
        text-align: center;
        border: 2px solid #e94560;
      ">
        <div style="font-weight: bold; font-size: 20px; margin-bottom: 15px; color: #e94560;">
          🔥 Bulk Detail Scraper
        </div>
        
        <div id="bulk-progress-text" style="font-size: 16px; margin-bottom: 15px;">
          Prêt à scraper ${items.length} items
        </div>
        
        <div style="
          width: 100%;
          height: 10px;
          background: rgba(255,255,255,0.1);
          border-radius: 5px;
          overflow: hidden;
          margin: 15px 0;
        ">
          <div id="bulk-progress-bar" style="
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            transition: width 0.3s;
          "></div>
        </div>
        
        <div id="bulk-status" style="font-size: 14px; opacity: 0.9; margin-bottom: 15px; color: #a0a0a0;">
          Cliquez sur "Démarrer" pour commencer
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="bulk-start-btn" style="
            padding: 12px 25px;
            background: linear-gradient(135deg, #e94560 0%, #c73e54 100%);
            border: none;
            color: white;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
          ">🚀 Démarrer</button>
          
          <button id="bulk-stop-btn" style="
            padding: 12px 25px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            display: none;
          ">⏹️ Arrêter</button>
          
          <button id="bulk-close-btn" style="
            padding: 12px 25px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
          ">❌ Fermer</button>
        </div>
        
        <div id="bulk-results" style="
          margin-top: 15px;
          padding: 10px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          font-size: 12px;
          text-align: left;
          max-height: 150px;
          overflow-y: auto;
          display: none;
        "></div>
      </div>
    `;
    
    document.body.appendChild(ui);
    
    // Event listeners
    document.getElementById('bulk-start-btn').addEventListener('click', startScraping);
    document.getElementById('bulk-stop-btn').addEventListener('click', stopScraping);
    document.getElementById('bulk-close-btn').addEventListener('click', () => {
      window.bulkScraperRunning = false;
      document.getElementById('bulk-scraper-ui').remove();
    });
  }
  
  function updateUI(status, progress = null) {
    const textEl = document.getElementById('bulk-progress-text');
    const barEl = document.getElementById('bulk-progress-bar');
    const statusEl = document.getElementById('bulk-status');
    const resultsEl = document.getElementById('bulk-results');
    
    if (textEl) {
      textEl.textContent = `${currentIndex} / ${items.length} items (${scrapedCount} réussis)`;
    }
    
    if (barEl && items.length > 0) {
      const percent = progress !== null ? progress : (currentIndex / items.length) * 100;
      barEl.style.width = `${percent}%`;
    }
    
    if (statusEl && status) {
      statusEl.textContent = status;
      statusEl.style.color = '#fff';
    }
    
    if (resultsEl && scrapedCount > 0) {
      resultsEl.style.display = 'block';
      resultsEl.innerHTML = allData.map(d => `✅ ${d.name} (Niv ${d.level || '?'})`).join('<br>');
    }
  }
  
  // =============================================================================
  // ÉTAPE 3: SCRAPER UN ITEM
  // =============================================================================
  
  async function scrapeItem(item) {
    console.log(`📄 [${currentIndex + 1}/${items.length}] Scraping: ${item.name}`);
    updateUI(`📄 Ouverture: ${item.name}`);
    
    return new Promise((resolve, reject) => {
      // Ouvrir dans un nouvel onglet
      const newWindow = window.open(item.url, `_dofusbook_${Date.now()}`);
      
      if (!newWindow) {
        reject(new Error('Popup bloqué ! Autorisez les popups pour ce site.'));
        return;
      }
      
      let checkCount = 0;
      const maxChecks = 100; // 20 secondes max
      
      const checkInterval = setInterval(() => {
        checkCount++;
        
        try {
          // Vérifier si fermé
          if (newWindow.closed) {
            clearInterval(checkInterval);
            reject(new Error('Fenêtre fermée'));
            return;
          }
          
          // Vérifier si chargé
          if (newWindow.document && newWindow.document.readyState === 'complete') {
            clearInterval(checkInterval);
            
            updateUI(`⏳ Extraction des données...`);
            
            setTimeout(() => {
              try {
                const data = extractDataFromWindow(newWindow, item);
                
                if (data) {
                  allData.push(data);
                  scrapedCount++;
                  
                  // Télécharger individuellement
                  downloadJSON(data, `dofusbook_${data.name.replace(/\s+/g, '_')}.json`);
                  
                  // Fermer
                  newWindow.close();
                  
                  console.log(`✅ ${data.name} scrapé (Niv ${data.level || '?'})`);
                  resolve(data);
                } else {
                  newWindow.close();
                  reject(new Error('Aucune donnée extraite'));
                }
              } catch (err) {
                newWindow.close();
                reject(err);
              }
            }, CONFIG.DELAY_AFTER_LOAD);
          }
        } catch (err) {
          clearInterval(checkInterval);
          reject(err);
        }
        
        if (checkCount > maxChecks) {
          clearInterval(checkInterval);
          newWindow.close();
          reject(new Error('Timeout'));
        }
      }, 200);
    });
  }
  
  function extractDataFromWindow(win, item) {
    const doc = win.document;
    const url = item.url;
    const bodyText = doc.body.innerText;
    
    const isPanoplie = url.includes('/panoplies/');
    
    if (isPanoplie) {
      return extractPanoplieData(doc, bodyText, url, item.name);
    } else {
      return extractItemData(doc, bodyText, url, item.name);
    }
  }
  
  function extractItemData(doc, bodyText, url, fallbackName) {
    const data = {
      type: 'item',
      name: fallbackName,
      url: url,
      scraped_at: new Date().toISOString()
    };
    
    try {
      // Nom - chercher h1
      const h1 = doc.querySelector('h1');
      if (h1) data.name = h1.textContent.trim();
      
      // Niveau
      const levelMatch = bodyText.match(/niveau\s+(\d+)/i);
      if (levelMatch) data.level = parseInt(levelMatch[1]);
      
      // Type
      const typePatterns = ['Anneau', 'Amulette', 'Chapeau', 'Cape', 'Ceinture', 'Bottes', 
                           'Epée', 'Arc', 'Baguette', 'Bâton', 'Dague', 'Hache', 'Marteau', 'Pelle'];
      for (const type of typePatterns) {
        if (bodyText.includes(type)) {
          data.item_type = type;
          break;
        }
      }
      
      // Image
      const img = doc.querySelector('img[src*="items"], img[src*="armes"]');
      if (img) data.image_url = img.src;
      
      // Stats
      data.stats = {};
      const statRegexes = [
        [/vitalit[eé]\s*:?\s*([+-]?\d+)/i, 'vitalite'],
        [/sagesse\s*:?\s*([+-]?\d+)/i, 'sagesse'],
        [/force\s*:?\s*([+-]?\d+)/i, 'force'],
        [/intelligence\s*:?\s*([+-]?\d+)/i, 'intelligence'],
        [/chance\s*:?\s*([+-]?\d+)/i, 'chance'],
        [/agilit[eé]\s*:?\s*([+-]?\d+)/i, 'agilite'],
        [/PA\s*:?\s*([+-]?\d+)/i, 'pa'],
        [/PM\s*:?\s*([+-]?\d+)/i, 'pm'],
        [/port[eé]e\s*:?\s*([+-]?\d+)/i, 'portee'],
        [/invocations?\s*:?\s*([+-]?\d+)/i, 'invocations']
      ];
      
      for (const [regex, statName] of statRegexes) {
        const match = bodyText.match(regex);
        if (match) {
          data.stats[statName] = parseInt(match[1]);
        }
      }
      
      // Recette
      data.recipe = [];
      if (bodyText.includes('Recette')) {
        const recipeSection = bodyText.substring(bodyText.indexOf('Recette'));
        const lines = recipeSection.split('\n').slice(0, 20);
        
        for (const line of lines) {
          const match = line.match(/(\d+)\s*x?\s*([^,\n]+)/);
          if (match && match[1] && match[2]) {
            const qty = parseInt(match[1]);
            if (qty > 0 && qty < 1000) {
              data.recipe.push({
                quantity: qty,
                name: match[2].trim()
              });
            }
          }
        }
      }
      
      return data;
      
    } catch (err) {
      console.error('Erreur extraction:', err);
      return data;
    }
  }
  
  function extractPanoplieData(doc, bodyText, url, fallbackName) {
    const data = {
      type: 'panoplie',
      name: fallbackName,
      url: url,
      scraped_at: new Date().toISOString()
    };
    
    try {
      // Nom
      const h1 = doc.querySelector('h1');
      if (h1) data.name = h1.textContent.trim();
      
      // Niveau
      const levelMatch = bodyText.match(/niveau\s+(\d+)/i);
      if (levelMatch) data.level = parseInt(levelMatch[1]);
      
      // Pièces
      data.pieces = [];
      const pieceLinks = doc.querySelectorAll('a[href*="/items/"]');
      pieceLinks.forEach(link => {
        const name = link.textContent.trim();
        if (name && name.length > 2 && !data.pieces.find(p => p.name === name)) {
          data.pieces.push({ name, type: 'Inconnu' });
        }
      });
      
      return data;
      
    } catch (err) {
      console.error('Erreur extraction panoplie:', err);
      return data;
    }
  }
  
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // =============================================================================
  // ÉTAPE 4: LOGIQUE PRINCIPALE
  // =============================================================================
  
  async function startScraping() {
    document.getElementById('bulk-start-btn').style.display = 'none';
    document.getElementById('bulk-stop-btn').style.display = 'inline-block';
    
    console.log('🚀 Démarrage du scraping...');
    
    for (currentIndex = 0; currentIndex < items.length; currentIndex++) {
      if (!window.bulkScraperRunning) {
        console.log('⏹️ Arrêté par l\'utilisateur');
        break;
      }
      
      const item = items[currentIndex];
      
      try {
        await scrapeItem(item);
        updateUI(`✅ ${item.name} terminé`);
      } catch (err) {
        console.error(`❌ Erreur sur ${item.name}:`, err.message);
        updateUI(`❌ Erreur: ${err.message}`);
      }
      
      // Délai avant le suivant
      if (currentIndex < items.length - 1) {
        updateUI(`⏳ Attente avant le suivant...`);
        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_PAGES));
      }
    }
    
    finishScraping();
  }
  
  function stopScraping() {
    window.bulkScraperRunning = false;
    document.getElementById('bulk-stop-btn').style.display = 'none';
    updateUI('⏹️ Arrêt demandé');
  }
  
  function finishScraping() {
    document.getElementById('bulk-stop-btn').style.display = 'none';
    document.getElementById('bulk-start-btn').style.display = 'inline-block';
    document.getElementById('bulk-start-btn').textContent = '🔄 Recommencer';
    
    // Télécharger l'export complet
    if (allData.length > 0) {
      const exportData = {
        export_date: new Date().toISOString(),
        source: 'DofusBook Bulk Scraper',
        total_items: allData.length,
        items: allData
      };
      
      downloadJSON(exportData, `dofusbook_bulk_export_${Date.now()}.json`);
      
      console.log(`\n✅ TERMINÉ ! ${scrapedCount}/${items.length} items scrapés`);
      console.log(`📦 Export complet téléchargé`);
      
      updateUI(`✅ Terminé ! ${scrapedCount}/${items.length} items`);
    }
    
    window.bulkScraperRunning = false;
  }
  
  // =============================================================================
  // DÉMARRAGE
  // =============================================================================
  
  // Extraire les items
  extractItems();
  
  if (items.length === 0) {
    alert('❌ Aucun item trouvé sur cette page.\n\nAssurez-vous d\'être sur une page liste (/items, /armes, /panoplies)');
    window.bulkScraperRunning = false;
    return;
  }
  
  // Créer l'interface
  createUI();
  
  console.log('✅ Prêt ! Cliquez sur "Démarrer" pour commencer le scraping.');
  
})();
