import React, { createContext, useContext, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Bloc, BoutonSecondaire } from "./cinquante-kit";
import { Champ } from "./formulaire/Champ";
import { FormulaireEnPlace } from "./formulaire/FormulaireEnPlace";
import { ConfirmDelete } from "./ConfirmDelete";

/**
 * SAISIR À LA MAIN — la première fiche d'un module, et les suivantes.
 * ═══════════════════════════════════════════════════════════════════
 *
 * L'audit « avant vente » l'a relevé : quarante-quatre des quarante-cinq
 * modules du chantier des cinquante LISAIENT leurs données sans jamais les
 * écrire. Seul le jeu de démonstration les remplissait ; une cliente qui
 * ouvrait Flotte, Procédures ou Simulateur de prêt sur un compte neuf voyait
 * un instrument vide et aucun moyen de lui donner quoi que ce soit.
 *
 * Ce composant est la réponse commune : un formulaire EN PLACE décrit par une
 * liste de champs, et la liste de ce qui a déjà été saisi — avec « Modifier »
 * et « Supprimer » sur chaque ligne. Chaque module garde la main sur ce qu'il
 * écrit : il reçoit des chaînes, les convertit (`versCents`, `versNombre`…)
 * et appelle `upsert` lui-même. L'instrument, lui, ne change pas.
 *
 * Ouvert d'emblée quand l'écran est vide (c'est la seule chose à y faire),
 * replié en un bouton ensuite.
 */

export type TypeChamp =
  | "texte"
  | "long"
  | "nombre"
  | "montant"
  | "pourcent"
  | "date"
  | "heure"
  | "choix"
  | "lignes";

export interface ChampSaisie {
  cle: string;
  intitule: string;
  type: TypeChamp;
  requis?: boolean;
  aide?: string;
  options?: Array<{ valeur: string; libelle: string }>;
  defaut?: string;
  suffixe?: string;
  /** Occupe toute la largeur de la grille (textes longs, listes). */
  large?: boolean;
}

export interface ElementSaisi {
  id: string;
  libelle: string;
  detail?: string;
  /** Les valeurs du formulaire pour « Modifier ». Absentes : pas de modification, seulement la suppression. */
  valeurs?: Record<string, string>;
}

type Valeurs = Record<string, string>;

/* ─── Conversions, pour que chaque module écrive ce que son instrument lit ─── */

/** « 1 250,50 » → 125050. `null` si ce n'est pas un montant. */
export function versCents(s: string | undefined): number | null {
  const n = versNombre(s);
  return n === null ? null : Math.round(n * 100);
}

/** « 12,5 » → 12.5. `null` si vide ou illisible. */
export function versNombre(s: string | undefined): number | null {
  const propre = (s ?? "").replace(/\s| /g, "").replace(",", ".");
  if (!propre) return null;
  const n = Number(propre);
  return Number.isFinite(n) ? n : null;
}

/** Une ligne par entrée, lignes vides retirées. */
export function versLignes(s: string | undefined): string[] {
  return (s ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** 125050 → « 1250,5 » : la valeur d'un champ montant, pour « Modifier ». */
export function depuisCents(c: number | null | undefined): string {
  return c === null || c === undefined ? "" : String(c / 100).replace(".", ",");
}

/** Une date du formulaire (AAAA-MM-JJ) en ISO à midi, pour ne pas glisser d'un jour selon le fuseau. */
export function versIso(jour: string): string {
  return new Date(`${jour}T12:00:00`).toISOString();
}

/** L'inverse : un ISO (ou un AAAA-MM-JJ) → AAAA-MM-JJ. */
export function versJour(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function initiales(champs: ChampSaisie[]): Valeurs {
  return Object.fromEntries(
    champs.map((c) => [
      c.cle,
      c.defaut ?? (c.type === "choix" ? (c.options?.[0]?.valeur ?? "") : ""),
    ]),
  );
}

/** Ce qui manque pour enregistrer, en clair — ou `undefined` quand tout va. */
function manque(champs: ChampSaisie[], v: Valeurs): string | undefined {
  const vides = champs
    .filter((c) => c.requis && !(v[c.cle] ?? "").trim())
    .map((c) => c.intitule);
  if (vides.length > 0) return `À remplir : ${vides.join(", ")}`;
  const illisible = champs.find(
    (c) =>
      (c.type === "nombre" || c.type === "montant" || c.type === "pourcent") &&
      (v[c.cle] ?? "").trim() &&
      versNombre(v[c.cle]) === null,
  );
  if (illisible) return `« ${illisible.intitule} » attend un nombre`;
  return undefined;
}

/* `id` et `className` viennent de `Champ`, qui les pose sur son enfant : ils doivent atteindre le vrai contrôle, sinon l'intitulé ne le désigne pas et le champ n'a pas son cadre. */
function Controle({
  champ,
  valeur,
  onChange,
  id,
  className = "",
}: {
  champ: ChampSaisie;
  valeur: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
}) {
  const commun = {
    id,
    className,
    value: valeur,
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onChange(e.target.value),
  };
  switch (champ.type) {
    case "long":
    case "lignes":
      return (
        <textarea
          {...commun}
          rows={champ.type === "lignes" ? 4 : 3}
          className={`${className} resize-y`}
        />
      );
    case "choix":
      return (
        <select {...commun}>
          {(champ.options ?? []).map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </select>
      );
    case "date":
      return <input type="date" {...commun} />;
    case "heure":
      return <input type="time" {...commun} />;
    case "nombre":
    case "montant":
    case "pourcent":
      return <input type="text" inputMode="decimal" {...commun} />;
    default:
      return <input type="text" {...commun} />;
  }
}

/*
  Deux saisies dans un même écran (un véhicule, puis ses dépenses) : leurs
  boutons se rangent sur UNE ligne au lieu de s'empiler. Le formulaire ouvert,
  ou la liste dépliée, reprend toute la largeur.
*/
const EnRangee = createContext(false);
export function Saisies({ children }: { children: React.ReactNode }) {
  return (
    <Bloc>
      <div className="flex flex-wrap items-start gap-2">
        <EnRangee.Provider value>{children}</EnRangee.Provider>
      </div>
    </Bloc>
  );
}

const SUFFIXES: Partial<Record<TypeChamp, string>> = {
  montant: "€",
  pourcent: "%",
};

export function SaisieModule({
  ajouter,
  champs,
  enregistrer,
  elements = [],
  supprimer,
  ouvertParDefaut = false,
  surtitreListe = "Ce que vous avez saisi",
  note,
}: {
  /** Le libellé du bouton et le titre du formulaire : « Ajouter un véhicule ». */
  ajouter: string;
  champs: ChampSaisie[];
  /** Écrit la fiche. `id` présent = modification de cette fiche. */
  enregistrer: (valeurs: Valeurs, id?: string) => Promise<void> | void;
  elements?: ElementSaisi[];
  supprimer?: (id: string) => Promise<void> | void;
  ouvertParDefaut?: boolean;
  surtitreListe?: string;
  /** Une précision à droite du titre du formulaire (« rien n'est envoyé »). */
  note?: string;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const [enCours, setEnCours] = useState<string | undefined>(undefined);
  const [valeurs, setValeurs] = useState<Valeurs>(() => initiales(champs));
  const [liste, setListe] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const enRangee = useContext(EnRangee);

  const fermer = () => {
    setOuvert(false);
    setEnCours(undefined);
    setValeurs(initiales(champs));
  };
  const modifier = (e: ElementSaisi) => {
    setEnCours(e.id);
    setValeurs({ ...initiales(champs), ...(e.valeurs ?? {}) });
    setOuvert(true);
  };
  const empeche = occupe ? "Enregistrement…" : manque(champs, valeurs);
  const valider = async () => {
    if (empeche) return;
    setOccupe(true);
    try {
      await enregistrer(valeurs, enCours);
      fermer();
    } finally {
      setOccupe(false);
    }
  };

  const corps = (
    <div
      data-saisie-module
      className={
        enRangee
          ? ouvert || liste
            ? "flex basis-full flex-col gap-3"
            : "contents"
          : "flex flex-col gap-3"
      }
    >
      {ouvert ? (
        <FormulaireEnPlace
          titre={enCours ? "Modifier la fiche" : ajouter}
          note={note}
          empeche={empeche}
          onEnregistrer={() => void valider()}
          onFermer={fermer}
        >
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void valider();
            }}
          >
            {champs.map((c) => (
              <div
                key={c.cle}
                className={
                  c.large || c.type === "long" || c.type === "lignes"
                    ? "sm:col-span-2"
                    : ""
                }
              >
                <Champ
                  intitule={
                    c.requis ? c.intitule : `${c.intitule} (facultatif)`
                  }
                  aide={c.aide}
                  suffixe={c.suffixe ?? SUFFIXES[c.type]}
                >
                  <Controle
                    champ={c}
                    valeur={valeurs[c.cle] ?? ""}
                    onChange={(v) => setValeurs((p) => ({ ...p, [c.cle]: v }))}
                  />
                </Champ>
              </div>
            ))}
          </form>
        </FormulaireEnPlace>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <BoutonSecondaire onClick={() => setOuvert(true)}>
            <Plus size={14} strokeWidth={2} aria-hidden />
            {ajouter}
          </BoutonSecondaire>
          {elements.length > 0 && (
            <BoutonSecondaire onClick={() => setListe((l) => !l)}>
              <Pencil size={13} strokeWidth={2} aria-hidden />
              {liste
                ? "Masquer la liste"
                : `Modifier ou supprimer (${elements.length})`}
            </BoutonSecondaire>
          )}
        </div>
      )}

      {liste && elements.length > 0 && !ouvert && (
        <section className="panel px-5 py-4" aria-label={surtitreListe}>
          <p className="eyebrow mb-3 text-text-secondary">{surtitreListe}</p>
          <ul className="flex flex-col">
            {elements.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2.5 first:border-t-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-text-primary">
                    {e.libelle}
                  </span>
                  {e.detail && (
                    <span className="block truncate text-[12px] text-text-muted">
                      {e.detail}
                    </span>
                  )}
                </span>
                {e.valeurs && (
                  <button
                    type="button"
                    onClick={() => modifier(e)}
                    className="min-h-9 px-2 text-[12.5px] font-semibold text-text-secondary underline decoration-trait-sourd underline-offset-4 hover:text-text-primary"
                  >
                    Modifier
                  </button>
                )}
                {supprimer && (
                  <ConfirmDelete
                    onConfirm={() => void supprimer(e.id)}
                    label={`Supprimer « ${e.libelle} »`}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
  return enRangee ? corps : <Bloc>{corps}</Bloc>;
}
