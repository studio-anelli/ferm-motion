(() => {
  function init(root) {
    const slides=JSON.parse(root.dataset.setups);
    if(root.dataset.palette && root.dataset.palette!=='custom custom'){
      const swatch=document.createElement('span');
      swatch.hidden=true;
      root.append(swatch);
      for(const state of ['active','hover']){
        swatch.style.backgroundColor='var(--fo-'+state+')';
        const rgb=getComputedStyle(swatch).backgroundColor.match(/^rgba?\(([\d.]+), ?([\d.]+), ?([\d.]+)/);
        if(!rgb)continue;
        const channels=rgb.slice(1).map(channel=>{
          const value=Number(channel)/255;
          return value<=.04045 ? value/12.92 : Math.pow((value+.055)/1.055,2.4);
        });
        const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
        root.style.setProperty('--fo-'+state+'-text',luminance>.179?'#000':'#fff');
      }
      swatch.remove();
    }

    const gallery=root.querySelector('figure'), photo=root.querySelector('.fo-photo'), list=root.querySelector('.fo-list');
    const previous=root.querySelector('.fo-prev'), next=root.querySelector('.fo-next');
    let index=0;
    const capacities=slides.map(slide=>slide[3]);
    let available=slides.map((_,i)=>i);
    const views=slides.map(([name,capacity,source])=>{
      const image=new Image();
      image.src=source;
      image.alt='FERM ingericht als '+name;
      photo.prepend(image);
      const button=document.createElement('button');
      button.type='button';
      button.className='fo-choice';
      for(const text of [name,capacity]){
        const label=document.createElement('span');
        label.textContent=text;
        button.append(label);
      }
      list.append(button);
      return {image,button};
    });
    function positionSelection(){
      const button=views[index].button;
      list.style.setProperty('--row-top',button.offsetTop+'px');
      list.style.setProperty('--row-height',button.offsetHeight+'px');
    }
    function show(i){
      index=i;
      positionSelection();
      views.forEach(({image,button},j)=>{
        image.classList.toggle('active',j===index);
        image.setAttribute('aria-hidden',String(j!==index));
        button.setAttribute('aria-pressed',String(j===index));
      });
      root.querySelector('figcaption strong').textContent=slides[index][0];
      root.querySelector('figcaption span').textContent=slides[index][1];
    }
    function step(direction){
      const current=available.indexOf(index);
      show(available[(current+direction+available.length)%available.length]);
    }
    for(const [i,{button}] of views.entries()){
      button.addEventListener('click',()=>show(i));
    }
    root.querySelector('.fo-group-size').addEventListener('change',event=>{
      const upperLimit=Number(event.target.value);
      available=capacities.flatMap((max,i)=>max>=upperLimit?[i]:[]);
      views.forEach(({button},i)=>{button.hidden=!available.includes(i);});
      previous.hidden=next.hidden=available.length<2;
      show(available.includes(index)?index:available[0]);
    });
    previous.addEventListener('click',()=>step(-1));
    next.addEventListener('click',()=>step(1));
    for(const arrow of [previous,next]){
      const follow=event=>{
        if(event.pointerType==='touch')return;
        const bounds=arrow.getBoundingClientRect();
        const frame=photo.getBoundingClientRect();
        const x=Math.max(28,Math.min(frame.width-28,event.clientX-frame.left));
        const y=Math.max(15,Math.min(frame.height-15,event.clientY-frame.top));
        arrow.style.setProperty('--arrow-x',(x+frame.left-bounds.left)+'px');
        arrow.style.setProperty('--arrow-y',y+'px');
        arrow.dataset.tracking='';
      };
      arrow.addEventListener('pointerenter',follow);
      arrow.addEventListener('pointermove',follow);
      arrow.addEventListener('pointerleave',()=>{
        delete arrow.dataset.tracking;
        arrow.style.removeProperty('--arrow-x');
        arrow.style.removeProperty('--arrow-y');
      });
    }

    gallery.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();
        step(event.key==='ArrowRight'?1:-1);
      }
    });
    let start;
    photo.addEventListener('pointerdown',event=>{
      if(event.pointerType==='touch')start=[event.clientX,event.clientY];
    });
    photo.addEventListener('pointercancel',()=>{start=null});
    photo.addEventListener('pointerup',event=>{
      if(!start)return;
      const dx=event.clientX-start[0],dy=event.clientY-start[1];
      start=null;
      if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy))step(dx<0?1:-1);
    });
    if(root.classList.contains('fo-full')){
      const updateGutters=()=>{
        const bounds=root.getBoundingClientRect();
        const width=document.documentElement.clientWidth;
        root.style.setProperty('--fo-left-gutter',Math.max(0,bounds.left)+'px');
        root.style.setProperty('--fo-right-gutter',Math.max(0,width-bounds.right)+'px');
      };
      updateGutters();
      window.addEventListener('resize',updateGutters,{passive:true});
      if('ResizeObserver' in window)new ResizeObserver(updateGutters).observe(root);
    }
    show(0);
    if('ResizeObserver' in window){
      const observer=new ResizeObserver(positionSelection);
      views.forEach(({button})=>observer.observe(button));
    }
    requestAnimationFrame(()=>requestAnimationFrame(()=>list.classList.add('is-ready')));
  }
  function boot(){document.querySelectorAll('.ferm-opstellingen').forEach(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
