/* FERM Motion 1.1 — inertial, optionally looping editorial filmstrip. */
(function () {
  'use strict';
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function init(root) {
    if(root.dataset.dmSliderReady)return;
    let opt={};try{opt=JSON.parse(root.dataset.dmSlider||'{}');}catch(e){}
    const track=root.querySelector('.dm-slider-track, .splide__track');
    const list=root.querySelector('.dm-slider-list, .splide__list');
    const originals=Array.from(list?list.children:[]);
    if(!track||!list||!originals.length)return;
    root.dataset.dmSliderReady='1';
    // Normalize markup from pages cached before the slider class names changed.
    root.classList.remove('splide');
    track.classList.remove('splide__track');
    list.classList.remove('splide__list');
    track.classList.add('dm-slider-track');
    list.classList.add('dm-slider-list');
    originals.forEach(slide=>{
      slide.classList.remove('splide__slide');
      slide.classList.add('dm-slider-slide');
    });
    const vertical=opt.direction==='vertical';
    const normalScroll=()=>vertical?track.scrollTop:track.scrollLeft;
    let lastWrittenScroll=normalScroll();
    const writeScroll=v=>{
      if(vertical)track.scrollTop=v;else track.scrollLeft=v;
      lastWrittenScroll=normalScroll();
    };
    const travel=()=>vertical?track.scrollHeight-track.clientHeight:track.scrollWidth-track.clientWidth;
    const axisSize=()=>vertical?track.clientHeight:track.clientWidth;
    const reduce=reduced();
    const looping=!!opt.loop&&!reduce&&originals.length>1;
    const dragAllowed=opt.allowDrag!==false;
    const mode=reduce?'off':(opt.scrollResponse||'off');
    const strength=clamp(Number(opt.scrollStrength)||0,0,150)/100;
    const scrollDriven=mode!=='off'&&strength>0&&originals.length>1;
    const response=clamp((100-(Number(opt.smoothness)||72))/100,0.04,0.55);
    let period=0,base=0,target=0,current=0,frame=0,lastTick=0;
    let pendingScroll=0,dragging=false,dragOrigin=0,dragScroll=0;
    let scrollY=window.scrollY,scrollTime=performance.now();
    let suppressClick=false;
    let visible=inViewport();
    if(typeof IntersectionObserver==='function'){
      new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;}).observe(root);
    }
    const children=()=>Array.from(list.children);
    let navigationTarget=null;
    let navigationStart=0;
    let navigationStartedAt=null;
    const navigationDuration=780;
    if(looping){
      // Clones on BOTH sides guarantee that dragging in either direction is continuous.
      // The middle set is the canonical one; when scrolling crosses the boundary,
      // both the visual position and its target are shifted by one complete period.
      for(const item of originals){const clone=item.cloneNode(true);clone.dataset.dmClone='1';clone.setAttribute('aria-hidden','true');clone.querySelectorAll('a,button,input,[tabindex]').forEach(el=>el.tabIndex=-1);list.insertBefore(clone,originals[0]);}
      for(const item of originals){const clone=item.cloneNode(true);clone.dataset.dmClone='1';clone.setAttribute('aria-hidden','true');clone.querySelectorAll('a,button,input,[tabindex]').forEach(el=>el.tabIndex=-1);list.appendChild(clone);}
    }
    root.classList.toggle('dm-slider--loop',looping);
    root.classList.toggle('dm-slider--no-drag',!dragAllowed);
    root.classList.toggle('dm-slider--scroll-driven',scrollDriven);
    root.classList.toggle('dm-slider--drift',!!opt.imageDrift&&!reduce);
    track.setAttribute('role','region');
    track.setAttribute('aria-roledescription','carousel');
    track.setAttribute('aria-label',root.getAttribute('aria-label')||'Photographic gallery');
    track.tabIndex=0;
    function offset(el){return vertical?el.offsetTop:el.offsetLeft;}
    function extent(el){return vertical?el.offsetHeight:el.offsetWidth;}
    function centre(slide){return offset(slide)+(extent(slide)-axisSize())/2;}
    const navigable=originals.length>1;
    root.classList.toggle('dm-slider--navigable',navigable);
    function padEdges(){
      if(!navigable||looping)return;
      list.style.setProperty('--dm-nav-start',Math.max(0,(axisSize()-extent(originals[0]))/2)+'px');
      list.style.setProperty('--dm-nav-end',Math.max(0,(axisSize()-extent(originals[originals.length-1]))/2)+'px');
    }
    function layout(reset){
      padEdges();
      if(looping){
        // Distance from the middle first slide to the third (cloned) first slide.
        period=Math.max(1,offset(children()[originals.length*2])-offset(children()[originals.length]));
        base=offset(children()[originals.length]);
        if(reset){current=target=Math.max(0,centre(originals[0]));writeScroll(current);}
        else {
          const previousRelative=current-base;
          if(Math.abs(previousRelative)>period*1.5){current=target=base;writeScroll(base);}
          else wrap();
        }
      } else if(reset){current=target=navigable?Math.max(0,centre(originals[0])):normalScroll();writeScroll(current);}
      applyDrift();
    }
    function wrap(){
      if(!looping||!period)return;
      let delta=0;
      while(current<base-period*.5){current+=period;delta+=period;}
      while(current>=base+period*.5){current-=period;delta-=period;}
      if(delta){target+=delta;dragScroll+=delta;navigationStart+=delta;writeScroll(current);}
    }
    function inViewport(){const b=root.getBoundingClientRect();return b.bottom>0&&b.top<window.innerHeight;}
    function applyDrift(){
      if(!opt.imageDrift||reduce)return;
      const centre=current+axisSize()/2;
      children().forEach(slide=>{
        const image=slide.querySelector('img');if(!image)return;
        const delta=clamp((offset(slide)+extent(slide)/2-centre)/Math.max(1,axisSize()),-1,1);
        image.style.transform=vertical?`scale(1.06) translate3d(0,${(delta*8).toFixed(2)}px,0)`:`scale(1.06) translate3d(${(delta*8).toFixed(2)}px,0,0)`;
      });
    }
    function tick(now){
      const dt=lastTick?Math.min(0.05,(now-lastTick)/1000):0;
      lastTick=now;
      const onscreen=typeof IntersectionObserver==='function'?visible:inViewport();
      if(document.hidden||(!onscreen&&navigationTarget===null)){
        pendingScroll=0;
        current=target=normalScroll();
        stopNavigation();
        frame=0;lastTick=0;
        return;
      }
      // Apply page-scroll influence only between manual navigation steps.
      const active=!dragging;
      if(active&&scrollDriven&&navigationTarget===null){
        const step=pendingScroll*(1-Math.exp(-dt*9));
        target+=step;
        pendingScroll-=step;
        if(Math.abs(pendingScroll)<.05)pendingScroll=0;
      }
      if(!looping)target=clamp(target,0,Math.max(0,travel()));
      if(!dragging&&(current!==target||navigationTarget!==null)){
        if(navigationTarget!==null){
          if(navigationStartedAt===null)navigationStartedAt=now;
          const progress=clamp((now-navigationStartedAt)/navigationDuration,0,1);
          const eased=progress*progress*progress*(progress*(progress*6-15)+10);
          current=navigationStart+(target-navigationStart)*eased;
        }else{
          const k=1-Math.pow(1-response,Math.max(0.01,dt*60));
          current+=(target-current)*k;
        }
        if(navigationTarget===null && Math.abs(current-target)<0.02)current=target;
        wrap();writeScroll(current);applyDrift();
      }
      if(navigationTarget!==null && navigationStartedAt!==null && now-navigationStartedAt>=navigationDuration){
        current=target;
        writeScroll(current);
        stopNavigation();
      }
      if(pendingScroll || navigationTarget!==null || Math.abs(current-target)>0.1)frame=requestAnimationFrame(tick);
      else{frame=0;lastTick=0;}
    }
    function ensure(){if(!frame){lastTick=0;frame=requestAnimationFrame(tick);}}
    function onPageScroll(){
      const next=window.scrollY,now=performance.now(),dy=next-scrollY,dt=Math.max(8,now-scrollTime);
      scrollY=next;scrollTime=now;
      if(!dy||dragging||navigationTarget!==null||!(typeof IntersectionObserver==='function'?visible:inViewport()))return;
      const velocity=Math.abs(dy)/dt*1000;
      const acceleration=mode==='dynamic'?1+Math.min(.6,velocity/2500):1;
      pendingScroll=clamp(pendingScroll+dy*strength*acceleration*2.4,-220,220);
      ensure();
    }
    if(scrollDriven)window.addEventListener('scroll',onPageScroll,{passive:true});
    if(dragAllowed){
      track.addEventListener('pointerdown',e=>{
        if(e.pointerType!=='mouse'||e.button!==0)return;
        stopNavigation();pendingScroll=0;
        dragging=true;dragOrigin=vertical?e.clientY:e.clientX;dragScroll=normalScroll();
        track.classList.add('dm-slider-dragging');
      });
      window.addEventListener('pointermove',e=>{
        if(!dragging)return;
        const delta=(vertical?e.clientY:e.clientX)-dragOrigin;
        if(Math.abs(delta)>3){suppressClick=true;current=target=dragScroll-delta;wrap();writeScroll(current);applyDrift();}
      });
      window.addEventListener('pointerup',()=>{
        if(!dragging)return;
        dragging=false;target=current;track.classList.remove('dm-slider-dragging');
        setTimeout(()=>{suppressClick=false;},150);ensure();
      });
      track.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();}},true);
      // Let touch gestures scroll the filmstrip naturally, without RAF fighting touch.
      track.addEventListener('touchstart',()=>{stopNavigation();pendingScroll=0;dragging=true;},{passive:true});
      track.addEventListener('touchend',()=>{
        current=target=normalScroll();wrap();dragging=false;ensure();
      },{passive:true});
      track.addEventListener('touchcancel',()=>{dragging=false;current=target=normalScroll();wrap();ensure();},{passive:true});
    }
    // Forward the wheel to the page when smooth scrolling is unavailable.
    if(vertical){
      track.addEventListener('wheel',event=>{
        if(window.__fermLenis)return;
        if(event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
        if(!event.deltaY || Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
        const mode=event.deltaMode;
        const unit=mode===1 ? (parseFloat(getComputedStyle(track).lineHeight)||16) : mode===2 ? window.innerHeight : 1;
        event.preventDefault();
        window.scrollBy({top:event.deltaY*unit,behavior:'instant'});
      },{passive:false});
    }
    track.addEventListener('scroll',()=>{
      if(dragging)return;
      const position=normalScroll();
      if(!frame || Math.abs(position-lastWrittenScroll)>.5){
        stopNavigation();
        current=target=position;
        lastWrittenScroll=position;
        wrap();applyDrift();
      }
    },{passive:true});
    function stopNavigation(){
      navigationTarget=null;
      root.classList.remove('dm-slider--navigating');
    }
    function destinationFor(direction){
      if(!navigable||dragging)return null;
      const reference=navigationTarget===null?normalScroll():target;
      const slides=children();
      const nearest=slides.reduce((best,slide,i)=>
        Math.abs(centre(slide)-reference)<Math.abs(centre(slides[best])-reference)?i:best,0);
      const nextSlide=slides[nearest+direction];
      if(!nextSlide){
        if(navigationTarget!==null || Math.abs(clamp(centre(slides[nearest]),0,Math.max(0,travel()))-reference)<1)return null;
      }
      return nextSlide || slides[nearest];
    }
    function navigate(direction){
      const destination=destinationFor(direction);
      if(!destination)return;
      pendingScroll=0;
      target=clamp(centre(destination),0,Math.max(0,travel()));
      navigationTarget=destination;
      navigationStart=current=normalScroll();
      navigationStartedAt=null;
      root.classList.add('dm-slider--navigating');
      if(reduce){
        current=target;
        writeScroll(current);
        stopNavigation();
      }else ensure();
    }
    if(navigable){
      for(const direction of [-1,1]){
        const button=document.createElement('button');
        button.type='button';
        button.className='dm-slider-arrow '+(direction<0?'is-prev':'is-next');
        button.setAttribute('aria-label',direction<0?'Vorige foto':'Volgende foto');
        const icon=document.createElement('span');
        icon.setAttribute('aria-hidden','true');
        button.append(icon);
        button.addEventListener('click',()=>navigate(direction));
        root.append(button);
      }

      // The fixed buttons remain available for touch and keyboard navigation.
      // With a mouse, the photo surface offers the same controls at the pointer.
      const pointer = document.createElement('span');
      pointer.className = 'dm-slider-arrow dm-slider-pointer';
      pointer.setAttribute('aria-hidden', 'true');
      pointer.append(document.createElement('span'));
      root.append(pointer);
      const isInteractive = event => event.target.closest('a, button, input, select, textarea, [contenteditable]');
      let pointerDirection=0;
      function clearPointer(){
        pointerDirection=0;
        root.classList.remove('dm-slider--pointer');
      }
      track.addEventListener('pointermove', event => {
        if(event.pointerType !== 'mouse' || event.buttons || isInteractive(event)){
          clearPointer();
          return;
        }
        const bounds = track.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const direction = (vertical ? y < bounds.height / 2 : x < bounds.width / 2) ? -1 : 1;
        if(!destinationFor(direction)){
          clearPointer();
          return;
        }
        pointerDirection=direction;
        pointer.classList.toggle('is-prev', pointerDirection < 0);
        pointer.classList.toggle('is-next', pointerDirection > 0);
        const rootBounds = root.getBoundingClientRect();
        pointer.style.left = (event.clientX - rootBounds.left) + 'px';
        pointer.style.top = (event.clientY - rootBounds.top) + 'px';
        root.classList.add('dm-slider--pointer');
      }, {passive:true});
      track.addEventListener('pointerleave', clearPointer);
      track.addEventListener('pointercancel', clearPointer);
      window.addEventListener('scroll', clearPointer,{passive:true});
      window.addEventListener('blur', clearPointer);
      track.addEventListener('scroll',()=>{
        if(pointerDirection&&!looping&&!destinationFor(pointerDirection))clearPointer();
      },{passive:true});
      track.addEventListener('click', event => {
        if(event.pointerType !== 'mouse' || event.defaultPrevented || isInteractive(event))return;
        const rect = track.getBoundingClientRect();
        const previous = vertical ? event.clientY < rect.top + rect.height / 2 : event.clientX < rect.left + rect.width / 2;
        navigate(previous ? -1 : 1);
        if(pointerDirection&&!looping&&!destinationFor(pointerDirection))clearPointer();
      });
    }
    track.addEventListener('keydown',e=>{
      const forward=vertical?'ArrowDown':'ArrowRight';
      const reverse=vertical?'ArrowUp':'ArrowLeft';
      if(e.key!==forward&&e.key!==reverse)return;
      e.preventDefault();
      navigate(e.key===forward?1:-1);
    });
    layout(true);
    if(typeof ResizeObserver==='function'){
      const ro=new ResizeObserver(()=>{
        const prior=looping&&period?(current-base)/period:0;
        layout(false);
        if(looping){current=target=base+prior*period;wrap();writeScroll(current);}
        if(navigationTarget!==null){
          target=clamp(centre(navigationTarget),0,Math.max(0,travel()));
          navigationStart=current=normalScroll();
          navigationStartedAt=null;
          ensure();
        }
      });ro.observe(track);
    }
  }
  function boot(){document.querySelectorAll('.dm-slider[data-dm-slider]').forEach(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.FERMSlider={refresh:boot};
})();
