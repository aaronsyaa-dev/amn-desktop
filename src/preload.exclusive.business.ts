import type { AmnBridge } from './shared/api';

/**
 * La face Business du pont exclusif (voir `preload.exclusive.internal.ts`).
 *
 * Vide, et c'est tout l'intérêt : dans l'app livrée à une organisation
 * cliente, `window.amn.remote` n'expose ni `startScan`, ni `listSites`, ni
 * `checkSsl`, ni la signalisation d'appel. Il n'y a rien à appeler depuis le
 * renderer, et rien à enregistrer côté process main (voir
 * `src/main/exclusive.business.ts`).
 *
 * L'assertion de type est délibérée : `AmnBridge` est le contrat COMMUN aux
 * deux éditions, et le renderer Business n'appelle jamais ces méthodes — les
 * écrans qui le feraient ne sont pas compilés non plus. Un appel malgré tout
 * échouerait bruyamment (`undefined is not a function`) plutôt que de partir
 * vers amn-api, ce qui est le bon échec.
 */
export const exclusivePreload = {} as unknown as AmnBridge['remote'];

/** Ni veille RSS ni modèle local dans cette édition — voir l'en-tête. */
export const exclusiveBridge = {} as unknown as Pick<AmnBridge, 'watch' | 'ollama'>;
