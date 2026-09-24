import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge } from '../lib/bridge';
import { useSync } from '../state/SyncContext';
import type { HallEtat, HallMessage } from '../shared/api';

/**
 * LE HALL, CÔTÉ POSTE — l'état de participation et la conversation.
 *
 * Tout vient du serveur, rien n'est mis en cache local : le Hall n'est pas
 * une collection synchronisée (il ne passe pas par `shared_records`, exprès —
 * ce sont des messages d'AUTRES organisations, et le poste ne doit jamais en
 * garder une copie hors ligne qui survivrait au retrait du consentement).
 * Sans lien, l'écran le dit et attend.
 */
export function useHall() {
  const { connectionStatus } = useSync();
  const [etat, setEtat] = useState<HallEtat | null>(null);
  const [messages, setMessages] = useState<HallMessage[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const monte = useRef(true);

  const recharger = useCallback(async () => {
    try {
      const e = await bridge().remote.hall.etat();
      if (!monte.current) return;
      setEtat(e);
      setErreur(null);
      if (e.participation?.participe) {
        const m = await bridge().remote.hall.messages();
        if (monte.current) setMessages(m);
      } else {
        setMessages(null);
      }
    } catch (err) {
      if (monte.current) setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      if (monte.current) setChargement(false);
    }
  }, []);

  useEffect(() => {
    monte.current = true;
    void recharger();
    return () => {
      monte.current = false;
    };
  }, [recharger]);

  /* Le lien revient : on relit. Le lien tombe : on garde ce qu'on a, et l'écran le dit. */
  useEffect(() => {
    if (connectionStatus === 'online') void recharger();
  }, [connectionStatus, recharger]);

  /* Les messages des autres arrivent sur la socket ; ceux masqués par AMN en partent. */
  useEffect(() => {
    if (!etat?.participation?.participe) return;
    const offMessage = bridge().remote.onHallMessage((m) => {
      setMessages((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
    });
    const offMasque = bridge().remote.onHallMasque((id) => {
      setMessages((prev) => prev?.filter((x) => x.id !== id) ?? prev);
    });
    /* Une organisation est entrée ou sortie : on relit tout — ce qui a disparu côté serveur disparaît ici. */
    const offRafraichir = bridge().remote.onHallRafraichir(() => {
      void recharger();
    });
    return () => {
      offMessage();
      offMasque();
      offRafraichir();
    };
  }, [etat?.participation?.participe, recharger]);

  const participer = useCallback(async (input: { participe: boolean; displayName?: string }) => {
    const e = await bridge().remote.hall.participer(input);
    setEtat(e);
    if (e.participation?.participe) setMessages(await bridge().remote.hall.messages());
    else setMessages(null);
    return e;
  }, []);

  const envoyer = useCallback(async (input: { body: string; signature?: string }) => {
    const m = await bridge().remote.hall.envoyer(input);
    setMessages((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
    return m;
  }, []);

  const signaler = useCallback(async (id: string) => bridge().remote.hall.signaler(id), []);

  return { etat, messages, erreur, chargement, connectionStatus, recharger, participer, envoyer, signaler };
}
