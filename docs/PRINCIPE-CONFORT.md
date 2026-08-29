# Le confort passe avant la densité

**Règle donnée par Aaron, le 29 août 2026. Elle vaut pour toute décision de ce
type à partir de maintenant.**

> Le but du desktop, c'est d'être facile d'accès, apaisant, utilisable des
> heures durant, pour tout le monde. Donc partout où il y a un choix entre
> lisibilité/confort et densité/distinction stricte, **la lisibilité et le
> confort gagnent.**

Deux applications nommées explicitement :

- **Les gris.** Les rendre plus lisibles, même si deux couleurs se ressemblent
  un peu plus.
- **Les zones cliquables trop serrées** (sites, champs). Les espacer, quitte à
  réorganiser la mise en page autour.

## Ce que cette règle renverse

Elle tranche dans l'autre sens que deux décisions prises la nuit du 28, et
c'est délibéré. Les deux raisonnements étaient corrects **sur leurs prémisses**,
et ce sont les prémisses qui changent.

### La rampe de gris

`--color-text-muted` était resté à `#808080` parce que le relever à `#8c8c8c`
le placerait à **1,03** de `--color-warning` (`#8f8f8c`) — deux crans
indiscernables. L'argument était : « un avertissement qui ressemble à du texte
discret n'avertit plus ».

C'est vrai, et ça pèse moins que la lisibilité. Un texte à 4,32:1 est illisible
pour une partie des gens **tout le temps**, sur tous les écrans ; deux gris
voisins gênent quelqu'un qui compare deux libellés côte à côte, ce qui arrive
rarement et se rattrape par le contexte, l'icône et la place.

### Les cibles trop serrées

Deux familles avaient été réglées **sans toucher à la mise en page** — un
remplissage négatif pour les puces de sites, une hauteur minimale pour les
champs modifiables. Les deux passaient les 24 px de WCAG 2.5.8 tout en laissant
les zones cliquables **collées les unes aux autres**, à 0 px d'écart.

Or 24 px atteints en collant deux cibles ne rend pas le geste confortable : on
vise juste, ou on ouvre le voisin. Le seuil est un plancher légal, pas un
objectif de confort.

## Comment l'appliquer

1. **Mesurer d'abord**, comme toujours. Le confort se constate, il ne se
   décrète pas : un écart en pixels, un rapport de contraste, un nombre de
   gestes.
2. **Quand deux propriétés s'opposent, écrire laquelle a cédé et pourquoi.**
   Une décision de confort qui n'explique pas ce qu'elle a sacrifié se fera
   annuler au premier arbitrage suivant.
3. **Une dispense « ce serait un choix de mise en page » n'en est plus une.**
   Réorganiser la mise en page est désormais une réponse acceptable — c'est
   même celle qui est demandée.

## Ce que la règle ne dit pas

Elle ne dit pas « tout agrandir ». Un écran où chaque élément réclame de la
place n'est pas apaisant non plus : il devient long à parcourir, et ce qui
compte s'y noie. Le confort visé est celui d'une **longue session** — on doit
pouvoir lire sans effort, viser sans se concentrer, et retrouver les choses au
même endroit.

Elle ne dit pas non plus de sacrifier le sens. Si deux couleurs qui se
rapprochent portent des sens qu'on doit distinguer **d'un coup d'œil**, la
bonne réponse est de les distinguer autrement — par la forme, l'icône, la
place, le poids — et non de reculer sur la lisibilité.
