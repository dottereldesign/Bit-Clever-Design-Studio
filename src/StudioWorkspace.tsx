import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowLeft, ArrowRight, Plus, Archive, Undo2, Redo2, FolderOpen, Paperclip, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Library, Item } from './model';
import type { Change } from './api';
import { appHistory } from './appHistory';
import { useHistoryState } from './useAppHistory';
import ProjectMoodboard from './ProjectMoodboard';
import { blankEntry, campaignStages, leadStages, nextAction, today, type StudioEntry, type StudioKind, type StudioRoute } from './studio';
import './studio.css';
function read<T>(key: string, fallback: T): T { try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
}
catch {
    return fallback;
} }
function Field({ id, label, value, save, type = 'text', large = false }: {
    id: string;
    label: string;
    value: string;
    save: (value: string) => Promise<unknown>;
    type?: string;
    large?: boolean;
}) {
    const [draft, setDraft] = useState(() => read(id, value)), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const dirty = useRef(localStorage.getItem(id) !== null);
    useEffect(() => { if (!dirty.current)
        setDraft(value); }, [value]);
    const commit = async () => { if (!dirty.current || busy)
        return; setBusy(true); setError(''); try {
        await save(draft);
        dirty.current = false;
        localStorage.removeItem(id);
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } };
    const props = { value: draft, disabled: busy, 'aria-label': label, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { dirty.current = true; setDraft(e.target.value); localStorage.setItem(id, JSON.stringify(e.target.value)); }, onBlur: () => void commit() };
    return <label className={`studio-field ${large ? 'wide' : ''}`}><span>{label}</span>{large ? <textarea {...props} rows={5}/> : <input {...props} type={type} min={type === 'number' ? 0 : undefined} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }}/>}{busy ? <small>Saving…</small> : error ? <small role="alert">{error} <button onClick={() => void commit()}>Retry</button></small> : dirty.current ? <small>Unsaved</small> : null}</label>;
}
function Rows({ entries, children }: {
    entries: StudioEntry[];
    children: (e: StudioEntry) => ReactNode;
}) {
    const host = useRef<HTMLDivElement>(null);
    const rows = useVirtualizer({ count: entries.length, getScrollElement: () => host.current, estimateSize: () => 66, overscan: 5 });
    return <div className="studio-rows" ref={host}><div style={{ height: rows.getTotalSize(), position: 'relative' }}>{rows.getVirtualItems().map(row => <div className="studio-row" key={entries[row.index].id} style={{ position: 'absolute', top: row.start, height: 66, left: 0, right: 0 }}>{children(entries[row.index])}</div>)}</div>{!entries.length && <p className="studio-empty">Nothing here yet. Add a record or change your filters.</p>}</div>;
}
export default function StudioWorkspace({ lib, route, navigate, mutate, importInto, preview, openProject }: {
    lib: Library;
    route: StudioRoute;
    navigate: (r: StudioRoute) => void;
    mutate: (c: Change) => Promise<unknown>;
    importInto: (id: string, mode: 'paste' | 'files' | 'drop', data?: DataTransfer) => void;
    preview: (i: Item) => void;
    openProject: (id: number) => void;
}) {
    const entries = lib.studio ?? [], entry = entries.find(e => e.id === route.id), marketing = route.section === 'marketing';
    const preferenceKey = `studio-view:${route.section}:${route.page}`;
    const [viewPrefs, setViewPrefs] = useHistoryState<Record<string, string>>('studio-layouts', () => read('studio-layouts', {}), 'Studio view layout');
    const [search, setSearch] = useState(''), [archived, setArchived] = useState(false), [sort, setSort] = useState('updated'), [selected, setSelected] = useState<string[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [newName, setNewName] = useState(''), [stageEditor, setStageEditor] = useState(false), [tag, setTag] = useState('');
    const [month, setMonth] = useState(() => today().slice(0, 7)), [fileSearch, setFileSearch] = useState(''), [addExisting, setAddExisting] = useState(false), [actionName, setActionName] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const byId = useMemo(() => new Map(entries.map(e => [e.id, e])), [entries]);
    const pipeline = byId.get('lead-pipeline'), stages = marketing ? campaignStages : pipeline?.stages ?? leadStages;
    const layout = viewPrefs[preferenceKey] ?? 'table';
    useEffect(() => { const filters = read<{
        search: string;
        tag: string;
        sort: string;
        archived: boolean;
    }>(`${preferenceKey}:${lib.root}:filters`, { search: '', tag: '', sort: 'updated', archived: false }); setSearch(filters.search); setTag(filters.tag); setSort(filters.sort); setArchived(filters.archived); setSelected([]); }, [preferenceKey, lib.root]);
    const filterKey = useRef(preferenceKey);
    useEffect(() => { if (filterKey.current !== preferenceKey) {
        filterKey.current = preferenceKey;
        return;
    } localStorage.setItem(`${preferenceKey}:${lib.root}:filters`, JSON.stringify({ search, tag, sort, archived })); }, [search, tag, sort, archived, preferenceKey, lib.root]);
    useEffect(() => { const search = () => searchRef.current?.focus(); window.addEventListener('studio-search', search); return () => window.removeEventListener('studio-search', search); }, []);
    const update = (id: string, patch: Partial<StudioEntry>) => mutate({ action: 'update_studio', value: JSON.stringify({ id, patch }) });
    const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } };
    const setView = (next: string) => setViewPrefs(p => ({ ...p, [preferenceKey]: next }));
    const openEntry = (e: StudioEntry) => navigate({ section: e.kind === 'lead' || e.kind === 'contact' || e.kind === 'organization' ? 'leads' : 'marketing', page: e.kind === 'contact' || e.kind === 'organization' ? 'contacts' : e.kind === 'lead' ? 'pipeline' : 'campaigns', id: e.id, tab: undefined });
    const add = async (kind: StudioKind, name: string, parent?: string) => { const e = blankEntry(kind, name.trim()); e.parent = parent ?? null; const { id, created, updated, ...patch } = e; await update(id, patch); return id; };
    const create = () => run(async () => { if (!newName.trim())
        return; const kind: StudioKind = route.page === 'contacts' ? 'contact' : route.page === 'ideas' ? 'content' : marketing ? 'campaign' : 'lead'; const id = await add(kind, newName); setNewName(''); navigate({ ...route, id, tab: undefined }); });
    const field = (e: StudioEntry, key: keyof StudioEntry, label: string, large = false, type = 'text') => <Field key={e.id + key} id={`studio-draft:${lib.root}:${e.id}:${key}`} label={label} value={e[key] === null ? '' : String(e[key] ?? '')} large={large} type={type} save={value => update(e.id, { [key]: key === 'value' ? (value === '' ? null : Number(value)) : value })}/>;
    const select = (e: StudioEntry, key: keyof StudioEntry, label: string, options: {
        id: string;
        name: string;
    }[], nullable = false) => <label className="studio-field"><span>{label}</span><select aria-label={label} value={String(e[key] ?? '')} disabled={busy} onChange={event => void run(() => update(e.id, { [key]: event.target.value || (nullable ? null : '') }))}>{nullable && <option value="">None</option>}{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;
    const options = (kind: StudioKind) => entries.filter(e => e.kind === kind && !e.archived).map(e => ({ id: e.id, name: e.name }));
    const changeStage = (e: StudioEntry, status: string) => void run(() => update(e.id, { status }));
    const matching = useMemo(() => entries.filter(e => e.archived === archived && (route.page === 'contacts' ? e.kind === 'contact' || e.kind === 'organization' : route.page === 'ideas' ? e.kind === 'content' && !e.parent : route.page === 'calendar' ? e.kind === 'content' || e.kind === 'campaign' : e.kind === (marketing ? 'campaign' : 'lead')) && (route.page !== 'follow-ups' || e.actions.some(a => !a.done)) && `${e.name} ${e.body} ${e.tags.join(' ')} ${e.contacts.map(id => byId.get(id)?.name ?? '').join(' ')} ${byId.get(e.organization ?? '')?.name ?? ''}`.toLowerCase().includes(search.toLowerCase()) && (!tag || e.tags.includes(tag))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'date' || route.page === 'follow-ups' ? (nextAction(a)?.deadline || '9999').localeCompare(nextAction(b)?.deadline || '9999') : b.updated - a.updated), [entries, archived, route.page, marketing, search, tag, sort, byId]);
    const actions = (e: StudioEntry) => <section className="studio-actions"><h2>Next actions</h2>{e.actions.map(a => <div className="studio-action" key={a.id}><input aria-label={`Complete ${a.text}`} type="checkbox" checked={a.done} disabled={busy} onChange={() => void run(() => update(e.id, { actions: e.actions.map(x => x.id === a.id ? { ...x, done: !x.done } : x) }))}/><Field id={`studio-draft:${lib.root}:${e.id}:action:${a.id}`} label="Action" value={a.text} save={text => update(e.id, { actions: e.actions.map(x => x.id === a.id ? { ...x, text } : x) })}/><input type="date" aria-label={`Deadline for ${a.text}`} value={a.deadline} disabled={busy} onChange={ev => void run(() => update(e.id, { actions: e.actions.map(x => x.id === a.id ? { ...x, deadline: ev.target.value } : x) }))}/>{!a.done && a.deadline && a.deadline < today() && <small className="studio-overdue">Overdue</small>}<button aria-label={`Remove ${a.text}`} onClick={() => void run(() => update(e.id, { actions: e.actions.filter(x => x.id !== a.id) }))}>×</button></div>)}<form className="studio-quick-add" onSubmit={ev => { ev.preventDefault(); if (actionName.trim())
        void run(async () => { await update(e.id, { actions: [...e.actions, { id: crypto.randomUUID(), text: actionName.trim(), deadline: '', done: false }] }); setActionName(''); }); }}><input aria-label="New next action" placeholder="Next action" value={actionName} onChange={ev => setActionName(ev.target.value)}/><button disabled={busy || !actionName.trim()}><Plus size={14}/>Add</button></form></section>;
    const associations = (e: StudioEntry) => <div className="studio-associations">{select(e, 'organization', 'Organisation', options('organization'), true)}{e.kind === 'lead' && select(e, 'campaign', 'Source campaign', options('campaign'), true)}<details><summary>Contacts ({e.contacts.length})</summary>{options('contact').map(c => <label className="studio-check" key={c.id}><input type="checkbox" checked={e.contacts.includes(c.id)} disabled={busy} onChange={() => void run(() => update(e.id, { contacts: e.contacts.includes(c.id) ? e.contacts.filter(id => id !== c.id) : [...e.contacts, c.id] }))}/><button className="text-button" onClick={() => openEntry(byId.get(c.id)!)}>{c.name}</button></label>)}{!options('contact').length && <button onClick={() => navigate({ section: 'leads', page: 'contacts' })}>Add contacts</button>}</details><details><summary>Linked projects ({e.projects.length})</summary>{lib.projects.map(p => <label className="studio-check" key={p.id}><input type="checkbox" checked={e.projects.includes(p.id)} disabled={busy} onChange={() => void run(() => update(e.id, { projects: e.projects.includes(p.id) ? e.projects.filter(id => id !== p.id) : [...e.projects, p.id] }))}/>{p.name}</label>)}</details><div className="studio-related">{e.projects.map(id => <button key={id} onClick={() => openProject(id)}><FolderOpen size={14}/>{lib.projects.find(p => p.id === id)?.name ?? 'Project unavailable'}</button>)}{e.campaign && byId.get(e.campaign) && <button onClick={() => openEntry(byId.get(e.campaign!)!)}>View source campaign <ArrowRight size={14}/></button>}</div></div>;
    const files = (e: StudioEntry) => <section className="studio-files" onDragOver={ev => ev.preventDefault()} onDrop={ev => { ev.preventDefault(); ev.stopPropagation(); const raw = ev.dataTransfer.getData('application/design-items'); if (raw) {
        try {
            const ids = JSON.parse(raw);
            if (Array.isArray(ids))
                void run(() => update(e.id, { files: [...new Set([...e.files, ...ids.filter((id: unknown) => typeof id === 'number' && lib.items.some(i => i.id === id))])] }));
        }
        catch {
            setError('Unable to read these references.');
        }
    }
    else
        importInto(e.id, 'drop', ev.dataTransfer); }}><div className="studio-toolbar"><button onClick={() => importInto(e.id, 'files')}><Plus size={14}/>Add files</button><button onClick={() => importInto(e.id, 'paste')}>Paste here</button><button onClick={() => setAddExisting(!addExisting)}><Paperclip size={14}/>Existing references</button></div>{addExisting && <div className="studio-reference-picker"><input aria-label="Find existing reference" placeholder="Search your library" value={fileSearch} onChange={ev => setFileSearch(ev.target.value)}/>{lib.items.filter(i => i.name.toLowerCase().includes(fileSearch.toLowerCase())).slice(0, 80).map(i => <label className="studio-check" key={i.id}><input type="checkbox" disabled={busy} checked={e.files.includes(i.id)} onChange={() => void run(() => update(e.id, { files: e.files.includes(i.id) ? e.files.filter(id => id !== i.id) : [...e.files, i.id] }))}/>{i.name}</label>)}<small>Showing the first 80 matches. Search to narrow the list.</small></div>}{e.files.map(id => { const item = lib.items.find(i => i.id === id); return <div className="studio-file" key={id}><button disabled={!item} onClick={() => item && preview(item)}>{item?.name ?? 'File unavailable'}</button><span>{item?.kind}</span><button className="danger" aria-label={`Detach ${item?.name ?? 'file'}`} onClick={() => void run(() => update(e.id, { files: e.files.filter(i => i !== id) }))}>Remove reference</button></div>; })}{!e.files.length && <p className="studio-empty">Drop files or paste here. These references stay in this workspace.</p>}</section>;
    const childList = (e: StudioEntry, kind: 'activity' | 'content') => <><form className="studio-quick-add" onSubmit={ev => { ev.preventDefault(); if (newName.trim())
        void run(async () => { const id = await add(kind, newName, e.id); if (kind === 'activity')
            await update(id, { date: today() }); setNewName(''); navigate({ ...route, id, tab: undefined }); }); }}><input aria-label={kind === 'activity' ? 'New activity' : 'New content'} placeholder={kind === 'activity' ? 'Record a call, meeting or note' : 'New post, ad or creative idea'} value={newName} onChange={ev => setNewName(ev.target.value)}/><button disabled={busy || !newName.trim()}><Plus size={14}/>Add</button></form>{entries.filter(c => c.parent === e.id && c.kind === kind && !c.archived).sort((a, b) => b.date.localeCompare(a.date)).map(c => <button className="studio-child" key={c.id} onClick={() => navigate({ ...route, id: c.id, tab: undefined })}><strong>{c.name}</strong><span>{c.date || 'No date'} · {kind === 'activity' ? c.activity_type : c.status}</span><ArrowRight size={14}/></button>)}</>;
    const tabs = entry?.kind === 'lead' ? ['Overview', 'Activity', 'Files'] : entry?.kind === 'campaign' ? ['Plan', 'Content', 'Moodboard', 'Schedule', 'Results'] : entry?.kind === 'contact' || entry?.kind === 'organization' ? ['Details', 'Related'] : ['Details', 'Files'];
    const tab = tabs.find(t => t.toLowerCase() === route.tab) ?? tabs[0];
    const details = (e: StudioEntry) => <><div className="studio-form">{field(e, 'name', 'Name')}{e.kind === 'contact' ? <>{field(e, 'email', 'Email', false, 'email')}{field(e, 'phone', 'Phone')}{select(e, 'organization', 'Organisation', options('organization'), true)}</> : e.kind === 'organization' ? field(e, 'website', 'Website') : null}{e.kind === 'lead' && <>{select(e, 'status', 'Stage', pipeline?.stages ?? leadStages)}{field(e, 'service', 'Service')}{field(e, 'source', 'Source')}{field(e, 'value', 'Estimated value', false, 'number')}{field(e, 'currency', 'Currency')}{field(e, 'end_date', 'Target completion', false, 'date')}</>}{e.kind === 'campaign' && <>{select(e, 'status', 'Status', campaignStages)}{field(e, 'audience', 'Audience')}{field(e, 'message', 'Message')}{field(e, 'offer', 'Offer')}{field(e, 'channel', 'Channels')}{field(e, 'date', 'Start date', false, 'date')}{field(e, 'end_date', 'End date', false, 'date')}{field(e, 'value', 'Budget', false, 'number')}{field(e, 'currency', 'Currency')}</>}{e.kind === 'content' && <>{field(e, 'channel', 'Channel')}{select(e, 'status', 'Content status', ['draft', 'ready', 'scheduled', 'published'].map(id => ({ id, name: id })))}{field(e, 'date', 'Planned date', false, 'date')}{select(e, 'parent', 'Campaign', options('campaign'), true)}</>}{e.kind === 'activity' && <>{select(e, 'activity_type', 'Activity type', ['note', 'call', 'meeting', 'email'].map(id => ({ id, name: id })))}{field(e, 'date', 'Activity date', false, 'date')}</>}{field(e, 'body', e.kind === 'campaign' ? 'Objective and strategy' : e.kind === 'content' ? 'Copy and notes' : e.kind === 'lead' ? 'Brief' : 'Notes', true)}<Field id={`studio-draft:${lib.root}:${e.id}:tags`} label="Tags" value={e.tags.join(', ')} save={value => update(e.id, { tags: [...new Set(value.split(',').map(t => t.trim()).filter(Boolean))] })}/></div>{['lead', 'campaign'].includes(e.kind) && <>{associations(e)}{actions(e)}</>}</>;
    const calendar = (scope?: string) => { const start = new Date(`${month}-01T12:00:00`), count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(), offset = (start.getDay() + 6) % 7; const scheduled = entries.filter(e => !e.archived && (scope ? e.parent === scope : e.kind === 'campaign' || e.kind === 'content')); const shift = (delta: number) => { const d = new Date(start.getFullYear(), start.getMonth() + delta, 1, 12); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }; return <><div className="studio-toolbar"><button aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16}/></button><input aria-label="Calendar month" type="month" value={month} onChange={ev => ev.target.value && setMonth(ev.target.value)}/><button aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={16}/></button><span>Drag content to reschedule</span></div><div className="studio-calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <strong key={d}>{d}</strong>)}{Array.from({ length: offset }, (_, i) => <div key={`pad${i}`}/>)}{Array.from({ length: count }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; return <div className={date === today() ? 'today' : ''} key={date} onDragOver={ev => ev.preventDefault()} onDrop={ev => { ev.preventDefault(); ev.stopPropagation(); const id = ev.dataTransfer.getData('application/studio-record'); if (scheduled.some(r => r.id === id))
        void run(() => update(id, { date })); }}><span>{i + 1}</span>{scheduled.filter(e => e.date === date).map(e => <button draggable onDragStart={ev => ev.dataTransfer.setData('application/studio-record', e.id)} key={e.id} onClick={() => navigate({ ...route, id: e.id, tab: undefined })}>{e.name}</button>)}</div>; })}</div><details><summary>Unscheduled ({scheduled.filter(e => !e.date).length})</summary>{scheduled.filter(e => !e.date).map(e => <button key={e.id} draggable onDragStart={ev => ev.dataTransfer.setData('application/studio-record', e.id)} onClick={() => navigate({ ...route, id: e.id })}>{e.name}</button>)}</details></>; };
    return <section className="studio-workspace" onDragOver={ev => { if (route.page === 'ideas' || entry && ['lead', 'campaign', 'content', 'activity'].includes(entry.kind))
        ev.preventDefault(); }} onDrop={ev => { ev.preventDefault(); ev.stopPropagation(); if (entry && ['lead', 'campaign', 'content', 'activity'].includes(entry.kind)) {
        importInto(entry.id, 'drop', ev.dataTransfer);
        return;
    } if (route.page === 'ideas') {
        const snapshot = new DataTransfer();
        for (const file of ev.dataTransfer.files)
            snapshot.items.add(file);
        for (const type of ev.dataTransfer.types)
            if (type !== 'Files')
                snapshot.setData(type, ev.dataTransfer.getData(type));
        void run(async () => { const id = await add('content', snapshot.files[0]?.name ?? 'New idea'); importInto(id, 'drop', snapshot); navigate({ ...route, id }); });
    } }} onKeyDownCapture={ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'v' && !(ev.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) {
        ev.preventDefault();
        ev.stopPropagation();
        if (entry && ['lead', 'campaign', 'content', 'activity'].includes(entry.kind))
            importInto(entry.id, 'paste');
        else if (route.page === 'ideas')
            void run(async () => { const id = await add('content', 'New idea'); importInto(id, 'paste'); navigate({ ...route, id }); });
        else
            setError('Open a lead or campaign first, then paste into it.');
    } }}>
 <header className="studio-header"><div>{route.id && <button aria-label="Back to list" onClick={() => entry?.parent && byId.get(entry.parent) ? navigate({ ...route, id: entry.parent, tab: entry.kind === 'activity' ? 'activity' : 'content' }) : navigate({ ...route, id: undefined, tab: undefined })}><ArrowLeft size={18}/></button>}<h1>{entry?.name ?? (route.id ? 'Record unavailable' : marketing ? 'Marketing' : 'Leads')}</h1>{entry?.archived && <span>Archived</span>}</div><div><button aria-label="Undo" title="Undo" onClick={() => void appHistory.undo()}><Undo2 size={16}/></button><button aria-label="Redo" title="Redo" onClick={() => void appHistory.redo()}><Redo2 size={16}/></button>{entry && <button disabled={busy} onClick={() => void run(() => update(entry.id, { archived: !entry.archived }))}><Archive size={15}/>{entry.archived ? 'Restore' : 'Archive'}</button>}{entry?.kind === 'lead' && entry.status === 'won' && !entry.archived && !entry.projects.length && <button className="primary" disabled={busy} onClick={() => void run(() => mutate({ action: 'convert_studio_lead', value: entry.id }))}>Create project</button>}</div></header>
 {error && <div className="studio-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
 {entry ? <><nav className="studio-tabs" aria-label="Workspace sections">{tabs.map(t => <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => navigate({ ...route, tab: t.toLowerCase() })}>{t}</button>)}</nav><div className="studio-content">{tab === 'Files' ? files(entry) : tab === 'Activity' ? childList(entry, 'activity') : tab === 'Content' ? childList(entry, 'content') : tab === 'Moodboard' ? <ProjectMoodboard project={0} data={entry.moodboard} items={lib.items.filter(i => entry.files.includes(i.id))} preview={preview} mutate={c => update(entry.id, { moodboard: JSON.parse(c.value!).value })}/> : tab === 'Schedule' ? calendar(entry.id) : tab === 'Results' ? <>{field(entry, 'results', 'Results and lessons learned', true)}<h2>Attributed leads</h2>{entries.filter(e => e.kind === 'lead' && e.campaign === entry.id).map(e => <button className="studio-child" key={e.id} onClick={() => openEntry(e)}>{e.name}<span>{e.status}</span></button>)}<small>Results are entered manually. Campaign association is not proof of attribution.</small></> : tab === 'Related' ? <><div className="studio-related">{entry.projects.map(id => <button key={id} onClick={() => openProject(id)}><FolderOpen size={14}/>{lib.projects.find(p => p.id === id)?.name ?? 'Project unavailable'}</button>)}</div>{entries.filter(e => e.contacts.includes(entry.id) || e.organization === entry.id).map(e => <button className="studio-child" key={e.id} onClick={() => openEntry(e)}>{e.name}<span>{e.kind}</span></button>)}</> : <>{details(entry)}{entry.kind === 'campaign' && files(entry)}</>}</div></> : route.id ? <p className="studio-empty">This record is unavailable. Use Back to return to your list.</p> : <><nav className="studio-tabs">{(marketing ? ['campaigns', 'ideas', 'calendar'] : ['pipeline', 'follow-ups', 'contacts']).map(p => <button key={p} aria-current={route.page === p ? 'page' : undefined} onClick={() => navigate({ ...route, page: p, id: undefined })}>{p[0].toUpperCase() + p.slice(1)}</button>)}</nav><div className="studio-content">{route.page === 'calendar' ? calendar() : <><div className="studio-toolbar"><Search size={16}/><input ref={searchRef} aria-label="Search studio" placeholder="Search" value={search} onChange={ev => setSearch(ev.target.value)}/><select aria-label="Filter by tag" value={tag} onChange={ev => setTag(ev.target.value)}><option value="">All tags</option>{[...new Set(entries.flatMap(e => e.tags))].sort().map(t => <option key={t}>{t}</option>)}</select><select aria-label="Sort records" value={sort} onChange={ev => setSort(ev.target.value)}><option value="updated">Recently updated</option><option value="name">Name</option><option value="date">Next follow-up</option></select><button aria-pressed={archived} onClick={() => setArchived(!archived)}>Archived</button>{['pipeline', 'campaigns'].includes(route.page) && <><button aria-pressed={layout === 'table'} onClick={() => setView('table')}>Table</button><button aria-pressed={layout === 'board'} onClick={() => setView('board')}>Board</button></>}{route.page === 'pipeline' && <button onClick={() => setStageEditor(!stageEditor)}>Edit stages</button>}</div>
 {stageEditor && <div className="studio-stage-editor">{(pipeline?.stages ?? leadStages).map((s, i, all) => <div key={s.id}><Field id={`studio-draft:stage:${s.id}`} label="Stage name" value={s.name} save={name => update('lead-pipeline', { ...(!pipeline ? { kind: 'pipeline' as const, name: 'Lead pipeline' } : {}), stages: all.map(x => x.id === s.id ? { ...x, name } : x) })}/><button disabled={!i || busy} aria-label={`Move ${s.name} earlier`} onClick={() => void run(() => { const reordered = [...all]; [reordered[i - 1], reordered[i]] = [reordered[i], reordered[i - 1]]; return update('lead-pipeline', { ...(!pipeline ? { kind: 'pipeline' as const, name: 'Lead pipeline' } : {}), stages: reordered }); })}>↑</button></div>)}</div>}
 <form className="studio-quick-add" onSubmit={ev => { ev.preventDefault(); void create(); }}><input aria-label="New record name" placeholder={route.page === 'contacts' ? 'Contact name' : route.page === 'ideas' ? 'Save an idea' : marketing ? 'Campaign name' : 'Opportunity name'} value={newName} onChange={ev => setNewName(ev.target.value)}/><button disabled={busy || !newName.trim()}><Plus size={15}/>Add {route.page === 'contacts' ? 'contact' : route.page === 'ideas' ? 'idea' : marketing ? 'campaign' : 'lead'}</button>{route.page === 'contacts' && <button type="button" disabled={busy || !newName.trim()} onClick={() => void run(async () => { const id = await add('organization', newName); setNewName(''); navigate({ ...route, id }); })}>Add organisation</button>}</form>
 {selected.length > 0 && <div className="studio-toolbar"><span>{selected.length} selected</span><button disabled={busy} onClick={() => void run(async () => { for (const id of selected)
                await update(id, { archived: !archived }); setSelected([]); })}>{archived ? 'Restore' : 'Archive'}</button><button onClick={() => setSelected([])}>Clear</button></div>}
 {layout === 'board' && ['pipeline', 'campaigns'].includes(route.page) ? <div className="studio-board">{stages.map(s => <section key={s.id} onDragOver={ev => ev.preventDefault()} onDrop={ev => { ev.preventDefault(); ev.stopPropagation(); const e = byId.get(ev.dataTransfer.getData('application/studio-record')); if (e && e.kind === (marketing ? 'campaign' : 'lead'))
                changeStage(e, s.id); }}><h2>{s.name}<small>{matching.filter(e => e.status === s.id).length}</small></h2><Rows entries={matching.filter(e => e.status === s.id)}>{e => <button className="studio-board-card" draggable onDragStart={ev => ev.dataTransfer.setData('application/studio-record', e.id)} onClick={() => openEntry(e)}><strong>{e.name}</strong><span>{nextAction(e)?.text ?? (e.date || 'No next action')}</span></button>}</Rows></section>)}</div> : <><div className="studio-table-labels"><span /><span>Name</span><span>{route.page === 'contacts' ? 'Type' : 'Status'}</span><span>Next action</span><span>Due</span></div><Rows entries={matching}>{e => { const next = nextAction(e); return <><input aria-label={`Select ${e.name}`} type="checkbox" checked={selected.includes(e.id)} onChange={() => setSelected(selected.includes(e.id) ? selected.filter(id => id !== e.id) : [...selected, e.id])}/><button className="studio-name" onClick={() => openEntry(e)}><strong>{e.name}</strong><small>{byId.get(e.organization ?? '')?.name ?? e.channel}</small></button>{['lead', 'campaign'].includes(e.kind) ? <select disabled={busy} aria-label={`Stage for ${e.name}`} value={e.status} onChange={ev => changeStage(e, ev.target.value)}>{(e.kind === 'lead' ? pipeline?.stages ?? leadStages : campaignStages).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select> : <span>{e.kind}</span>}<span>{next?.text ?? '—'}</span><span className={next?.deadline && next.deadline < today() ? 'studio-overdue' : ''}>{next?.deadline ?? '—'}</span></>; }}</Rows></>}
 </>}</div></>}
 </section>;
}
