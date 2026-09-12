# AURA PRESTIGE — site vitrine

Landing page one-page, HTML/CSS/JS vanilla (aucune dépendance, aucun build). Design figé, issu du handoff Claude Design (`design_handoff_aura_prestige/`).

## Structure

```
aura-prestige/
├── index.html
├── css/style.css
└── js/main.js
```

## En attente de validation client

- **Photos véhicules** : 5 emplacements `.img-slot` (motif rayé + libellé). À remplacer par des `<img>` en `object-fit: cover` :
  - Classe V : ratio 3/2
  - DS7 : hauteur libre (flex, pas de ratio fixe)
  - Auris / CHR / Corolla : ratio 4/3
- **Fond hero** (plage crépuscule) : rendu CSS temporaire (`.hero__bg*`). À remplacer par une photo définitive quand fournie.
- **Coordonnées de contact** (téléphone, e-mail, zone) : actuellement "à compléter" dans `#contact`.
- **Formulaire** : soumission gérée en JS (`js/main.js`), affiche "Demande envoyée" au clic. Aucun envoi réel (e-mail/API) — à brancher une fois l'hébergement/backend de contact décidé.

## Personnalisation

Couleurs accent/or exposées en variables CSS dans `:root` (`--accent`, `--gold`) — cf. variantes documentées dans le handoff si le client souhaite ajuster.

## Ouvrir en local

Ouvrir `index.html` directement dans un navigateur, ou servir le dossier avec n'importe quel serveur statique (`python3 -m http.server`, `npx serve`, etc.).
