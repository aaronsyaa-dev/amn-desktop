import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, BoutonSecondaire, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type ComposantKit,
  ECHELLE_MECHE_J,
  type InterventionPlanifiee,
  type Meche,
  type SuiviStock,
  meche,
  mecheEnAmbre,
  surEchelle,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * PRÉVISION DE STOCK — la mèche (`39d`).
 *
 * Chaque article suivi est une mèche sur une échelle commune de 40 jours. La
 * flamme brûle à gauche, aujourd'hui ; la mèche s'étend jusqu'à la rupture
 * prévue et se termine par un bouchon carré. Un cran marque le point de
 * commande — la rupture moins le délai du fournisseur. Tant que le cran est
 * devant la flamme, il est encore temps.
 *
 * Tout est LU dans les modules d'origine : la quantité dans Stock, le délai
 * annoncé dans Fournisseurs, les interventions planifiées dans Interventions,
 * les nomenclatures de kit dans Composition & coût. Le module ne stocke que
 * la liste des articles suivis et leur fournisseur.
 */

interface ArticleStock {
  name: string;
  quantity: number;
  unit?: string;
}
interface Fournisseur {
  name: string;
  leadTimeDays?: number | null;
}
interface Kit {
  product: string;
  components: ComposantKit[];
}

const MECHE = 'repeating-linear-gradient(90deg, rgba(0,0,0,.35) 0 2px, transparent 2px 6px)';
const nombre = (n: number) => String(n).replace('.', ',');
const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function LigneMeche({ m, ambre }: { m: Meche; ambre: boolean }) {
  const long = m.ruptureJ === null ? 100 : surEchelle(m.ruptureJ);
  const cran = m.cranJ === null ? null : surEchelle(m.cranJ);
  const tard = m.cranJ !== null && m.cranJ < 0;
  const etat = tard ? 'commande trop tardive' : m.ruptureJ === null ? `au-delà de ${ECHELLE_MECHE_J} j` : `rupture dans ${m.ruptureJ} j`;
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[18px] gap-y-2 border-b border-border py-[13px] sm:grid-cols-[170px_minmax(0,1fr)_150px]"
      data-signal-groupe={ambre ? 'meche' : undefined}
    >
      <span className="min-w-0 text-[13.5px] font-semibold text-text-primary [overflow-wrap:anywhere]">{m.article}</span>
      <span className="relative col-span-2 row-start-2 h-[26px] sm:col-span-1 sm:row-start-auto" aria-hidden>
        <span
          className={`absolute left-0 top-[11px] h-1 ${ambre ? 'bg-signal shadow-[0_0_28px_-7px_rgba(208,154,74,.85)]' : 'bg-[#5e5e5b]'}`}
          style={{ width: `${long.toFixed(2)}%`, backgroundImage: MECHE }}
        />
        <span
          className="absolute left-0 top-[5px] h-4 w-2.5 -translate-x-1/2 rounded-[50%_50%_45%_45%]"
          style={{ background: 'radial-gradient(circle at 50% 70%, var(--color-text-primary), var(--color-text-secondary) 70%)' }}
        />
        {cran !== null && (
          <span className={`absolute top-[3px] h-5 w-0.5 -translate-x-1/2 ${ambre ? 'bg-signal' : 'bg-text-body'}`} style={{ left: `${cran.toFixed(2)}%` }} />
        )}
        {m.ruptureJ !== null && (
          <span
            className={`absolute top-1.5 h-3.5 w-3.5 -translate-x-1/2 border-2 bg-sunken ${ambre ? 'border-signal' : 'border-[#4a4a48]'}`}
            style={{ left: `${long.toFixed(2)}%` }}
          />
        )}
      </span>
      <span className={`tnum col-start-2 row-start-1 whitespace-nowrap text-right font-mono text-[11px] sm:col-start-auto sm:row-start-auto ${ambre ? 'font-bold text-signal' : 'font-medium text-text-secondary'}`}>{etat}</span>
    </div>
  );
}

export function PrevisionStockScreen() {
  const { t, langue } = useLangue();
  const navigate = useNavigate();
  const suivis = useCollection<SuiviStock>('stockForecasts');
  const articles = useCollection<ArticleStock>('stockItems');
  const fournisseurs = useCollection<Fournisseur>('suppliers');
  const interventions = useCollection<InterventionPlanifiee>('interventions');
  const kits = useCollection<Kit>('boms');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const lignes = useMemo(() => {
    return suivis
      .filter((s) => s.kind === 'suivi')
      .map((s) => {
        const a = articles.find((x) => x.name.trim().toLowerCase() === s.article.trim().toLowerCase());
        const f = fournisseurs.find((x) => x.name.trim().toLowerCase() === s.fournisseur.trim().toLowerCase());
        const delai = typeof f?.leadTimeDays === 'number' && f.leadTimeDays > 0 ? f.leadTimeDays : null;
        return { s, a, f, m: meche(s.article, a?.quantity ?? 0, delai, interventions, kits, maintenant) };
      })
      .filter((x) => x.a);
  }, [suivis, articles, fournisseurs, interventions, kits, maintenant]);

  /* « Déjà en rupture » : suivi dans Stock, pas ici. */
  const enRupture = lignes.filter((x) => x.m.stock <= 0);
  const meches = lignes.filter((x) => x.m.stock > 0).sort((a, b) => (a.m.ruptureJ ?? 999) - (b.m.ruptureJ ?? 999));
  const ambre = mecheEnAmbre(meches.map((x) => x.m));
  const ligneAmbre = meches.find((x) => x.m === ambre) ?? null;
  const vide = lignes.length === 0;

  const aCommander = meches.filter((x) => x.m.cranJ !== null && x.m.cranJ <= 7).length;
  const delais = lignes.map((x) => x.m.delaiJ).filter((d): d is number => d !== null);
  const delaiMoyen = delais.length ? Math.round((delais.reduce((s, d) => s + d, 0) / delais.length) * 10) / 10 : null;
  const tardives = meches.filter((x) => x.m.cranJ !== null && x.m.cranJ < 0).length;

  const description = vide
    ? t('m50.stockForecast.descriptionVide')
    : tardives === 0
      ? t('m50.stockForecast.descriptionATemps')
      : t(tardives === 1 ? 'm50.stockForecast.description' : 'm50.stockForecast.descriptionPlusieurs', { n: L(tardives) });

  const pied = (() => {
    if (!ligneAmbre || !ambre || ambre.ruptureJ === null || ambre.delaiJ === null) {
      const prochain = meches.find((x) => x.m.cranJ !== null);
      return prochain && prochain.m.cranJ !== null
        ? `Prochaine commande : ${minuscule(prochain.m.article)}, ${prochain.m.cranJ === 0 ? 'aujourd’hui' : `d’ici ${L(prochain.m.cranJ)} jour${prochain.m.cranJ > 1 ? 's' : ''}`}. Toutes les mèches ont encore leur cran devant la flamme.`
        : 'Toutes les mèches ont encore leur cran devant la flamme.';
    }
    const nom = ambre.article;
    const f = ligneAmbre.f?.name ?? ligneAmbre.s.fournisseur;
    return `${nom} : épuisement dans ${L(ambre.ruptureJ)} jour${ambre.ruptureJ > 1 ? 's' : ''} ; ${f} livre en ${L(ambre.delaiJ)}.${
      ambre.interventionsSans > 0
        ? ` ${ambre.interventionsSans === 1 ? 'Une' : L(ambre.interventionsSans, true)} intervention${ambre.interventionsSans > 1 ? 's' : ''} ${ambre.interventionsSans > 1 ? 'tomberont' : 'tombera'} sans cet article, sauf à le prendre chez un autre fournisseur.`
        : ' Commander aujourd’hui ne suffit plus.'
    }`;
  })();

  return (
    <Ecran50 vide={vide} premierJour={suivis.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.production'), module: t('m50.stockForecast.titre') })}
          title={t('m50.stockForecast.titre')}
          description={description}
          phraseVide={t('m50.stockForecast.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre={`Les mèches · ${ECHELLE_MECHE_J} jours`} note={meches.length ? 'Flamme = aujourd’hui · cran = dernier jour pour commander' : undefined}>
        {meches.length === 0 ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            {vide
              ? 'Chaque article suivi deviendra ici une mèche qui brûle vers sa rupture, au rythme des interventions planifiées. Un cran marquera le dernier jour pour commander à temps.'
              : 'Tous les articles suivis sont déjà en rupture : ils se suivent dans Stock.'}
          </p>
        ) : (
          <>
            {meches.map((x) => (
              <LigneMeche key={x.s.article} m={x.m} ambre={x.m === ambre} />
            ))}
            <div className="mt-2.5 grid grid-cols-1 gap-[18px] sm:grid-cols-[170px_minmax(0,1fr)_150px]">
              <span className="max-sm:hidden" />
              <span className="relative h-[13px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
                <span className="absolute left-0">Aujourd’hui</span>
                <span className="absolute left-1/2 -translate-x-1/2">+ {ECHELLE_MECHE_J / 2} j</span>
                <span className="absolute right-0">+ {ECHELLE_MECHE_J} j</span>
              </span>
            </div>

            <PiedDominante
              action={ambre && ambre.interventionsSans > 0 ? <BoutonSecondaire onClick={() => navigate('/fournisseurs')}>Chercher un autre fournisseur</BoutonSecondaire> : undefined}
            >
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les articles suivis" note={lignes.length ? 'Consommation · fournisseur' : undefined}>
          {lignes.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun article suivi.</p>
          ) : (
            lignes.map((x, i) => (
              <LigneRegistre key={x.s.article} colonnes="minmax(0,1fr) auto auto" derniere={i === lignes.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{x.s.article}</span>
                <span className="tnum font-mono text-[11.5px] text-text-secondary">{nombre(x.m.parSemaine)} / sem.</span>
                <span className="text-right font-mono text-[11.5px] text-text-secondary sm:whitespace-nowrap">
                  {x.f?.name ?? x.s.fournisseur}
                  {x.m.delaiJ !== null ? ` · ${x.m.delaiJ} j` : ''}
                </span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Cette semaine"
          releves={[
            { label: 'À commander', valeur: aCommander },
            { label: 'Délai moyen', valeur: delaiMoyen === null ? '—' : `${nombre(delaiMoyen)} j` },
            { label: 'Déjà en rupture', valeur: enRupture.length },
          ]}
        >
          {enRupture.length
            ? `${enRupture.map((x) => x.s.article).join(', ')}, déjà en rupture, se sui${enRupture.length > 1 ? 'vent' : 't'} dans Stock, pas ici.`
            : 'La consommation vient des interventions planifiées et des kits, pas d’une moyenne seule.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
