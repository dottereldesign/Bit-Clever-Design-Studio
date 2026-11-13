import { nextAction, type StudioEntry } from './studio';

export const contactColumns = [['name', 'Name'], ['type', 'Type'], ['action', 'Next action'], ['due', 'Due']] as const;
export function contactSort(value: string) {
  return contactColumns.some(([key]) => value === key || value === `${key}-desc`) ? value : 'name';
}
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
export function compareContacts(a: StudioEntry, b: StudioEntry, sort: string) {
  const key = contactSort(sort).replace('-desc', '');
  const value = (entry: StudioEntry) => key === 'type' ? entry.kind : key === 'action' ? nextAction(entry)?.text : key === 'due' ? nextAction(entry)?.deadline : entry.name;
  const av = value(a)?.trim() || '', bv = value(b)?.trim() || '';
  // Empty actions and deadlines stay at the bottom in either direction.
  if (!av !== !bv) return av ? -1 : 1;
  return collator.compare(av, bv) * (sort.endsWith('-desc') ? -1 : 1) || collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
}
