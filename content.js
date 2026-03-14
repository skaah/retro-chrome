/**
 * Content Script - Extraction de données DofusBook Retro
 * Version 1.1.0 - Support du mode Auto
 */

(function() {
  'use strict';

  // Éviter les doubles injections
  if (window.dofusbookScraperInjected) return;
  window.dofusbookScraperInjected = true;

  console.log('🔥 DofusBook Retro Scraper v1.1.0 injecté');

  let autoModeEnabled = false;
  let isScraping = false;

  // Écouter les messages du background/popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'scrape':
        scrapePage().then(data => {
          sendResponse({ success: true, data: data });
        }).catch(err => {
          sendResponse({ success: false, error: err.message });
        });
        return true; // Async

      case 'autoModeChanged':
        autoModeEnabled = message.enabled;
        console.log('🤖 Mode Auto:', autoModeEnabled ? 'activé' : 'désactivé');
        updateFloatingButton();
        sendResponse({ received: true });
        break;

      case 'autoScrape':
        if (autoModeEnabled && !isScraping) {
          handleAutoScrape(message.url);
        }
        sendResponse({ received: true });
        break;

      case 'ping':
        sendResponse({ pong: true });
        break;
    }
  });

  // Vérifier l'état initial du mode auto
  chrome.runtime.sendMessage({ action: 'getAutoMode' }, (response) => {
    if (response?.autoMode) {
      autoModeEnabled = true;
      updateFloatingButton();
    }
  });

  // Créer le bouton flottant
  let floatingBtn = null;
  function createFloatingButton() {
    if (floatingBtn) return;

    floatingBtn = document.createElement('div');
    floatingBtn.id = 'dofusbook-scraper-float';
    floatingBtn.innerHTML = `
      🔥
      <span class="tooltip">Cliquez pour scraper cette page</span>
    `;
    floatingBtn.addEventListener('click', () => {
      if (!isScraping) {
        scrapePage();
      }
    });

    document.body.appendChild(floatingBtn);
  }

  // Mettre à jour le bouton flottant selon le mode
  function updateFloatingButton() {
    createFloatingButton();
    
    if (autoModeEnabled) {
      floatingBtn.classList.add('auto-mode');
      floatingBtn.innerHTML = `
        🤖
        <span class="tooltip">Mode Auto actif</span>
      `;
    } else {
      floatingBtn.classList.remove('auto-mode');
      floatingBtn.innerHTML = `
        🔥
        <span class="tooltip">Cliquez pour scraper</span>
      `;
    }
  }

  // Gérer l'auto-scrape
  async function handleAutoScrape(url) {
    if (isScraping) return;

    // Vérifier si déjà scrapé
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'isUrlScraped', 
        url: url 
      });
      
      if (response?.scraped) {
        console.log('⏭️ Page déjà scrapée:', url);
        showFloatingNotification('⏭️ Déjà scrapé');
        return;
      }
    } catch (err) {
      console.error('Erreur vérification URL:', err);
    }

    // Attendre que la page soit stable
    console.log('🤖 Auto-scraping dans 3 secondes...');
    showFloatingNotification('🤖 Auto-scraping...');

    setTimeout(async () => {
      try {
        const data = await scrapePage();
        showFloatingNotification(`✅ ${data.name} scrapé !`);
      } catch (err) {
        console.error('Erreur auto-scrape:', err);
        showFloatingNotification('❌ Erreur');
      }
    }, 3000);
  }

  // Afficher une notification flottante
  function showFloatingNotification(text) {
    if (!floatingBtn) return;

    floatingBtn.innerHTML = `
      ${text}
      <span class="tooltip">${autoModeEnabled ? 'Mode Auto' : 'Manuel'}</span>
    `;

    // Restaurer après 2 secondes
    setTimeout(() => {
      updateFloatingButton();
    }, 2000);
  }

  // Fonction principale de scraping
  async function scrapePage() {
    if (isScraping) {
      throw new Error('Scraping déjà en cours');
    }

    isScraping = true;
    console.log('🔍 Début du scraping...');

    try {
      const url = window.location.href;
      const data = {
        url: url,
        scraped_at: new Date().toISOString()
      };

      // Détecter le type de page
      if (url.includes('/panoplies/')) {
        Object.assign(data, scrapePanoplie());
      } else if (url.includes('/items/')) {
        Object.assign(data, scrapeItem());
      } else {
        throw new Error('Page non reconnue (ni item ni panoplie)');
      }

      // Sauvegarder via background
      await chrome.runtime.sendMessage({
        action: 'saveData',
        data: data
      });

      // Télécharger aussi localement
      downloadJSON(data, `dofusbook_${data.type}_${Date.now()}.json`);

      console.log('✅ Scraping terminé:', data.name);
      return data;

    } finally {
      isScraping = false;
    }
  }

  // Scraper un item
  function scrapeItem() {
    console.log('📦 Scraping item...');

    const result = {
      type: 'item',
      name: '',
      level: null,
      item_type: '',
      description: '',
      image_url: '',
      stats: {},
      recipe: []
    };

    // Nom
    const nameEl = document.querySelector('h1[item-name], .item-name, h1');
    if (nameEl) {
      result.name = nameEl.textContent.trim();
    }

    // Niveau
    const levelEl = document.querySelector('.item-level, [item-level], .level');
    if (levelEl) {
      const match = levelEl.textContent.match(/niveau\s*(\d+)/i);
      if (match) result.level = parseInt(match[1]);
    }

    // Type d'item
    const typeEl = document.querySelector('.item-type, [item-type]');
    if (typeEl) {
      result.item_type = typeEl.textContent.trim();
    }

    // Description
    const descEl = document.querySelector('.item-description, .description, [item-description]');
    if (descEl) {
      result.description = descEl.textContent.trim();
    }

    // Image
    const imgEl = document.querySelector('.item-image img, [item-image] img, .item-icon img');
    if (imgEl) {
      result.image_url = imgEl.src;
    }

    // Stats
    const statsSection = document.querySelector('.item-stats, .stats, [item-stats]');
    if (statsSection) {
      const statRows = statsSection.querySelectorAll('.stat-row, .stat, [stat]');
      statRows.forEach(row => {
        const label = row.querySelector('.stat-label, .label, td:first-child');
        const value = row.querySelector('.stat-value, .value, td:last-child');

        if (label && value) {
          const statName = normalizeStatName(label.textContent.trim());
          const statValue = parseStatValue(value.textContent.trim());
          if (statName) {
            result.stats[statName] = statValue;
          }
        }
      });
    }

    // Alternative: chercher dans les divs de stats
    document.querySelectorAll('[class*="stat"]').forEach(el => {
      const text = el.textContent;
      const match = text.match(/([^:]+):\s*(.+)/);
      if (match) {
        const statName = normalizeStatName(match[1]);
        const statValue = parseStatValue(match[2]);
        if (statName && !result.stats[statName]) {
          result.stats[statName] = statValue;
        }
      }
    });

    // Recette
    const recipeSection = document.querySelector('.item-recipe, .recipe, [item-recipe]');
    if (recipeSection) {
      const ingredients = recipeSection.querySelectorAll('.ingredient, .recipe-item, [ingredient]');
      ingredients.forEach(ing => {
        const name = ing.querySelector('.ingredient-name, .name')?.textContent?.trim();
        const qty = ing.querySelector('.ingredient-qty, .quantity')?.textContent?.trim();
        if (name) {
          result.recipe.push({
            name: name,
            quantity: parseInt(qty) || 1
          });
        }
      });
    }

    return result;
  }

  // Scraper une panoplie
  function scrapePanoplie() {
    console.log('👕 Scraping panoplie...');

    const result = {
      type: 'panoplie',
      name: '',
      level: null,
      pieces: [],
      bonuses: {}
    };

    // Nom
    const nameEl = document.querySelector('h1[set-name], .set-name, h1');
    if (nameEl) {
      result.name = nameEl.textContent.trim();
    }

    // Niveau
    const levelEl = document.querySelector('.set-level, [set-level]');
    if (levelEl) {
      const match = levelEl.textContent.match(/niveau\s*(\d+)/i);
      if (match) result.level = parseInt(match[1]);
    }

    // Pièces de la panoplie
    const piecesSection = document.querySelector('.set-pieces, [set-pieces], .pieces');
    if (piecesSection) {
      const pieceEls = piecesSection.querySelectorAll('.piece, [piece], .set-item');
      pieceEls.forEach(piece => {
        const name = piece.querySelector('.piece-name, .name')?.textContent?.trim();
        const type = piece.querySelector('.piece-type, .type')?.textContent?.trim();
        if (name) {
          result.pieces.push({
            name: name,
            type: type || 'Inconnu'
          });
        }
      });
    }

    // Bonus de la panoplie
    const bonusesSection = document.querySelector('.set-bonuses, [set-bonuses], .bonuses');
    if (bonusesSection) {
      // Bonus par nombre d'items équipés (2/3/4/5/6/7/8)
      const bonusRows = bonusesSection.querySelectorAll('.bonus-row, [bonus-row]');
      bonusRows.forEach(row => {
        const countMatch = row.textContent.match(/(\d+)\s*items?/i);
        if (countMatch) {
          const itemCount = countMatch[1];
          const bonuses = {};

          // Extraire les stats
          row.querySelectorAll('.bonus-stat, [bonus-stat]').forEach(statEl => {
            const text = statEl.textContent;
            const match = text.match(/([^:]+):\s*(.+)/);
            if (match) {
              const statName = normalizeStatName(match[1]);
              const statValue = parseStatValue(match[2]);
              if (statName) bonuses[statName] = statValue;
            }
          });

          if (Object.keys(bonuses).length > 0) {
            result.bonuses[`${itemCount}_items`] = bonuses;
          }
        }
      });
    }

    return result;
  }

  // Normaliser le nom d'une stat
  function normalizeStatName(name) {
    const mapping = {
      'vitalité': 'vitalite',
      'vita': 'vitalite',
      'sagesse': 'sagesse',
      'sag': 'sagesse',
      'force': 'force',
      'for': 'force',
      'intelligence': 'intelligence',
      'int': 'intelligence',
      'chance': 'chance',
      'cha': 'chance',
      'agilité': 'agilite',
      'agi': 'agilite',
      'pa': 'pa',
      'points d\'action': 'pa',
      'pm': 'pm',
      'points de mouvement': 'pm',
      'po': 'po',
      'portée': 'po',
      'invocations': 'invocations',
      'invoc': 'invocations',
      'initiative': 'initiative',
      'init': 'initiative',
      'prospection': 'prospection',
      'pp': 'prospection',
      'pods': 'pods',
      'pdv': 'vitalite'
    };

    const normalized = name.toLowerCase().trim();
    return mapping[normalized] || normalized;
  }

  // Parser une valeur de stat
  function parseStatValue(value) {
    // Format: "10 à 20" ou "10-20" ou "10~20"
    const rangeMatch = value.match(/(\d+)\s*[à\-~]\s*(\d+)/);
    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1]),
        max: parseInt(rangeMatch[2])
      };
    }

    // Format: "+10" ou "-10"
    const numMatch = value.match(/([+\-]?\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1]);
    }

    return value;
  }

  // Télécharger un fichier JSON
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

  // Créer le bouton flottant au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }

})();
