import test from 'node:test';
import assert from 'node:assert/strict';
import {appThemes,themePalette,normalizeTheme,defaultTheme,themeButtonTint} from './appThemeData';
import {contrast} from './tabTheme';
test('all 29 Codex families and 44 variants have readable text and accents',()=>{
 assert.equal(new Set(appThemes.map(p=>p.family)).size,29);assert.equal(appThemes.length,44);
 for(const p of appThemes){const t=themePalette(p.id)!;for(const surface of [t.background,t.panel,t.raised])for(const ink of [t.ink,t.muted,t.accent])assert.ok(contrast(ink,surface)>=4.5,`${p.id}: ${ink} on ${surface}`);assert.ok(contrast(t.accent,t.onAccent)>=4.5,p.id);}
});
test('unknown or corrupted theme preferences preserve the original look',()=>{
 assert.deepEqual(normalizeTheme({theme:'not-a-theme',fontMode:'invalid',body:'not-a-font'}),defaultTheme);assert.equal(themePalette('studio'),null);assert.equal(normalizeTheme({theme:'dracula-dark',fontMode:'two',body:'arial',heading:'georgia'}).heading,'georgia');
});

test('theme button tint remains readable from zero to maximum intensity',()=>{
 for(const theme of appThemes){const p=themePalette(theme.id)!;for(let strength=0;strength<=60;strength+=5)assert.ok(contrast(p.ink,themeButtonTint(p,strength))>=4.5,`${theme.id} at ${strength}`);assert.equal(themeButtonTint(p,0),p.panel);}
});
