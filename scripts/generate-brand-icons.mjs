// The vector master is also used directly by the sidebar and README.
// Rebuild platform assets without building or packaging the app.
import {copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source='src/assets/app-logo.svg';
for(const destination of ['public/app-icon.svg','src-tauri/icon.svg'])copyFileSync(source,destination);
const result=spawnSync(process.execPath,['node_modules/@tauri-apps/cli/tauri.js','icon',source,'--output','src-tauri/icons'],{stdio:'inherit',windowsHide:true});
if(result.status!==0)process.exit(result.status??1);
copyFileSync('src-tauri/icons/icon.png','src/assets/app-logo.png');
