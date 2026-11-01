import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Coquille, BarreLaterale, EnTete, BarreAjmani, type FamilleLaterale } from '../../socle/coquille';
import { useSocleLangue } from '../../socle/i18n';
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
import { useToucheModificatrice } from './touche';

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
 */
export function CoquilleRefonte({ children, largeur = 'lecture' }: { children?: React.ReactNode; largeur?: 'lecture' | 'pleine' }) {
  const { ts } = useSocleLangue();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const espaces = useNavigationEspacesOptionnelle();
  const assistant = useAssistant();
  const modKey = useToucheModificatrice();
  const pouls = usePoulsGarde();

  const donnees = useDonneesCoquille(pathname, ROUTE_TOUS_LES_MODULES, ts('coquille.tous.court'), ts('coquille.accueil'));

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
      <Coquille
        largeur={largeur}
        tiroirOuvert={tiroir}
        onFermerTiroir={() => setTiroir(false)}
        lateral={
          <BarreLaterale
            produit={EDITION_PRODUCT_NAME}
            familles={donnees.familles}
            garde={garde}
            etatGarde={pouls.etat}
            nombreModules={donnees.nombreModules}
            routeTousLesModules={ROUTE_TOUS_LES_MODULES}
            enLigne={donnees.enLigne}
            presenceMontree={donnees.presenceMontree}
            raccourciRecherche={`${modKey} K`}
            onRecherche={() => {
              setPalette(false);
              setRechercheOuverte(true);
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
            onMenu={() => setTiroir(true)}
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
        ajmani={<BarreAjmani onOuvrir={() => setPalette(true)} raccourci={`${modKey} J`} />}
      >
        {children}
      </Coquille>
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
