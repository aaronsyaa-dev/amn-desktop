import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Coquille, BarreLaterale, EnTete, BarreAjmani, PaletteAjmani, type FamilleLaterale, type Proposition } from '../../socle/coquille';
import { EtatVide, Squelette, Chargement, PastilleEtat } from '../../socle/ui';
import { useSocleLangue } from '../../socle/i18n';
import { useCommandPalette } from '../../components/command-palette/CommandPalette';
import { useAssistant } from '../../assistant/AssistantContext';
import { useNavigationEspacesOptionnelle } from '../../bureaux/navigation';
import { useFermetureEchap } from '../../lib/useFermetureEchap';
import { EDITION_PRODUCT_NAME } from '../../edition/edition';
import { SyncStatusIndicator } from '../../components/SyncStatusIndicator';
import { OrgSwitchButton } from '../../components/org-rail/OrgSwitchButton';
import { libelleNav, indiceNav } from '../../i18n';
import { ROUTE_TOUS_LES_MODULES, suggestionsDuMoment } from '../navigation/moment';
import { chercher } from '../navigation/recherche';
import { familleDe } from '../navigation/registre';
import { useDonneesCoquille } from './donnees';
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
  const recherche = useCommandPalette();
  const assistant = useAssistant();
  const modKey = useToucheModificatrice();
  const pouls = usePoulsGarde();

  const donnees = useDonneesCoquille(pathname, ROUTE_TOUS_LES_MODULES, ts('coquille.tous.court'), ts('coquille.accueil'));

  /* ── Le tiroir (sous 900 px) ── */
  const [tiroir, setTiroir] = useState(false);
  useEffect(() => setTiroir(false), [pathname]);
  useFermetureEchap(tiroir, () => setTiroir(false));

  /* ── La palette ⌘J ── */
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        // L'écouteur d'origine de l'assistant basculerait le panneau en même temps.
        e.stopImmediatePropagation();
        setPalette((v) => !v);
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

  const items = useMemo(
    () => donnees.catalogue.map((item) => ({ ...item, label: libelleNav(item), hint: indiceNav(item) })),
    [donnees.catalogue],
  );
  const proposition = useCallback(
    (item: (typeof items)[number], detail?: string): Proposition => ({ id: item.key, libelle: item.label, detail, famille: familleDe(item.key), executer: () => aller(item.to) }),
    [aller],
  );
  const suggestions = useMemo(() => {
    const parCle = new Map(items.map((i) => [i.key, i]));
    return suggestionsDuMoment(new Date())
      .map((k) => parCle.get(k))
      .filter((i): i is (typeof items)[number] => Boolean(i))
      .slice(0, 5)
      .map((i) => proposition(i));
    // L'heure compte : on relit à chaque ouverture de la palette.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, proposition, palette]);
  const chercherModules = useCallback((texte: string) => chercher(texte, items).slice(0, 6).map(({ item, raison }) => proposition(item, raison)), [items, proposition]);
  const demander = useCallback(
    (texte: string) => {
      setPalette(false);
      assistant.sendMessage(texte);
      assistant.open('chat');
    },
    [assistant],
  );

  /* ── Le volet de la cloche : ce qui attend ── */
  const volet = (fermer: () => void) => (
    <>
      <h2 className="sc-popover__titre">{ts('entete.cloche.titre')}</h2>
      {!donnees.attentionEvaluee ? (
        <Chargement libelle={ts('bouton.chargement')}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Squelette hauteur={14} largeur="80%" />
            <Squelette hauteur={14} largeur="60%" />
          </div>
        </Chargement>
      ) : donnees.attention.length === 0 ? (
        <EtatVide texte={ts('entete.cloche.vide')} />
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
          {donnees.attention.slice(0, 6).map((a) => (
            <li key={a.key}>
              <Link to={a.to} onClick={fermer} className="sc-module sc-focus" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 3, height: 'auto' }}>
                <span style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                  <PastilleEtat etat={a.severity === 'critical' ? 'critique' : a.severity === 'warning' ? 'attention' : 'info'}>{a.severity === 'critical' ? '!' : '·'}</PastilleEtat>
                  <span style={{ color: 'var(--socle-texte-1)', fontWeight: 500, whiteSpace: 'normal' }}>{a.title}</span>
                </span>
                <span style={{ color: 'var(--socle-texte-3)', fontSize: 12, whiteSpace: 'normal' }}>{a.evidence}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );

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
            nombreModules={donnees.nombreModules}
            routeTousLesModules={ROUTE_TOUS_LES_MODULES}
            enLigne={donnees.enLigne}
            presenceMontree={donnees.presenceMontree}
            raccourciRecherche={`${modKey} K`}
            onRecherche={recherche.open}
            ouvert={tiroir}
            onFermer={() => setTiroir(false)}
          />
        }
        entete={
          <EnTete
            fil={donnees.fil}
            enLigne={donnees.enLigne.map((p) => p.nom)}
            presenceMontree={donnees.presenceMontree}
            notifications={donnees.attention.length}
            volet={volet}
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
      <PaletteAjmani ouverte={palette} onFermer={() => setPalette(false)} suggestions={suggestions} chercher={chercherModules} onDemander={demander} />
    </>
  );
}
