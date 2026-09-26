import React from 'react';
import { Link } from 'react-router-dom';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { nomPalier } from '../../lib/paliers';
import { Carte, Chargement, EnTete, Invitation } from '../ui/kit';
import { enLettresF } from '../format';

/**
 * SUPERVISOR · LA SANTÉ DES PLACES (cahier 15, `51c` · 03).
 *
 * Les places utilisées contre celles de la formule, chez chaque cliente —
 * les comptes ouverts (`userCount`) contre les places posées ou comprises
 * dans la formule. Une cliente sans limite de places n'y figure pas.
 *
 * L'ambre : la cliente la plus pleine, dès qu'elle a pris toutes ses places —
 * la prochaine personne qu'elle voudra inviter sera refusée : c'est elle
 * qui va devoir monter.
 */
export function SupervisorPlaces() {
  const m = useSupervisor();
  if (!m.pret) {
    return (
      <>
        <EnTete surtitre="Supervisor · Santé des places" titre="Les places se comptent." />
        <Chargement texte="Lecture des organisations" />
      </>
    );
  }
  const lignes = m.orgs
    .map((o) => {
      const total = o.org.seats ?? o.org.formula?.seats ?? null;
      return { o, total, utilisees: o.org.userCount ?? 0 };
    })
    .filter((l): l is { o: (typeof m.orgs)[number]; total: number; utilisees: number } => l.total !== null && l.total > 0 && l.o.statut !== 'suspended')
    .sort((a, b) => b.utilisees / b.total - a.utilisees / a.total || b.o.poids - a.o.poids);
  const pleines = lignes.filter((l) => l.utilisees >= l.total);
  const ambre = pleines[0] ?? null;
  const titre = !lignes.length
    ? 'Aucune cliente n’a de limite de places.'
    : pleines.length
      ? pleines.length > 1 ? `${enLettresF(pleines.length, true)} clientes ont pris toutes leurs places.` : `${pleines[0].o.nom} a pris toutes ses places.`
      : 'Chaque cliente a encore de la place.';

  return (
    <>
      <EnTete surtitre="Supervisor · Dossiers clients · Santé des places" titre={titre} />
      {!lignes.length ? (
        <Invitation titre="Rien à mesurer." texte="Les places se comptent chez les clientes dont la formule ou les réglages posent une limite." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <Carte dominante pad="p-6" titre={`Les places · ${lignes.length} clientes`} droite="comptes ouverts / places de la formule">
            {lignes.slice(0, 24).map((l) => {
              const estAmbre = ambre?.o.id === l.o.id;
              const part = Math.min(1, l.utilisees / l.total);
              return (
                <Link key={l.o.id} to={`/supervisor/dossiers/${l.o.id}`} className="grid grid-cols-[180px_minmax(0,1fr)_64px] items-center gap-4 border-b border-border py-2.5 hover:bg-white/[0.02]" data-signal-groupe={estAmbre ? 'places-ambre' : undefined}>
                  <span className="truncate text-[13px] font-semibold text-text-primary">{l.o.nom}</span>
                  <span className="h-[10px] bg-[#1c1c1c]" aria-hidden>
                    <span className="block h-full" style={{ width: `${part * 100}%`, background: estAmbre ? AMBRE : part >= 1 ? '#bdbdb9' : 'var(--color-trait-sourd)' }} />
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: estAmbre ? AMBRE : 'var(--color-text-secondary)' }}>
                    {l.utilisees} / {l.total}
                  </span>
                </Link>
              );
            })}
          </Carte>
          <Carte className="self-start" titre={ambre ? ambre.o.nom : 'Rien ne presse'} droite={ambre ? nomPalier(ambre.o.org.plan) : ''}>
            {ambre ? (
              <>
                <p className="text-[13.5px] leading-relaxed text-text-body">
                  {ambre.utilisees} compte{ambre.utilisees > 1 ? 's' : ''} pour {ambre.total} place{ambre.total > 1 ? 's' : ''} : la prochaine invitation sera refusée. Une place de plus, ou la formule au-dessus.
                </p>
                <div className="mt-4 flex gap-2.5">
                  <Link to={`/supervisor/dossiers/${ambre.o.id}`} className="bx-btn2">
                    Ouvrir son dossier
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-text-secondary">La cliente la plus pleine utilise {lignes[0].utilisees} place{lignes[0].utilisees > 1 ? 's' : ''} sur {lignes[0].total}.</p>
            )}
          </Carte>
        </div>
      )}
    </>
  );
}
