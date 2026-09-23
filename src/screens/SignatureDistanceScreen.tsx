import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { medianeNombres } from '../lib/cinquante/marketing';
import { type CircuitSignature, destinataireRelance, temoin } from '../lib/cinquante/juridique';
import { useLangue } from '../i18n';

/**
 * SIGNATURE À DISTANCE — le témoin (`38b`).
 *
 * Le circuit est une piste de relais : une station par signataire, dans
 * l'ordre FIXÉ À L'ENVOI, reliées par un couloir. Le document est le témoin :
 * les stations franchies portent leur date de signature, le témoin est posé
 * chez qui le tient (et depuis quand), les stations à venir restent en filet.
 *
 * « Une relance ne part qu'à la personne qui tient le témoin, jamais à tout
 * le circuit » : le bouton ne nomme qu'elle, et la relance est consignée dans
 * le circuit.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const date = (iso: string) => `${new Date(iso).getDate()} ${MOIS[new Date(iso).getMonth()]}`;

export function SignatureDistanceScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const circuits = useCollection<CircuitSignature>('signatureCircuits');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const enCours = useMemo(
    () => circuits.map((c) => ({ c, t: temoin(c, maintenant) })).filter((x) => !x.t.signe && !x.t.abandonne).sort((a, b) => b.t.depuisJ - a.t.depuisJ),
    [circuits, maintenant],
  );
  const courant = enCours[0] ?? null;
  const vide = circuits.length === 0;
  const signesMois = circuits.filter((c) => {
    const t = temoin(c, maintenant);
    return t.signe && t.fin && new Date(t.fin).getMonth() === maintenant.getMonth() && new Date(t.fin).getFullYear() === maintenant.getFullYear();
  });
  /* Le délai d'un circuit signé : de l'envoi à la dernière signature. */
  const delais = circuits.flatMap((c) => {
    const tm = temoin(c, maintenant);
    return tm.signe && tm.fin ? [(new Date(tm.fin).getTime() - new Date(c.envoyeLe).getTime()) / 86_400_000] : [];
  });
  const mediane = delais.length ? medianeNombres(delais.map((d) => Math.round(d * 10))) / 10 : null;

  const relancer = async () => {
    if (!courant) return;
    const a = destinataireRelance(courant.c, maintenant);
    if (!a) return;
    await upsert('signatureCircuits', courant.c.id, { ...donnees(courant.c), relances: [...(courant.c.relances ?? []), { le: new Date().toISOString(), a }] });
  };

  const description = vide
    ? t('m50.remoteSign.descriptionVide')
    : courant
      ? courant.t.index === 0
        ? t('m50.remoteSign.descriptionPremier', { jours: L(courant.t.depuisJ) })
        : courant.t.index === 1
          ? t('m50.remoteSign.descriptionUn', { jours: L(courant.t.depuisJ) })
          : t('m50.remoteSign.description', { signes: L(courant.t.index, true), jours: L(courant.t.depuisJ) })
      : t('m50.remoteSign.descriptionAucun');

  const derniereRelance = courant?.c.relances?.filter((r) => r.a === courant.t.detenteur?.nom).pop() ?? null;

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.juridique'), module: t('m50.remoteSign.titre') })}
          title={t('m50.remoteSign.titre')}
          description={description}
          phraseVide={t('m50.remoteSign.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre={courant ? `Le circuit · ${courant.c.document}` : 'Le circuit · dans l’ordre imposé'} note={courant ? 'Le témoin = le document' : undefined}>
        {!courant ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            {vide
              ? 'Un document envoyé à signer passera ici de main en main, dans l’ordre fixé à l’envoi. On verra d’un coup qui tient le témoin.'
              : 'Aucun circuit en cours : chaque document envoyé a été signé jusqu’au bout.'}
          </p>
        ) : (
          <>
            <div className="relative grid gap-y-6" style={{ gridTemplateColumns: `repeat(${courant.c.signataires.length}, minmax(0,1fr))` }}>
              <span className="absolute top-[54px] h-[3px] bg-[#2b2b2b]" style={{ left: `${50 / courant.c.signataires.length}%`, right: `${50 / courant.c.signataires.length}%` }} />
              <span
                className="absolute top-[54px] h-[3px] bg-text-muted"
                style={{ left: `${50 / courant.c.signataires.length}%`, width: `${(courant.t.index / courant.c.signataires.length) * 100}%` }}
              />
              {courant.c.signataires.map((s, i) => {
                const franchie = !!s.signeLe;
                const tient = i === courant.t.index;
                return (
                  <div key={`${s.role}-${s.nom}`} className="relative flex min-w-0 flex-col items-center px-1 sm:px-2" data-signal-groupe={tient ? 'temoin' : undefined}>
                    <span className="whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.1em] text-text-muted sm:text-[9px] sm:tracking-[0.14em]">{s.role}</span>
                    <span
                      className={`mt-3 flex h-10 w-10 items-center justify-center rounded-full ${
                        franchie
                          ? 'bg-text-body'
                          : tient
                            ? 'border-[3px] border-signal bg-elevated shadow-[0_0_28px_-7px_var(--color-signal-glow)]'
                            : 'border border-dashed border-[#4a4a48] bg-sunken'
                      }`}
                    >
                      {franchie && <span className="h-2 w-3.5 -translate-y-px -rotate-45 border-b-2 border-l-2 border-[#0a0a0a]" aria-hidden />}
                      {tient && <span className="h-[22px] w-2.5 bg-signal" aria-hidden />}
                    </span>
                    <span className={`mt-3.5 text-center text-[13px] font-semibold sm:text-[14px] ${franchie || tient ? 'text-text-primary' : 'text-text-muted'}`}>{s.nom}</span>
                    <span className={`tnum mt-1 text-center font-mono text-[10px] sm:text-[10.5px] ${tient ? 'font-bold text-signal' : 'text-text-muted'}`}>
                      {franchie ? `signé le ${date(s.signeLe as string)}` : tient ? `le tient depuis ${courant.t.depuisJ} j` : 'en attente'}
                    </span>
                  </div>
                );
              })}
            </div>

            <PiedDominante action={courant.t.detenteur ? <BoutonSecondaire onClick={() => void relancer()}>Relancer {courant.t.detenteur.nom}</BoutonSecondaire> : undefined}>
              {`${courant.t.detenteur?.nom} ${courant.t.detenteur?.ouvertures ? `a ouvert le lien ${L(courant.t.detenteur.ouvertures)} fois sans signer` : 'n’a pas encore ouvert le lien'}.${
                courant.c.debutContratLe ? ` Le document prend effet le ${new Date(courant.c.debutContratLe).getDate()} ${MOIS_LONGS[new Date(courant.c.debutContratLe).getMonth()]} et ne peut pas commencer sans cette signature.` : ''
              }${derniereRelance ? ` Relance consignée le ${date(derniereRelance.le)}.` : ''}`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les circuits en cours" note={enCours.length ? 'Qui tient le témoin' : undefined}>
          {enCours.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun circuit en cours.</p>
          ) : (
            enCours.map(({ c, t: tm }, i) => (
              <LigneRegistre key={c.id} colonnes="minmax(0,1fr) minmax(0,120px) 40px" derniere={i === enCours.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{c.document}</span>
                <span className="min-w-0 text-[12.5px] text-text-secondary">{tm.detenteur?.nom}</span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">{tm.depuisJ} j</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS_LONGS[maintenant.getMonth()].replace(/^./, (x) => x.toUpperCase())}
          releves={[
            { label: 'Signés', valeur: signesMois.length },
            { label: 'Délai médian', valeur: mediane === null ? '—' : `${String(mediane).replace('.', ',')} j` },
            { label: 'Valeur', valeur: 'signature avancée' },
          ]}
        >
          Un circuit abandonné pendant quinze jours est clos ; le document n’est pas signé.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
