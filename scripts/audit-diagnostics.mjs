// Guard against new application commands bypassing the common evidence layer.
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
const sources=files('src').filter(p=>/\.tsx?$/.test(p)&&!p.endsWith('.test.ts'));
const failures=[];let wrapped=0;
for(const path of sources){
 const text=readFileSync(path,'utf8');
 if(!path.endsWith('diagnostics.ts')){
  for(const match of text.matchAll(/import\s+([^;]+?)\s+from\s+['"]@tauri-apps\/api\/core['"]/g)){
   if(/\binvoke\b|\*\s+as/.test(match[1]))failures.push(`${path}: native invoke bypasses diagnostics`);
  }
  if(/__TAURI_INTERNALS__|import\(['"]@tauri-apps\/api\/core/.test(text))failures.push(`${path}: raw/dynamic native access needs review`);
 }
 if(!path.endsWith('nativeUi.ts')&&/@tauri-apps\/plugin-(dialog|opener)/.test(text))failures.push(`${path}: native UI bypasses diagnostics`);
 if(/from\s+['"].*diagnostics['"]/.test(text))wrapped++;
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`Checked ${sources.length} application modules; ${wrapped} import diagnostics. No direct core invoke bypasses. This guard does not prove every local action or third-party plugin is instrumented.`);
