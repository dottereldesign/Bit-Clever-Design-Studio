import presets from './themePresets.json';
import {contrast,mixColour} from './tabTheme';
export const appThemes=presets;
export const colourGroups=['buttons','tabs','sidebar','home','analytics','selection'] as const;
export type ColourGroup=typeof colourGroups[number];
export const fonts={original:'Inter, "Segoe UI", sans-serif',system:'system-ui, "Segoe UI", sans-serif',segoe:'"Segoe UI", sans-serif',arial:'Arial, Helvetica, sans-serif',verdana:'Verdana, sans-serif',georgia:'Georgia, "Times New Roman", serif',cambria:'Cambria, Georgia, serif',consolas:'Consolas, "Courier New", monospace'};
export type ThemePrefs={theme:string;fontMode:'default'|'one'|'two';body:keyof typeof fonts;heading:keyof typeof fonts};
export const defaultTheme:ThemePrefs={theme:'studio',fontMode:'default',body:'original',heading:'original'};
export function normalizeTheme(value:unknown):ThemePrefs{const v=value as Partial<ThemePrefs>|null;return {theme:appThemes.some(t=>t.id===v?.theme)?v!.theme!:'studio',fontMode:v?.fontMode==='one'||v?.fontMode==='two'?v.fontMode:'default',body:v?.body&&v.body in fonts?v.body:'original',heading:v?.heading&&v.heading in fonts?v.heading:'original'};}
export function themePalette(id:string){const p=appThemes.find(t=>t.id===id);if(!p)return null;const dark=p.mode==='dark',background=p.background,panel=mixColour(dark?'#ffffff':'#000000',background,dark?.035:.025),raised=mixColour(dark?'#ffffff':'#000000',background,dark?.075:.05),tint=mixColour(p.accent,background,.14);let ink=p.foreground,accent=p.accent;
 const target=dark?'#ffffff':'#000000';for(let i=0;i<100&&[background,panel,raised,tint].some(s=>contrast(ink,s)<4.5);i++)ink=mixColour(ink,target,.92);
 for(let i=0;i<100&&[background,panel,raised,tint].some(s=>contrast(accent,s)<4.5);i++)accent=mixColour(accent,target,.92);
 let muted=mixColour(ink,background,.72);for(let i=0;i<100&&[background,panel,raised].some(s=>contrast(muted,s)<4.5);i++)muted=mixColour(muted,target,.9);
 return {background,panel,raised,ink,muted,accent,tint,border:mixColour(ink,background,.28),onAccent:contrast(accent,'#ffffff')>=contrast(accent,'#000000')?'#ffffff':'#000000',overlay:dark?'#000000bb':'#00000066',shadow:'#00000040'};
}

export function themeButtonTint(p:NonNullable<ReturnType<typeof themePalette>>,strength:number){let tint=mixColour(p.accent,p.panel,Math.max(0,Math.min(60,Number.isFinite(strength)?strength:24))/100);for(let i=0;i<100&&contrast(p.ink,tint)<4.5;i++)tint=mixColour(tint,p.panel,.9);return tint;}
