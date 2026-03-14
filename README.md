# 🔥 DofusBook Retro Scraper

Extension Chrome pour extraire automatiquement les données de **DofusBook Retro**.

## ✨ Nouveautés v1.2.0 - Bulk Detail Scraper !

🚀 **Bulk Detail Scraper** : Scrape automatiquement tous les items d'une page liste en ouvrant chaque détail !

## 📦 Installation

1. Clone ou télécharge ce repository
2. Ouvrir Chrome → `chrome://extensions/`
3. Activer **"Mode développeur"** (en haut à droite)
4. Cliquer **"Charger l'extension non empaquetée"**
5. Sélectionner le dossier `retro-chrome/`

L'icône 🔥 apparaît dans la barre Chrome.

## 🚀 Utilisation

### 🆕 Mode Bulk Detail Scraper (NOUVEAU !)

1. Allez sur une **page liste** (ex: `/encyclopedie/items`, `/encyclopedie/armes`, `/encyclopedie/panoplies`)
2. Ouvrez l'extension
3. Cliquez sur **"🚀 Scraper tout en détail"**
4. L'extension va :
   - 🔍 Extraire tous les liens des items de la page
   - 🆕 Ouvrir chaque item dans un nouvel onglet
   - 📥 Scraper automatiquement les détails (stats, recettes, etc.)
   - 💾 Télécharger le fichier JSON
   - ❌ Fermer l'onglet
   - 🔄 Passer au suivant
5. Une barre de progression s'affiche en haut de l'écran
6. Tous les items sont scrapés automatiquement !

**Avantages :**
- ✅ Récupère les **stats complètes** (pas juste le nom)
- ✅ Récupère les **recettes** de craft
- ✅ Récupère les **conditions** d'utilisation
- ✅ Fonctionne sur les **items, armes ET panoplies**
- ✅ Anti-doublon intégré

### Mode Manuel (Classique)

1. Allez sur [retro.dofusbook.net](https://retro.dofusbook.net)
2. Naviguez vers un **item** ou une **panoplie**
3. Cliquez sur le bouton 🔥 en bas à droite
4. Le fichier JSON se télécharge automatiquement

### Mode Auto (Nouveau !)

1. Ouvrez l'extension (cliquez sur l'icône 🔥)
2. Activez le **toggle "Mode Auto"**
3. Naviguez sur DofusBook normalement
4. **Chaque page se scrape automatiquement !**
5. Quand vous avez fini, cliquez **"Exporter tout"**

**Avantages du mode Auto :**
- ✅ Plus besoin de cliquer à chaque page
- ✅ Pas de doublons (vérifie si déjà scrapé)
- ✅ Accumulation des données
- ✅ Export unique à la fin

## 📊 Format des données exportées

```json
{
  "export_date": "2026-03-15T10:30:00.000Z",
  "source": "DofusBook Retro Scraper",
  "total_items": 25,
  "total_panoplies": 3,
  "items": [
    {
      "type": "item",
      "name": "Gelano",
      "level": 60,
      "item_type": "Anneau",
      "image_url": "https://...",
      "stats": {
        "vitalite": { "min": 40, "max": 60 },
        "sagesse": { "min": 20, "max": 30 },
        "pm": 1
      },
      "recipe": [
        { "name": "Or", "quantity": 10 },
        { "name": "Argent", "quantity": 10 }
      ],
      "url": "https://retro.dofusbook.net/fr/encyclopedie/items/gelano",
      "scraped_at": "2026-03-15T10:30:00.000Z"
    }
  ],
  "panoplies": [
    {
      "type": "panoplie",
      "name": "Panoplie du Bouftou",
      "level": 20,
      "pieces": [...],
      "bonuses": { "2_items": {...}, "3_items": {...} }
    }
  ]
}
```

## 🎯 Workflow recommandé

### Pour un item unique
1. Mode Manuel → Scraper → Téléchargement immédiat

### Pour une session de scraping intensive
1. Activer **Mode Auto**
2. Ouvrir plusieurs onglets DofusBook
3. Naviguer entre les items/panoplies
4. Tout est accumulé automatiquement
5. **"Exporter tout"** quand terminé
6. **"Vider le cache"** pour recommencer

## 🔧 Fonctionnalités

| Fonction | Description |
|----------|-------------|
| 🔥 Mode Manuel | Scrape la page active sur clic |
| 🤖 Mode Auto | Scrape automatiquement chaque page visitée |
| 🔄 Anti-doublon | Détecte et ignore les URLs déjà scrapées |
| 💾 Stockage | Accumule les données pendant la session |
| 📤 Export | Export unique de toutes les données |
| 🗑️ Reset | Vide le cache quand vous voulez |

## 🐛 Dépannage

**L'extension ne s'affiche pas ?**
- Vérifiez que vous êtes sur `retro.dofusbook.net`
- Rechargez la page (F5)

**Le scraping échoue ?**
- Attendez que la page soit complètement chargée
- Vérifiez que c'est bien une page item ou panoplie

**Mode Auto ne fonctionne pas ?**
- Vérifiez que le toggle est bien activé
- Rechargez la page DofusBook
- Les pages se scrapent 3 secondes après chargement complet

## 📝 Changelog

### v1.2.0 (2026-03-15)
- 🚀 **Bulk Detail Scraper** : Scrape automatiquement tous les items d'une page liste
- 🆕 Ouvre chaque item en détail automatiquement
- 📊 Barre de progression en temps réel
- ✅ Extraction complète (stats, recettes, conditions)
- 🎯 Fonctionne sur items, armes et panoplies

### v1.1.0 (2026-03-15)
- ✨ **Mode Auto** : Scraping automatique
- 🔄 Détection anti-doublon
- 💾 Stockage persistant des données
- 📤 Export global
- 🔔 Notifications visuelles

### v1.0.0
- 🎉 Version initiale
- Scraping manuel items/panoplies
- Export JSON automatique

## 📄 License

MIT - Libre d'utilisation pour le projet RetroFus

---

**Projet:** [RetroFus API](https://github.com/skaah/retrofus-API)
