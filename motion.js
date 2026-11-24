(function () {
  'use strict';
  var cfg = window.FERMMotionConfig || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var observed = new WeakSet();
  var parallax = new Set();
  var easedOffsets = new WeakMap();
  var easingActive=false;
  var revealObservers = {};
  var stats = {initialized:0,visible:0,lines:0,stagger:0,images:0,backgrounds:0,backgroundMissing:0,parallax:0,imageParallax:0,backgroundParallax:0,sectionParallax:0,words:0,colorSections:0,colorTransitions:0};
  function number(value,fallback,max){var n=Number(value);return value!==null&&value!==undefined&&value!==''&&Number.isFinite(n)?Math.max(0,Math.min(n,max)):fallback;}
  function setting(el,name,fallback,max){return number(el.getAttribute('data-dm-'+name),fallback,max);}
  function reveal(el){if(!el.classList.contains('dm-visible'))stats.visible++;el.classList.add('dm-visible');}
  function revealObserver(trigger){
    if(!('IntersectionObserver' in window))return null;
    // Trigger is the percentage DOWN the viewport. 45% triggers later than 85%.
    var key=String(trigger);
    if(!revealObservers[key])revealObservers[key]=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){reveal(entry.target);if(cfg.once!==false)revealObservers[key].unobserve(entry.target);}
        else if(cfg.once===false)entry.target.classList.remove('dm-visible');
      });
    },{threshold:0,rootMargin:'0px 0px -'+(100-trigger)+'% 0px'});
    return revealObservers[key];
  }
  function findTextTarget(el){
    var target=el;
    for(var i=0;i<4;i++){
      var children=Array.from(target.children).filter(function(x){return x.tagName!=='BR';});
      if(children.length!==1)break;
      var only=children[0];
      if(only.tagName==='P'||/^H[1-6]$/.test(only.tagName)){target=only;break;}
      if(only.classList.contains('wpb_wrapper')||only.classList.contains('w-text')||only.classList.contains('w-text-h'))target=only;else break;
    }
    return target;
  }
  function splitLines(el){
    var target=findTextTarget(el);
    if(target.querySelector('.dm-line'))return true;
    var parts=target.innerHTML.split(/<br\s*\/?\s*>/i);
    if(parts.length<2)return false;
    if(parts.some(function(p){return /<(?!\/?(?:strong|b|em|i|span)\b)[a-z][^>]*>/i.test(p);}))return false;
    target.innerHTML=parts.map(function(p,i){return '<span class="dm-line" style="--dm-delay:'+(i*setting(el,'stagger',number(cfg.stagger,120,600),600))+'ms">'+p+'</span>';}).join('');
    stats.lines++;return true;
  }

  function splitWords(el){
    var target=findTextTarget(el);
    if(target.querySelector('.dm-word'))return true;
    var delay=setting(el,'word-delay',number(cfg.stagger,120,600),700);
    var index=0;
    if(el.classList.contains('dm-words-manual')){
      var manual=Array.from(target.querySelectorAll('span')).filter(function(span){return !span.querySelector('span') && span.textContent.trim();});
      if(!manual.length)return false;
      manual.forEach(function(span){span.classList.add('dm-word');span.style.setProperty('--dm-delay',index++ * delay+'ms');});
      stats.words++;return true;
    }
    // Splitting text nodes, not innerHTML, preserves WPBakery formatting,
    // nested <strong>/<em>, authored line breaks, punctuation and links.
    var walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{
      acceptNode:function(node){
        if(!node.nodeValue || !/\S/.test(node.nodeValue))return NodeFilter.FILTER_REJECT;
        var parent=node.parentElement;
        if(!parent || parent.closest('.dm-word,script,style,button,textarea,[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      var fragments=node.nodeValue.match(/\S+|\s+/g)||[];
      var frag=document.createDocumentFragment();
      fragments.forEach(function(piece){
        if(/^\s+$/.test(piece)){frag.appendChild(document.createTextNode(piece));return;}
        var span=document.createElement('span');
        span.className='dm-word';span.textContent=piece;
        span.style.setProperty('--dm-delay',(index++ * delay)+'ms');
        frag.appendChild(span);
      });
      node.parentNode.replaceChild(frag,node);
    });
    if(!index)return false;
    stats.words++;return true;
  }
  function staggerChildren(el){
    var parent=el;if(parent.children.length===1&&parent.firstElementChild.classList.contains('wpb_wrapper'))parent=parent.firstElementChild;
    var children=Array.from(parent.children);if(children.length<2)return false;
    children.forEach(function(child,i){child.classList.add('dm-stagger-item');child.style.setProperty('--dm-delay',i*setting(el,'stagger',number(cfg.stagger,120,600),600)+'ms');});
    stats.stagger++;return true;
  }
  function backgroundNode(el){
    // Prefer Impreza's dedicated decorative background layer, not text/image columns.
    var candidates=Array.from(el.querySelectorAll('.l-section-img,.vc_parallax-inner'));
    candidates.push(el);
    candidates=candidates.concat(Array.from(el.querySelectorAll('.vc_row')).slice(0,4));
    for(var i=0;i<candidates.length;i++){
      var styles=window.getComputedStyle(candidates[i]);
      if(styles.backgroundImage && styles.backgroundImage!=='none' && /url\(/i.test(styles.backgroundImage))
        return {node:candidates[i],style:styles};
    }
    return null;
  }
  // The original WPBakery/Impreza element stays the authority for fitting and focal point.
  // The decorative layer inherits its computed layout, not our own "cover / center" defaults.
  function syncBackgroundLayout(el){
    var node=el._dmBgSource,layer=el._dmBgLayer;
    if(!node||!layer)return;
    var st=window.getComputedStyle(node);
    var overrides=el._dmBgOverrides||{};
    layer.style.backgroundSize=overrides.size||st.backgroundSize||'auto';
    layer.style.backgroundRepeat=overrides.repeat||st.backgroundRepeat||'repeat';
    layer.style.backgroundPositionX=overrides.x||st.backgroundPositionX||'50%';
    el._dmBgBasePositionY=overrides.y||st.backgroundPositionY||'50%';
    layer.style.backgroundPositionY=el._dmBgBasePositionY;
    // A motion layer must scroll with its row; "fixed" backgrounds need their own
    // native rendering, so don't reproduce background-attachment: fixed here.
    layer.style.backgroundOrigin=st.backgroundOrigin||'padding-box';
    layer.style.backgroundClip=st.backgroundClip||'border-box';
    // Distinct breakpoint styles are read again on resize / element-size changes.
    el._dmBgLastLayout={size:layer.style.backgroundSize,position:layer.style.backgroundPositionX+' '+el._dmBgBasePositionY,repeat:layer.style.backgroundRepeat};
  }
  function prepareBackground(el){
    var found=backgroundNode(el),url=el.getAttribute('data-dm-bg-url');
    if(!found&&!url){stats.backgroundMissing++;el.classList.add('dm-bg-missing');return false;}
    var node=found?found.node:el;
    var st=window.getComputedStyle(node);
    var image=url?'url("'+url.replace(/"/g,'%22')+'")':st.backgroundImage;
    // If we cannot safely reconstruct a single image, leave the native background.
    if(!url && (!image||image==='none'||(image.match(/url\(/g)||[]).length!==1)){
      stats.backgroundMissing++;el.classList.add('dm-bg-missing');return false;
    }
    var layer=document.createElement('span');
    layer.className='dm-bg-layer';layer.setAttribute('aria-hidden','true');
    layer.style.backgroundImage=image;
    if(st.position==='static')node.style.position='relative';
    if(found){
      el._dmOriginalBackground={node:node,value:node.style.getPropertyValue('background-image'),priority:node.style.getPropertyPriority('background-image')};
      node.style.setProperty('background-image','none','important');
      if(window.getComputedStyle(node).backgroundImage!=='none'){
        if(el._dmOriginalBackground.value)node.style.setProperty('background-image',el._dmOriginalBackground.value,el._dmOriginalBackground.priority);
        else node.style.removeProperty('background-image');
        stats.backgroundMissing++;el.classList.add('dm-bg-missing');return false;
      }
    }
    var frame=document.createElement('span');
    frame.className='dm-bg-frame';frame.setAttribute('aria-hidden','true');frame.appendChild(layer);
    node.insertBefore(frame,node.firstChild);
    node.classList.add('dm-bg-host');node.style.isolation='isolate';
    if(el!==node)el.classList.add('dm-bg-owner');
    el._dmBgLayer=layer;
    el._dmBgSource=node;
    var customPos=el.getAttribute('data-dm-bg-position');
    var customSize=el.getAttribute('data-dm-bg-size');
    // Optional HTML-element overrides; ordinary WPBakery users need neither.
    el._dmBgOverrides={size:customSize||'',repeat:el.getAttribute('data-dm-bg-repeat')||'',x:'',y:''};
    if(customPos){
      var parts=customPos.trim().split(/\s+/);
      el._dmBgOverrides.x=parts[0]||'';
      el._dmBgOverrides.y=parts[1]||'50%';
    }
    syncBackgroundLayout(el);
    // Impreza can change image settings at responsive breakpoints. Read them back
    // rather than continuing to show a frozen clone of the previous layout.
    if('ResizeObserver' in window){
      el._dmBgResizeObserver=new ResizeObserver(function(){syncBackgroundLayout(el);schedule();});
      el._dmBgResizeObserver.observe(node);
    }
    stats.backgrounds++;
    return true;
  }
  function positionOffset(base,offset){
    // CSS supports calc(top + 12px) only when top is converted to a percentage.
    var normalized=String(base||'50%').trim().toLowerCase();
    if(normalized==='top')normalized='0%';
    else if(normalized==='center')normalized='50%';
    else if(normalized==='bottom')normalized='100%';
    if(!/^(?:-?\d*\.?\d+(?:%|px|em|rem|vh|vw)|calc\(.+\))$/.test(normalized))return base;
    return 'calc('+normalized+' + '+offset.toFixed(2)+'px)';
  }
  function isSection(el){
    return el.matches('section,.vc_row,.l-section,.wpb_row,.wpb_row_wrapper') || el.classList.contains('ferm-section');
  }
  function prepareParallax(el){
    // Legacy dm-parallax on a whole row is upgraded to the safe section mode.
    if(el.classList.contains('dm-parallax')){
      if(isSection(el))el.classList.add('dm-section-parallax');
      else if(el.matches('.wpb_single_image,.w-image,figure')||el.querySelector('img'))el.classList.add('dm-image-parallax');
    }
    if(el.classList.contains('dm-organic-parallax'))el.classList.add('dm-image-parallax');
    if(el.classList.contains('dm-image-parallax')){
      var pic=el.matches('img')?el:el.querySelector('img');
      if(!pic)return false;
      el._dmImage=pic;
      if(el.classList.contains('dm-organic-parallax') && organicNoise){
        el._dmOrganicSeed = ++organicImages * 13.71;
      }
      // The wrapper (not row) acts as the clipping frame.
      if(pic!==el){
        const imageBounds = pic.getBoundingClientRect();
        let frame = el;
        const configuredRadius = number(cfg.imageParallaxRadius,0,200);
        let radius = configuredRadius ? configuredRadius+'px' : '';
        for(let source=pic;source;source=source.parentElement){
          const style = getComputedStyle(source);
          if(!radius && [
            style.borderTopLeftRadius, style.borderTopRightRadius,
            style.borderBottomRightRadius, style.borderBottomLeftRadius
          ].some(value => value.split(/\s+/).some(part => parseFloat(part) > 0))){
            radius = style.borderRadius;
          }
          if(source!==pic && frame===el && imageBounds.width && imageBounds.height){
            const bounds = source.getBoundingClientRect();
            if(['left','top','right','bottom'].every(edge => Math.abs(bounds[edge]-imageBounds[edge]) < 1)){
              frame = source;
            }
          }
          if(source===el)break;
        }
        frame.style.overflow='clip';
        if(radius){
          const syncClip = () => {
            // Measure the resting image even when parallax is already active.
            const transform = pic.style.transform;
            pic.style.transform = 'none';
            const image = pic.getBoundingClientRect();
            const bounds = frame.getBoundingClientRect();
            pic.style.transform = transform;
            if(!image.width || !image.height || !bounds.width || !bounds.height)return;
            const inset = [image.top-bounds.top,bounds.right-image.right,bounds.bottom-image.bottom,image.left-bounds.left];
            frame.style.clipPath='inset('+inset.map(value => Math.max(0,value)+'px').join(' ')+' round '+radius+')';
          };
          syncClip();
          if('ResizeObserver' in window){
            const observer = new ResizeObserver(syncClip);
            observer.observe(pic);
            observer.observe(frame);
          }
        }
      }
      pic.classList.add('dm-parallax-picture');
      stats.imageParallax++;return true;
    }
    if(el.classList.contains('dm-section-parallax')){
      var shell=Array.from(el.children).find(function(child){return child.matches('.l-section-h,.vc_column_container,.wpb_column,.vc_row') && !child.classList.contains('dm-bg-layer');});
      if(!shell){shell=Array.from(el.children).find(function(child){return !child.classList.contains('dm-bg-layer') && !child.classList.contains('l-section-img');});}
      if(!shell)return false;
      shell.classList.add('dm-section-motion-content');el._dmSectionContent=shell;
      stats.sectionParallax++;return true;
    }
    return true;
  }
  function init(root){
    if(!root||!root.querySelectorAll)return;
    var selector='.dm-reveal,.dm-lines,.dm-words,.dm-stagger,.dm-image,.dm-parallax,.dm-image-parallax,.dm-organic-parallax,.dm-section-parallax,.dm-float,.dm-bg-reveal,.dm-bg-parallax';
    var elements=Array.from(root.querySelectorAll(selector));if(root.matches&&root.matches(selector))elements.unshift(root);
    elements.forEach(function(el){
      if(observed.has(el))return;observed.add(el);stats.initialized++;
      el.style.setProperty('--dm-time',setting(el,'duration',number(cfg.duration,900,2400),2400)+'ms');
      el.style.setProperty('--dm-travel',setting(el,'distance',number(cfg.distance,36,120),120)+'px');
      if(el.classList.contains('dm-words')&&!splitWords(el)){el.classList.remove('dm-words');el.classList.add('dm-reveal');}
      if(el.classList.contains('dm-lines')&&!splitLines(el)){el.classList.remove('dm-lines');el.classList.add('dm-reveal');}
      if(el.classList.contains('dm-stagger')&&!staggerChildren(el)){el.classList.remove('dm-stagger');el.classList.add('dm-reveal');}
      if(el.classList.contains('dm-image'))stats.images++;
      if(el.matches('.dm-bg-reveal,.dm-bg-parallax')){
        if(!prepareBackground(el)){el.classList.remove('dm-bg-reveal','dm-bg-parallax');}
      }
      if(el.matches('.dm-parallax,.dm-image-parallax,.dm-organic-parallax,.dm-section-parallax,.dm-bg-parallax')){
        if(prepareParallax(el)){parallax.add(el);stats.parallax++;if(el.classList.contains('dm-bg-parallax'))stats.backgroundParallax++;}
      }
      if(reduceMotion){reveal(el);return;}
      el.classList.add('dm-ready');
      if(el.matches('.dm-reveal,.dm-lines,.dm-words,.dm-stagger,.dm-image,.dm-bg-reveal')){
        var isImage=el.matches('.dm-image,.dm-bg-reveal');
        var trigger=setting(el,'trigger',number(isImage?cfg.imageTrigger:cfg.textTrigger,isImage?45:97,95),95);
        var obs=revealObserver(trigger);
        if(obs)obs.observe(el);else reveal(el);
      }
    });
  }
  // Scroll colour flow: only background-color changes, never the row's position,
  // clipping or transform. Adjacent rows are painted the SAME interpolated colour
  // while their shared boundary traverses the viewport, avoiding hard colour seams.
  var colorRows=[];
  var lastColourValues=new WeakMap();
  function validHex(value){return /^#[0-9a-f]{6}$/i.test(value||'')?value.toUpperCase():null;}
  function hexRgb(hex){return [1,3,5].map(function(i){return parseInt(hex.slice(i,i+2),16);});}
  function blendHex(a,b,t){
    var aa=hexRgb(a),bb=hexRgb(b);
    return '#'+aa.map(function(v,i){return Math.round(v+(bb[i]-v)*t).toString(16).padStart(2,'0');}).join('').toUpperCase();
  }
  function rowColor(el){
    var custom=validHex(el.getAttribute('data-dm-color'));
    if(custom)return custom;
    var palette=cfg.colors||{};
    var names=['cream','orange','green','pink','ink'];
    for(var i=0;i<names.length;i++)if(el.classList.contains('dm-color-'+names[i]))return validHex(palette[names[i]]);
    return null;
  }
  function sameFlowGroup(a,b){
    // Do not blend across unrelated rows, image sections or content wrappers.
    // Impreza puts full-width page rows beside each other as .l-section siblings.
    if(a.parentElement===b.parentElement){
      return a.nextElementSibling===b;
    }
    var aa=a.closest('.l-section,.vc_row,.wpb_row');
    var bb=b.closest('.l-section,.vc_row,.wpb_row');
    return !!(aa&&bb&&aa!==bb&&aa.parentElement===bb.parentElement&&aa.nextElementSibling===bb);
  }
  function paintColour(el,color){
    if(lastColourValues.get(el)===color)return;
    el.style.setProperty('background-color',color,'important');
    lastColourValues.set(el,color);
  }
  function initColours(){
    if(!cfg.colorEnabled)return;
    colorRows=Array.from(document.querySelectorAll('.dm-color-flow')).map(function(el){return {el:el,color:rowColor(el)};}).filter(function(x){return !!x.color;});
    stats.colorSections=colorRows.length;
    colorRows.forEach(function(row){paintColour(row.el,row.color);});
  }
  // The footer may have a transparent/white outer Impreza wrapper even when
  // the visible inner footer background is Ink. Do not infer a colour from that
  // wrapper or repaint it: only animate the preceding page row toward Ink.
  function footerInfo(){
    var node=document.querySelector('.l-footer, footer.site-footer, footer#colophon, footer');
    return node ? {node:node} : null;
  }
  function footerTarget(last){
    return validHex(last.el.getAttribute('data-dm-footer-color'))
      || validHex((cfg.colors||{}).ink) || '#25231F';
  }
  function updateColours(){
    if(!colorRows.length)return;
    if(reduceMotion){colorRows.forEach(function(row){paintColour(row.el,row.color);});stats.colorTransitions=0;return;}
    var viewport=window.innerHeight||1;
    var position=number(cfg.colorPosition,55,85)/100*viewport;
    var softness=cfg.colorSoftness||'balanced';
    var span=viewport*(softness==='tight'?.30:softness==='atmospheric'?1.05:.65);
    var half=span/2;
    var output=colorRows.map(function(row){return row.color;});
    var priority=colorRows.map(function(){return Infinity;});
    var active=0;
    // Evaluate each shared section boundary in viewport coordinates. Each row
    // accepts the colour of its nearest boundary only. This eliminates the
    // previous last-pair-wins flicker with short adjacent WPBakery rows.
    for(var i=0;i<colorRows.length-1;i++){
      var a=colorRows[i],b=colorRows[i+1];
      // A break on the destination row blocks only the incoming blend.
      // That row may still blend towards the next row (cream -> pink).
      if(b.el.classList.contains('dm-color-break'))continue;
      if(!sameFlowGroup(a.el,b.el))continue;
      var boundary=b.el.getBoundingClientRect().top;
      if(boundary>viewport+half||boundary< -half)continue;
      var t=Math.max(0,Math.min(1,(position+half-boundary)/span));
      if(cfg.colorEasing==='smooth')t=t*t*(3-2*t);
      var mixed=blendHex(a.color,b.color,t);
      var distance=Math.abs(boundary-position);
      if(distance<priority[i]){priority[i]=distance;output[i]=mixed;}
      if(distance<priority[i+1]){priority[i+1]=distance;output[i+1]=mixed;}
      if(t>0&&t<1)active++;
    }
    // Opt-in blend only the FINAL COLOURED ROW toward the explicitly defined
    // ink colour. The footer's own background remains untouched in Impreza.
    var last=colorRows[colorRows.length-1];
    if(last&&last.el.classList.contains('dm-color-to-footer')){
      var foot=footerInfo();
      if(foot){
        var boundary=foot.node.getBoundingClientRect().top;
        var ft=Math.max(0,Math.min(1,(position+half-boundary)/span));
        if(cfg.colorEasing==='smooth')ft=ft*ft*(3-2*ft);
        if(boundary<=viewport+half && boundary>=-half){
          var lastIndex=colorRows.length-1;
          var mix=blendHex(last.color,footerTarget(last),ft);
          if(Math.abs(boundary-position)<priority[lastIndex])output[lastIndex]=mix;
          if(ft>0&&ft<1)active++;
        }
      }
    }
    colorRows.forEach(function(row,i){paintColour(row.el,output[i]);});
    stats.colorTransitions=active;
  }
  var ticking=false;
  function easingAmount(mode){
    var preset=(cfg.easing&&cfg.easing[mode])||'soft';
    return preset==='direct'?1:preset==='cinematic'?.075:.18;
  }
  let seed = 314159;
  const organicNoise = window.OrganicMotionNoise?.createNoise2D(() => {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  let organicImages = 0;
  const organicProgress = new WeakMap();

  function applyParallax(el,mode,y,travel,progress){
    let value = y;
    if(!el._dmOrganicSeed){
      const previous = easedOffsets.get(el) ?? y;
      value = previous+(y-previous)*easingAmount(mode);
      if(Math.abs(y-value)<.15)value=y;
      easedOffsets.set(el,value);
      if(value!==y)easingActive=true;
    }
    if(mode==='section'){
      if(el._dmSectionContent)el.style.setProperty('--dm-y',value.toFixed(2)+'px');
    } else if(mode==='background'){
      if(el._dmBgLayer){
        el._dmBgLayer.style.backgroundPositionY=positionOffset(el._dmBgBasePositionY,value);
        var overscan=setting(el,'bg-overscan',number(cfg.backgroundOverscan,8,30),30);
        el._dmBgLayer.style.transform=overscan>0?'scale('+(1+overscan/100)+')':'none';
      }
    } else if(mode==='image'){
      if(el._dmImage){
        var imageHeight=Math.max(1,el.getBoundingClientRect().height);
        var scale=1+(travel+28)/imageHeight;
        if(el._dmOrganicSeed){
          const easing = cfg.organicEasing || 'editorial';
          const previous = organicProgress.get(el) || {position:progress,velocity:0};
          const difference = progress-previous.position;
          let position = progress;
          let velocity = 0;
          if(easing==='bubble'){
            velocity = (previous.velocity+difference*.12)*.76;
            position = previous.position+velocity;
            // Bound the overshoot even after a fast scroll jump.
            position = Math.max(-.08,Math.min(1.08,position));
          } else if(easing==='editorial'){
            position = previous.position+difference*.18;
          }
          if(Math.abs(progress-position)<.001 && Math.abs(velocity)<.001){
            position=progress;
            velocity=0;
          }
          organicProgress.set(el,{position,velocity});
          if(position!==progress || velocity!==0)easingActive=true;

          const sample = position*1.35;
          const seed = el._dmOrganicSeed;
          const intensity = number(cfg.organicIntensity,100,200)/100;
          const x = organicNoise(sample,seed)*7*intensity;
          value = (position-.5)*travel+organicNoise(sample,seed+4)*6*intensity;
          const zoom = (1+organicNoise(sample,seed+8))*.014*intensity;
          const width = Math.max(1,el._dmImage.offsetWidth);
          const height = Math.max(1,el._dmImage.offsetHeight);
          scale = Math.max(scale,1+2*(Math.abs(x)+1)/width,1+2*(Math.abs(value)+1)/height)+zoom;
          el.style.setProperty('--dm-x',x.toFixed(2)+'px');
        }
        el.style.setProperty('--dm-parallax-scale',String(scale));
        el.style.setProperty('--dm-y',value.toFixed(2)+'px');
      }
    } else el.style.setProperty('--dm-y',value.toFixed(2)+'px');
  }
  function updateParallax(){
    ticking=false;easingActive=false;updateColours();if(reduceMotion)return;
    var h=window.innerHeight||1;
    parallax.forEach(function(el){
      var rect=el.getBoundingClientRect();
      if(rect.bottom<0||rect.top>h)return;
      var progress=Math.max(0,Math.min(1,(h-rect.top)/(h+rect.height)));
      var mode=el.classList.contains('dm-bg-parallax')?'background':el.classList.contains('dm-section-parallax')?'section':el.classList.contains('dm-image-parallax')?'image':'legacy';
      var defaults={background:number(cfg.backgroundParallax,45,150),image:number(cfg.imageParallax,35,150),section:number(cfg.sectionParallax,20,80),legacy:number(cfg.parallax,60,150)};
      var travel=setting(el,'parallax',el._dmOrganicSeed ? number(cfg.organicParallax,35,150) : defaults[mode],mode==='section'?80:150);
      // Maximum motion is half the configured travel, centered around 0.
      var y=(progress-.5)*travel;
      if(mode==='section')y*=Math.sin(Math.PI*progress);
      applyParallax(el,mode,y,travel,progress);
    });
    if(easingActive)schedule();
  }
  function schedule(){if(!ticking){ticking=true;window.requestAnimationFrame(updateParallax);}}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',function(){
    document.querySelectorAll('.dm-bg-reveal,.dm-bg-parallax').forEach(syncBackgroundLayout);
    schedule();
  });
  // Lenis controls the browser scroll position without translating page wrappers.
  // This preserves WPBakery row edges, native sticky labels, and CSS positions.
  // Keep native scroll if the library is blocked, another Lenis instance exists,
  // reduced-motion is requested, touch/mobile, or editor mode is active.
  var lenisInstance=null;
  var smoothReason='not initialized';
  function initSmoothScroll(){
    if(!cfg.scrollEnabled){smoothReason='Disabled in Organic Motion settings';return;}
    if(reduceMotion){smoothReason='Reduced motion preference';return;}
    if(typeof window.Lenis!=='function'){smoothReason='Lenis script did not load (check CDN/security/cache)';return;}
    if(window.__fermLenis||window.lenis){smoothReason='Another smooth scrolling instance detected';return;}
    // wpb-js-composer is added to PUBLISHED WPBakery pages too; it is NOT editor mode.
    // Only disable inside an actual WPBakery frontend editor session.
    if(document.body.classList.contains('vc_editor')||document.body.classList.contains('vc_inline')||document.documentElement.classList.contains('vc_editor')){
      smoothReason='WPBakery frontend editor';return;
    }
    if(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches){smoothReason='Touchscreen/coarse pointer: native scrolling';return;}
    try{
      var lerp=Math.min(.22,Math.max(.04,number(cfg.scrollSmoothing,10,22)/100));
      var wheel=Math.min(1.4,Math.max(.5,number(cfg.scrollWheel,85,140)/100));
      var focusElements=Array.from(document.querySelectorAll('.dm-scroll-focus'));
      lenisInstance=new window.Lenis({
        lerp:lerp,wheelMultiplier:wheel,smoothWheel:true,syncTouch:false,autoRaf:false,
        prevent:function(node){
          return !!(node && node.closest && node.closest('[data-lenis-prevent],.dm-slider,.wp-block-embed iframe,.modal,[role="dialog"]'));
        },
        virtualScroll:function(input){
          if(cfg.scrollFocus==='off'||!focusElements.length||!input||!input.event)return true;
          var event=input.event;
          if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return true;
          if(Math.abs(input.deltaX)>Math.abs(input.deltaY)*.4)return true;
          var h=window.innerHeight||1;
          var nearest=Infinity;
          focusElements.forEach(function(el){
            var r=el.getBoundingClientRect();
            if(r.bottom<0||r.top>h)return;
            var edge=input.deltaY>0?r.top:r.bottom;
            nearest=Math.min(nearest,Math.abs(edge-h*.55));
          });
          var range=Math.min(h*.55,420);
          if(nearest>=range)return true;
          var v=1-nearest/range;
          var softened=v*v*(3-2*v);
          var resistance=cfg.scrollFocus==='defined'?.30:.14;
          input.deltaY*=1-softened*resistance;
          return true;
        }
      });
      window.__fermLenis=lenisInstance;
      smoothReason='active';
      lenisInstance.on('scroll',function(){schedule();});
      function frame(time){
        if(window.__fermLenis!==lenisInstance)return;
        lenisInstance.raf(time);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      window.addEventListener('pagehide',function(){
        if(lenisInstance){lenisInstance.destroy();if(window.__fermLenis===lenisInstance)window.__fermLenis=null;lenisInstance=null;}
      },{once:true});
    }catch(error){
      smoothReason='Initialization error: '+(error&&error.message||String(error));
      if(window.console&&console.warn)console.warn('[Organic Motion] Smooth scroll unavailable; using native scrolling.',error);
    }
  }
  function start(){init(document);initColours();initSmoothScroll();schedule();}
  window.FERMMotion={refresh:function(root){init(root||document);initColours();schedule();},diagnostics:function(){return Object.assign({version:'1.8.2',smoothScroll:!!lenisInstance,scrollReason:smoothReason,lenisLoaded:typeof window.Lenis==='function',wpbakeryBodyClass:document.body.classList.contains('wpb-js-composer'),scrollConfigured:!!cfg.scrollEnabled,scrollFocus:cfg.scrollFocus||'off',reducedMotion:!!reduceMotion,imageTrigger:cfg.imageTrigger||45,colorEnabled:!!cfg.colorEnabled},stats);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
