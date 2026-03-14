# 🔥 DofusBook Retro Scraper

Extension Chrome pour extraire automatiquement les données de **DofusBook Retro** (items, panoplies, stats, recettes) et les exporter en JSON.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Chrome](https://img.shields.io/badge/chrome-88%2B-green)

## 📥 Installation

### Méthode 1: Mode développeur (recommandé)

1. **Téléchargez l'extension:**
   ```bash
   git clone https://github.com/skaah/retro-chrome.git
   ```

2. **Ouvrez Chrome et allez à:**
   ```
   chrome://extensions/
   ```

3. **Activez le "Mode développeur"** (toggle en haut à droite)

4. **Cliquez sur "Charger l'extension non empaquetée"**

5. **Sélectionnez le dossier `retro-chrome`**

6. **L'icône 🔥 apparaît dans votre barre d'outils Chrome!**

### Méthode 2: Fichier ZIP

1. Téléchargez le repo comme ZIP
2. Décompressez
3. Suivez les étapes 2-6 ci-dessus

---

## 🎮 Utilisation

### Scraper une page

1. **Allez sur** [retro.dofusbook.net](https://retro.dofusbook.net)

2. **Naviguez vers un item ou panoplie** (ex: `/items/gelano`)

3. **Cliquez sur l'icône 🔥** dans la barre Chrome

4. **Cliquez sur "Scraper cette page"**

5. **Le fichier JSON se télécharge automatiquement!**

### Scraper une liste d'items

1. Allez sur `/fr/encyclopedie/items` (liste)

2. Cliquez sur le bouton flottant **"📥 Scraper"** en haut à droite

3. Tous les items visibles sont exportés

---

## 📊 Format des données exportées

### Item individuel
```json
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
    { "name": "Argent", "quantity": 5 }
  ]
}
```

### Panoplie
```json
{
  "type": "panoplie",
  "name": "Panoplie du Bouftou",
  "level": 10,
  "pieces": ["Coiffe", "Cape", "Anneau"],
  "bonuses": {
    "2": "+10 Vitalité",
    "4": "+1 PA"
  }
}
```

---

## 🎯 Fonctionnalités

| Fonction | Description |
|----------|-------------|
| ✅ **Extraction items** | Nom, niveau, type, image |
| ✅ **Stats complètes** | Min/max pour chaque caractéristique |
| ✅ **Recettes** | Ingrédients et quantités |
| ✅ **Panoplies** | Bonus progressifs |
| ✅ **Export JSON** | Format standardisé |
| 🔄 **Mode Auto** | *À venir* - Scraping automatique de plusieurs pages |

---

## 🔧 Dépannage

### L'extension ne s'affiche pas
- Vérifiez que vous êtes sur `retro.dofusbook.net`
- Rechargez la page (F5)

### Le bouton ne fonctionne pas
- Ouvrez la console (F12 → Console)
- Regardez s'il y a des erreurs
- Rechargez l'extension dans `chrome://extensions/`

### Données incomplètes
- Attendez que la page soit complètement chargée
- Certaines pages nécessitent de scroller pour charger tout le contenu

---

## 📝 Changelog

### v1.0.0 (2026-03-14)
- 🎉 Première version
- ✅ Extraction items et panoplies
- ✅ Export JSON automatique
- ✅ Interface popup
- ✅ Bouton flottant sur les pages

---

## 🤝 Contribution

Les PR sont les bienvenues! Pour contribuer:

1. Fork le repo
2. Créez une branche (`git checkout -b feature/amelioration`)
3. Committez (`git commit -am 'Ajout fonctionnalité'`)
4. Pushez (`git push origin feature/amelioration`)
5. Ouvrez une Pull Request

---

## 📄 License

MIT - Fait avec ❤️ pour la communauté Dofus Retro

---

**Problèmes?** Ouvrez une issue sur GitHub!
