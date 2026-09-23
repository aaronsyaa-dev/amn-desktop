import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, BoutonSecondaire, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante, donnees } from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { type Extension, installerSansLesInutiles, passageEnAmbre, passagesAuPoste, verdict } from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';
import { EDITION_PRODUCT_NAME } from '../edition/edition';

/**
 * EXTENSIONS — la douane (`39k`).
 *
 * L'installation d'une extension se présente comme un poste de douane : à
 * gauche le produit, au centre la frontière (un mur et son guichet), à droite
 * l'extension. Chaque accès demandé est un passage qui traverse le mur — vers
 * l'extension pour une lecture, vers le produit pour une écriture — avec la
 * donnée et un verdict. On autorise ou on refuse passage par passage.
 *
 * Personnel et Coffre-fort ne figurent JAMAIS au poste : ils sont filtrés
 * avant l'affichage, et refusés d'office à l'installation.
 */

type E = Extension & { id: string; updatedAt: string };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const COLONNES = 'grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_70px_minmax(0,1fr)]';

export function ExtensionsScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<Extension>('extensionGrants');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const extensions = useMemo(() => tout.filter((e): e is E => e.kind === 'extension'), [tout]);
  const installees = extensions.filter((e) => e.statut === 'installee');
  /* Au poste : la demande d'installation en cours ; sinon l'extension installée qui demande trop. */
  const courante = extensions.find((e) => e.statut === 'demande') ?? installees.find((e) => passageEnAmbre(e) !== null) ?? installees[0] ?? null;
  const vide = extensions.length === 0;
  const iAmbre = courante ? passageEnAmbre(courante) : null;
  const ambre = courante && iAmbre !== null ? courante.passages[iAmbre] : null;
  const auPoste = courante ? passagesAuPoste(courante) : [];
  const justifies = auPoste.filter((p) => courante && verdict(courante, p).necessaire).length;

  const ecrire = (e: E, x: Extension) => upsert('extensionGrants', e.id, { ...donnees(e), ...x });
  const basculer = async (i: number) => {
    if (!courante) return;
    const p = courante.passages[i];
    await ecrire(courante, {
      ...courante,
      revueLe: new Date().toISOString(),
      passages: courante.passages.map((q, k) => (k === i ? { ...q, decision: p.decision === 'refuse' ? 'autorise' : 'refuse' } : q)),
    });
  };
  const installer = async () => {
    if (!courante) return;
    await ecrire(courante, installerSansLesInutiles(courante, new Date()));
  };

  const refuses = installees.reduce((s, e) => s + e.passages.filter((p) => p.decision === 'refuse').length, 0);
  const revue = extensions.map((e) => e.revueLe).filter((x): x is string => Boolean(x)).sort().pop();

  const pied = (() => {
    if (!courante) return '';
    if (ambre) {
      const v = verdict(courante, ambre);
      return courante.statut === 'demande'
        ? `${courante.nom} est une ${courante.usage} : ${ambre.sens === 'lecture' ? 'lire' : 'écrire'} « ${ambre.donnee} » (${ambre.module}) ne lui sert à rien. L’installer sans ce passage ne change rien à ce qu’elle fait.`
        : `${courante.nom} n’a pas servi l’accès « ${ambre.module} · ${ambre.donnee} » en 30 jours (${v.texte}). Le refuser le lui ferme, sans casser l’extension.`;
    }
    return `Les ${L(auPoste.length)} passages de ${courante.nom} sont justifiés.${courante.statut === 'installee' ? ' Chaque accès se retire d’un geste, sans désinstaller.' : ''}`;
  })();

  const description = vide
    ? t('m50.extensions.descriptionVide')
    : ambre
      ? t(justifies === 1 ? 'm50.extensions.descriptionUn' : 'm50.extensions.description', { justifies: L(justifies, true) })
      : t('m50.extensions.descriptionSansExces');

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.systeme'), module: t('m50.extensions.titre') })}
          title={t('m50.extensions.titre')}
          description={description}
          phraseVide={t('m50.extensions.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre={courante ? `Le poste de douane · ${courante.nom}` : 'Le poste de douane'} note={courante ? '→ = l’extension lit · ← = l’extension écrit' : undefined}>
        {!courante ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Avant d’installer une extension, on verra ici ce qui passe la frontière entre le produit et elle, dans chaque
            sens, et on autorisera ou refusera passage par passage.
          </p>
        ) : (
          <>
            <div className={`grid items-stretch ${COLONNES}`}>
              <div className="flex flex-col justify-center border border-border-raised bg-raised p-3.5">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">Le produit</span>
                <span className="mt-[5px] text-[15px] font-bold text-text-primary">{EDITION_PRODUCT_NAME}</span>
              </div>
              <div className="relative flex items-center justify-center" aria-hidden>
                <span className="absolute inset-y-0 left-1/2 w-2.5 -translate-x-1/2" style={{ background: 'repeating-linear-gradient(0deg, var(--color-border-strong) 0 10px, #2b2b2b 10px 20px)' }} />
                <span className="relative border border-[#4a4a48] bg-elevated px-1.5 py-1 font-mono text-[9px] font-bold text-text-secondary max-sm:text-[7.5px]">DOUANE</span>
              </div>
              <div className="flex flex-col justify-center border border-border-raised bg-raised p-3.5">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">L’extension</span>
                <span className="mt-[5px] text-[15px] font-bold text-text-primary [overflow-wrap:anywhere]">
                  {courante.nom} · {courante.editeur}
                </span>
              </div>
            </div>

            <div className="mt-3.5 flex flex-col gap-2">
              {auPoste.map((p) => {
                const i = courante.passages.indexOf(p);
                const a = i === iAmbre;
                const v = verdict(courante, p);
                const refuse = p.decision === 'refuse';
                return (
                  <button
                    key={`${p.moduleCle}-${p.donnee}-${p.sens}`}
                    type="button"
                    onClick={() => void basculer(i)}
                    title={refuse ? 'Autoriser ce passage' : 'Refuser ce passage'}
                    data-signal-groupe={a ? 'passage' : undefined}
                    className={`grid items-center text-left ${COLONNES} ${a ? 'bg-[#1c1408] py-1.5 shadow-[0_0_28px_-7px_rgba(208,154,74,.85)] outline outline-2 outline-signal' : ''}`}
                  >
                    <span className="min-w-0 px-3.5">
                      <span className="block text-[13.5px] font-semibold text-text-primary">{p.module}</span>
                      <span className="mt-0.5 block text-[12px] text-text-secondary [overflow-wrap:anywhere]">{p.donnee}</span>
                    </span>
                    <span className={`text-center font-mono text-[22px] font-bold ${a ? 'text-signal' : 'text-[#5e5e5b]'}`}>{p.sens === 'lecture' ? '→' : '←'}</span>
                    <span className={`px-3.5 font-mono text-[11px] tracking-[0.04em] ${a ? 'font-bold text-signal' : 'font-medium text-text-muted'}`}>
                      {refuse ? 'refusé' : v.texte}
                    </span>
                  </button>
                );
              })}
            </div>

            <PiedDominante
              action={
                courante.statut === 'demande' ? (
                  <BoutonSecondaire onClick={() => void installer()}>
                    {ambre ? `Installer sans ${ambre.module}` : 'Installer'}
                  </BoutonSecondaire>
                ) : ambre && iAmbre !== null ? (
                  <BoutonSecondaire onClick={() => void basculer(iAmbre)}>Refuser cet accès</BoutonSecondaire>
                ) : undefined
              }
            >
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les extensions installées" note={installees.length ? 'Accès' : undefined}>
          {installees.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune extension installée.</p>
          ) : (
            installees.map((e, i) => {
              const ouverts = passagesAuPoste(e).filter((p) => p.decision !== 'refuse');
              const parModule = new Map<string, Set<string>>();
              for (const p of ouverts) parModule.set(p.module, (parModule.get(p.module) ?? new Set()).add(p.sens === 'lecture' ? 'lecture' : 'écriture'));
              return (
                <LigneRegistre key={e.id} colonnes="minmax(0,1fr) minmax(0,170px) 40px" derniere={i === installees.length - 1}>
                  <span className="min-w-0 text-[13.5px] text-text-primary">{e.nom}</span>
                  <span className="min-w-0 font-mono text-[11.5px] text-text-secondary">
                    {[...parModule.entries()].map(([m, s]) => `${m} · ${[...s].join(', ')}`).join(' ; ') || 'aucun'}
                  </span>
                  <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">{ouverts.length}</span>
                </LigneRegistre>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Les extensions"
          releves={[
            { label: 'Actives', valeur: installees.length },
            { label: 'Accès refusés', valeur: refuses },
            { label: 'Dernière revue', valeur: revue ? (revue.slice(0, 7) === `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}` ? 'ce mois-ci' : MOIS[new Date(revue).getMonth()]) : '—' },
          ]}
        >
          Chaque accès se retire d’un geste, sans désinstaller l’extension.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
