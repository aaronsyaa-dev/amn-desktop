import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, BoutonSecondaire, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneBarre, PiedDominante, donnees } from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type EtatEcheance,
  type TourneeFlotte,
  type Vehicule,
  compteur,
  echeanceEnAmbre,
  etatEcheance,
  jourDeRendezVous,
  kmParJour,
  kmPointes,
  tambours,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * FLOTTE — les odomètres (`39e`).
 *
 * Chaque véhicule est son compteur kilométrique : des chiffres en tambours,
 * le dernier en clair, relevé à la dernière tournée. Sous le compteur, les
 * échéances sont des jauges qui se remplissent à mesure qu'elles approchent.
 *
 * Le kilométrage n'est jamais saisi : il vient des tournées POINTÉES dans
 * Tournées, chaque arrêt coché ajoutant la distance calculée de son trajet.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const km = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} km`;
const date = (d: Date) => `${d.getDate()} ${MOIS[d.getMonth()]}`;
const jourIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** « du Kangoo » / « de la Clio » : le nom tel qu'il est, avec « du » par défaut. */
const du = (nom: string) => (/^[aeiouyéèh]/i.test(nom) ? `de l’${nom}` : `du ${nom}`);

function reste(x: EtatEcheance, maintenant: Date) {
  if (x.e.nature === 'km') return x.reste <= 0 ? 'dépassée' : km(x.reste);
  if (!x.tombeLe) return '—';
  const j = Math.ceil((x.tombeLe.getTime() - maintenant.getTime()) / 86_400_000);
  if (j < 0) return 'dépassée';
  if (j <= 60) return `dans ${j} j`;
  return `${MOIS[x.tombeLe.getMonth()]} ${x.tombeLe.getFullYear()}`;
}

export function FlotteScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const vehicules = useCollection<Vehicule>('vehicles');
  const tournees = useCollection<TourneeFlotte>('deliveryRounds');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const flotte = useMemo(
    () =>
      vehicules
        .filter((v) => v.kind === 'vehicule')
        .map((v) => {
          const c = compteur(v, tournees);
          const rythme = kmParJour(v, tournees, maintenant);
          return { v, c, etats: v.echeances.map((e) => etatEcheance(e, c.km, rythme, maintenant)) };
        }),
    [vehicules, tournees, maintenant],
  );
  const vide = flotte.length === 0;
  const ambre = echeanceEnAmbre(
    flotte.flatMap((f) => f.etats.map((etat) => ({ v: f.v, etat }))),
    tournees,
    maintenant,
  );
  const vAmbre = ambre ? flotte.find((f) => f.v.id === ambre.v.id) ?? null : null;
  const rdv = ambre?.etat.tombeLe ? jourDeRendezVous(ambre.v, ambre.etat.tombeLe, tournees, maintenant) : null;
  const releve = flotte.map((f) => f.c.releveLe).sort().pop();

  const annee = String(maintenant.getFullYear());
  const couts = flotte.map((f) => ({ f, cents: f.v.couts.filter((c) => c.le.startsWith(annee)).reduce((s, c) => s + c.montantCents, 0) }));
  const maxCout = Math.max(1, ...couts.map((c) => c.cents));
  const moisIso = jourIso(maintenant).slice(0, 7);
  const kmMois = tournees.filter((t) => t.vehiculeId && flotte.some((f) => f.v.id === t.vehiculeId) && t.day.startsWith(moisIso)).reduce((s, t) => s + kmPointes(t), 0);
  /*
    Le coût au kilomètre se mesure sur la même fenêtre pour les deux termes :
    depuis le 1er janvier, ou depuis le début du suivi s'il est plus récent.
    Rapporter les coûts de toute l'année aux seuls kilomètres pointés depuis
    le début du suivi gonflerait le chiffre.
  */
  const fenetre = (v: Vehicule) => (v.departLe.slice(0, 10) > `${annee}-01-01` ? v.departLe.slice(0, 10) : `${annee}-01-01`);
  const mesureKm = flotte.map((f) => {
    const debut = fenetre(f.v);
    const kmF = tournees.filter((t) => t.vehiculeId === f.v.id && t.day >= debut).reduce((s, t) => s + kmPointes(t), 0);
    const cents = f.v.couts.filter((c) => c.le.slice(0, 10) >= debut).reduce((s, c) => s + c.montantCents, 0);
    return { nom: f.v.nom, kmF, cents, parKm: kmF > 0 ? cents / kmF : null };
  });
  const kmTotal = mesureKm.reduce((s, x) => s + x.kmF, 0);
  const coutKm = kmTotal > 0 ? mesureKm.reduce((s, x) => s + x.cents, 0) / kmTotal : null;
  const parKm = mesureKm.filter((x): x is typeof x & { parKm: number } => x.parKm !== null && x.parKm > 0);
  const moinsCher = [...parKm].sort((a, b) => a.parKm - b.parKm)[0];
  const plusCher = [...parKm].sort((a, b) => b.parKm - a.parKm)[0];
  const rapport = moinsCher && plusCher && moinsCher.nom !== plusCher.nom ? Math.round(plusCher.parKm / moinsCher.parKm) : null;
  const prochaine = flotte
    .flatMap((f) => f.etats)
    .filter((x) => x.tombeLe && !x.e.rendezVous)
    .sort((a, b) => (a.tombeLe as Date).getTime() - (b.tombeLe as Date).getTime())[0];

  const reserver = async () => {
    if (!ambre || !vAmbre || !rdv) return;
    await upsert('vehicles', vAmbre.v.id, {
      ...donnees(vAmbre.v),
      echeances: vAmbre.v.echeances.map((e) => (e === ambre.etat.e ? { ...e, rendezVous: jourIso(rdv) } : e)),
    });
  };

  const joursAmbre = ambre?.etat.tombeLe ? Math.ceil((ambre.etat.tombeLe.getTime() - maintenant.getTime()) / 86_400_000) : null;
  const description = vide
    ? t('m50.fleet.descriptionVide')
    : ambre && joursAmbre !== null
      ? t('m50.fleet.description', { n: L(flotte.length, true), jours: L(Math.max(0, joursAmbre)) })
      : t('m50.fleet.descriptionSansAmbre', { n: L(flotte.length, true) });

  const pied = (() => {
    if (!ambre || !vAmbre || !ambre.etat.tombeLe) return 'Aucune échéance ne tombe avant une tournée planifiée : la flotte peut rouler.';
    const jours = [...new Set(ambre.chantiers.map((d) => JOURS[new Date(`${d}T12:00:00`).getDay()]))];
    const qui = `${ambre.etat.e.feminin ? 'La' : 'Le'} ${ambre.etat.e.nom.toLowerCase()} ${du(vAmbre.v.nom)}`;
    return `${qui} tombe le ${date(ambre.etat.tombeLe)}. Ce véhicule assure ${
      jours.length === 1 ? `les tournées du ${jours[0]}` : `${L(ambre.chantiers.length)} tournée${ambre.chantiers.length > 1 ? 's' : ''} planifiée${ambre.chantiers.length > 1 ? 's' : ''} après cette date`
    }${rdv ? ` : un rendez-vous le ${JOURS[rdv.getDay()]} ${rdv.getDate()} évite d’en perdre une.` : '.'}`;
  })();

  return (
    <Ecran50 vide={vide} premierJour={vehicules.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.production'), module: t('m50.fleet.titre') })}
          title={t('m50.fleet.titre')}
          description={description}
          phraseVide={t('m50.fleet.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={releve ? `La flotte · relevé du ${date(new Date(`${releve}T12:00:00`))}` : 'La flotte'}
        note={vide ? undefined : 'Tambours = kilométrage · jauge = échéance qui approche'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque véhicule deviendra ici son compteur kilométrique, nourri par les tournées pointées, avec sous lui ses
            échéances d’entretien et de contrôle.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
              {flotte.map((f) => (
                <div key={f.v.id} className="flex min-w-0 flex-col gap-3.5 border border-border-raised bg-raised p-[18px]">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-bold text-text-primary">{f.v.nom}</span>
                    <span className="tnum font-mono text-[10px] text-text-muted">{f.v.immatriculation || '—'}</span>
                  </span>
                  <span className="flex gap-[3px]" aria-label={km(f.c.km)}>
                    {tambours(f.c.km).map((d, i, arr) => (
                      <span
                        key={i}
                        className={`tnum flex h-[34px] w-6 items-center justify-center border border-[#333] font-mono text-[18px] font-bold shadow-[inset_0_6px_8px_-6px_rgba(0,0,0,.9),inset_0_-6px_8px_-6px_rgba(0,0,0,.9)] ${
                          i === arr.length - 1 ? 'bg-text-body text-[#0a0a0a]' : 'bg-[#0a0a0a] text-text-primary'
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                    <span className="ml-[5px] self-end font-mono text-[10px] font-medium text-text-muted">km</span>
                  </span>
                  <div className="flex flex-col gap-2.5">
                    {f.etats.map((x) => {
                      const a = ambre?.etat === x;
                      return (
                        <div
                          key={x.e.nom}
                          data-signal-groupe={a ? 'echeance' : undefined}
                          className={a ? '-mx-2 bg-[#1c1408] p-2 shadow-[0_0_28px_-7px_rgba(208,154,74,.85)] outline outline-2 outline-signal' : ''}
                        >
                          <span className="flex justify-between gap-2.5">
                            <span className="text-[12.5px] text-text-body">{x.e.nom}</span>
                            <span className={`tnum whitespace-nowrap font-mono text-[11px] ${a ? 'font-bold text-signal' : 'font-medium text-text-secondary'}`}>
                              {x.e.rendezVous ? `rendez-vous le ${date(new Date(`${x.e.rendezVous}T12:00:00`))}` : reste(x, maintenant)}
                            </span>
                          </span>
                          <span className="mt-1.5 block h-[5px] bg-[#101010]">
                            <span className={`block h-[5px] ${a ? 'bg-signal' : 'bg-[#4a4a48]'}`} style={{ width: `${Math.round(x.part * 100)}%` }} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <PiedDominante
              action={
                ambre && rdv ? (
                  <BoutonSecondaire onClick={() => void reserver()}>
                    Réserver le {JOURS[rdv.getDay()]} {rdv.getDate()}
                  </BoutonSecondaire>
                ) : undefined
              }
            >
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les coûts de l’année" note={vide ? undefined : 'Carburant · entretien · assurance'}>
          {vide ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun véhicule suivi.</p>
          ) : (
            couts.map((c, i) => <LigneBarre key={c.f.v.id} nom={c.f.v.nom} part={c.cents / maxCout} valeur={formatCentsCompact(c.cents)} derniere={i === couts.length - 1} />)
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[maintenant.getMonth()].replace(/^./, (x) => x.toUpperCase())}
          releves={[
            { label: 'Km du mois', valeur: km(kmMois) },
            { label: 'Coût au km', valeur: coutKm === null ? '—' : `${(coutKm / 100).toFixed(2).replace('.', ',')} €` },
            {
              label: 'Prochaine échéance',
              valeur: prochaine?.tombeLe ? `${prochaine.tombeLe.getDate()} ${MOIS_COURTS[prochaine.tombeLe.getMonth()]}` : '—',
            },
          ]}
        >
          {rapport && rapport >= 2 && moinsCher && plusCher
            ? `Le ${moinsCher.nom.toLowerCase()} coûte ${L(rapport)} fois moins par kilomètre que le ${plusCher.nom}.`
            : 'Le kilométrage vient des tournées pointées, jamais d’une saisie.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
