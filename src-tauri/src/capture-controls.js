(() => {
  if (document.getElementById('bitclever-capture-controls')) return true;
  const host = document.createElement('div');
  host.id = 'bitclever-capture-controls';
  host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>:host{all:initial}section{box-sizing:border-box;width:320px;max-width:calc(100vw - 32px);padding:16px;border-radius:12px;background:#f9faf7;color:#26322d;font:13px/1.5 system-ui;box-shadow:0 8px 32px #0004}strong{font-size:14px}p{margin:8px 0 12px}div{display:flex;gap:8px}button{border:0;border-radius:6px;padding:8px 12px;font:inherit;cursor:pointer;background:#e7ebe2;color:#26322d}button:first-child{background:#52664a;color:white}</style><section><strong>BitClever capture</strong><p>Handle the cookie notice, login or verification, then continue here.</p><div><button id="continue">Continue capture</button><button id="cancel">Cancel</button></div></section>`;
  root.getElementById('continue').onclick = () => { window.__bitcleverCaptureAction = 'continue'; };
  root.getElementById('cancel').onclick = () => { window.__bitcleverCaptureAction = 'cancel'; };
  window.__bitcleverCaptureAction = '';
  document.documentElement.append(host);
  return true;
})()
