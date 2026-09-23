import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EnTeteAccueil, SiPremierJour, enLettres, euros } from './communs';
import { hhmm, useJournee } from './journee';

/**
 * C7 · LA LETTRE (`40g`).
 *
 * Une lettre de l'espace à la personne qui le tient, en trois paragraphes de
 * 19 px sur 62 caractères : ce qui s'est passé, ce qui ne peut pas attendre,
 * ce qui peut attendre. Les chiffres sont dans les phrases, en mono.
 *
 * Règles (ACCUEILS.md) : TROIS paragraphes, jamais quatre. Le deuxième contient
 * toujours UNE SEULE chose ; s'il n'y en a aucune, il devient « Rien ne presse
 * aujourd'hui » et la lettre n'a pas d'ambre. Les phrases sont composées à
 * partir de GABARITS FIXES, pas par un modèle de langage. L'ambre : la seule
 * phrase surlignée, celle de la décision, surlignage ligne à ligne
 * (`box-decoration-break: clone`).
 */
const JOURS = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
const MOIS = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];

const Chiffre = ({ children, fort }: { children: React.ReactNode; fort?: boolean }) => (
  <span className={`tnum font-mono text-[17px] ${fort ? 'text-text-primary' : ''}`}>{children}</span>
);

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

export function Lettre() {
  const j = useJournee(60_000);
  /* La lettre est écrite à l'ouverture : sa signature porte l'heure de composition. */
  const [ecrite] = useState(() => new Date());
  const prenom = (j.user?.name ?? '').trim().split(/\s+/)[0] ?? '';

  /* ─── 1. Ce qui s'est passé ─── */
  const passes = j.evenements.filter((e) => e.at.getTime() <= ecrite.getTime());
  const debut = passes[0]?.at ?? null;
  const tenus = j.duJour.filter((a) => new Date(a.startAt).getTime() + a.durationMin * 60_000 <= ecrite.getTime());
  const premier = (
    <>
      Bonjour{prenom ? ` ${prenom}` : ''}. {debut ? <>Depuis <Chiffre>{hhmm(debut)}</Chiffre>, </> : 'Depuis ce matin, '}
      {j.encaisseJour > 0 ? (
        <>
          <Chiffre fort>{euros(j.encaisseJour)}</Chiffre> sont rentrés
        </>
      ) : (
        'rien n’est encore rentré'
      )}
      {tenus.length > 0 ? (
        <>
          , et {tenus.length === 1 ? 'un rendez-vous a été tenu' : <>{enLettres(tenus.length)} rendez-vous ont été tenus</>}, le dernier avec {tenus[tenus.length - 1].clientName || tenus[tenus.length - 1].title}.
        </>
      ) : (
        '.'
      )}
    </>
  );

  /* ─── 2. Ce qui ne peut pas attendre : UNE chose, ou « Rien ne presse aujourd'hui » ─── */
  const e = j.enJeu;
  const second = e ? (
    <>
      Une seule chose ne peut pas attendre :{' '}
      <span
        data-signal-groupe="decision"
        className="bg-signal px-1.5 py-0.5 font-semibold text-signal-ink shadow-[0_0_26px_-8px_rgba(208,154,74,.8)] [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
      >
        le rendez-vous de {hhmm(new Date(e.rdv.startAt))} avec {e.rdv.clientName}, où{' '}
        {e.motif === 'devis'
          ? `le devis attend sa réponse${e.jours !== null ? ` depuis ${enLettres(e.jours)} jour${e.jours > 1 ? 's' : ''}` : ''}`
          : `une facture est échue${e.jours !== null ? ` depuis ${enLettres(e.jours)} jour${e.jours > 1 ? 's' : ''}` : ''}`}
      </span>
      .
    </>
  ) : (
    'Rien ne presse aujourd’hui.'
  );

  /* ─── 3. Ce qui peut attendre ─── */
  const reste: React.ReactNode[] = [];
  if (j.retard.n > 0)
    reste.push(
      <React.Fragment key="retard">
        {j.retard.n === 1 ? 'une facture' : `${enLettres(j.retard.n)} factures`} en retard pour <Chiffre>{euros(j.retard.cents)}</Chiffre>
      </React.Fragment>,
    );
  if (j.ruptures.length > 0)
    reste.push(
      <React.Fragment key="stock">
        {j.ruptures.length === 1 ? `${j.ruptures[0].name.toLowerCase()} à recommander` : `${enLettres(j.ruptures.length)} articles à recommander`}
      </React.Fragment>,
    );
  const troisieme = reste.length ? (
    <>
      Le reste peut attendre demain matin : {reste[0]}
      {reste[1] ? <>, et {reste[1]}</> : null}.
    </>
  ) : (
    'Le reste est à jour : aucune facture en retard, rien à recommander.'
  );

  const actions = [
    e && { to: e.motif === 'devis' ? '/facturation/devis' : '/facturation', label: e.motif === 'devis' ? 'Ouvrir le devis' : 'Ouvrir la facture' },
    j.retard.n > 0 && { to: '/relances', label: pluriel(j.retard.n, 'La facture', 'Les factures') },
    j.ruptures.length > 0 && { to: '/stock', label: j.ruptures.length === 1 ? j.ruptures[0].name : 'Le stock' },
  ].filter(Boolean) as { to: string; label: string }[];

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="La lettre" />
        <section className="panel-raised panel-raised-wide px-5 pb-9 pt-10 sm:px-12">
          <div className="max-w-[62ch]">
            <span className="tnum block font-mono text-[10px] tracking-[0.16em] text-text-muted">
              {JOURS[ecrite.getDay()]} {ecrite.getDate()} {MOIS[ecrite.getMonth()]} · {hhmm(ecrite)}
            </span>
            <p className="mt-[22px] text-[17px] leading-[1.7] text-text-body [text-wrap:pretty] sm:text-[19px]">{premier}</p>
            <p className="mt-[18px] text-[17px] leading-[1.7] text-text-body [text-wrap:pretty] sm:text-[19px]">{second}</p>
            <p className="mt-[18px] text-[17px] leading-[1.7] text-text-secondary [text-wrap:pretty] sm:text-[19px]">{troisieme}</p>
            <span className="mt-[26px] block text-[14px] text-text-muted">— votre espace, à {hhmm(ecrite)}</span>
          </div>
          {actions.length > 0 && (
            <div className="mt-[30px] flex flex-wrap gap-[9px] border-t border-border-raised pt-5">
              {actions.map((a, i) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className={`flex min-h-11 items-center px-[13px] text-[12.5px] font-semibold sm:min-h-[30px] ${
                    i === 0 && e ? 'bg-text-primary text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)]' : 'border border-border-strong text-text-body'
                  }`}
                >
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </SiPremierJour>
  );
}
