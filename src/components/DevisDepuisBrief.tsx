import React, { useMemo, useState } from 'react';
import { AssistantLong, LigneAVenir } from './etats/EtatsTransverses';
import { formatCents } from '../lib/money';
import { type EntreeCatalogue, lignesDepuisBrief } from '../lib/devisBrief';
import type { Client } from '../shared/api';

/**
 * LE DEVIS DEPUIS UN BRIEF — la nouvelle porte d'entrée de Devis (`13a`).
 *
 * Fusion du chantier des cinquante : un générateur n'a plus rien à montrer
 * une fois le devis produit, donc il n'a pas d'écran à lui. C'est une
 * variante de l'assistant `27c` : à gauche l'étape, à droite LE DEVIS RÉEL
 * qui se remplit, chaque ligne reliée à la phrase du brief qui l'a produite.
 * Rien n'est créé avant le dernier bouton ; fermer ne laisse rien derrière.
 */

const ETAPES = ['Brief', 'Lignes', 'Envoi'];

export function DevisDepuisBrief({
  clients,
  catalogue,
  onCreer,
  onFermer,
}: {
  clients: Client[];
  catalogue: EntreeCatalogue[];
  onCreer: (d: { clientId: number; title: string; detail: string; priceEuro: number }) => Promise<void>;
  onFermer: () => void;
}) {
  const [etape, setEtape] = useState(0);
  const [clientId, setClientId] = useState<number | ''>('');
  const [brief, setBrief] = useState('');
  const [retenues, setRetenues] = useState<Record<number, boolean>>({});
  const [prix, setPrix] = useState<Record<number, string>>({});
  const [titre, setTitre] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const lignes = useMemo(() => lignesDepuisBrief(brief, catalogue), [brief, catalogue]);
  const client = clients.find((c) => c.id === clientId) ?? null;
  const prixDe = (i: number) => {
    const saisi = prix[i];
    if (saisi !== undefined && saisi.trim() !== '') return Math.round((Number(saisi.replace(',', '.')) || 0) * 100);
    return lignes[i]?.prixCents ?? null;
  };
  const garde = (i: number) => retenues[i] ?? lignes[i]?.entree !== null;
  const gardees = lignes.map((l, i) => ({ l, i })).filter(({ i }) => garde(i) && prixDe(i) !== null);
  const aChiffrer = lignes.filter((_, i) => garde(i) && prixDe(i) === null);
  const totalCents = gardees.reduce((s, { i }) => s + (prixDe(i) ?? 0), 0);
  const titreFinal = titre.trim() || (gardees[0] ? `${gardees[0].l.entree?.libelle ?? 'Devis'}${gardees.length > 1 ? ` et ${gardees.length - 1} autre${gardees.length > 2 ? 's' : ''} poste${gardees.length > 2 ? 's' : ''}` : ''}` : '');

  const peutSuivre = etape === 0 ? Boolean(clientId) && brief.trim().length > 0 : etape === 1 ? gardees.length > 0 && aChiffrer.length === 0 : Boolean(titreFinal);

  const creer = async () => {
    if (!client || !peutSuivre) return;
    setEnvoi(true);
    const jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const detail = [
      `Depuis le brief du ${jour} :`,
      ...gardees.map(({ l, i }) => `· ${l.entree?.libelle ?? l.phrase}${l.quantite > 1 ? ` × ${l.quantite}` : ''} — ${formatCents(prixDe(i) ?? 0)} ← « ${l.phrase} »`),
    ].join('\n');
    await onCreer({ clientId: client.id, title: titreFinal, detail, priceEuro: totalCents / 100 });
    setEnvoi(false);
  };

  const champs =
    etape === 0 ? (
      <>
        <label className="flex flex-col gap-1.5 text-[12.5px] text-text-secondary">
          Pour quel client
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          >
            <option value="">Choisir un client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] text-text-secondary">
          Le brief, tel que le client l’a écrit
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={7}
            placeholder="« Nettoyer les vitrages du rez-de-chaussée, deux passages par mois, et remettre en état le canapé de l’accueil. »"
            className="input-focus border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none"
          />
        </label>
        <p className="text-[12.5px] leading-relaxed text-text-muted">
          Chaque phrase sera rapprochée de vos prestations déjà facturées ou chiffrées. Une phrase qui ne correspond à rien
          restera à chiffrer : aucun prix n’est inventé.
        </p>
      </>
    ) : etape === 1 ? (
      <div className="flex flex-col gap-2">
        {lignes.map((l, i) => (
          <div key={i} className="grid gap-2 border-b border-border-row pb-2 sm:grid-cols-[auto_minmax(0,1fr)_120px]">
            <input type="checkbox" checked={garde(i)} onChange={(e) => setRetenues({ ...retenues, [i]: e.target.checked })} aria-label={`Garder « ${l.phrase} »`} className="mt-1 h-4 w-4" />
            <span className="min-w-0">
              <span className="block text-[13.5px] text-text-primary">{l.entree ? `${l.entree.libelle}${l.quantite > 1 ? ` × ${l.quantite}` : ''}` : 'Aucune prestation connue'}</span>
              <span className="block text-[12px] italic text-text-muted">« {l.phrase} »{l.entree ? ` · prix de vos ${l.entree.source === 'devis' ? 'devis' : `${l.entree.source}s`}` : ''}</span>
            </span>
            <input
              value={prix[i] ?? (l.prixCents !== null ? String(l.prixCents / 100).replace('.', ',') : '')}
              onChange={(e) => setPrix({ ...prix, [i]: e.target.value })}
              inputMode="decimal"
              placeholder="à chiffrer"
              aria-label={`Prix de « ${l.phrase} »`}
              disabled={!garde(i)}
              className="input-focus min-h-11 border border-border bg-bg px-3 text-right font-mono text-sm text-text-primary outline-none disabled:opacity-40 md:min-h-9"
            />
          </div>
        ))}
        {aChiffrer.length > 0 && (
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            {aChiffrer.length} ligne{aChiffrer.length > 1 ? 's' : ''} gardée{aChiffrer.length > 1 ? 's' : ''} sans prix : chiffrez-la{aChiffrer.length > 1 ? 's' : ''}, ou décochez-la{aChiffrer.length > 1 ? 's' : ''}.
          </p>
        )}
      </div>
    ) : (
      <>
        <label className="flex flex-col gap-1.5 text-[12.5px] text-text-secondary">
          Le titre du devis
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder={titreFinal}
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          />
        </label>
        <p className="text-[12.5px] leading-relaxed text-text-muted">
          Le devis est créé en brouillon sur la fiche de {client?.name ?? 'ce client'}, avec chaque ligne et la phrase du brief qui l’a produite.
        </p>
      </>
    );

  const apercu = (
    <div className="flex flex-col">
      {client ? (
        <p className="border-b border-border-row pb-2 text-[13px] font-semibold text-text-primary">{client.name}</p>
      ) : (
        <LigneAVenir quoi="Le client" etape={1} />
      )}
      {etape === 0 ? (
        <LigneAVenir quoi="Les lignes, une par phrase du brief" etape={2} />
      ) : (
        gardees.map(({ l, i }) => (
          <div key={i} className="border-b border-border-row py-2">
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[13px] text-text-primary">
                {l.entree?.libelle ?? l.phrase}
                {l.quantite > 1 ? ` × ${l.quantite}` : ''}
              </span>
              <span className="tnum flex-shrink-0 font-mono text-[12px] text-text-primary">{formatCents(prixDe(i) ?? 0)}</span>
            </span>
            <span className="mt-0.5 block text-[11.5px] italic leading-snug text-text-muted">← « {l.phrase} »</span>
          </div>
        ))
      )}
      {etape < 2 ? (
        <LigneAVenir quoi="Le titre et l’envoi" etape={3} />
      ) : (
        <p className="border-b border-border-row py-2 text-[13px] text-text-secondary">{titreFinal}</p>
      )}
      {etape > 0 && (
        <p className="flex items-baseline justify-between pt-3">
          <span className="eyebrow">Total</span>
          <span className="tnum font-mono text-[15px] font-bold text-text-primary">{formatCents(totalCents)}</span>
        </p>
      )}
    </div>
  );

  return (
    <AssistantLong
      etapes={ETAPES}
      courante={etape}
      champs={champs}
      apercu={apercu}
      titreApercu="Le devis, tel qu’il se compose"
      pied={
        <>
          <button type="button" onClick={onFermer} className="min-h-11 px-3 text-sm text-text-secondary hover:text-text-primary md:min-h-9">
            Fermer — rien n’est créé
          </button>
          <span className="flex-1" />
          {etape > 0 && (
            <button type="button" onClick={() => setEtape(etape - 1)} className="min-h-11 border border-border-strong px-4 text-sm font-semibold text-text-body hover:bg-surface-hover md:min-h-9">
              Précédent
            </button>
          )}
          {etape < 2 ? (
            <button type="button" disabled={!peutSuivre} onClick={() => setEtape(etape + 1)} className="min-h-11 bg-accent px-4 text-sm font-semibold text-bg md:min-h-9">
              Suivant
            </button>
          ) : (
            <button type="button" disabled={!peutSuivre || envoi} onClick={() => void creer()} className="min-h-11 bg-accent px-4 text-sm font-semibold text-bg md:min-h-9">
              Créer le devis
            </button>
          )}
        </>
      }
    />
  );
}
