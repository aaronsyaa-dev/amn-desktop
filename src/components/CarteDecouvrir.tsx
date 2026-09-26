import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Search } from 'lucide-react';
import { useModulesOuverts } from '../state/useModulesOuverts';

/**
 * DÉCOUVRIR, MIS EN AVANT SUR L'ACCUEIL CLIENT.
 *
 * Une cliente qui arrive ne sait pas que le produit compte plus de cent
 * modules, ni qu'un écran les range et les cherche pour elle : rien ne le
 * lui disait. Cette carte le dit en une phrase, et lui laisse taper son
 * besoin tout de suite (« relancer mes factures ») — la recherche s'ouvre
 * dans Découvrir, déjà remplie.
 *
 * Deux tailles : pleine tant qu'elle n'a jamais ouvert Découvrir, puis une
 * ligne. Jamais retirée : c'est l'entrée vers tout ce qui lui manque.
 * Aucun ambre — ce n'est pas une décision qui l'attend.
 */
export function CarteDecouvrir() {
  const ouvertures = useModulesOuverts();
  const navigate = useNavigate();
  const [besoin, setBesoin] = useState('');
  const dejaVu = Boolean(ouvertures.discover);
  const aller = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(besoin.trim() ? `/decouvrir?q=${encodeURIComponent(besoin.trim())}` : '/decouvrir');
  };

  if (dejaVu) {
    return (
      <form onSubmit={aller} className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-border bg-surface px-4 py-2.5" data-carte-decouvrir="ligne" aria-label="Chercher un module">
        <Compass size={15} strokeWidth={2} className="flex-none text-text-secondary" aria-hidden />
        <span className="text-[13px] text-text-secondary">Il vous manque un outil ?</span>
        <input
          id="carte-decouvrir-besoin"
          value={besoin}
          onChange={(e) => setBesoin(e.target.value)}
          placeholder="Décrivez ce que vous voulez faire"
          aria-label="Décrivez ce que vous voulez faire"
          className="h-8 min-w-0 flex-1 border border-border bg-bg px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong"
        />
        <button type="submit" className="h-8 border border-border-strong px-3 text-[12.5px] font-semibold text-text-primary hover:bg-surface-hover">
          Chercher
        </button>
      </form>
    );
  }

  return (
    <section className="border border-border-strong bg-surface p-5" data-carte-decouvrir="pleine" aria-labelledby="carte-decouvrir-titre">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-10 w-10 flex-none items-center justify-center border border-border-strong bg-bg text-text-primary" aria-hidden>
          <Compass size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1.5">Découvrir</p>
          <h2 id="carte-decouvrir-titre" className="text-[17px] font-semibold leading-snug text-text-primary">
            Il vous manque un outil ? Dites ce que vous voulez faire.
          </h2>
          <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-text-secondary">
            Plus de cent modules existent : facturation, planning, stock, caisse, rendez-vous en ligne… Découvrir trouve celui qui fait ce que vous décrivez, vous dit s’il est déjà ouvert chez vous, et demande le reste à votre prestataire en un clic.
          </p>
          <form onSubmit={aller} className="mt-3.5 flex flex-wrap gap-2">
            <label className="relative flex min-w-[240px] flex-1 items-center">
              <Search size={14} className="pointer-events-none absolute left-3 text-text-muted" aria-hidden />
              <input
                id="carte-decouvrir-besoin"
                value={besoin}
                onChange={(e) => setBesoin(e.target.value)}
                placeholder="« relancer mes factures », « planning de l’équipe »…"
                aria-label="Décrivez ce que vous voulez faire"
                className="h-10 w-full border border-border bg-bg pl-9 pr-3 text-[13.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong"
              />
            </label>
            <button type="submit" className="h-10 bg-accent px-4 text-[13px] font-semibold text-bg hover:bg-accent-hover">
              Chercher
            </button>
            <Link to="/decouvrir" className="flex h-10 items-center border border-border-strong px-4 text-[13px] font-semibold text-text-primary hover:bg-surface-hover">
              Voir tout ce qui existe
            </Link>
          </form>
        </div>
      </div>
    </section>
  );
}
