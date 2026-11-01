# Aperçus statiques des écrans

Un fichier `<ID>.tsx` par écran : il exporte par défaut l'élément à montrer, sur des données
**fictives** de bac à sable (jamais de données réelles, jamais de secret). `npm run apercu -- <ID>`
en fait une page `file://` autonome (`/tmp/apercu/<ID>/index.html`), capturée à 1440 × 900 puis
comparée à l'image de la maquette (outil de T1, `docs/refonte/CONTROLE-FIDELITE.md`). Rien ici
n'entre dans l'application.

La coquille (barre latérale v3, en-tête, barre Ajmani) se pose avec `ApercuBureau` (`scripts/apercu/coquille.tsx`) :
la coquille de présentation de `src/socle/coquille/` sur des données fictives. Un écran passe sa famille dépliée,
sa sous-page allumée, son fil d'Ariane, le texte de sa barre Ajmani, et sa zone principale en `children`. Les
aperçus `COQUILLE-H40`, `COQUILLE-H42`, `COQUILLE-H47` et `COQUILLE-D02` montrent la coquille seule, zone
principale vide, dans l'état de ces images.
