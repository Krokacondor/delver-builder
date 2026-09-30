/* Deciding what a spell actually does, from its rules text.

   The spell chooser's "Deals damage" and "Healing" filters used to be a
   keyword search: any description containing the word "damage" counted. That
   put Mending in the damage list, because it says the repair leaves "no trace
   of the former damage", and Resistance, because it reduces damage. For a new
   player picking their first cantrip that is worse than no filter at all.

   So these read a sentence at a time and ask whether the sentence makes
   something take damage or get Hit Points back, rather than whether the word
   appears anywhere in the spell. */

const TYPES = 'Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing'
  + '|Poison|Psychic|Radiant|Slashing|Thunder';

/* "3d6 damage", "3d6 Fire damage", "takes Necrotic damage", "damage equal to". */
const DEALS = new RegExp(
  '\\b\\d+d\\d+\\s+(?:(?:' + TYPES + ')\\s+)?damage\\b'
  + '|\\b(?:deals?|dealing|takes?|taking|suffers?)\\b[^.]{0,60}?\\b(?:' + TYPES + ')\\s+damage\\b'
  + '|\\bdamage\\s+equal\\s+to\\b', 'i');

/* Sentences about soaking or dodging damage rather than inflicting it. These
   are deliberately narrow: an earlier, looser version threw out Ray of Frost,
   whose damage sentence happens to end "its Speed is reduced by 10 feet". */
const SHIELDS = new RegExp(
  '\\b(?:Resistance|Immunity|Vulnerability)\\s+to\\s+[^.]{0,40}?damage'
  + '|\\breduces?\\s+the\\s+(?:total\\s+)?damage'
  + '|\\bsubtracts?\\s+[^.]{0,20}?\\bfrom\\s+[^.]{0,30}?damage'
  + '|\\bno\\s+damage\\b'
  + '|\\bdamage\\s+(?:is|are)\\s+(?:reduced|prevented|halved)'
  + '|\\bprotect\\w*\\s+(?:against|from)\\s+[^.]{0,30}?damage'
  + '|\\bformer\\s+damage\\b', 'i');

/* "regains 2d4 Hit Points", "restoring 70 Hit Points", and Aid's phrasing,
   where current Hit Points increase rather than being regained. */
const HEALS = /\b(?:regain|regains|regaining|restore|restores|restoring)\b[^.]{0,60}?\bHit Points?\b|\bHit Points?\b[^.]{0,40}?\bincreases?\b/i;

/* Split on sentence ends so one sentence's wording cannot colour another's.
   Lookbehind is fine here: every browser the app targets supports it. */
const sentences = text => (text || '').split(/(?<=\.)\s+/);

export function dealsDamage(spell) {
  return sentences(spell?.description).some(s => DEALS.test(s) && !SHIELDS.test(s));
}

export function healsHitPoints(spell) {
  // A sentence that mentions damage at all is describing a wound, not a cure:
  // Simulacrum's "if the simulacrum takes damage, the only way to restore its
  // Hit Points…" is not a healing spell's selling point.
  return sentences(spell?.description).some(s => HEALS.test(s) && !/\bdamage\b/i.test(s));
}
