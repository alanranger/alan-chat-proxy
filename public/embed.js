/*
  Lightweight embed script to launch the Alan Ranger Assistant chat UI on any site.
  Usage (Squarespace Global Header or Footer):
  <script async src="/embed.js" data-chat-src="/chat.html" data-position="br" data-color="#000F5B"></script>
  
  Version: 2025-11-02-v2 (SVG updated with smaller chat bubble)

  Optional data-attributes:
    data-chat-src  - absolute or relative URL to chat.html (default: /chat.html)
    data-position  - br | bl (bottom-right default, bottom-left alternative)
    data-color     - hex color for launcher background (default: #000F5B - navy blue, overridden by SVG)
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
    color: scriptEl.getAttribute('data-color') || '#000F5B',
    size: scriptEl.getAttribute('data-size') || '420x640',
    offset: parseInt(scriptEl.getAttribute('data-offset') || '20', 10),
    ga4: scriptEl.getAttribute('data-ga4-id') || ''
  };
  // Read optional cache-busting version from script src (?v=...)
  let scriptVersion = '';
  try { const u = new URL(scriptEl.src, location.href); scriptVersion = u.searchParams.get('v') || ''; } catch {}
  if (!scriptVersion) { scriptVersion = String(Date.now()); }

  function ensureGA(){
    if (!cfg.ga4) return;
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', cfg.ga4, { send_page_view: false, debug_mode: true });
    const s = doc.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4)}`;
    doc.head.appendChild(s);
  }

  function track(eventName, params){
    try{ if (window.gtag) window.gtag('event', eventName, { debug_mode: true, ...(params||{}) }); else if (window.dataLayer) window.dataLayer.push({ event: eventName, debug_mode: true, ...params }); }catch{}
  }

  function injectStyles(){
    const style = doc.createElement('style');
    style.id = 'alan-chat-embed-styles';
    style.textContent = `
      #alan-chat-launcher{position:fixed;z-index:2147483000;display:flex;align-items:center;justify-content:center;width:84px;height:84px;color:#fff;cursor:pointer;background:transparent;border:none;outline:none;box-shadow:none;animation:pulsate 3s ease-in-out infinite;}
      #alan-chat-launcher svg,#alan-chat-launcher .svg-container{display:block;width:100%;height:100%;pointer-events:none;}
      #alan-chat-launcher:hover{animation:wiggle 0.5s ease-in-out infinite;}
      @keyframes pulsate{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}
      @keyframes wiggle{0%,100%{transform:translate(0,0) rotate(0deg);}25%{transform:translate(-2px,-2px) rotate(-2deg);}75%{transform:translate(2px,2px) rotate(2deg);}}
      #alan-chat-frame-wrap{position:fixed;z-index:2147482999;display:none;background:rgba(0,0,0,0.35);} 
      #alan-chat-panel{position:absolute;background:#111;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.45);overflow:hidden;border:1px solid rgba(255,255,255,0.08);min-width:400px;min-height:300px;max-width:90vw;max-height:90vh;}
      #alan-chat-panel .drag-handle{position:absolute;top:0;left:0;right:0;height:40px;cursor:move;z-index:5;background:transparent;}
      #alan-chat-panel.resizing{cursor:nw-resize}
      #alan-chat-resize-handle{position:absolute;bottom:0;right:0;width:20px;height:20px;background:#E57200;cursor:nw-resize;border-radius:0 0 12px 0;opacity:0.7;transition:opacity 0.2s;z-index:10;}
      #alan-chat-resize-handle:hover{opacity:1}
      #alan-chat-resize-handle::after{content:'';position:absolute;bottom:4px;right:4px;width:0;height:0;border-left:6px solid transparent;border-bottom:6px solid #0b0f16;} 
      #alan-chat-close{position:absolute;right:8px;top:8px;width:40px;height:40px;border-radius:999px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid rgba(255,255,255,0.15);font-size:18px;font-weight:bold;transition:all 0.2s ease;z-index:20;padding:4px;}
      #alan-chat-close:hover{background:rgba(0,0,0,0.75);transform:scale(1.1);}
      #alan-chat-iframe{border:0;width:100%;height:100%;}
      @media (max-width: 768px){
        #alan-chat-panel{left:0!important;right:0!important;top:0!important;bottom:0!important;width:auto!important;height:auto!important;border-radius:0!important;}
        #alan-chat-frame-wrap{inset:0!important}
        #alan-chat-launcher{width:90px;height:90px;bottom:20px;right:20px;}
      }
      @media (max-width: 480px){
        #alan-chat-launcher{width:84px;height:84px;bottom:16px;right:16px;}
        #alan-chat-panel{border-radius:0!important;}
        #alan-chat-close{width:44px;height:44px;right:12px;top:12px;font-size:20px;}
      }
    `;
    doc.head.appendChild(style);
  }

  function createLauncher(){
    const btn = doc.createElement('div');
    btn.id = 'alan-chat-launcher';
    btn.setAttribute('aria-label','Open Alan Ranger Assistant');
    btn.style.background = 'transparent';
    const off = cfg.offset + 'px';
    if (cfg.position === 'bl') { btn.style.left = off; btn.style.bottom = off; }
    else { btn.style.right = off; btn.style.bottom = off; }
    
    // Default SVG (inline) - updated from ai-chat-badge-default-3d.svg (M28 smaller bubble, narrower width)
    const defaultSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="AI Chat Default"><g fill="#000F5B"><circle cx="60" cy="60" r="50"/><polygon points="90,96 108,110 100,88"/></g><rect x="58" y="56" width="36" height="24" rx="6" fill="#E57200"/><polygon points="78,80 88,86 88,80" fill="#E57200"/><g fill="#000F5B" transform="translate(2,2)"><path d="M30 34 h42 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-28 l-8 8 -2 -8 h-10 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6 z"/></g><g fill="#E57200"><path d="M30 34 h42 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-28 l-8 8 -2 -8 h-10 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6 z"/></g><text x="52" y="50" fill="#FFFFFF" font-size="14" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" text-anchor="middle" dominant-baseline="middle">Chat</text></svg>';
    
    // Hover SVG (inline) - updated from ai-chat-badge-hover-3d.svg (M28 smaller bubble, narrower width)
    const hoverSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="AI Chat Hover"><g fill="#E57200"><circle cx="60" cy="60" r="50"/><polygon points="90,96 108,110 100,88"/></g><rect x="58" y="56" width="36" height="24" rx="6" fill="#000F5B"/><polygon points="78,80 88,86 88,80" fill="#000F5B"/><g fill="#E57200" transform="translate(2,2)"><path d="M30 34 h42 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-28 l-8 8 -2 -8 h-10 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6 z"/></g><g fill="#000F5B"><path d="M30 34 h42 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-28 l-8 8 -2 -8 h-10 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6 z"/></g><text x="52" y="50" fill="#FFFFFF" font-size="14" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" text-anchor="middle" dominant-baseline="middle">Chat</text></svg>';
    
    // Create container for SVGs
    const svgContainer = doc.createElement('div');
    svgContainer.className = 'svg-container';
    svgContainer.innerHTML = defaultSVG;
    btn.appendChild(svgContainer);
    
    // Store SVGs for easy access
    let isHovered = false;
    
    // Handle hover to swap SVGs
    btn.addEventListener('mouseenter', function() {
      isHovered = true;
      svgContainer.innerHTML = hoverSVG;
    });
    
    btn.addEventListener('mouseleave', function() {
      isHovered = false;
      svgContainer.innerHTML = defaultSVG;
    });
    
    // Click handler - use capture phase to ensure it fires
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    }, true);
    
    doc.body.appendChild(btn);
  }

  function openPanel(){
    let wrap = doc.getElementById('alan-chat-frame-wrap');
    if (!wrap){
      ensureGA();
      wrap = doc.createElement('div');
      wrap.id = 'alan-chat-frame-wrap';
      wrap.style.inset = '0';
      doc.body.appendChild(wrap);

      const panel = doc.createElement('div');
      panel.id = 'alan-chat-panel';
      const [w,h] = cfg.size.split('x').map(v=>parseInt(v||'0',10));
      const off = cfg.offset;
      // Center the chat panel on screen instead of bottom-right/bottom-left
      const centerX = (window.innerWidth - (w||420)) / 2;
      const centerY = (window.innerHeight - (h||640)) / 2;
      const posStyles = {
        left: Math.max(off, centerX) + 'px',
        top: Math.max(off, centerY) + 'px'
      };
      Object.assign(panel.style, { width: (w||420)+'px', height: (h||640)+'px', ...posStyles });

      const close = doc.createElement('div');
      close.id = 'alan-chat-close';
      close.innerHTML = '&#10005;';
      close.addEventListener('click', ()=>{ wrap.style.display='none'; });
      panel.appendChild(close);

      const dragHandle = doc.createElement('div');
      dragHandle.className = 'drag-handle';
      panel.appendChild(dragHandle);

      const resizeHandle = doc.createElement('div');
      resizeHandle.id = 'alan-chat-resize-handle';
      panel.appendChild(resizeHandle);

      const iframe = doc.createElement('iframe');
      iframe.id = 'alan-chat-iframe';
      // Append parent page context so chat can log/display real host page, not /chat.html
      try{
        const u = new URL(cfg.chatSrc, location.origin);
        u.searchParams.set('parentUrl', location.href);
        u.searchParams.set('parentTitle', document.title || '');
        u.searchParams.set('parentHost', location.hostname || '');
        u.searchParams.set('parentPath', location.pathname || '');
        if (scriptVersion) u.searchParams.set('v', scriptVersion);
        iframe.src = u.toString();
      }catch{
        iframe.src = cfg.chatSrc;
      }
      iframe.setAttribute('title','Alan Ranger Assistant');
      iframe.setAttribute('loading','lazy');
      // Allow clipboard for Copy log button inside iframe
      try { iframe.allow = [iframe.allow||'', 'clipboard-read', 'clipboard-write'].filter(Boolean).join('; '); } catch{}
      panel.appendChild(iframe);

      wrap.appendChild(panel);

      // Add drag and resize functionality
      let isDragging = false;
      let isResizing = false;
      let startX, startY, startWidth, startHeight, startLeft, startTop;

      // Make panel draggable via drag handle
      dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;
        
        doc.body.style.userSelect = 'none';
        e.preventDefault();
      });

      // Handle resize
      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = panel.offsetWidth;
        startHeight = panel.offsetHeight;
        
        panel.classList.add('resizing');
        doc.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
      });

      // Mouse move handler
      doc.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          
          let newLeft = startLeft + deltaX;
          let newTop = startTop + deltaY;
          
          // Keep within viewport bounds
          const maxLeft = window.innerWidth - panel.offsetWidth;
          const maxTop = window.innerHeight - panel.offsetHeight;
          
          newLeft = Math.max(0, Math.min(newLeft, maxLeft));
          newTop = Math.max(0, Math.min(newTop, maxTop));
          
          panel.style.left = newLeft + 'px';
          panel.style.top = newTop + 'px';
          panel.style.right = 'auto';
          panel.style.bottom = 'auto';
        }
        
        if (isResizing) {
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          
          let newWidth = startWidth + deltaX;
          let newHeight = startHeight + deltaY;
          
          // Enforce min/max constraints
          newWidth = Math.max(400, Math.min(newWidth, window.innerWidth - panel.offsetLeft));
          newHeight = Math.max(300, Math.min(newHeight, window.innerHeight - panel.offsetTop));
          
          panel.style.width = newWidth + 'px';
          panel.style.height = newHeight + 'px';
        }
      });

      // Mouse up handler
      doc.addEventListener('mouseup', () => {
        if (isDragging || isResizing) {
          isDragging = false;
          isResizing = false;
          panel.classList.remove('resizing');
          doc.body.style.userSelect = '';
        }
      });

      // Touch support for mobile
      dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;
        
        e.preventDefault();
      });

      resizeHandle.addEventListener('touchstart', (e) => {
        isResizing = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startWidth = panel.offsetWidth;
        startHeight = panel.offsetHeight;
        
        panel.classList.add('resizing');
        e.preventDefault();
        e.stopPropagation();
      });

      doc.addEventListener('touchmove', (e) => {
        if (isDragging || isResizing) {
          const touch = e.touches[0];
          
          if (isDragging) {
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;
            
            const maxLeft = window.innerWidth - panel.offsetWidth;
            const maxTop = window.innerHeight - panel.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
          }
          
          if (isResizing) {
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            let newWidth = startWidth + deltaX;
            let newHeight = startHeight + deltaY;
            
            newWidth = Math.max(400, Math.min(newWidth, window.innerWidth - panel.offsetLeft));
            newHeight = Math.max(300, Math.min(newHeight, window.innerHeight - panel.offsetTop));
            
            panel.style.width = newWidth + 'px';
            panel.style.height = newHeight + 'px';
          }
          
          e.preventDefault();
        }
      });

      doc.addEventListener('touchend', () => {
        if (isDragging || isResizing) {
          isDragging = false;
          isResizing = false;
          panel.classList.remove('resizing');
        }
      });
    }
    wrap.style.display = 'block';

    // fire only once per browser session
    if (!sessionStorage.getItem('chat_started')) {
      track('chat_start', { source: 'embed', page_location: location.href });
      sessionStorage.setItem('chat_started', 'true');
    }
  }

  function init(){
    ensureGA();
    injectStyles();
    createLauncher();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();


