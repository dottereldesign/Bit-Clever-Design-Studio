import { type StudioEntry } from './studio';

export const contactColumns = [['name', 'Name'], ['organization', 'Organisation'], ['email', 'Email'], ['phone', 'Phone'], ['location', 'Location']] as const;
export function contactSort(value: string) {
  return contactColumns.some(([key]) => value === key || value === `${key}-desc`) ? value : 'name';
}
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
export function compareContacts(a: StudioEntry, b: StudioEntry, sort: string, entries: ReadonlyMap<string, StudioEntry>) {
  const key = contactSort(sort).replace('-desc', '');
  const value = (entry: StudioEntry) => key === 'organization' ? (entry.kind === 'organization' ? entry.name : entries.get(entry.organization ?? '')?.name) : key === 'email' ? entry.email : key === 'phone' ? entry.phone : key === 'location' ? entry.location : entry.name;
  const av = value(a)?.trim() || '', bv = value(b)?.trim() || '';
  // Empty values stay at the bottom in either direction.
  if (!av !== !bv) return av ? -1 : 1;
  return collator.compare(av, bv) * (sort.endsWith('-desc') ? -1 : 1) || collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
}
