/**
 * Copies a secret to the clipboard and wipes it again after `ms` — used by
 * the Vault so a copied password doesn't sit in the clipboard indefinitely.
 *
 * A module-level generation counter means a *later* copy (of anything, from
 * anywhere) cancels an earlier pending wipe instead of racing it: if the
 * operator copies the password then the username a few seconds later, the
 * password's timer won't blank out the username they just copied.
 */
let generation = 0;

export async function copyWithAutoClear(text: string, ms = 30_000): Promise<void> {
  const mine = ++generation;
  await navigator.clipboard.writeText(text);
  setTimeout(() => {
    if (generation === mine) {
      navigator.clipboard.writeText('').catch(() => {
        /* clipboard access can be revoked between the copy and the wipe — nothing to do */
      });
    }
  }, ms);
}
