# Aperçus statiques des écrans

Un fichier `<ID>.tsx` par écran : il exporte par défaut l'élément à montrer, sur des données
**fictives** de bac à sable (jamais de données réelles, jamais de secret). `npm run apercu -- <ID>`
en fait une page `file://` autonome (`/tmp/apercu/<ID>/index.html`), capturée à 1440 × 900 puis
comparée à l'image de la maquette (outil de T1, `docs/refonte/CONTROLE-FIDELITE.md`). Rien ici
n'entre dans l'application.
