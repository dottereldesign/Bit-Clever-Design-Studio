import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
const fixture = process.argv[2] ?? 'grid-return';
if (!['sidebar-tools', 'customise-tab-order', 'analytics-reports', 'default-appearance', 'startup', 'analytics', 'home-overview', 'close-lead', 'customise-layouts', 'tab-styles', 'cta-buttons', 'add-contact', 'home-logo', 'client-sidebar', 'calendar-setup', 'clients-performance', 'branding', 'clients', 'sidebar-reorder', 'customise-motion', 'research', 'leads-tour', 'calendar-sync', 'studio', 'sidebar-styles', 'moodboard', 'project-workspace', 'project-folder-drag', 'thumbnail-readiness', 'storage-cache', 'collection-performance', 'settings-page', 'diagnostics', 'project-navigation', 'project-folders', 'link-categories', 'thumbnail-click', 'colour-picker', 'website-scroll', 'hover-preview', 'image-drop', 'clipboard-scroll', 'view-session', 'thumbnail-enlargement', 'component-links', 'customization', 'app-history', 'home-styles', 'thumbnail-loading', 'performance', 'grid-return', 'copy-resources', 'link-boards', 'video-download', 'categories', 'workflow-tools', 'pointer-moves', 'wide-preview', 'library-export'].includes(fixture)) throw Error('Unknown browser test fixture');
const port = ["wide-preview", "performance"].includes(fixture) ? "1422" : "1421";
const testUrl = `http://127.0.0.1:${port}/tests/${fixture}.html`;

const chrome = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
  .filter(Boolean).map(root => join(root, 'Google/Chrome/Application/chrome.exe')).find(existsSync);
if (!chrome) throw Error('Chrome is required for the isolated headless check.');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: 'pipe', windowsHide: true });
let serverError = '';
server.stderr.on('data', chunk => { serverError += chunk; });
let started = false;
try {
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) throw Error(serverError || 'Test server stopped');
    try { if ((await fetch(testUrl)).ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!started) throw Error('Test server did not start');
  for (const dimensions of (fixture === 'link-boards' ? ['1920,1080', '1440,940', '960,700'] : fixture === 'home-styles' ? ['1440,2000', '960,700'] : fixture === 'performance' ? ['1920,1080'] : fixture === 'wide-preview' ? ['3440,1440', '1920,1080', '1600,940', '1599,940'] : ['1440,940', '960,700'])) {
    const profile = await mkdtemp(join(tmpdir(), 'design-grid-check-'));
    try {
      // An isolated headless process uses real browser frames and keyboard events.
      // It never attaches to, opens or focuses the user's browser windows.
      const child = spawn(chrome, ['--headless', '--disable-gpu', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}`], { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'], windowsHide: true });
      let sequence = 0, buffered = '', result;
      const pending = new Map();
      child.stdio[4].on('data', chunk => {
        buffered += chunk;
        let end;
        while ((end = buffered.indexOf('\0')) >= 0) {
          const message = JSON.parse(buffered.slice(0, end));
          buffered = buffered.slice(end + 1);
          const callback = pending.get(message.id);
          if (callback) { pending.delete(message.id); callback(message); }
        }
      });
      const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`Browser command timed out: ${method}`)); }, method === 'Page.navigate' ? 30000 : 10000);
        pending.set(id, message => {
          clearTimeout(timer);
          if (message.error) reject(Error(JSON.stringify(message.error)));
          else resolve(message.result);
        });
        child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
      });
      try {
        await call('Browser.getVersion');
        const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
        const [width, height] = dimensions.split(',').map(Number);
        await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
        if(['home-styles','thumbnail-enlargement'].includes(fixture)&&width===960) await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},sessionId);
        await call('Page.bringToFront', {}, sessionId);
        await call('Page.navigate', { url: testUrl }, sessionId);
        let sentEnter = false;
        let lastPointerAction=0;
        let lastWheelAction=0;
        let lastResizeAction=0;
        let captured = false;
        let lastCaptureName="";
        const deadline = Date.now() + (['home-styles','customization','grid-return'].includes(fixture)?120000:60000);
        while (Date.now() < deadline) {
          const { result: state } = await call('Runtime.evaluate', { expression: '({ report: document.getElementById("check-result")?.textContent, enter: !!window.__awaitNativeEnter, pointer: window.__pointerAction, wheel: window.__wheelAction, resize: window.__resizeAction, capture: !!window.__screenshotReady, captureName: window.__captureName })', returnByValue: true }, sessionId);
          if (['sidebar-tools', 'customise-tab-order', 'analytics-reports', 'default-appearance', 'startup', 'analytics', 'home-overview', 'close-lead', 'customise-layouts', 'tab-styles', 'cta-buttons', 'add-contact', 'calendar-setup', 'clients-performance', 'branding', 'clients', 'sidebar-reorder', 'customise-motion', 'research', 'leads-tour', 'calendar-sync', 'studio', 'sidebar-styles', 'moodboard', 'project-workspace', 'settings-page', 'diagnostics', 'project-folder-drag', 'project-folders', 'link-categories', 'thumbnail-click', 'colour-picker', 'website-scroll', 'link-boards', 'hover-preview', 'library-export', 'image-drop', 'view-session', 'thumbnail-enlargement', 'copy-resources', 'component-links', 'customization', 'home-styles', 'thumbnail-loading', 'wide-preview', 'workflow-tools', 'categories'].includes(fixture) && state.value?.capture && (!captured || (['sidebar-tools','settings-page','analytics-reports','analytics','studio','home-styles','customization','project-workspace','cta-buttons','home-overview','close-lead'].includes(fixture)&&state.value.captureName!==lastCaptureName))) {
            await mkdir('.tools/checks', { recursive: true });
            const shot = await call('Page.captureScreenshot', { format: 'png' }, sessionId);
            const captureName=['sidebar-tools','settings-page','analytics-reports','analytics','studio','home-styles','customization','project-workspace','cta-buttons','home-overview','close-lead'].includes(fixture)&&/^[a-z-]+$/.test(state.value.captureName??"")?"-"+state.value.captureName:"";
            await writeFile(`.tools/checks/${fixture}${captureName}-${dimensions}.png`, Buffer.from(shot.data, 'base64'));
            lastCaptureName=state.value.captureName;
            captured = true;
          }
          if (state.value?.resize?.id > lastResizeAction) {
            const action = state.value.resize; lastResizeAction = action.id;
            await call('Emulation.setDeviceMetricsOverride', { width: action.width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
            await call('Runtime.evaluate', { expression: `window.__resizeActionDone=${action.id}` }, sessionId);
          }
          if(state.value?.wheel?.id>lastWheelAction){
            const action=state.value.wheel;lastWheelAction=action.id;
            await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:action.x,y:action.y},sessionId);
            await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:action.x,y:action.y,deltaX:0,deltaY:action.deltaY,modifiers:action.ctrl?2:0},sessionId);
            await call('Runtime.evaluate',{expression:`window.__wheelActionDone=${action.id}`},sessionId);
          }
          if(state.value?.pointer?.id>lastPointerAction){
            const action=state.value.pointer;lastPointerAction=action.id;
            await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:action.from.x,y:action.from.y},sessionId);
            await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x:action.from.x,y:action.from.y},sessionId);
            if(!action.click){
              await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:action.from.x+12,y:action.from.y+8},sessionId);
              await call('Runtime.evaluate',{expression:'window.__duringPointerDrag?.()'},sessionId);
              await call('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:action.to.x,y:action.to.y,modifiers:action.ctrl?2:0},sessionId);
              if(action.pause)await new Promise(resolve=>setTimeout(resolve,action.pause));
              await call('Runtime.evaluate',{expression:'window.__checkPointerDrag?.()'},sessionId);
              if(action.escape){
                await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
                await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
              }
            }
            await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:action.to.x,y:action.to.y,modifiers:action.ctrl?2:0},sessionId);
            await call('Runtime.evaluate',{expression:`window.__pointerActionDone=${action.id}`},sessionId);
          }
          if (state.value?.enter && !sentEnter) {
            sentEnter = true;
            await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 }, sessionId);
            await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }, sessionId);
          }
          if (state.value?.report && state.value.report !== 'pending') { result = JSON.parse(state.value.report); break; }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!result) {
          const { result: debug } = await call('Runtime.evaluate', { expression: 'JSON.stringify({progress:window.__checkProgress, report:document.getElementById("check-result")?.textContent, viewer:document.querySelector(".viewer")?.dataset.itemId, cards:document.querySelectorAll(".card").length, focus:document.activeElement?.tagName})', returnByValue:true }, sessionId);
          throw Error(`Headless check timed out: ${debug.value}`);
        }
      } finally {
        if (child.exitCode === null) {
          const exited = new Promise(resolve => child.once('exit', resolve));
          child.kill();
          await exited;
        }
      }
      console.log(JSON.stringify({ dimensions, ...result }, null, 2));
      if (fixture === 'performance') {
        const label = process.env.DESIGN_PERF_LABEL || 'latest';
        if (!/^[a-z0-9_-]+$/i.test(label)) throw Error('Invalid performance label');
        await mkdir('.tools/performance', { recursive: true });
        await writeFile(`.tools/performance/${label}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), dimensions, ...result }, null, 2));
      }
      if (!result.ok) throw Error(result.error);
    } finally {
      const target = resolve(profile);
      if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('design-grid-check-')) throw Error('Unexpected temporary profile path');
      await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    }
  }
} finally { server.kill(); }
