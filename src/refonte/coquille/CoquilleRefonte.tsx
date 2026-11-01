import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Coquille, BarreLaterale, EnTete, BarreAjmani, type FamilleLaterale } from '../../socle/coquille';
import { useLangue } from '../../i18n';
import { useAssistant } from '../../assistant/AssistantContext';
import { useNavigationEspacesOptionnelle } from '../../bureaux/navigation';
import { useFermetureEchap } from '../../lib/useFermetureEchap';
import { EDITION_PRODUCT_NAME } from '../../edition/edition';
import { SyncStatusIndicator } from '../../components/SyncStatusIndicator';
import { OrgSwitchButton } from '../../components/org-rail/OrgSwitchButton';
import { ROUTE_TOUS_LES_MODULES } from '../navigation/moment';
import { useDonneesCoquille } from './donnees';
import { PaletteRecherche } from '../systeme/recherche/PaletteRecherche';
import { PaletteAjmaniBranchee } from '../systeme/ajmani';
import { useNotificationsNonLuesAvec } from '../systeme/notifications';
import { ROUTE_NOTIFICATIONS } from '../systeme/routes';
import { usePoulsGarde } from './pouls';
import { raccourciAffiche, useToucheModificatrice } from './touche';
import { ContextePageCoquille, type PageCoquille } from './page';
import { useCarteAujourdhui } from './aujourdhui';

/**
 * LA COQUILLE DE LA REFONTE, BRANCHÉE — la barre latérale, l'en-tête, la barre
 * Ajmani et la palette ⌘J, avec les vraies données de l'édition interne.
 *
 * Elle remplace, quand le drapeau est allumé (`drapeau.ts`), la colonne
 * d'organisations, la barre latérale, la barre du haut et le bandeau d'état de
 * `AppLayout` : UNE navigation, un fil d'Ariane, ⌘K pour chercher, ⌘J pour
 * Ajmani. Ce qui servait dans ces anciennes pièces reste à portée dans
 * l'en-tête : l'état de la synchronisation et le changement d'organisation.
 *
 * ⌘J : la palette prend la touche avant l'écouteur d'origine (celui qui
 * basculait le panneau, dans `AssistantContext`) — en phase de capture, sans
 * le laisser passer. « Demander à Ajmani » envoie le texte au moteur existant
 * (`sendMessage`) et ouvre le panneau pour lire la réponse.
 *
 * Le module `src/assistant/**` n'est pas touché.
 *
 * v3 (01-SOCLE-DESIGN §0.1) : la barre a trois sections (ESPACE, SURVEILLANCE,
 * ÉPINGLÉS) et, en bas, la carte « Aujourd'hui » — les chiffres de l'Accueil
 * (`useCarteAujourdhui`, qui lit `useAccueil`). Une page hors registre donne son
 * fil d'Ariane, sa famille et sa sous-page par `usePageCoquille` (`page.ts`) ;
 * les pages système connues sont dans `pagesSysteme.ts`. Le bouton « panneau »
 * replie la barre sur ce poste, le temps de la session (un état local : il
 * n'existait pas de repli dans la nouvelle coquille).
 */
export function CoquilleRefonte({ children, largeur = 'lecture' }: { children?: React.ReactNode; largeur?: 'lecture' | 'pleine' }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const espaces = useNavigationEspacesOptionnelle();
  const assistant = useAssistant();
  const modKey = useToucheModificatrice();
  const pouls = usePoulsGarde();
  const { langue } = useLangue();

  /* ── Ce que la page montée dit d'elle (fil, famille, sous-page, texte d'Ajmani) ── */
  const [pageDeclaree, setPageDeclaree] = useState<PageCoquille | null>(null);
  const donnees = useDonneesCoquille(pathname, pageDeclaree);
  const aujourdhui = useCarteAujourdhui(langue, '/');

  /* ── La barre repliée (le bouton « panneau » du haut) : un état de session, sur ce poste ── */
  const [repliee, setRepliee] = useState(false);

  /* ── Le tiroir (sous 900 px) ── */
  const [tiroir, setTiroir] = useState(false);
  useEffect(() => setTiroir(false), [pathname]);
  useFermetureEchap(tiroir, () => setTiroir(false));

  /* ── Les palettes : ⌘J (Ajmani) et ⌘K (recherche), une seule ouverte à la fois ── */
  const [palette, setPalette] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const touche = e.key.toLowerCase();
      if (touche === 'j') {
        e.preventDefault();
        // L'écouteur d'origine de l'assistant basculerait le panneau en même temps.
        e.stopImmediatePropagation();
        setRechercheOuverte(false);
        setPalette((v) => !v);
      } else if (touche === 'k') {
        e.preventDefault();
        // Sans cela, l'ancienne palette de commandes s'ouvrirait par-dessus.
        e.stopImmediatePropagation();
        setPalette(false);
        setRechercheOuverte((v) => !v);
      }
    };
    window.addEventListener('keydown', surTouche, true);
    return () => window.removeEventListener('keydown', surTouche, true);
  }, []);

  const aller = useCallback(
    (vers: string) => {
      setPalette(false);
      if (espaces) espaces.aller(vers);
      else navigate(vers);
    },
    [espaces, navigate],
  );

  const demander = useCallback(
    (texte: string) => {
      setPalette(false);
      assistant.sendMessage(texte);
      assistant.open('chat');
    },
    [assistant],
  );

  /* ── La cloche : un lien vers la page Notifications ; le compteur est celui de « Non lues » (le même calcul que la page). ── */
  const nonLues = useNotificationsNonLuesAvec(donnees.attention, donnees.attentionEvaluee);

  const garde: FamilleLaterale | null = donnees.garde;

  return (
    <>
      <ContextePageCoquille.Provider value={setPageDeclaree}>
      <Coquille
        largeur={largeur}
        tiroirOuvert={tiroir}
        onFermerTiroir={() => setTiroir(false)}
        lateralRepliee={repliee}
        lateral={
          <BarreLaterale
            produit={EDITION_PRODUCT_NAME}
            familles={donnees.familles}
            garde={garde}
            cyber={donnees.cyber}
            epingles={donnees.epingles}
            etatGarde={pouls.etat}
            nombreModules={donnees.nombreModules}
            routeTousLesModules={ROUTE_TOUS_LES_MODULES}
            tousLesModulesActif={donnees.tousLesModulesActif}
            aujourdhui={aujourdhui}
            raccourciRecherche={raccourciAffiche(modKey, 'K')}
            onRecherche={() => {
              setPalette(false);
              setRechercheOuverte(true);
            }}
            onReplier={() => {
              setTiroir(false);
              setRepliee(true);
            }}
            ouvert={tiroir}
            onFermer={() => setTiroir(false)}
          />
        }
        entete={
          <EnTete
            fil={donnees.fil}
            enLigne={donnees.enLigne.map((p) => p.nom)}
            presenceMontree={donnees.presenceMontree}
            notifications={nonLues}
            versNotifications={ROUTE_NOTIFICATIONS}
            garde={{ etat: pouls.etat, points: pouls.points, vers: '/garde' }}
            lateralRepliee={repliee}
            onMenu={() => {
              // Repliée : le bouton la redéplie ; sous 900 px, il ouvre le tiroir.
              setRepliee(false);
              setTiroir(true);
            }}
            extra={
              <>
                <span data-guide="lien" className="flex">
                  <SyncStatusIndicator libelleDes="lg" />
                </span>
                <OrgSwitchButton className="hidden md:flex" />
              </>
            }
          />
        }
        ajmani={<BarreAjmani onOuvrir={() => setPalette(true)} raccourci={raccourciAffiche(modKey, 'J')} texte={donnees.texteAjmani} />}
      >
        {children}
      </Coquille>
      </ContextePageCoquille.Provider>
      <PaletteRecherche
        ouverte={rechercheOuverte}
        onFermer={() => setRechercheOuverte(false)}
        surDemanderAjmani={(texte) => {
          setRechercheOuverte(false);
          assistant.sendMessage(texte);
          assistant.open('chat');
        }}
        surAllerA={(route, state) => {
          setRechercheOuverte(false);
          if (state) navigate(route, { state });
          else aller(route);
        }}
      />
      <PaletteAjmaniBranchee
        ouverte={palette}
        onFermer={() => setPalette(false)}
        surDemander={demander}
        surAllerA={(route, state) => {
          setPalette(false);
          if (state) navigate(route, { state });
          else aller(route);
        }}
        surOuvrirRecherche={() => {
          setPalette(false);
          setRechercheOuverte(true);
        }}
      />
    </>
  );
}
