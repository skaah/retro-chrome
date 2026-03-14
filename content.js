// DofusBook Retro Scraper - Content Script
// S'exécute sur les pages de retro.dofusbook.net

(function() {
    'use strict';
    
    console.log('🔥 DofusBook Scraper actif sur:', window.location.href);
    
    // Injecter un bouton flottant
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'dofusbook-scraper-btn';
    floatingBtn.innerHTML = '📥 Scraper';
    floatingBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        z-index: 999999;
        font-family: sans-serif;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        transition: transform 0.2s;
    `;
    floatingBtn.addEventListener('mouseenter', () => floatingBtn.style.transform = 'scale(1.05)');
    floatingBtn.addEventListener('mouseleave', () => floatingBtn.style.transform = 'scale(1)');
    floatingBtn.addEventListener('click', scrapePage);
    document.body.appendChild(floatingBtn);
    
    // Écouter les messages de l'extension
    chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrape') {
            const data = scrapePage();
            sendResponse({ success: true, data });
        }
        return true;
    });
    
    function scrapePage() {
        const url = window.location.href;
        const data = {
            url: url,
            timestamp: new Date().toISOString(),
            items: []
        };
        
        // Détecter le type de page
        if (url.includes('/items/') && !url.endsWith('/items')) {
            // Page d'item individuel
            const item = scrapeItemPage();
            if (item) data.items.push(item);
        } else if (url.includes('/panoplies/') && !url.endsWith('/panoplies')) {
            // Page de panoplie
            data.panoplie = scrapeSetPage();
        } else {
            // Page de liste
            data.items = scrapeListPage();
        }
        
        // Sauvegarder et télécharger
        if (data.items.length > 0 || data.panoplie) {
            downloadJSON(data, `dofusbook-${Date.now()}.json`);
            showNotification(`✅ ${data.items.length || 1} élément(s) exporté(s) !`);
        }
        
        return data;
    }
    
    function scrapeItemPage() {
        const item = {
            type: 'item',
            scraped_at: new Date().toISOString()
        };
        
        // Nom
        const nameEl = document.querySelector('h1, h2[class*="title"], .item-name, [class*="name"]');
        item.name = nameEl?.textContent?.trim() || 'Unknown';
        
        // Niveau
        const levelMatch = document.body.textContent.match(/Niveau\s+(\d+)/i);
        item.level = levelMatch ? parseInt(levelMatch[1]) : 0;
        
        // Type d'item
        const typePatterns = ['Chapeau', 'Cape', 'Amulette', 'Anneau', 'Ceinture', 'Bottes', 
                             'Bâton', 'Épée', 'Dague', 'Hache', 'Marteau', 'Pelle', 'Baguette', 'Arc'];
        for (const type of typePatterns) {
            if (document.body.textContent.includes(type)) {
                item.item_type = type;
                break;
            }
        }
        
        // Image
        const imgEl = document.querySelector('img[src*="items"], img[src*="static"], .item-image img');
        if (imgEl) {
            item.image_url = imgEl.src;
        }
        
        // Stats
        item.stats = {};
        const statMapping = [
            { key: 'vitalite', regex: /(\d+)\s*à\s*(\d+)\s*Vitalité/i },
            { key: 'force', regex: /(\d+)\s*à\s*(\d+)\s*Force/i },
            { key: 'intelligence', regex: /(\d+)\s*à\s*(\d+)\s*Intelligence/i },
            { key: 'chance', regex: /(\d+)\s*à\s*(\d+)\s*Chance/i },
            { key: 'agilite', regex: /(\d+)\s*à\s*(\d+)\s*Agilité/i },
            { key: 'sagesse', regex: /(\d+)\s*à\s*(\d+)\s*Sagesse/i },
            { key: 'pa', regex: /(\d+)\s*PA/i },
            { key: 'pm', regex: /(\d+)\s*PM/i },
            { key: 'po', regex: /(\d+)\s*PO/i },
            { key: 'critique', regex: /(\d+)\s*à\s*(\d+)\s*Critique/i },
            { key: 'dommages', regex: /(\d+)\s*à\s*(\d+)\s*Dommages/i },
            { key: 'pourcentage_dmg', regex: /(\d+)\s*à\s*(\d+)\s*%\s*Dmg/i },
            { key: 'soin', regex: /(\d+)\s*à\s*(\d+)\s*Soin/i },
            { key: 'prospection', regex: /(\d+)\s*à\s*(\d+)\s*Prospection/i },
            { key: 'initiative', regex: /(\d+)\s*à\s*(\d+)\s*Initiative/i },
            { key: 'invocation', regex: /(\d+)\s*à\s*(\d+)\s*Invocation/i },
        ];
        
        const pageText = document.body.innerText;
        for (const { key, regex } of statMapping) {
            const match = pageText.match(regex);
            if (match) {
                if (match[2]) {
                    item.stats[key] = { min: parseInt(match[1]), max: parseInt(match[2]) };
                } else {
                    item.stats[key] = parseInt(match[1]);
                }
            }
        }
        
        // Recette (ingrédients)
        item.recipe = [];
        const recipeSection = Array.from(document.querySelectorAll('*')).find(el => 
            el.textContent.toLowerCase().includes('recette') || 
            el.textContent.toLowerCase().includes('craft')
        );
        if (recipeSection) {
            // Extraire les ingrédients
            const ingredients = document.querySelectorAll('[class*="ingredient"], [class*="recipe"]');
            ingredients.forEach(ing => {
                const name = ing.textContent?.trim();
                const qty = ing.textContent?.match(/x\s*(\d+)/)?.[1];
                if (name) {
                    item.recipe.push({ name, quantity: qty ? parseInt(qty) : 1 });
                }
            });
        }
        
        return item;
    }
    
    function scrapeSetPage() {
        const panoplie = {
            type: 'panoplie',
            scraped_at: new Date().toISOString()
        };
        
        // Nom
        const nameEl = document.querySelector('h1, h2[class*="title"]');
        panoplie.name = nameEl?.textContent?.trim() || 'Unknown';
        
        // Niveau
        const levelMatch = document.body.textContent.match(/Niveau\s+(\d+)/i);
        panoplie.level = levelMatch ? parseInt(levelMatch[1]) : 0;
        
        // Pièces de la panoplie
        panoplie.pieces = [];
        const pieceElements = document.querySelectorAll('[class*="piece"], [class*="item"]');
        pieceElements.forEach(el => {
            const name = el.textContent?.trim();
            if (name && name.length > 2) {
                panoplie.pieces.push(name);
            }
        });
        
        // Bonus de panoplie
        panoplie.bonuses = {};
        const bonusSection = document.querySelector('[class*="bonus"], [class*="set-bonus"]');
        if (bonusSection) {
            // Parser les bonus par nombre d'items équipés
            const bonusTexts = bonusSection.innerText.split('\n');
            bonusTexts.forEach(text => {
                const match = text.match(/(\d+)\s*items?\s*:\s*(.+)/i);
                if (match) {
                    panoplie.bonuses[match[1]] = match[2].trim();
                }
            });
        }
        
        return panoplie;
    }
    
    function scrapeListPage() {
        const items = [];
        
        // Chercher les cartes d'items
        const cards = document.querySelectorAll('[class*="item"], [class*="card"], .encyclopedia-item, [data-item-id]');
        
        cards.forEach(card => {
            const item = {
                type: 'item',
                scraped_at: new Date().toISOString()
            };
            
            // Nom
            const nameEl = card.querySelector('h2, h3, h4, [class*="name"], [class*="title"]');
            item.name = nameEl?.textContent?.trim();
            
            if (!item.name) return;
            
            // Niveau
            const levelEl = card.querySelector('[class*="level"], [class*="niveau"]');
            if (levelEl) {
                const match = levelEl.textContent.match(/(\d+)/);
                item.level = match ? parseInt(match[1]) : 0;
            }
            
            // URL de l'item
            const link = card.querySelector('a[href*="/items/"]');
            if (link) {
                item.url = link.href;
            }
            
            // Image
            const img = card.querySelector('img');
            if (img) {
                item.image_url = img.src;
            }
            
            items.push(item);
        });
        
        return items;
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
    
    function showNotification(message) {
        const notif = document.createElement('div');
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #22c55e;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 999999;
            font-family: sans-serif;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
    
    // Ajouter l'animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
})();
