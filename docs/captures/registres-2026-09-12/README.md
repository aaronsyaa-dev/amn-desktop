# Famille B — les registres, avant et après

Quatre modules composés le 12 septembre : `Fournisseurs`, `Nomenclatures`,
`Modèles`, `Trombinoscope`. Le cinquième, `Coffre-fort`, n'est pas fait — voir
la fin de ce fichier.

## La méthode commune, et ce qu'elle ne décide pas

Un registre ne se surveille pas, il se CONSULTE : la question n'est pas
« qu'est-ce qui a changé » mais « où est celui que je cherche ». D'où, partout :
une recherche, et des LIGNES plutôt que des cartes. Six cartes de 17 rem
remplissaient déjà la fenêtre sur Fournisseurs ; un registre de quarante
entrées aurait demandé six écrans de défilement.

Mais la méthode ne donne pas le dominant. Chaque registre garde le sien, tiré
de sa propre matière.

## L'après, module par module

| Écran | Objet dominant | Pourquoi celui-là | Ambre |
|---|---|---|---|
| Fournisseurs | Les silencieux depuis trois mois | C'est le seul défaut qu'une liste de fournisseurs puisse porter, et le fichier le disait déjà en tête | Les silencieux |
| Nomenclatures | Ce qui se vend à perte, puis les marges en barres | Vendre à perte sans le savoir est le seul vrai défaut du module ; la barre va du prix de revient au prix de vente, donc une marge mince se voit sans lire un pourcentage | Les produits à perte |
| Modèles | Le modèle en train d'être rempli | Un modèle n'est pas un document qu'on choisit : c'est un FORMULAIRE, ses trous sont des champs | Les trous qui restent |
| Trombinoscope | Les visages, rangés par rôle | « C'est qui, déjà ? » se résout par le rôle, pas par l'initiale du nom | Aucun : cet écran ne décide rien |

## Un commentaire qui mentait, corrigé

`SuppliersScreen.tsx` annonçait en tête : « les fournisseurs silencieux depuis
trois mois remontent ». Ils ne remontaient pas — les fiches étaient triées par
nom. Sur le bac à sable, « Bois de l'Hérault », commandé il y a un mois,
ouvrait l'écran ; « Métal & Structure », muet depuis quatre mois, arrivait
troisième. Ils remontent maintenant, et le commentaire est redevenu vrai.

C'est le deuxième de ce genre dans le chantier, après celui du Bloc 0 sur
`--signal`. Un commentaire faux coûte plus cher qu'un commentaire absent : il
fait croire que la question est réglée.

## Le quatrième rail vertical, retiré

`Modèles` était un rail de 18 rem plus un panneau — après Notes, Pages et
Contrôles, et après celui de Groupes retiré plus tôt dans ce chantier. Il est
devenu une bande horizontale, chaque modèle portant son nombre de trous, et le
premier s'ouvre de lui-même : un écran de modèles qui n'en montre aucun fait
perdre un clic à chaque visite et ne montre rien de ce qu'il fait.

## Les derniers « (s) »

« 4 composant(s) » et « 3 trou(s) » rejoignent « 4 vote(s) », « {n} jour(s) »
et « 1 personne(s) » : des phrases écrites, choisies dans le composant, comme
`src/i18n/index.ts` le prescrit.

## Les gardes, à la livraison de la famille

| Garde | Résultat |
|---|---|
| `tsc` | 0 erreur |
| lint | 76 avertissements, 0 erreur — la ligne de base inchangée |
| `check:encres` | aucun défaut, 33 copies connues |
| `check:langue` | 8 contrôles sur 2416 clés |
| `check:signal` | 42 écrans, aucun avec plus d'un ambre, dans les DEUX éditions |
| `check:contraste` | 101 écrans, 21 940 textes, aucun sous WCAG AA |

## Ce qui reste de la famille : le Coffre-fort

`VaultScreen.tsx` fait 654 lignes et, contrairement aux quatre autres, ne passe
ni par la synchronisation ni par l'API : les secrets vivent en local, chiffrés
par le trousseau du système sous Electron, en `localStorage` dans le
navigateur. Le semer demande donc d'écrire dans le stockage du navigateur
depuis le script de capture, pas dans la base du bac à sable — une boucle de
preuve différente de celle des vingt-trois autres modules composés jusqu'ici.

Il est nommé comme restant plutôt que composé à l'aveugle : un écran de
secrets sans données réalistes se compose de mémoire, et c'est exactement ce
que ce chantier refuse.
