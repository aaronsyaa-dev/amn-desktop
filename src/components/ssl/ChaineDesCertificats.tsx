import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import type { SslStatus } from '../../shared/api';

/**
 * PRODUITS · SSL MONITOR — la chaîne.
 *
 * Une couverture par certificats EST une chaîne, et on la dessine comme telle :
 * des maillons reliés par des anneaux, chacun avec son hôte et son émetteur.
 * Sous les maillons, leurs validités sur un AXE COMMUN — et c'est là que tout
 * se joue : LA CHAÎNE S'ARRÊTE LÀ OÙ FINIT LE PLUS COURT, quelle que soit la
 * longueur des autres. Un tableau de dates dit la même chose et n'en montre
 * rien.
 *
 * L'AXE DOIT ÊTRE COMMUN AUX MAILLONS. Les mettre à des échelles différentes —
 * chacun sa barre sur sa propre largeur — détruirait l'instrument : c'est la
 * comparaison des fins qui porte la lecture, pas la longueur d'une barre.
 *
 * L'AMBRE, unique : le maillon qui finit le premier — sa plaque, son anneau de
 * liaison, sa validité tronquée et son échéance. Quatre nœuds, tous sur la même
 * chaîne.
 *
 * ────────────────────────────────────────────────────────────────────────
 * IL N'Y A PAS DE CHAÎNE DE CERTIFICATION DANS LE PRODUIT
 *
 * La direction décrit « trois maillons, du certificat du site jusqu'à la
 * racine, chacun avec son sujet et son émetteur », et leurs trois validités sur
 * l'axe. `SslStatus` dit autre chose, et c'est lui qui fait foi : amn-api ne
 * relève QUE LE CERTIFICAT FEUILLE d'un hôte — `subject`, `validFrom`,
 * `validTo`, `daysLeft`, et un `issuer` qui est un NOM, pas un certificat.
 * Aucun intermédiaire, aucune racine n'est téléchargé, et leurs fenêtres de
 * validité ne sont nulle part.
 *
 * Dessiner trois maillons aurait donc fabriqué deux certificats et deux
 * validités que personne n'a mesurés — sur un écran dont le sujet est
 * justement de dire quand une couverture s'arrête. La chaîne dessinée est
 * celle que le produit connaît : LES HÔTES SUPERVISÉS, dont la couverture
 * commune finit à la première échéance. La loi est la même, l'axe est le même,
 * et chaque maillon est un relevé réel.
 *
 * PAS DE REGROUPEMENT PAR ORGANISATION non plus : `listSslStatus` rend les
 * hôtes de l'organisation courante, et aucun champ ne rattache un hôte à une
 * cliente. Le pied dit ce que la Garde fait, ce qui est vérifiable, plutôt
 * qu'un classement qui demanderait un rattachement inexistant.
 */

/** La géométrie de la chaîne. Rien n'est posé au pixel près ailleurs. */
const MAILLON_L = 178;
const ANNEAU = 26;
const AXE_H = 116;
const BARRE_H = 16;
const JOUR_MS = 86_400_000;

/**
 * Les seuils de la Garde des Sites (`amn-api`, `sites.certificats`) : sous sept
 * jours une remontée haute, sous deux jours une remontée critique — et le
 * critique est le seul qui franchisse le silence de nuit.
 */
const SEUIL_HAUTE_JOURS = 7;
const SEUIL_CRITIQUE_JOURS = 2;

export function ChaineDesCertificats({ statuses }: { statuses: SslStatus[] }) {
  const lecture = useMemo(() => {
    /* Un hôte sans relevé n'a pas de maillon : on ne dessine pas une validité qu'on n'a pas mesurée. */
    const maillons = statuses
      .filter((s) => s.validFrom && s.validTo)
      .map((s) => ({ s, debut: Date.parse(s.validFrom as string), fin: Date.parse(s.validTo as string) }))
      .filter((m) => Number.isFinite(m.debut) && Number.isFinite(m.fin))
      .sort((a, b) => a.fin - b.fin);
    const sansReleve = statuses.filter((s) => !s.validFrom || !s.validTo);
    if (maillons.length === 0) return null;
    const debut = Math.min(...maillons.map((m) => m.debut));
    const fin = Math.max(...maillons.map((m) => m.fin));
    /* LE PLUS COURT : c'est lui qui décide de la fin de la couverture commune. */
    const court = maillons[0];
    return { maillons, sansReleve, debut, fin: Math.max(fin, debut + JOUR_MS), court };
  }, [statuses]);

  const halo = useHaloSignal(lecture !== null);
  /* Aucun relevé, aucune chaîne : ni maillon, ni échéance à zéro. */
  if (!lecture) return null;
  const { maillons, sansReleve, debut, fin, court } = lecture;

  const pct = (t: number) => ((t - debut) / (fin - debut)) * 100;
  const jour = (ms: number) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
  const jours = court.s.daysLeft;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-chaine={maillons.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">La chaîne de couverture</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Axe commun · la chaîne vaut son maillon le plus court</span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex items-stretch" style={{ minWidth: maillons.length * (MAILLON_L + ANNEAU) }}>
          {maillons.map((m, i) => {
            const ambre = m.s.host === court.s.host;
            const groupe = ambre ? 'maillon-court' : undefined;
            /* L'anneau appartient aux DEUX maillons qu'il relie : celui du plus court s'allume, qu'il soit à gauche ou à droite. */
            const anneauAmbre = ambre || maillons[i - 1]?.s.host === court.s.host;
            return (
              <React.Fragment key={m.s.host}>
                {i > 0 && (
                  /* L'ANNEAU DE LIAISON : c'est lui qui fait une chaîne et non une rangée de cartes. */
                  <span className="flex flex-none items-center justify-center" style={{ width: ANNEAU }} aria-hidden>
                    <span
                      data-signal-groupe={anneauAmbre ? 'maillon-court' : undefined}
                      className={`block rounded-full border-2 ${anneauAmbre ? `border-signal ${halo}` : 'border-border-strong'}`}
                      style={{ width: 13, height: 13 }}
                    />
                  </span>
                )}
                <span
                  data-signal-groupe={groupe}
                  data-maillon={m.s.host}
                  className={`flex flex-none flex-col justify-center border px-4 py-3 ${ambre ? `bg-signal text-signal-ink border-signal ${halo}` : 'border-border-strong bg-raised'}`}
                  style={{ width: MAILLON_L }}
                >
                  <span data-signal-groupe={groupe} className={`truncate text-[13px] font-semibold ${ambre ? '' : 'text-text-primary'}`} title={m.s.host}>
                    {m.s.host}
                  </span>
                  <span className={`mt-1 truncate font-mono text-[10px] uppercase tracking-[0.06em] ${ambre ? 'opacity-75' : 'text-text-muted'}`}>
                    {m.s.issuer ?? 'émetteur inconnu'}
                  </span>
                  <span data-signal-groupe={groupe} className={`mt-2 font-mono text-[11.5px] tabular-nums ${ambre ? 'font-bold' : 'text-text-secondary'}`}>
                    {jour(m.fin)}
                    {m.s.daysLeft !== null && <span className={ambre ? 'opacity-75' : 'text-text-muted'}> · {m.s.daysLeft} j</span>}
                  </span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* L'AXE COMMUN. Une barre par maillon, toutes à la même échelle, et le trait qui dit où la couverture s'arrête. */}
      <div className="mt-5">
        <div className="relative border border-border-raised bg-sunken" style={{ height: Math.max(AXE_H, maillons.length * (BARRE_H + 8) + 16) }}>
          {maillons.map((m, i) => {
            const ambre = m.s.host === court.s.host;
            return (
              <span key={m.s.host} className="absolute" style={{ left: `${pct(m.debut)}%`, width: `${Math.max(0.5, pct(m.fin) - pct(m.debut))}%`, top: 10 + i * (BARRE_H + 8), height: BARRE_H }}>
                <span
                  data-signal-groupe={ambre ? 'maillon-court' : undefined}
                  className={`block h-full border ${ambre ? `bg-signal border-signal ${halo}` : 'border-border-strong bg-[#4a4a48]'}`}
                />
              </span>
            );
          })}
          {/* LA FIN DE LA COUVERTURE : le trait tombe à la première échéance, pas à la dernière. */}
          <span aria-hidden className="absolute inset-y-0 w-px bg-signal-line" style={{ left: `${pct(court.fin)}%` }} />
          <span className="absolute -translate-x-1/2 whitespace-nowrap bg-sunken px-1 font-mono text-[9px] uppercase tracking-[0.1em] text-text-secondary" style={{ left: `${pct(court.fin)}%`, bottom: 3 }}>
            fin de la couverture
          </span>
        </div>
        <div className="relative mt-2 h-3.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
          <span className="absolute left-0">{jour(debut)}</span>
          <span className="absolute right-0">{jour(fin)}</span>
        </div>
      </div>

      <div className="mt-[22px] border-t border-border-raised pt-5">
        <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
          La couverture du parc s’arrête le {jour(court.fin)}, avec <b className="font-semibold text-text-primary">{court.s.host}</b>
          {jours !== null && <> — dans {jours} jour{jours > 1 ? 's' : ''}</>}. Les autres maillons vont plus loin, et cela ne change rien : une chaîne vaut son maillon le plus court, et c’est pour cela qu’ils partagent un axe.
        </p>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Ce que la Garde fait seule : la Garde des Sites relit les certificats toutes les six heures ; sous {SEUIL_HAUTE_JOURS} jours elle remonte en gravité haute, sous {SEUIL_CRITIQUE_JOURS} jours en critique — et le critique est le seul qui franchisse le silence de nuit. La remontée se ferme d’elle-même au renouvellement : personne n’a à la classer.
        </p>
        {sansReleve.length > 0 && (
          /* Un hôte jamais relevé n'a pas de maillon : le dire vaut mieux que de l'oublier au bord de l'axe. */
          <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
            {/* Trois noms suffisent : une énumération de dix hôtes n'informe plus, elle encombre. */}
            {sansReleve.length} hôte{sansReleve.length > 1 ? 's' : ''} sans relevé de validité {sansReleve.length > 1 ? 'restent' : 'reste'} hors de la chaîne — {sansReleve.slice(0, 3).map((s) => s.host).join(', ')}{sansReleve.length > 3 ? ` et ${sansReleve.length - 3} autres` : ''}. Une validité qu’on n’a pas mesurée ne se dessine pas.
          </p>
        )}
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Un maillon est le certificat FEUILLE d’un hôte : amn-api ne télécharge ni intermédiaire ni racine, et leur validité n’existe nulle part. La chaîne dessinée est celle des hôtes supervisés, pas celle de la certification.
        </p>
      </div>
    </article>
  );
}
