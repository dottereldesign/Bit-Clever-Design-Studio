import type { MoodboardNode, ProjectOverviewData } from './model';
export type StudioKind = 'lead' | 'campaign' | 'contact' | 'organization' | 'content' | 'activity' | 'pipeline' | 'meeting' | 'research' | 'client' | 'client_entry';
export type StudioEntry = {
    id: string;
    avatar?: string;
    meeting?: import('./calendarImport').Meeting;
    kind: StudioKind;
    name: string;
    archived: boolean;
    organization: string | null;
    contacts: string[];
    projects: number[];
    handover_project?: number | null;
    campaign: string | null;
    parent: string | null;
    files: number[];
    tags: string[];
    status: string;
    service: string;
    source: string;
    value: number | null;
    currency: string;
    date: string;
    end_date: string;
    body: string;
    email: string;
    phone: string;
    website: string;
    audience: string;
    message: string;
    offer: string;
    channel: string;
    results: string;
    metrics?: {id:string;name:string;value:string;unit:string}[];
    variant_group?: string;
    activity_type: string;
    actions: ProjectOverviewData['actions'];
    milestones?: ProjectOverviewData['actions'];
    moodboard: MoodboardNode[];
    stages: {
        id: string;
        name: string;
    }[];
    created: number;
    updated: number;
};
export type StudioRoute = {
    section: 'marketing' | 'leads' | 'research' | 'clients' | 'client' | 'client_entry';
    page: string;
    id?: string;
    tab?: string;
    returnTo?: StudioRoute;
};
export const leadStages = [{ id: 'new', name: 'New' }, { id: 'contacted', name: 'Contacted' }, { id: 'discussing', name: 'Discussing' }, { id: 'proposal', name: 'Proposal sent' }, { id: 'won', name: 'Won' }, { id: 'lost', name: 'Lost' }];
export const campaignStages = ['idea', 'planning', 'ready', 'active', 'complete', 'paused'].map(id => ({ id, name: id[0].toUpperCase() + id.slice(1) }));
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const nextAction = (entry: StudioEntry) => entry.actions.filter(a => !a.done).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))[0];
export const blankEntry = (kind: StudioKind, name: string): StudioEntry => ({ id: crypto.randomUUID(), kind, name, archived: false, organization: null, contacts: [], projects: [], campaign: null, parent: null, files: [], tags: [], status: kind === 'lead' ? 'new' : kind === 'campaign' ? 'idea' : 'draft', service: '', source: '', value: null, currency: 'NZD', date: '', end_date: '', body: '', email: '', phone: '', website: '', audience: '', message: '', offer: '', channel: '', results: '', activity_type: 'note', actions: [], moodboard: [], stages: [], created: 0, updated: 0 });

export function followUpGroup(entry:StudioEntry,day=today()):string {
 if (['won','lost'].includes(entry.status)) return 'Closed leads';
 const due=nextAction(entry)?.deadline;
 return !due?'No date':due<day?'Overdue':due===day?'Today':'Upcoming';
}
export const followUpGroups=['Overdue','Today','Upcoming','No date','Closed leads'];
export function calendarEntries(entries:StudioEntry[],scope?:string){
 const byId=new Map(entries.map(e=>[e.id,e]));
 return entries.filter(e=>!e.archived&&(!e.parent||!byId.get(e.parent)?.archived)&&(scope?e.id===scope||e.parent===scope:e.kind==='campaign'||e.kind==='content'||e.kind==='meeting'));
}
