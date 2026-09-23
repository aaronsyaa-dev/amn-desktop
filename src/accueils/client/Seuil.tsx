import React from 'react';
import { useCollection, useSync } from '../../state/SyncContext';
import { dayKey } from '../../lib/calendar';
import { EnTeteAccueil, SiPremierJour } from './communs';
import { hhmm, useJournee } from './journee';

/**
 * C10 · LE SEUIL (`40j`).
 *
 * Une phrase de 52 px au centre d'une carte de 430 px de haut, une seconde
 * ligne qui nomme le rendez-vous, et quatre états discrets en pastilles.
 * En dessous : rien.
 *
 * Règles (ACCUEILS.md) : la phrase change de forme selon l'état —
 *   « Rien ne presse avant 16:30. »  (l'heure en ENCRE ambre, pas en plaque)
 *   « Rien ne presse aujourd'hui. »  (sans ambre)
 *   « Une chose presse : … »         (quand l'élément à enjeu est échu)
 * Les quatre états ne portent AUCUN chiffre de travail : ni montant ni durée.
 */

interface Intervention {
  at: string;
  closedAt: string;
}

type Teinte = 'claire' | 'danger' | 'eteinte';

export function Seuil() {
  const j = useJournee(30_000);
  const { connectionStatus } = useSync();
  const interventions = useCollection<Intervention>('interventions');
  const t = j.maintenant.getTime();
  const e = j.enJeu;
  const debut = e ? new Date(e.rdv.startAt) : null;
  const echu = debut !== null && debut.getTime() <= t;

  const heure = debut ? (
    <span data-signal-groupe="seuil" className="tnum font-mono text-signal">
      {hhmm(debut)}
    </span>
  ) : null;
  const phrase = !e ? (
    'Rien ne presse aujourd’hui.'
  ) : echu ? (
    <>
      Une chose presse : {e.motif === 'devis' ? 'le devis' : 'la facture'} de {e.rdv.clientName}, depuis {heure}.
    </>
  ) : (
    <>Rien ne presse avant {heure}.</>
  );
  const suite = e
    ? `${e.rdv.clientName}, ${e.motif === 'devis' ? 'remise du devis' : 'facture échue à évoquer'}.`
    : j.prochain
      ? `Prochain rendez-vous à ${hhmm(new Date(j.prochain.startAt))} : ${j.prochain.clientName || j.prochain.title}.`
      : 'Plus aucun rendez-vous aujourd’hui.';

  const enCours = interventions.some((i) => !i.closedAt && dayKey(new Date(i.at)) === dayKey(j.maintenant));
  const etats: [Teinte, string][] = [
    [connectionStatus === 'online' ? 'claire' : 'eteinte', connectionStatus === 'online' ? 'Espace synchronisé' : 'Hors ligne'],
    [enCours ? 'claire' : 'eteinte', enCours ? 'Intervention en cours' : 'Personne sur la route'],
    j.ruptures.length ? ['danger', j.ruptures.length === 1 ? 'Une rupture de stock' : 'Des ruptures de stock'] : ['eteinte', 'Stock tenu'],
    [j.retard.n ? 'eteinte' : 'claire', j.retard.n ? (j.retard.n === 1 ? 'Une facture en retard' : 'Des factures en retard') : 'Aucune facture en retard'],
  ];

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="Le seuil" />
        <section className="panel-raised panel-raised-wide flex min-h-[430px] flex-col items-center justify-center px-5 py-10 text-center sm:px-10">
          <p className="max-w-[18ch] text-[34px] font-bold leading-[1.05] tracking-[-0.04em] text-text-primary [text-wrap:balance] sm:max-w-none sm:text-[52px]">{phrase}</p>
          <p className="mt-[18px] text-[16px] text-text-secondary">{suite}</p>
          <div className="mt-11 flex flex-wrap justify-center gap-x-[34px] gap-y-3">
            {etats.map(([teinte, texte]) => (
              <span key={texte} className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${teinte === 'claire' ? 'bg-text-primary' : teinte === 'danger' ? 'bg-danger' : 'bg-text-muted'}`} />
                <span className="text-[13px] text-text-secondary">{texte}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </SiPremierJour>
  );
}
