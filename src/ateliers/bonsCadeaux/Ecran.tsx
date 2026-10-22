import React, { useState } from 'react';
import { Gift, Ticket } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Etat, Tableau, type Ton } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, dateLisible, euros, versCentimes } from '../_commun/nombres';
import { BONS_EXEMPLE, NUMERO_DE_DEPART } from './donnees';
import { useTextes } from './i18n';
import { emettre, encaisser, etat, remplacer, solde, totaux, VALIDITE_PAR_DEFAUT, type Bon, type ErreurEmission, type EtatBon } from './logique';
import { MODULE } from './module';

const AUJ = AUJOURDHUI_BAC_A_SABLE;
const TON: Record<EtatBon, Ton> = { actif: 'succes', epuise: 'neutre', expire: 'attention' };

type Message = { ton: Ton; texte: string } | null;

export default function EcranBonsCadeaux() {
  const { tx, langue } = useTextes();
  const [bons, setBons] = useState<Bon[]>(BONS_EXEMPLE);
  const [code, setCode] = useState('');
  const [achat, setAchat] = useState('');
  const [msgEncaisser, setMsgEncaisser] = useState<Message>(null);
  const [beneficiaire, setBeneficiaire] = useState('');
  const [montant, setMontant] = useState('50');
  const [validite, setValidite] = useState(String(VALIDITE_PAR_DEFAUT));
  const [fautesEmission, setFautesEmission] = useState<ErreurEmission[]>([]);
  const [msgEmettre, setMsgEmettre] = useState<Message>(null);

  const t = totaux(bons, AUJ);

  const surEncaisser = (ev: React.FormEvent) => {
    ev.preventDefault();
    const r = encaisser(bons, code, versCentimes(achat), AUJ);
    if ('erreur' in r) {
      setMsgEncaisser({ ton: 'danger', texte: tx(`erreur.${r.erreur}`) });
      return;
    }
    setBons(remplacer(bons, r.bon));
    const vars = { u: euros(r.utilise, langue), c: r.bon.code, s: euros(solde(r.bon), langue), r: euros(r.resteAPayer, langue) };
    setMsgEncaisser({ ton: 'succes', texte: tx(r.resteAPayer > 0 ? 'encaisser.reste' : 'encaisser.ok', vars) });
    setCode('');
    setAchat('');
  };

  const surEmettre = (ev: React.FormEvent) => {
    ev.preventDefault();
    const r = emettre(
      { beneficiaire, montant: versCentimes(montant), emission: AUJ, moisValidite: Number(validite), numero: NUMERO_DE_DEPART + bons.length },
      bons,
    );
    if ('erreurs' in r) {
      setFautesEmission(r.erreurs);
      setMsgEmettre(null);
      return;
    }
    setFautesEmission([]);
    setBons([...bons, r.bon]);
    setMsgEmettre({ ton: 'succes', texte: tx('emettre.ok', { c: r.bon.code, d: dateLisible(r.bon.valableJusquau, langue) }) });
    setBeneficiaire('');
  };
  const faute = (f: ErreurEmission, cle: Parameters<typeof tx>[0]) => (fautesEmission.includes(f) ? tx(cle) : undefined);

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Chiffre fort intitule={tx('chiffre.encours')} valeur={euros(t.encours, langue)} detail={tx('chiffre.encours.detail')} />
        <Chiffre intitule={tx('chiffre.encaisse')} valeur={euros(t.encaisse, langue)} detail={tx('chiffre.encaisse.detail', { e: euros(t.emis, langue) })} />
        <Chiffre intitule={tx('chiffre.expires')} valeur={euros(t.expiresNonUtilises, langue)} detail={tx('chiffre.expires.detail')} />
        <Chiffre
          intitule={tx('chiffre.bons')}
          valeur={String(bons.length)}
          detail={tx('chiffre.bons.detail', { a: t.nombre.actif, u: t.nombre.epuise, x: t.nombre.expire })}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={surEncaisser} className="flex flex-col gap-4 rounded-xl border border-socle-bord bg-socle-surface p-4" aria-labelledby="titre-encaisser">
          <h2 id="titre-encaisser" className="text-[15px] font-semibold">
            {tx('encaisser.titre')}
          </h2>
          <Saisie
            etiquette={tx('encaisser.code')}
            aide={tx('encaisser.code.aide', { ex: BONS_EXEMPLE[1].code })}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase tracking-[0.08em]"
          />
          <Saisie etiquette={tx('encaisser.achat')} suffixe="€" inputMode="decimal" value={achat} onChange={(e) => setAchat(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <Bouton type="submit" variante="primaire" icone={<Ticket size={16} />}>
              {tx('encaisser.bouton')}
            </Bouton>
            {msgEncaisser && (
              <p role="status">
                <Etat ton={msgEncaisser.ton}>{msgEncaisser.texte}</Etat>
              </p>
            )}
          </div>
        </form>

        <form onSubmit={surEmettre} className="flex flex-col gap-4 rounded-xl border border-socle-bord bg-socle-surface p-4" aria-labelledby="titre-emettre">
          <h2 id="titre-emettre" className="text-[15px] font-semibold">
            {tx('emettre.titre')}
          </h2>
          <Saisie etiquette={tx('emettre.beneficiaire')} value={beneficiaire} onChange={(e) => setBeneficiaire(e.target.value)} erreur={faute('beneficiaire', 'erreur.beneficiaire')} />
          <div className="grid grid-cols-2 gap-4">
            <Saisie
              etiquette={tx('emettre.montant')}
              suffixe="€"
              inputMode="decimal"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              erreur={faute('montant', 'erreur.montantEmission')}
            />
            <Saisie
              etiquette={tx('emettre.validite')}
              aide={tx('emettre.validite.aide', { d: dateLisible(AUJ, langue) })}
              suffixe={langue === 'fr' ? 'mois' : 'mo'}
              inputMode="numeric"
              value={validite}
              onChange={(e) => setValidite(e.target.value)}
              erreur={faute('validite', 'erreur.validite')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Bouton type="submit" variante="secondaire" icone={<Gift size={16} />}>
              {tx('emettre.bouton')}
            </Bouton>
            {fautesEmission.includes('doublon') && <Etat ton="danger">{tx('erreur.doublon')}</Etat>}
            {msgEmettre && (
              <p role="status">
                <Etat ton={msgEmettre.ton}>{msgEmettre.texte}</Etat>
              </p>
            )}
          </div>
        </form>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="titre-liste">
        <h2 id="titre-liste" className="text-[13px] font-semibold text-socle-texte-discret">
          {tx('liste.titre')}
        </h2>
        <Tableau
          entetes={[tx('col.code'), tx('col.beneficiaire'), tx('col.montant'), tx('col.solde'), tx('col.jusquau'), tx('col.etat')]}
          droite={[2, 3]}
          lignes={[...bons].reverse().map((b) => {
            const e = etat(b, AUJ);
            return [
              <span key="c" className="whitespace-nowrap font-mono text-socle-texte">
                {b.code}
              </span>,
              b.beneficiaire,
              <span key="m" className="whitespace-nowrap">
                {euros(b.montant, langue)}
              </span>,
              <span key="s" className="whitespace-nowrap font-semibold text-socle-texte">
                {euros(solde(b), langue)}
              </span>,
              <span key="d" className="whitespace-nowrap">
                {dateLisible(b.valableJusquau, langue)}
              </span>,
              <Etat key="e" ton={TON[e]}>
                {tx(`etat.${e}`)}
              </Etat>,
            ];
          })}
        />
      </section>
    </CadreAtelier>
  );
}
