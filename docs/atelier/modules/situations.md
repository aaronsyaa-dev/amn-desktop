# Situations de travaux (`situations`)

**Famille** argent · **Action** facturer · **Niveau** avancé · **Route proposée** `/situations-de-travaux`

## Le besoin

Sur un chantier de plusieurs semaines, l'artisan du bâtiment facture à
l'avancement : chaque mois, une « situation » reprend ce qui a été fait depuis
la précédente, lot par lot, retenue de garantie et acompte déduits. Faite à la
main dans un tableur, elle se trompe souvent d'un cumul ou d'une TVA. Le
catalogue facture un montant (`invoices`), pas un avancement cumulé par lot.

## Ce que fait le module

- Le marché : des lots, chacun avec son montant HT et son taux de TVA
  (20, 10 ou 5,5 %), un acompte TTC reçu à la commande, un taux de retenue.
- La situation n : on saisit l'avancement **cumulé** de chaque lot (en %), à
  côté de celui de la situation précédente.
- Sorties : par lot, cumul réalisé et montant de la période ; ventilation de
  la TVA par taux ; total TTC, retenue de garantie, reprise d'acompte, **net à
  payer** (la réponse) ; avancement global du marché et retenues cumulées.
- Un bouton : copier la situation (texte prêt à coller dans une facture).

## Règles

- Période HT = cumul HT − cumul HT de la situation précédente ; cumul = montant
  × avancement, arrondi au centime (à 100 %, exactement le montant du lot).
- TVA calculée par taux sur le HT de la période.
- **Retenue de garantie** : au plus **5 % du marché** (loi n° 71-584 du
  16 juillet 1971, art. 1er), taux au-dessus refusé. Calculée sur le **TTC** de
  la période, la pratique la plus courante ; certains marchés la calculent sur
  le HT : à vérifier dans le contrat (réglage non proposé pour l'instant).
- **Acompte** : repris au prorata de l'avancement global (acompte × cumul HT /
  marché HT, différence avec la situation précédente). À 100 %, il est repris
  en entier.
- Refusés : un avancement qui recule sous la situation précédente, hors de
  0–100 %, illisible ; un lot à montant nul ; un acompte supérieur au marché TTC.
- Argent en centimes entiers.

## Hors périmètre

Travaux supplémentaires et avenants, révision de prix (index BT), caution
bancaire remplaçant la retenue, autoliquidation de la TVA en sous-traitance,
retenue calculée sur le HT, numérotation et émission de la facture.
