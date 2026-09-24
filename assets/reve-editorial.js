(function(){
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var root=(window.Shopify&&Shopify.routes&&Shopify.routes.root)||'/';

  function initAnn(el){
    if(el.dataset.rvAnn) return; el.dataset.rvAnn=1;
    var msgs=$$('.rv-ann__msg',el), dots=$$('.rv-ann__dot',el), i=0, paused=false, t;
    var speed=(parseFloat(el.dataset.speed)||5)*1000;
    if(msgs.length<2) return;
    function show(n){ i=(n+msgs.length)%msgs.length;
      msgs.forEach(function(m,k){ m.classList.toggle('is-active',k===i); m.setAttribute('aria-hidden',k!==i) });
      dots.forEach(function(d,k){ d.classList.toggle('is-active',k===i); d.setAttribute('aria-current',k===i) }); }
    function tick(){ clearInterval(t); t=setInterval(function(){ if(!paused) show(i+1) },speed) }
    dots.forEach(function(d,k){ d.addEventListener('click',function(){ show(k); tick() }) });
    var tg=$('.rv-ann__toggle',el);
    if(tg) tg.addEventListener('click',function(){ paused=!paused; el.classList.toggle('is-paused',paused); tg.setAttribute('aria-label',paused?'Play':'Pause') });
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){ paused=true; el.classList.add('is-paused') }
    show(0); tick();
  }

  function initCarousel(el){
    var track=$('[data-rv-track]',el); if(!track||el.dataset.rvCar) return; el.dataset.rvCar=1;
    $$('[data-rv-dir]',el).forEach(function(b){ b.addEventListener('click',function(){ track.scrollBy({left:(+b.dataset.rvDir)*track.clientWidth,behavior:'smooth'}) }) });
  }

  function initRecs(el){
    var url=el.dataset.rvRecs; if(!url||el.dataset.rvRecsDone) return; el.dataset.rvRecsDone=1;
    fetch(url).then(function(r){return r.text()}).then(function(html){
      var d=document.createElement('div'); d.innerHTML=html;
      var n=d.querySelector('[data-rv-recs-body]');
      if(n&&n.innerHTML.trim()){ el.innerHTML=n.innerHTML; initCarousel(el); syncWish() }
    }).catch(function(){});
  }

  var WKEY='rv-wishlist';
  function wl(){ try{ return JSON.parse(localStorage.getItem(WKEY))||[] }catch(e){ return [] } }
  function syncWish(){
    var l=wl();
    $$('[data-rv-wish]').forEach(function(b){ var on=l.indexOf(b.dataset.rvWish)>-1; b.setAttribute('aria-pressed',on); if(!b.dataset.rvKeepLabel) b.setAttribute('aria-label',on?'Remove from wishlist':'Add to wishlist') });
    $$('[data-rv-wish-count]').forEach(function(c){ c.textContent=l.length?'('+l.length+')':'' });
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-rv-wish]'); if(!b) return;
    e.preventDefault(); var l=wl(), h=b.dataset.rvWish, k=l.indexOf(h);
    if(k>-1) l.splice(k,1); else l.push(h);
    try{ localStorage.setItem(WKEY,JSON.stringify(l)) }catch(err){}
    syncWish();
  });

  var lastFocus=null;
  function closeDrawers(){ $$('.rv-drawer.is-open').forEach(function(d){ d.classList.remove('is-open'); d.setAttribute('aria-hidden','true') }); document.documentElement.style.overflow=''; if(lastFocus){ lastFocus.focus(); lastFocus=null } }
  document.addEventListener('click',function(e){
    var o=e.target.closest('[data-rv-open]');
    if(o){ var d=document.getElementById(o.dataset.rvOpen); if(d){ lastFocus=o; d.classList.add('is-open'); d.setAttribute('aria-hidden','false'); document.documentElement.style.overflow='hidden'; var c=$('.rv-drawer__close',d); if(c) c.focus() } return }
    if(e.target.closest('[data-rv-close]')) closeDrawers();
    var q=e.target.closest('[data-rv-qty]');
    if(q){ var i=q.parentNode.querySelector('input'); i.value=Math.max(1,Math.min(99,(parseInt(i.value,10)||1)+(+q.dataset.rvQty))) }
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeDrawers() });
  document.addEventListener('change',function(e){ if(e.target.matches('[data-rv-autosubmit]')) e.target.form.submit() });

  function initProduct(el){
    if(el.dataset.rvProd) return; el.dataset.rvProd=1;
    var json=$('[data-rv-variants]',el); if(!json) return;
    var data=JSON.parse(json.textContent), form=$('form[action*="/cart/add"]',el); if(!form) return;
    var idInput=$('input[name="id"]',form), btn=$('[data-rv-atc]',form), priceEl=$('[data-rv-price]',el), img=$('[data-rv-variant-img]',el);
    var sticky=document.querySelector('[data-rv-sticky="'+el.dataset.rvProduct+'"]'), isMain=el.hasAttribute('data-rv-main');
    var groups=$$('[data-rv-option]',el);
    function selected(){ return groups.map(function(g){ var c=$('input:checked',g); return c?c.value:null }) }
    function find(sel){ for(var i=0;i<data.length;i++){ var v=data[i], ok=true; for(var k=0;k<sel.length;k++){ if(v.options[k]!==sel[k]){ ok=false; break } } if(ok) return v } return null }
    function label(v){ return !v?btn.dataset.unavailable:(v.available?btn.dataset.add:btn.dataset.soldout) }
    function update(){
      var sel=selected(), v=find(sel);
      groups.forEach(function(g,k){ var l=$('[data-rv-selected]',g); if(l) l.textContent=sel[k]||'';
        $$('input',g).forEach(function(inp){ var t=sel.slice(); t[k]=inp.value; var m=find(t); inp.parentNode.classList.toggle('is-unavailable',!m||!m.available) }) });
      btn.disabled=!v||!v.available; btn.textContent=label(v);
      if(v){ idInput.value=v.id;
        if(priceEl) priceEl.innerHTML=v.price+(v.compare?' <s>'+v.compare+'</s>':'');
        if(img&&v.img){ img.src=v.img; img.removeAttribute('srcset') }
        if(isMain&&window.history&&history.replaceState){ var u=new URL(location.href); u.searchParams.set('variant',v.id); history.replaceState({},'',u.toString()) } }
      if(sticky){ var sv=$('[data-rv-sticky-variant]',sticky); if(sv) sv.textContent=sel.join(' / '); var sb=$('[data-rv-atc]',sticky); if(sb){ sb.disabled=btn.disabled; sb.textContent=btn.textContent } }
    }
    el.addEventListener('change',function(e){ if(e.target.closest('[data-rv-option]')) update() });
    form.addEventListener('submit',function(e){
      if(!window.fetch||!window.FormData) return;
      e.preventDefault(); btn.disabled=true;
      fetch(root+'cart/add.js',{method:'POST',headers:{'Accept':'application/json'},body:new FormData(form)})
        .then(function(r){ if(!r.ok) throw new Error('add'); return r.json() })
        .then(function(){ btn.textContent=btn.dataset.added; document.dispatchEvent(new CustomEvent('rv:cart-added'));
          return fetch(root+'cart.js').then(function(r){return r.json()}).then(function(c){ $$('[data-rv-cart-count]').forEach(function(n){ n.textContent='('+c.item_count+')' }) }) })
        .catch(function(){ form.submit() })
        .then(function(){ setTimeout(update,1800) });
    });
    if(sticky){
      var sb=$('[data-rv-atc]',sticky);
      if(sb) sb.addEventListener('click',function(){ if(form.requestSubmit) form.requestSubmit(btn); else btn.click() });
      if('IntersectionObserver' in window) new IntersectionObserver(function(en){ var x=en[0]; sticky.classList.toggle('is-visible',!x.isIntersecting&&x.boundingClientRect.top<0) }).observe(btn);
    }
    update();
  }

  function init(scope){
    $$('.rv-ann',scope).forEach(initAnn);
    $$('[data-rv-carousel]',scope).forEach(initCarousel);
    $$('[data-rv-recs]',scope).forEach(initRecs);
    $$('[data-rv-product]',scope).forEach(initProduct);
    syncWish();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ init(document) }); else init(document);
  document.addEventListener('shopify:section:load',function(e){ init(e.target) });
})();
