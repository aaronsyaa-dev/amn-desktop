import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonPrimaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  ENCRE_SURTITRE_PLAQUE,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type Bulletin, type EnregistrementPaie, type Paie, TUYAU, cheminBranche, tuyau } from '../lib/cinquante/rh';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * BULLETINS DE PAIE — le tuyau (`37e`).
 *
 * Le coût employeur entre à gauche sur une largeur proportionnelle à son
 * montant (150 unités). Chaque prélèvement quitte le tuyau par une branche
 * de sa propre largeur, dans l'ordre du bulletin : les cotisations
 * patronales vers le haut, les salariales et le prélèvement à la source vers
 * le bas. Ce qui arrive au bout est le net versé. La somme des largeurs de
 * sortie égale la largeur d'entrée — le net est calculé, pas saisi.
 *
 * Le tuyau montre le mois courant ; le précédent n'est jamais superposé.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const moisDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function BulletinsScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementPaie>('payslips');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const mois = moisDe(maintenant);
  const bulletins = useMemo(
    () => tout.filter((e): e is Id<Bulletin> & { updatedAt: string } => e.kind === 'bulletin' && e.mois === mois).sort((a, b) => b.coutEmployeurCents - a.coutEmployeurCents),
    [tout, mois],
  );
  const paie = tout.find((e): e is Id<Paie> & { updatedAt: string } => e.kind === 'paie' && e.mois === mois) ?? null;
  const tu = useMemo(() => tuyau(bulletins), [bulletins]);
  const vide = bulletins.length === 0;
  const nomMois = MOIS[maintenant.getMonth()];
  const hs = bulletins.find((b) => b.heuresSup);
  const virement = paie ? new Date(paie.virementLe) : null;

  const valider = async () => {
    if (!paie || tu.incoherents.length) return;
    await upsert('payslips', paie.id, { ...donnees(paie), valideeLe: new Date().toISOString() });
  };

  const description = vide ? t('m50.payslips.descriptionVide') : t('m50.payslips.description', { n: L(bulletins.length) });
  const { bandes } = tu;
  const hauts = [{ nom: 'Cotisations patronales', cents: tu.patronales, bande: bandes.patronales, x0: 300 }];
  const bas = [
    { nom: 'Cotisations salariales', cents: tu.salariales, bande: bandes.salariales, x0: 520 },
    { nom: 'Impôt à la source', cents: tu.pas, bande: bandes.pas, x0: 700 },
  ];

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.rh'), module: t('m50.payslips.titre') })}
          title={t('m50.payslips.titre')}
          description={description}
          phraseVide={t('m50.payslips.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={`La paie de ${nomMois} · du coût à la poche`}
        note={vide ? undefined : `Largeur = montant · ${formatCentsCompact(tu.cout)} en entrée`}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Les bulletins du mois dessineront ici un tuyau : le coût employeur entre à gauche, les cotisations sortent en
            chemin, et ce qui arrive au bout est le net versé.
          </p>
        ) : (
          <>
            <div className="relative h-[300px]">
              <svg viewBox={`0 0 ${TUYAU.viewBox.l} ${TUYAU.viewBox.h}`} preserveAspectRatio="none" className="absolute inset-0 h-[300px] w-full" aria-hidden>
                {hauts.map((h) => h.cents > 0 && <path key={h.nom} d={cheminBranche(h.bande.a, h.bande.b, h.x0, 'haut')} fill="var(--color-border-strong)" />)}
                {bas.map((h, i) => h.cents > 0 && <path key={h.nom} d={cheminBranche(h.bande.a, h.bande.b, h.x0, 'bas')} fill={i === 0 ? '#4a4a48' : 'var(--color-text-muted)'} />)}
                <path
                  data-signal-groupe="net-verse"
                  d={`M${TUYAU.xDebut} ${bandes.net.a.toFixed(1)} L${TUYAU.xFin} ${bandes.net.a.toFixed(1)} L${TUYAU.xFin} ${bandes.net.b.toFixed(1)} L${TUYAU.xDebut} ${bandes.net.b.toFixed(1)} Z`}
                  fill="var(--color-signal)"
                />
              </svg>
              <span className="absolute left-[0.5%] top-[6%] whitespace-nowrap">
                <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">Coût employeur</span>
                <span className="tnum mt-[3px] block font-mono text-[13px] font-semibold text-text-body">{formatCentsCompact(tu.cout)}</span>
                <span className="mt-px block text-[11px] text-text-muted">{bulletins.length} bulletin{bulletins.length > 1 ? 's' : ''}</span>
              </span>
              {hauts.map((h) => (
                <span key={h.nom} className="absolute top-[1%] whitespace-nowrap max-sm:hidden" style={{ left: `${(h.x0 + 90) / 10}%` }}>
                  <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">{h.nom}</span>
                  <span className="tnum mt-[3px] block font-mono text-[13px] font-semibold text-text-body">{formatCentsCompact(h.cents)}</span>
                  <span className="mt-px block text-[11px] text-text-muted">{tu.part(h.cents)} %</span>
                </span>
              ))}
              {bas.map((h, i) => (
                <span
                  key={h.nom}
                  className={`absolute top-[80%] whitespace-nowrap max-sm:hidden ${i === 0 ? '-translate-x-full text-right' : ''}`}
                  style={{ left: `${i === 0 ? (h.x0 + 25) / 10 : (h.x0 + 50) / 10}%` }}
                >
                  <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">{h.nom}</span>
                  <span className="tnum mt-[3px] block font-mono text-[13px] font-semibold text-text-body">{formatCentsCompact(h.cents)}</span>
                  <span className="mt-px block text-[11px] text-text-muted">{tu.part(h.cents)} %</span>
                </span>
              ))}
              <span
                data-signal-groupe="net-verse"
                className="absolute right-0 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap bg-signal px-2.5 py-1.5 shadow-[0_0_28px_-7px_var(--color-signal-glow)]"
                style={{ top: `${((bandes.net.a + bandes.net.b) / 2 / TUYAU.viewBox.h) * 100}%` }}
              >
                <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${ENCRE_SURTITRE_PLAQUE}`}>Net versé · {tu.part(tu.net)} %</span>
                <span className="tnum font-mono text-[13px] font-bold text-signal-ink">{formatCentsCompact(tu.net)}</span>
              </span>
            </div>
            {/* Sur un téléphone, les sorties se lisent en liste sous le tuyau. */}
            <div className="mt-3 flex flex-col gap-1 font-mono text-[11px] text-text-secondary sm:hidden">
              {[...hauts, ...bas].map((h) => (
                <span key={h.nom} className="flex justify-between">
                  <span>{h.nom}</span>
                  <span className="tnum">{formatCentsCompact(h.cents)} · {tu.part(h.cents)} %</span>
                </span>
              ))}
            </div>

            <PiedDominante
              action={paie && !paie.valideeLe && tu.incoherents.length === 0 ? <BoutonPrimaire onClick={() => void valider()}>Valider la paie</BoutonPrimaire> : undefined}
            >
              {tu.incoherents.length
                ? `Le net déclaré ne tombe pas juste sur ${tu.incoherents.map((b) => b.personne).join(', ')} : la paie ne se valide pas tant que les bulletins ne s’additionnent pas.`
                : `Sur 100 € que coûte une heure de travail, ${tu.part(tu.net)} € arrivent sur le compte de la personne.${
                    hs?.heuresSup ? ` Les heures supplémentaires de ${hs.personne.split(' ')[0]} ajoutent ${formatCentsCompact(hs.heuresSup.coutCents)} de coût pour ${formatCentsCompact(hs.heuresSup.netCents)} nets.` : ''
                  }${paie?.valideeLe ? ' La paie est validée.' : ''}`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={`Les ${L(bulletins.length)} bulletins`} note={bulletins.length ? 'Coût → net' : undefined}>
          {bulletins.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun bulletin ce mois-ci.</p>
          ) : (
            bulletins.map((b, i) => (
              <LigneRegistre key={b.id} colonnes="minmax(0,1fr) auto auto" derniere={i === bulletins.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{b.personne}</span>
                <span className="tnum font-mono text-[11.5px] text-text-muted">{formatCentsCompact(b.coutEmployeurCents)}</span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-body">{formatCentsCompact(b.netCents)}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={nomMois.replace(/^./, (c) => c.toUpperCase())}
          releves={[
            { label: 'Coût total', valeur: formatCentsCompact(tu.cout) },
            { label: 'Net total', valeur: formatCentsCompact(tu.net) },
            { label: 'Virement', valeur: virement ? `${virement.getDate()} ${MOIS[virement.getMonth()].slice(0, 4)}${MOIS[virement.getMonth()].length > 4 ? '.' : ''}` : '—' },
          ]}
        >
          Chaque bulletin part à sa personne le jour du virement.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
