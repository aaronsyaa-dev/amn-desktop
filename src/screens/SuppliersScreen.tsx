import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface SupplierData {
  name: string;
  supplies: string;
  contact: string;
  phone: string;
  email: string;
  lastOrderAt: string | null;
  createdAt: string;
}

const QUATRE_VINGT_DIX_JOURS = 90 * 86_400_000;

/** Silencieux : jamais commandé, ou plus rien depuis trois mois. */
const muet = (f: SupplierData, maintenant: number) =>
  !f.lastOrderAt || maintenant - Date.parse(f.lastOrderAt) > QUATRE_VINGT_DIX_JOURS;

/**
 * LES FOURNISSEURS — qui vous livre quoi, et depuis quand.
 *
 * Pour qui : une boutique ou un atelier dont le numéro du grossiste vit dans
 * un SMS de l'an dernier. Ce que ça règle : une fiche par fournisseur avec ce
 * qu'il livre, qui appeler, et la date de la dernière commande — posée d'un
 * geste. Les fournisseurs silencieux depuis trois mois remontent : c'est
 * souvent là qu'une commande a été oubliée.
 *
 * ## Un commentaire qui mentait, corrigé le 12 septembre
 *
 * La phrase ci-dessus — « les fournisseurs silencieux remontent » — décrivait
 * une intention, pas le code. Les fiches étaient triées par NOM, et le silence
 * ne se voyait que dans un relevé d'en-tête et une date en orange au milieu
 * d'une grille de cartes égales. Sur le bac à sable : « Bois de l'Hérault »,
 * commandé il y a un mois, ouvrait l'écran ; « Métal & Structure », muet
 * depuis quatre mois, arrivait troisième.
 *
 * Ils remontent pour de bon maintenant, et le commentaire est redevenu vrai.
 *
 * ## Ce qui domine, et ce que la famille a en commun
 *
 * Un registre ne se surveille pas, il se CONSULTE : la question n'est pas
 * « qu'est-ce qui a changé » mais « où est celui que je cherche ». D'où un
 * champ de recherche et des LIGNES, pas des cartes — six cartes de 17 rem
 * remplissaient déjà la fenêtre, et un registre de quarante fournisseurs
 * demanderait six écrans de défilement.
 *
 * Mais chaque registre garde son propre dominant, tiré de sa matière : ici le
 * SILENCE, parce que c'est le seul défaut qu'une liste de fournisseurs puisse
 * porter.
 *
 * ## L'ambre
 *
 * Sur les silencieux, et nulle part ailleurs. Une fiche qu'on consulte n'est
 * pas une décision ; un fournisseur oublié depuis trois mois en est une —
 * commander, ou retirer la fiche.
 */
export function SuppliersScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<SupplierData>('suppliers');
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState('');
  const [supplies, setSupplies] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [recherche, setRecherche] = useState('');
  const maintenant = Date.now();

  /*
    L'ORDRE DU REGISTRE : les silencieux d'abord, puis l'alphabet.

    C'est ce que l'en-tête du fichier promettait depuis le début. À l'intérieur
    d'un groupe, l'alphabet — un registre se parcourt du regard, et un ordre
    par date y serait imprévisible.

    `maintenant` est relu DANS le mémo, pas capturé dehors : une horloge lue à
    chaque rendu ne peut pas servir de dépendance honnête.
  */
  const fournisseurs = useMemo(() => {
    const a_present = Date.now();
    return [...brutes].sort((a, b) => {
      const ma = muet(a, a_present);
      const mb = muet(b, a_present);
      if (ma !== mb) return ma ? -1 : 1;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [brutes]);
  const muets = fournisseurs.filter((f) => muet(f, maintenant));
  const q = recherche.trim().toLowerCase();
  const trouves = q
    ? fournisseurs.filter((f) => `${f.name} ${f.supplies} ${f.contact}`.toLowerCase().includes(q))
    : fournisseurs;
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const commandesMois = fournisseurs.filter((f) => f.lastOrderAt && Date.parse(f.lastOrderAt) >= debutMois).length;
  const silencieux = fournisseurs.filter((f) => !f.lastOrderAt || maintenant - Date.parse(f.lastOrderAt) > QUATRE_VINGT_DIX_JOURS).length;

  const ajouter = async () => {
    if (!name.trim()) return;
    await upsert('suppliers', uid('sup'), { name: name.trim(), supplies: supplies.trim(), contact: contact.trim(), phone: phone.trim(), email: email.trim(), lastOrderAt: null, createdAt: new Date().toISOString() });
    setName(''); setSupplies(''); setContact(''); setPhone(''); setEmail(''); setOuvert(false);
  };
  const commander = (f: SupplierData & { id: string }) => upsert('suppliers', f.id, { ...f, lastOrderAt: new Date().toISOString() });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('fournisseurs.titre') })}
          title={t('fournisseurs.titre')}
          description={t('fournisseurs.description')}
          stats={[
            { label: t('fournisseurs.stat.fournisseurs'), value: fournisseurs.length },
            { label: t('fournisseurs.stat.commandesMois'), value: commandesMois },
            { label: t('fournisseurs.stat.silencieux'), value: silencieux, emphasis: silencieux > 0 && fournisseurs.length > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('fournisseurs.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('fournisseurs.champNom')} aria-label={t('fournisseurs.champNom')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={supplies} onChange={(e) => setSupplies(e.target.value)} placeholder={t('fournisseurs.champFourniture')} aria-label={t('fournisseurs.champFourniture')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('fournisseurs.champContact')} aria-label={t('fournisseurs.champContact')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder={t('fournisseurs.champTelephone')} aria-label={t('fournisseurs.champTelephone')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('fournisseurs.champEmail')} aria-label={t('fournisseurs.champEmail')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!name.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('fournisseurs.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {fournisseurs.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('fournisseurs.vide.titre')} action={{ label: t('fournisseurs.vide.action'), onClick: () => setOuvert(true) }}>{t('fournisseurs.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* LES SILENCIEUX — l'objet dominant, et la promesse de l'en-tête
              enfin tenue. */}
          <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6" data-signal-groupe="silencieux">
            {muets.length > 0 ? (
              <>
                <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('fournisseurs.stat.silencieux')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">
                  {muets.length === 1 ? t('fournisseurs.silencieuxUn') : t('fournisseurs.silencieuxN', { n: muets.length })}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('fournisseurs.silencieuxAide')}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {muets.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 border border-border-strong px-3 py-2">
                      <span className="text-sm text-text-primary">{f.name}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                        {f.lastOrderAt ? relativeTime(f.lastOrderAt) : t('fournisseurs.jamaisCommande')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">{t('fournisseurs.stat.silencieux')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{t('fournisseurs.tousServis')}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('fournisseurs.tousServisAide')}</p>
              </>
            )}
          </motion.section>

          {/* LE REGISTRE — on vient y chercher une entrée, pas surveiller un
              état : une recherche, puis des lignes. */}
          <motion.section variants={staggerItem} className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <p className="eyebrow">{t('fournisseurs.leRegistre')}</p>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t('fournisseurs.rechercher')}
                aria-label={t('fournisseurs.rechercher')}
                className="input-focus min-h-11 w-full max-w-xs border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-0 md:py-2"
              />
            </div>
            {trouves.length === 0 ? (
              <p className="px-4 py-7 text-center text-sm text-text-secondary">{t('fournisseurs.aucunTrouve')}</p>
            ) : (
              <ul className="flex flex-col gap-px bg-border">
                {trouves.map((f) => (
                  <li key={f.id} className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-surface px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="text-sm text-text-primary">{f.name}</span>
                      {f.supplies && <span className="text-sm text-text-muted"> · {f.supplies}</span>}
                    </span>
                    <span className={`w-40 flex-shrink-0 font-mono text-[10px] uppercase tracking-wider ${muet(f, maintenant) ? 'text-warning' : 'text-text-muted'}`}>
                      {f.lastOrderAt ? t('fournisseurs.derniereCommande', { quand: relativeTime(f.lastOrderAt) }) : t('fournisseurs.jamaisCommande')}
                    </span>
                    <span className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      {f.phone && <a href={`tel:${f.phone}`} className="-my-2 flex items-center gap-1 py-2 hover:text-text-primary"><Phone size={11} /> {f.phone}</a>}
                      {f.email && <a href={`mailto:${f.email}`} className="-my-2 flex items-center gap-1 py-2 hover:text-text-primary"><Mail size={11} /> {f.email}</a>}
                    </span>
                    <span className="flex flex-shrink-0 gap-2">
                      <button type="button" onClick={() => void commander(f)} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-2.5 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                        <ShoppingCart size={12} /> {t('fournisseurs.commandeAujourdhui')}
                      </button>
                      <button type="button" onClick={() => void remove('suppliers', f.id)} aria-label={t('fournisseurs.supprimer')} title={t('fournisseurs.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        </>
      )}
    </motion.section>
  );
}
