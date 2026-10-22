import React, { useState } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Choix, Etat, Tableau, type Ton } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, joursEntre } from '../_commun/nombres';
import { CALENDRIER, ETAPES, LIVRAISON, PROJET, TAMPON } from './donnees';
import { useTextes } from './i18n';
import { planifier, verifier, type Calendrier, type Etape, type Unite } from './logique';
import { MODULE } from './module';

type LigneTexte = Omit<Etape, 'duree'> & { duree: string };

function dateLongue(d: string, langue: 'fr' | 'en', avecAnnee = true): string {
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(avecAnnee ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`));
}

export default function EcranRetroplanning() {
  const { tx, langue } = useTextes();
  const [livraison, setLivraison] = useState(LIVRAISON);
  const [tampon, setTampon] = useState(String(TAMPON));
  const [cal, setCal] = useState<Calendrier>(CALENDRIER);
  const [lignes, setLignes] = useState<LigneTexte[]>(() => ETAPES.map((e) => ({ ...e, duree: String(e.duree) })));
  const [suivant, setSuivant] = useState(1);
  const [copie, setCopie] = useState(false);

  const etapes: Etape[] = lignes.map((l) => ({ ...l, duree: l.duree.trim() === '' ? Number.NaN : Number(l.duree) }));
  const t = tampon.trim() === '' ? Number.NaN : Number(tampon);
  const fautes = verifier(livraison, t, etapes, AUJOURDHUI_BAC_A_SABLE);
  const p = planifier(livraison, t, etapes, cal, AUJOURDHUI_BAC_A_SABLE);
  const changer = (id: string, champ: 'nom' | 'duree' | 'unite', v: string) => setLignes(lignes.map((l) => (l.id === id ? { ...l, [champ]: v } : l)));

  const ton: Ton = !p ? 'neutre' : p.marge < 0 ? 'danger' : p.marge <= 5 ? 'attention' : 'succes';
  const messageMarge = !p
    ? ''
    : p.marge < 0
      ? tx('marge.retard', { n: -p.marge })
      : p.marge === 0
        ? tx('marge.zero')
        : tx(p.marge <= 5 ? 'marge.juste' : 'marge.ok', { n: p.marge });
  const duree = (e: Etape) => tx(e.unite === 'ouvres' ? 'duree.ouvres' : 'duree.calendaires', { n: e.duree });

  // L'échelle de la frise : du démarrage à la livraison, en jours calendaires.
  const etendue = p ? Math.max(1, joursEntre(p.demarrage, p.livraison) + 1) : 1;
  const barre = (debut: string, fin: string) =>
    p ? { marginLeft: `${(joursEntre(p.demarrage, debut) / etendue) * 100}%`, width: `${Math.max(1.2, ((joursEntre(debut, fin) + 1) / etendue) * 100)}%` } : {};

  const texte = p
    ? [
        `${PROJET} — ${tx('livraison')} : ${dateLongue(p.livraison, langue)}`,
        ...p.etapes.map((e) => `${e.nom} : ${dateLongue(e.debut, langue)} → ${dateLongue(e.fin, langue)} (${duree(e)})`),
        ...(p.tampon ? [`${tx('tampon.ligne')} : ${dateLongue(p.tampon.debut, langue)} → ${dateLongue(p.tampon.fin, langue)}`] : []),
        `${tx('demarrage')} ${dateLongue(p.demarrage, langue)}`,
      ].join('\n')
    : '';

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <p className="text-[14px] text-socle-texte">
        <span className="text-socle-texte-discret">{tx('projet')} · </span>
        {PROJET}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Saisie type="date" etiquette={tx('livraison')} value={livraison} onChange={(e) => setLivraison(e.target.value)} erreur={fautes.includes('livraison') ? tx('erreur.livraison') : undefined} />
        <Saisie
          etiquette={tx('tampon')}
          aide={tx('tampon.aide')}
          inputMode="numeric"
          value={tampon}
          onChange={(e) => setTampon(e.target.value)}
          erreur={fautes.includes('tampon') ? tx('erreur.tampon') : undefined}
        />
        <div className="flex flex-col gap-2 text-[14px] text-socle-texte-doux sm:col-span-2 sm:flex-row sm:gap-6">
          {(['samediOuvre', 'feries'] as const).map((k) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={cal[k]} onChange={(e) => setCal({ ...cal, [k]: e.target.checked })} className="h-4 w-4 accent-socle-texte" />
              {tx(k === 'samediOuvre' ? 'samedi' : 'feries')}
            </label>
          ))}
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.etapes')}</legend>
        <ol className="flex flex-col gap-2">
          {lignes.map((l, i) => (
            <li key={l.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-end gap-2 rounded-xl border border-socle-bord bg-socle-surface p-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_7rem_11rem_auto]">
              <span className="pb-3 text-[13px] tabular-nums text-socle-texte-discret">{i + 1}.</span>
              <Saisie etiquette={tx('etape.nom')} value={l.nom} onChange={(e) => changer(l.id, 'nom', e.target.value)} />
              <div className="col-start-2 sm:col-start-auto">
                <Saisie etiquette={tx('etape.duree')} inputMode="numeric" value={l.duree} onChange={(e) => changer(l.id, 'duree', e.target.value)} />
              </div>
              <div className="col-start-2 sm:col-start-auto">
                <Choix<Unite>
                  etiquette={tx('etape.unite')}
                  valeur={l.unite}
                  onChange={(v) => changer(l.id, 'unite', v)}
                  options={[
                    { valeur: 'ouvres', libelle: tx('unite.ouvres') },
                    { valeur: 'calendaires', libelle: tx('unite.calendaires') },
                  ]}
                />
              </div>
              <div className="col-start-3 row-start-1 pb-0.5 sm:col-start-auto sm:row-start-auto">
                <Bouton variante="discret" taille="petit" aria-label={tx('retirer', { n: l.nom || String(i + 1) })} onClick={() => setLignes(lignes.filter((x) => x.id !== l.id))}>
                  <X size={16} aria-hidden />
                </Bouton>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <Bouton
            variante="secondaire"
            taille="petit"
            icone={<Plus size={16} />}
            onClick={() => {
              setLignes([...lignes, { id: `n${suivant}`, nom: tx('nouvelle'), duree: '1', unite: 'ouvres' }]);
              setSuivant(suivant + 1);
            }}
          >
            {tx('ajouter')}
          </Bouton>
        </div>
      </fieldset>

      <section aria-live="polite" className="flex flex-col gap-4">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.plan')}</h2>
        {p ? (
          <>
            <div className="flex flex-col gap-2 rounded-xl border border-socle-bord-fort bg-socle-eleve p-4">
              <span className="text-[12px] font-medium text-socle-texte-discret">{tx('demarrage')}</span>
              <span className="text-[26px] font-semibold leading-tight">{dateLongue(p.demarrage, langue)}</span>
              <Etat ton={ton}>{messageMarge}</Etat>
            </div>

            <div aria-hidden className="flex flex-col gap-1.5 rounded-xl border border-socle-bord bg-socle-surface p-4">
              {p.etapes.map((e) => (
                <div key={e.id} className="h-2 rounded-full bg-socle-creux">
                  <div className={`h-full rounded-full ${e.unite === 'ouvres' ? 'bg-socle-texte-doux' : 'bg-socle-bord-fort'}`} style={barre(e.debut, e.fin)} />
                </div>
              ))}
              {p.tampon && (
                <div className="h-2 rounded-full bg-socle-creux">
                  <div className="h-full rounded-full bg-socle-texte-discret opacity-60" style={barre(p.tampon.debut, p.tampon.fin)} />
                </div>
              )}
            </div>

            <Tableau
              entetes={[tx('col.etape'), tx('col.du'), tx('col.au'), tx('col.duree')]}
              droite={[3]}
              lignes={[
                ...p.etapes.map((e) => [e.nom, dateLongue(e.debut, langue, false), dateLongue(e.fin, langue, false), duree(e)]),
                ...(p.tampon ? [[tx('tampon.ligne'), dateLongue(p.tampon.debut, langue, false), dateLongue(p.tampon.fin, langue, false), tx('duree.ouvres', { n: t })]] : []),
              ]}
            />
            <div>
              <Bouton
                variante="primaire"
                icone={<Copy size={16} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(texte).then(() => setCopie(true));
                }}
              >
                {copie ? tx('copie') : tx('copier')}
              </Bouton>
            </div>
          </>
        ) : (
          <p className="text-[14px] text-socle-texte-doux">
            {fautes.map((f) => (typeof f === 'string' ? tx(`erreur.${f}`) : tx('erreur.etape'))).filter((x, i, a) => a.indexOf(x) === i).join(' ')}
          </p>
        )}
      </section>
    </CadreAtelier>
  );
}
