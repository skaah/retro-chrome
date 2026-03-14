# 📘 Utilisation du Bulk Scraper

## Méthode recommandée : Console DevTools

C'est la méthode la plus fiable et rapide.

### Étapes :

1. **Va sur une page liste DofusBook** :
   - `https://retro.dofusbook.net/fr/encyclopedie/items`
   - `https://retro.dofusbook.net/fr/encyclopedie/armes`
   - `https://retro.dofusbook.net/fr/encyclopedie/panoplies`

2. **Ouvre la console DevTools** :
   - Appuie sur `F12` ou `Ctrl+Shift+J` (Windows/Linux)
   - Ou `Cmd+Option+J` (Mac)

3. **Copie-colle ce script** dans la console :

```javascript
// ===== COPIE TOUT CE QUI SUIT =====
(function() {
  if (window.bulkScraperRunning) { console.log('⚠️ Déjà en cours'); return; }
  window.bulkScraperRunning = true;
  
  const CONFIG = { DELAY_BETWEEN_PAGES: 5000, DELAY_AFTER_LOAD: 3000 };
  let items = [], currentIndex = 0, scrapedCount = 0, allData = [];
  
  function extractItems() {
    console.log('🔍 Recherche des items...');
    const arrowLinks = document.querySelectorAll('a:has(.fa-right-to-bracket), a:has([data-icon="right-to-bracket"])');
    console.log(`➡️  ${arrowLinks.length} liens avec flèche trouvés`);
    
    arrowLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !items.find(i => i.url === href)) {
        let name = 'Unknown';
        const card = link.closest('[class*="item"], [class*="card"], tr, li');
        if (card) {
          const nameEl = card.querySelector('h3, h4, .name, strong');
          if (nameEl) name = nameEl.textContent.trim();
        }
        if (name === 'Unknown') {
          name = decodeURIComponent(href.split('/').pop()).replace(/-/g, ' ');
        }
        items.push({ name, url: href.startsWith('http') ? href : `https://retro.dofusbook.net${href}` });
      }
    });
    
    if (items.length === 0) {
      const allLinks = document.querySelectorAll('a[href*="/encyclopedie/"]');
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        const match = href.match(/\/encyclopedie\/(items|armes|panoplies)\/([^/]+)$/);
        if (match && match[2] && !['items','armes','panoplies'].includes(match[2])) {
          const fullUrl = href.startsWith('http') ? href : `https://retro.dofusbook.net${href}`;
          if (!items.find(i => i.url === fullUrl)) {
            items.push({ name: link.textContent.trim() || match[2], url: fullUrl });
          }
        }
      });
    }
    console.log(`✅ ${items.length} items trouvés`);
    return items;
  }
  
  function createUI() {
    const ui = document.createElement('div');
    ui.id = 'bulk-scraper-ui';
    ui.innerHTML = `<div style="position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a1a2e,#16213e);color:white;padding:25px;border-radius:15px;z-index:999999;font-family:sans-serif;box-shadow:0 10px 40px rgba(0,0,0,0.5);min-width:400px;text-align:center;border:2px solid #e94560;"><div style="font-weight:bold;font-size:20px;margin-bottom:15px;color:#e94560;">🔥 Bulk Scraper</div><div id="bulk-text" style="font-size:16px;margin-bottom:15px;">Prêt à scraper ${items.length} items</div><div style="width:100%;height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden;margin:15px 0;"><div id="bulk-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#e94560,#ff6b6b);transition:width 0.3s;"></div></div><div id="bulk-status" style="font-size:14px;color:#a0a0a0;margin-bottom:15px;">Cliquez sur Démarrer</div><div style="display:flex;gap:10px;justify-content:center;"><button id="bulk-start" style="padding:12px 25px;background:linear-gradient(135deg,#e94560,#c73e54);border:none;color:white;border-radius:8px;cursor:pointer;font-weight:bold;">🚀 Démarrer</button><button id="bulk-stop" style="padding:12px 25px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;border-radius:8px;cursor:pointer;display:none;">⏹️ Arrêter</button></div></div>`;
    document.body.appendChild(ui);
    document.getElementById('bulk-start').addEventListener('click', startScraping);
    document.getElementById('bulk-stop').addEventListener('click', () => { window.bulkScraperRunning = false; });
  }
  
  function updateUI(status) {
    document.getElementById('bulk-text').textContent = `${currentIndex}/${items.length} items (${scrapedCount} réussis)`;
    document.getElementById('bulk-bar').style.width = `${(currentIndex/items.length)*100}%`;
    document.getElementById('bulk-status').textContent = status;
    document.getElementById('bulk-status').style.color = '#fff';
  }
  
  async function scrapeItem(item) {
    console.log(`📄 [${currentIndex+1}/${items.length}] ${item.name}`);
    updateUI(`📄 Ouverture: ${item.name}`);
    return new Promise((resolve, reject) => {
      const newWindow = window.open(item.url, `_dofusbook_${Date.now()}`);
      if (!newWindow) { reject(new Error('Popup bloqué !')); return; }
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if (newWindow.closed) { clearInterval(interval); reject(new Error('Fermé')); return; }
        if (newWindow.document && newWindow.document.readyState === 'complete') {
          clearInterval(interval);
          updateUI(`⏳ Extraction...`);
          setTimeout(() => {
            try {
              const doc = newWindow.document, bodyText = doc.body.innerText;
              const isPanoplie = item.url.includes('/panoplies/');
              const data = { type: isPanoplie?'panoplie':'item', name: item.name, url: item.url, scraped_at: new Date().toISOString() };
              
              const h1 = doc.querySelector('h1'); if (h1) data.name = h1.textContent.trim();
              const levelMatch = bodyText.match(/niveau\s+(\d+)/i); if (levelMatch) data.level = parseInt(levelMatch[1]);
              
              if (!isPanoplie) {
                const img = doc.querySelector('img[src*="items"], img[src*="armes"]'); if (img) data.image_url = img.src;
                data.stats = {};
                [['vitalite',/vitalit[eé]\s*[:\s]+([+-]?\d+)/i],['sagesse',/sagesse\s*[:\s]+([+-]?\d+)/i],['force',/force\s*[:\s]+([+-]?\d+)/i],['intelligence',/intelligence\s*[:\s]+([+-]?\d+)/i],['chance',/chance\s*[:\s]+([+-]?\d+)/i],['pa',/PA\s*[:\s]+([+-]?\d+)/i],['pm',/PM\s*[:\s]+([+-]?\d+)/i]].forEach(([name,regex])=>{const m=bodyText.match(regex);if(m)data.stats[name]=parseInt(m[1]);});
              } else {
                data.pieces = [];
                doc.querySelectorAll('a[href*="/items/"]').forEach(link=>{const n=link.textContent.trim();if(n&&n.length>2&&!data.pieces.find(p=>p.name===n))data.pieces.push({name:n,type:'Inconnu'});});
              }
              
              allData.push(data); scrapedCount++;
              const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
              const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=`dofusbook_${data.name.replace(/\s+/g,'_')}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
              newWindow.close();
              console.log(`✅ ${data.name} (Niv ${data.level||'?'})`);
              resolve(data);
            } catch(e) { newWindow.close(); reject(e); }
          }, CONFIG.DELAY_AFTER_LOAD);
        }
        if (checks > 100) { clearInterval(interval); newWindow.close(); reject(new Error('Timeout')); }
      }, 200);
    });
  }
  
  async function startScraping() {
    document.getElementById('bulk-start').style.display = 'none';
    document.getElementById('bulk-stop').style.display = 'inline-block';
    for (currentIndex = 0; currentIndex < items.length; currentIndex++) {
      if (!window.bulkScraperRunning) break;
      try { await scrapeItem(items[currentIndex]); updateUI(`✅ Terminé`); } 
      catch (err) { console.error(`❌ ${items[currentIndex].name}:`, err.message); updateUI(`❌ ${err.message}`); }
      if (currentIndex < items.length - 1) { updateUI(`⏳ Attente...`); await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_PAGES)); }
    }
    document.getElementById('bulk-stop').style.display = 'none';
    if (allData.length > 0) {
      const exportData = { export_date: new Date().toISOString(), total_items: allData.length, items: allData };
      const blob = new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=`dofusbook_bulk_${Date.now()}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
      updateUI(`✅ Terminé ! ${scrapedCount}/${items.length}`);
      console.log(`✅ TERMINÉ ! ${scrapedCount}/${items.length} items`);
    }
    window.bulkScraperRunning = false;
  }
  
  extractItems();
  if (items.length === 0) { alert('❌ Aucun item trouvé'); window.bulkScraperRunning = false; return; }
  createUI();
  console.log('✅ Prêt ! Cliquez sur Démarrer');
})();
// ===== FIN DU SCRIPT =====
```

4. **Appuie sur Entrée**

5. **Une fenêtre apparaît** avec un bouton "🚀 Démarrer"

6. **Clique sur Démarrer** et laisse tourner !

---

## 📋 Résultat

- Chaque item est téléchargé individuellement
- Un export complet est généré à la fin
- Les données incluent : nom, niveau, type, stats, image

## ⚠️ Important

- **Autorise les popups** pour retro.dofusbook.net
- **Ne ferme pas l'onglet principal** pendant le scraping
- **Temps estimé** : 5 secondes par item
