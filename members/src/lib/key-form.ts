// Saving a Key's boxes from a page form (Today or a Key's own page). Only Keys already open can be filled in.
import { readEntries } from './answers';
import { isValidTz, localDay } from './dates';
import { saveAnswers, setTz, type Db, type Member } from './db';
import type { Key } from './keys';

export async function saveKeyForm(db: Db, member: Member, form: FormData, open: Key[], now = new Date()): Promise<{ keyId: string } | { error: string }> {
  const k = open.find((x) => x.id === String(form.get('key_id') ?? ''));
  if (!k) return { error: 'That Key isn’t open yet.' };
  const tz = form.get('tz');
  if (isValidTz(tz) && tz !== member.tz) {
    await setTz(db, member.id, tz);
    member.tz = tz;
  }
  const entries = readEntries(k, (name) => form.get(`p_${name}`));
  await saveAnswers(db, member.id, k.id, localDay(now, member.tz), entries);
  return { keyId: k.id };
}
