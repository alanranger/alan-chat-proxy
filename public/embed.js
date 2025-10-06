/*
  Lightweight embed script to launch the Alan Ranger Assistant chat UI on any site.
  Usage (Squarespace Global Header or Footer):
  <script async src="/embed.js" data-chat-src="/chat.html" data-position="br" data-color="#4CAF50"></script>

  Optional data-attributes:
    data-chat-src  - absolute or relative URL to chat.html (default: /chat.html)
    data-position  - br | bl (bottom-right default, bottom-left alternative)
    data-color     - hex color for launcher background (default: #4CAF50)
    data-size      - desktop max width/height in px (e.g., 420x640)
    data-offset    - CSS margin from edges (default: 20)
*/
(function(){
  if (window.__AlanChatEmbedLoaded) return; // idempotent
  window.__AlanChatEmbedLoaded = true;

  const doc = document;
  const scriptEl = doc.currentScript || (function(){ const s = doc.querySelector('script[src*="/embed.js"]'); return s || {}; })();
  const cfg = {
    chatSrc: scriptEl.getAttribute('data-chat-src') || '/chat.html',
    position: (scriptEl.getAttribute('data-position') || 'br').toLowerCase(),
    color: scriptEl.getAttribute('data-color') || '#4CAF50',
    size: scriptEl.getAttribute('data-size') || '420x640',
    offset: parseInt(scriptEl.getAttribute('data-offset') || '20', 10)
  };

  function injectStyles(){
    const style = doc.createElement('style');
    style.id = 'alan-chat-embed-styles';
    style.textContent = `
      #alan-chat-launcher{position:fixed;z-index:2147483000;display:flex;align-items:center;justify-content:center;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,0.3);width:56px;height:56px;color:#fff;cursor:pointer;}
      #alan-chat-launcher:hover{filter:brightness(1.05)}
      #alan-chat-frame-wrap{position:fixed;z-index:2147482999;display:none;background:rgba(0,0,0,0.35);} 
      #alan-chat-panel{position:absolute;background:#111;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.45);overflow:hidden;border:1px solid rgba(255,255,255,0.08);} 
      #alan-chat-close{position:absolute;right:8px;top:8px;width:32px;height:32px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid rgba(255,255,255,0.15)}
      #alan-chat-iframe{border:0;width:100%;height:100%;}
      @media (max-width: 768px){
        #alan-chat-panel{left:0!important;right:0!important;top:0!important;bottom:0!important;width:auto!important;height:auto!important;border-radius:0!important;}
        #alan-chat-frame-wrap{inset:0!important}
      }
    `;
    doc.head.appendChild(style);
  }

  function createLauncher(){
    const btn = doc.createElement('div');
    btn.id = 'alan-chat-launcher';
    btn.setAttribute('aria-label','Open Alan Ranger Assistant');
    btn.style.background = cfg.color;
    const off = cfg.offset + 'px';
    if (cfg.position === 'bl') { btn.style.left = off; btn.style.bottom = off; }
    else { btn.style.right = off; btn.style.bottom = off; }
    btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C7.03 3 3 6.58 3 11c0 2.02.93 3.84 2.47 5.19-.1.88-.44 2.34-1.39 3.86 0 0 2.02-.22 4.02-1.74.03-.02.05-.03.08-.05 1.12.38 2.33.59 3.64.59 4.97 0 9-3.58 9-8s-4.03-8-9-8z" fill="currentColor"/></svg>';
    btn.addEventListener('click', openPanel);
    doc.body.appendChild(btn);
  }

  function openPanel(){
    let wrap = doc.getElementById('alan-chat-frame-wrap');
    if (!wrap){
      wrap = doc.createElement('div');
      wrap.id = 'alan-chat-frame-wrap';
      wrap.style.inset = '0';
      doc.body.appendChild(wrap);

      const panel = doc.createElement('div');
      panel.id = 'alan-chat-panel';
      const [w,h] = cfg.size.split('x').map(v=>parseInt(v||'0',10));
      const off = cfg.offset;
      const posStyles = (cfg.position === 'bl')
        ? { left: off+'px', bottom: (off+64)+'px' }
        : { right: off+'px', bottom: (off+64)+'px' };
      Object.assign(panel.style, { width: (w||420)+'px', height: (h||640)+'px', ...posStyles });

      const close = doc.createElement('div');
      close.id = 'alan-chat-close';
      close.innerHTML = '&#10005;';
      close.addEventListener('click', ()=>{ wrap.style.display='none'; });
      panel.appendChild(close);

      const iframe = doc.createElement('iframe');
      iframe.id = 'alan-chat-iframe';
      iframe.src = cfg.chatSrc;
      iframe.setAttribute('title','Alan Ranger Assistant');
      iframe.setAttribute('loading','lazy');
      panel.appendChild(iframe);

      wrap.appendChild(panel);
    }
    wrap.style.display = 'block';
  }

  function init(){
    injectStyles();
    createLauncher();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();


