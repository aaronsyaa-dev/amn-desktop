# Signer les installeurs Windows

*État au 28 août 2026 : **aucun certificat n'est configuré**. Les installeurs
publiés ne sont pas signés, et Windows SmartScreen affiche un avertissement à
l'installation. Toute la mécanique est en place et attend le certificat ; ce
document dit exactement ce qu'Aaron doit faire, et ce qui se produit ensuite
sans qu'il ait à toucher au code.*

---

## 1. Ce que la signature change réellement

Sans signature, une cliente qui lance `AMN Desktop-Setup-1.2.42.exe` voit un
écran bleu : « Windows a protégé votre ordinateur ». Il faut cliquer
« Informations complémentaires », puis « Exécuter quand même ». Deux clics
supplémentaires, sur un écran qui dit « protégé » — c'est le pire moment
possible pour demander de la confiance à quelqu'un qui vient d'acheter.

Il y a un second effet, plus discret : les antivirus mettent nettement plus
souvent en quarantaine un exécutable non signé. C'est précisément la classe de
panne qui a coûté quatre versions (v1.2.35 → v1.2.38) sous l'ancienne chaîne.

La signature ne dit pas que le logiciel est bon. Elle dit qu'il vient de qui il
prétend venir, et qu'il n'a pas été modifié depuis. C'est tout — et c'est ce
que Windows attend.

---

## 2. Quel certificat acheter

Deux familles, et l'écart entre elles est important.

| | OV (validation d'organisation) | EV (validation étendue) |
|---|---|---|
| Prix indicatif | ~250–400 €/an | ~350–600 €/an |
| Support | fichier `.pfx` téléchargeable | **jeton matériel** (clé USB) ou HSM cloud |
| Utilisable en CI GitHub | **oui**, directement | non sans service de signature à distance |
| SmartScreen | la réputation se construit avec les téléchargements | confiance **immédiate**, dès le premier |

**Recommandation : un certificat OV.** Non parce qu'il est meilleur, mais parce
qu'un EV vit sur un jeton physique qu'un runner GitHub ne peut pas lire : il
faudrait un service de signature à distance (Azure Trusted Signing,
SSL.com eSigner), c'est-à-dire un autre chantier. L'OV s'intègre à la chaîne
actuelle sans rien changer d'autre que deux secrets.

Le prix de l'OV, c'est la réputation SmartScreen : elle se construit sur les
premiers téléchargements. Concrètement, les toutes premières clientes peuvent
encore voir un avertissement — atténué, et il disparaît de lui-même.

*Note : depuis juin 2023, les autorités de certification exigent que même une
clé OV soit générée sur un support matériel ou un HSM. Plusieurs revendeurs
proposent une signature dans le cloud avec un `.pfx` exportable ; c'est ce
qu'il faut demander explicitement à l'achat, sinon le certificat ne sera pas
utilisable en CI.*

Émetteurs courants : DigiCert, Sectigo, SSL.com, GlobalSign. La validation
d'organisation demande des justificatifs d'existence légale de l'entreprise
(extrait Kbis, ligne téléphonique vérifiable) et prend en général de deux à dix
jours ouvrés.

---

## 3. Ce qu'Aaron fait, une fois le certificat en main

### 3.1 Obtenir le fichier `.pfx`

Le certificat doit être exporté au format PKCS#12 (`.pfx` ou `.p12`), **avec sa
clé privée**, et protégé par un mot de passe. Depuis Windows, si le certificat
est dans le magasin personnel :

```
certmgr.msc → Personnel → Certificats → clic droit sur le certificat
  → Toutes les tâches → Exporter…
  → « Oui, exporter la clé privée »
  → PKCS#12, cocher « Inclure tous les certificats dans le chemin d'accès »
  → définir un mot de passe fort
```

Le mot de passe n'est pas une formalité : c'est la seule chose qui protège la
clé si le fichier fuit.

### 3.2 Le convertir en base64

GitHub ne stocke que du texte. Depuis PowerShell :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\chemin\vers\amn.pfx")) | Set-Clipboard
```

Le presse-papier contient alors une longue ligne de texte — c'est elle qu'on
colle, en entier, sans retour à la ligne ajouté.

### 3.3 Créer les deux secrets GitHub

Dépôt `aaronsyaa-dev/amn-desktop` → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**.

| Nom du secret | Contenu |
|---|---|
| `WINDOWS_CERT_PFX_BASE64` | la ligne base64 de l'étape 3.2 |
| `WINDOWS_CERT_PASSWORD` | le mot de passe du `.pfx` |

**Les noms doivent être exacts.** C'est le point qui casse le plus souvent, et
c'est la raison d'être du garde-fou décrit plus bas.

### 3.4 Publier

Rien d'autre à faire. La prochaine étiquette de version signe.

```
git tag v1.2.43 && git push origin v1.2.43
```

Dans le journal du workflow, l'étape **« Vérifier la signature des artefacts »**
affiche alors, pour l'exécutable et pour l'installeur :

```
AMN Business.exe : Valid
  signe par   : CN=…, O=…
  horodate par: CN=DigiCert Timestamp…
```

---

## 4. Ce que la chaîne garantit toute seule

Trois protections, et chacune répond à un échec qui serait autrement invisible.

**Un certificat fourni doit produire une signature.**
`electron-builder.config.mjs` calcule `forceCodeSigning` depuis
l'environnement : faux tant qu'aucun certificat n'existe, vrai dès qu'il y en a
un. Ce n'est pas une précaution théorique — c'est mesuré dans
`app-builder-lib` 26.15.3 : quand `CSC_LINK` est vide,
`windowsSignToolManager.getCscInfo()` rend `null` et **la construction se
poursuit sans signer, sans erreur**. Un `.pfx` illisible ou un mot de passe
faux publierait donc un binaire nu sous une CI verte. Avec
`forceCodeSigning`, `_sign` lève à la place.

**Une configuration à moitié faite arrête tout.**
L'étape « État de la signature de code » s'exécute *avant* l'empaquetage. Un
certificat sans mot de passe, ou un mot de passe sans certificat, échoue avec
un message qui nomme le secret manquant. Sans certificat du tout, elle
n'échoue pas — elle **avertit bruyamment** que les artefacts seront non signés.

**On interroge les fichiers, on ne croit pas la configuration.**
L'étape « Vérifier la signature des artefacts » passe
`Get-AuthenticodeSignature` sur l'exécutable *et* sur l'installeur, exige le
statut `Valid`, et exige un **horodatage**. C'est le même principe que le
smoke test qui exige un démarrage réel : une valeur de configuration ne prouve
pas un résultat.

`npm run check:signing` rejoue ces règles hors CI.

---

## 5. Pourquoi l'horodatage compte autant que la signature

Une signature non horodatée cesse d'être valide le jour où le certificat
expire — **y compris sur les installeurs déjà téléchargés par les clientes**.
Trois ans après l'achat, tous les artefacts publiés se mettraient à alerter le
même jour, sans que rien n'ait changé chez personne.

Avec un horodatage RFC 3161, un tiers atteste que la signature existait pendant
la validité du certificat. Elle lui survit.

La chaîne utilise `http://timestamp.digicert.com` (déclaré dans
`win.signtoolOptions`), et la CI **refuse** un artefact signé mais non horodaté.

---

## 6. Ce que ce document ne couvre pas

- **macOS et Linux.** Aucune des deux plateformes n'est distribuée
  aujourd'hui : la cible Linux sert aux vérifications, macOS n'existe pas dans
  la chaîne. Signer sur macOS demanderait un compte Apple Developer (99 $/an)
  et une notarisation — un autre chantier, à ouvrir le jour où la question se
  pose.
- **La rotation du certificat.** À son renouvellement, refaire les étapes 3.1 à
  3.3 : les secrets sont remplacés, rien d'autre ne bouge.
- **La compromission.** Si le `.pfx` ou son mot de passe fuit, il faut faire
  révoquer le certificat auprès de l'émetteur *et* remplacer les deux secrets.
  Un certificat révoqué invalide les signatures non horodatées ; les
  horodatées, elles, restent valides pour ce qui a été signé avant la
  révocation. Une raison de plus pour l'horodatage.
