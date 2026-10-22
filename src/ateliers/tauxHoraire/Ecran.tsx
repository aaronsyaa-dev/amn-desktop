import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Choix, Etat } from '../_commun/Cadre';
import { euros, nombre, versCentimes } from '../_commun/nombres';
import { EXEMPLE } from './donnees';
import { useTextes } from './i18n';
import { calculerTaux, verifier, type EntreesTaux, type ErreurTaux, type Regime } from './logique';
import { MODULE } from './module';

type Champ = 'revenu' | 'charges' | 'cotisations' | 'joursParSemaine' | 'semainesConges' | 'feriesChomes' | 'autresJoursOff' | 'heuresParJour' | 'partFacturable' | 'marge' | 'tarifActuel';

const enTexte = (e: EntreesTaux): Record<Champ, string> => ({
  revenu: String(e.revenuAnnuel / 100),
  charges: String(e.chargesFixes / 100),
  cotisations: String(e.tauxCotisations),
  joursParSemaine: String(e.joursParSemaine),
  semainesConges: String(e.semainesConges),
  feriesChomes: String(e.feriesChomes),
  autresJoursOff: String(e.autresJoursOff),
  heuresParJour: String(e.heuresParJour),
  partFacturable: String(e.partFacturable),
  marge: String(e.margeSecurite),
  tarifActuel: e.tarifActuel ? String(e.tarifActuel / 100) : '',
});

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(',', '.')));

export default function EcranTauxHoraire() {
  const { tx, langue } = useTextes();
  const [regime, setRegime] = useState<Regime>(EXEMPLE.regime);
  const [v, setV] = useState(() => enTexte(EXEMPLE));
  const [copie, setCopie] = useState(false);

  const entrees: EntreesTaux = {
    regime,
    revenuAnnuel: versCentimes(v.revenu),
    chargesFixes: versCentimes(v.charges),
    tauxCotisations: num(v.cotisations),
    joursParSemaine: num(v.joursParSemaine),
    semainesConges: num(v.semainesConges),
    feriesChomes: num(v.feriesChomes),
    autresJoursOff: num(v.autresJoursOff),
    heuresParJour: num(v.heuresParJour),
    partFacturable: num(v.partFacturable),
    margeSecurite: num(v.marge),
    tarifActuel: v.tarifActuel.trim() === '' ? undefined : versCentimes(v.tarifActuel),
  };
  const fautes = verifier(entrees);
  const r = calculerTaux(entrees);
  const faute = (f: ErreurTaux) => (fautes.includes(f) ? tx(`erreur.${f}`) : undefined);
  const e = (c: Champ) => ({ value: v[c], onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [c]: ev.target.value }), inputMode: 'decimal' as const });

  const resume = r
    ? [
        `${tx('res.taux')} : ${euros(r.tauxHoraire, langue)}`,
        `${tx('res.journee')} : ${euros(r.prixJournee, langue)}`,
        `${tx('res.ca')} : ${euros(r.caNecessaire, langue)}`,
        `${tx('res.heures')} : ${nombre(r.heuresFacturables, 1, langue)}`,
      ].join('\n')
    : '';

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.vous')}</legend>
            <Choix
              etiquette={tx('regime')}
              valeur={regime}
              onChange={setRegime}
              options={[
                { valeur: 'reel', libelle: tx('regime.reel') },
                { valeur: 'micro', libelle: tx('regime.micro') },
              ]}
            />
            <Saisie etiquette={tx('revenu')} aide={tx('revenu.aide')} suffixe="€" erreur={faute('revenu')} {...e('revenu')} />
            <Saisie etiquette={tx('charges')} aide={tx('charges.aide')} suffixe="€" erreur={faute('charges')} {...e('charges')} />
            <Saisie
              etiquette={tx('cotisations')}
              aide={tx(regime === 'reel' ? 'cotisations.aide.reel' : 'cotisations.aide.micro')}
              suffixe="%"
              erreur={faute('cotisations')}
              {...e('cotisations')}
            />
            <Saisie etiquette={tx('marge')} suffixe="%" erreur={faute('marge')} {...e('marge')} />
            <Saisie etiquette={tx('tarifActuel')} aide={tx('tarifActuel.aide')} suffixe="€" {...e('tarifActuel')} />
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-4">
            <legend className="col-span-2 mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.temps')}</legend>
            <Saisie etiquette={tx('joursParSemaine')} erreur={faute('jours')} {...e('joursParSemaine')} />
            <Saisie etiquette={tx('semainesConges')} {...e('semainesConges')} />
            <Saisie etiquette={tx('feriesChomes')} {...e('feriesChomes')} />
            <Saisie etiquette={tx('autresJoursOff')} aide={tx('autresJoursOff.aide')} {...e('autresJoursOff')} />
            <Saisie etiquette={tx('heuresParJour')} suffixe="h" erreur={faute('heures')} {...e('heuresParJour')} />
            <Saisie etiquette={tx('partFacturable')} aide={tx('partFacturable.aide')} suffixe="%" erreur={faute('partFacturable')} {...e('partFacturable')} />
          </fieldset>
        </div>

        <section aria-live="polite" className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.resultat')}</h2>
          {r ? (
            <>
              <Chiffre fort intitule={tx('res.taux')} valeur={euros(r.tauxHoraire, langue)} detail={tx('res.taux.detail')} />
              <div className="grid grid-cols-2 gap-3">
                <Chiffre
                  intitule={tx('res.journee')}
                  valeur={euros(r.prixJournee, langue)}
                  detail={tx('res.journee.detail', { h: nombre((entrees.heuresParJour * entrees.partFacturable) / 100, 1, langue) })}
                />
                <Chiffre intitule={tx('res.ca')} valeur={euros(r.caNecessaire, langue)} detail={tx('res.ca.detail', { c: euros(r.cotisations, langue) })} />
                <Chiffre
                  intitule={tx('res.heures')}
                  valeur={nombre(r.heuresFacturables, 1, langue)}
                  detail={tx('res.heures.detail', { j: r.joursTravailles, s: nombre(r.heuresFacturablesParSemaine, 1, langue) })}
                />
              </div>
              {r.manqueParHeure !== undefined && (
                <p className="rounded-xl border border-socle-bord bg-socle-surface p-4 text-[14px] leading-relaxed">
                  {r.manqueParHeure > 0 ? (
                    <Etat ton="attention">{tx('res.manque', { m: euros(r.manqueParHeure, langue), a: euros(r.manqueSurAnnee ?? 0, langue) })}</Etat>
                  ) : (
                    <Etat ton="succes">{tx('res.ok', { m: euros(-r.manqueParHeure, langue) })}</Etat>
                  )}
                </p>
              )}
              <Bouton
                variante="primaire"
                icone={<Copy size={16} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(resume).then(() => setCopie(true));
                }}
              >
                {copie ? tx('copie') : tx('copier')}
              </Bouton>
            </>
          ) : (
            <p className="text-[14px] text-socle-texte-doux">{fautes.map((f) => tx(`erreur.${f}`)).join(' ')}</p>
          )}
        </section>
      </div>
    </CadreAtelier>
  );
}
