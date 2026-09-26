/* 10 秒找亮點：同一張物件照片，右邊（手機是下面）被程式偷改 3 個地方，10 秒內全部點到就過關。
   照片來自網站上架物件（photos.json 由 build.py 產生），不同處每局隨機產生，所以可以一直重玩。
   排行榜用房產遊戲室共用的 assets/game.js（GM.board）。 */
(function(){
  var RT=window.RT, GM=window.GM, $=RT.$, esc=RT.esc;
  var LIMIT=10, PENALTY=1, N=3, W=720;   // 秒數、點錯扣秒、不同處數量、運算用寬度
  var played=0, last=null;   // 這次打開頁面玩了幾局、上一局秒數（分享用）

  var photos=[], deck=[], cur=null, diffs=[], found=0, t0=0, extra=0, raf=0, state='idle';
  var cvA=$('spA'), cvB=$('spB'), ctxA=cvA.getContext('2d'), ctxB=cvB.getContext('2d');

  function sec(t){ return t.toFixed(2); }

  // ---------- 產生不同處 ----------
  function energyGrid(data,w,h,cell){   // 每一格的邊緣強度：挑有東西的地方改，改在白牆上太難找也不公平
    var gw=Math.floor(w/cell), gh=Math.floor(h/cell), g=[];
    for(var gy=0;gy<gh;gy++) for(var gx=0;gx<gw;gx++){
      var s=0;
      for(var y=gy*cell+1;y<(gy+1)*cell-1;y+=2) for(var x=gx*cell+1;x<(gx+1)*cell-1;x+=2){
        var i=(y*w+x)*4, j=i+4, k=i+w*4;
        var l=data[i]+data[i+1]+data[i+2];
        s+=Math.abs(l-data[j]-data[j+1]-data[j+2])+Math.abs(l-data[k]-data[k+1]-data[k+2]);
      }
      g.push({x:(gx+.5)*cell,y:(gy+.5)*cell,e:s});
    }
    return g;
  }
  function pickSpots(g,w,h,r){
    var m=r*1.15, c=g.filter(function(p){return p.x>m&&p.x<w-m&&p.y>m&&p.y<h-m});
    c.sort(function(a,b){return b.e-a.e}); c=c.slice(0,Math.max(12,Math.floor(c.length*.45)));
    for(var tries=0;tries<60;tries++){
      var pool=c.slice(), out=[];
      while(pool.length&&out.length<N){
        var p=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
        if(out.every(function(q){return Math.hypot(p.x-q.x,p.y-q.y)>r*2.6})) out.push(p);
      }
      if(out.length===N) return out;
    }
    return null;
  }
  // 圓形區域、邊緣柔化，逐像素套用 fn(r,g,b,x,y) → [r,g,b]
  function patch(img,w,cx,cy,r,fn){
    var d=img.data, x0=Math.max(0,Math.floor(cx-r)), x1=Math.min(w-1,Math.ceil(cx+r)), h=d.length/4/w,
        y0=Math.max(0,Math.floor(cy-r)), y1=Math.min(h-1,Math.ceil(cy+r)), src=new Uint8ClampedArray(d);
    for(var y=y0;y<=y1;y++) for(var x=x0;x<=x1;x++){
      var dist=Math.hypot(x-cx,y-cy); if(dist>r) continue;
      var a=Math.min(1,(r-dist)/(r*.25)), i=(y*w+x)*4, v=fn(src,x,y,i);
      d[i]=d[i]*(1-a)+v[0]*a; d[i+1]=d[i+1]*(1-a)+v[1]*a; d[i+2]=d[i+2]*(1-a)+v[2]*a;
    }
  }
  var KINDS={
    color:function(img,w,p,r){ var sw=Math.random()<.5; patch(img,w,p.x,p.y,r,function(s,x,y,i){ return sw?[s[i+2],s[i],s[i+1]]:[s[i+1],s[i+2],s[i]]; }); },
    mirror:function(img,w,p,r){ patch(img,w,p.x,p.y,r,function(s,x,y){ var mx=Math.round(2*p.x-x), j=(y*w+mx)*4; return [s[j],s[j+1],s[j+2]]; }); },
    flip:function(img,w,p,r){ patch(img,w,p.x,p.y,r,function(s,x,y){ var my=Math.round(2*p.y-y), j=(my*w+x)*4; return [s[j],s[j+1],s[j+2]]; }); },
    shade:function(img,w,p,r){ var k=Math.random()<.5?.5:1.45; patch(img,w,p.x,p.y,r,function(s,x,y,i){ return [s[i]*k,s[i+1]*k,s[i+2]*k]; }); },
    clone:function(img,w,p,r){   // 從旁邊搬一塊蓋過去：東西「不見了」
      var h=img.data.length/4/w, ang=Math.random()*Math.PI*2, dx=0, dy=0;
      for(var t=0;t<12;t++){ dx=Math.round(Math.cos(ang+t)*r*2.2); dy=Math.round(Math.sin(ang+t)*r*2.2);
        if(p.x+dx>r&&p.x+dx<w-r&&p.y+dy>r&&p.y+dy<h-r) break; }
      patch(img,w,p.x,p.y,r,function(s,x,y){ var j=((y+dy)*w+x+dx)*4; return [s[j],s[j+1],s[j+2]]; });
    }
  };

  function change(x,y,w,p,r){   // 圓裡面平均每個像素變了多少（RGB 差的總和）
    var s=0,n=0;
    for(var yy=Math.round(p.y-r*.7);yy<p.y+r*.7;yy+=2) for(var xx=Math.round(p.x-r*.7);xx<p.x+r*.7;xx+=2){
      var i=(yy*w+xx)*4; s+=Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2]); n++; }
    return s/n;
  }
  function build(im){   // 在畫面外的畫布上做好一局：{a 原圖, b 改過的, diffs}
    var w=W, h=Math.round(im.naturalHeight/im.naturalWidth*W), a=document.createElement('canvas'), b=document.createElement('canvas');
    a.width=b.width=w; a.height=b.height=h;
    var ca=a.getContext('2d'); ca.drawImage(im,0,0,w,h);
    var img=ca.getImageData(0,0,w,h), r=Math.round(w*.062);
    var spots=pickSpots(energyGrid(img.data,w,h,Math.round(r*.9)),w,h,r);
    if(!spots) return null;
    // 每一處都要改得夠明顯：鏡射剛好對稱、搬過來的一塊跟原本很像，就換別種改法
    var kinds=Object.keys(KINDS).sort(function(){return Math.random()-.5}), used={};
    spots.forEach(function(p){
      var order=kinds.filter(function(k){return !used[k]}).concat(['color','shade']), before=new Uint8ClampedArray(img.data);
      for(var t=0;t<order.length;t++){
        img.data.set(before); KINDS[order[t]](img,w,p,r);
        if(change(before,img.data,w,p,r)>45){ used[order[t]]=1; break; }
      }
    });
    b.getContext('2d').putImageData(img,0,0);
    return {a:a,b:b,diffs:spots.map(function(p){return {x:p.x,y:p.y,r:r,hit:false}})};
  }

  // ---------- 一局 ----------
  var pending=null, want=false;
  function nextPhoto(){
    if(!deck.length) deck=photos.slice().sort(function(){return Math.random()-.5});
    return deck.pop();
  }
  function prepare(tries){   // 背景先準備好下一局，按「再玩一次」就能馬上開始
    var ph=nextPhoto(); if(!ph) return;
    var im=new Image();
    im.onload=function(){ var R=build(im); if(!R) return tries<6&&prepare(tries+1);
      R.photo=ph; pending=R;
      if(state==='idle') show(); else if(want){ want=false; show(); start(); } };
    im.onerror=function(){ if(tries<6) prepare(tries+1); else msg('照片載入失敗，請重新整理再試一次。'); };
    im.src=ph.src;
  }
  function show(){
    var R=pending; pending=null; cur=R.photo; diffs=R.diffs;
    [[cvA,ctxA,R.a],[cvB,ctxB,R.b]].forEach(function(z){ z[0].width=z[2].width; z[0].height=z[2].height; z[1].drawImage(z[2],0,0); });
    state='ready'; found=0; extra=0;
    [].forEach.call(document.querySelectorAll('.sp-layer'),function(l){l.innerHTML=''});
    $('spBoard').classList.add('cover'); $('spBoard').classList.remove('over');
    $('spCover').hidden=false; $('spStart').disabled=false; $('spStart').textContent=played?'再挑戰一次':'開始（10 秒）';
    $('spBar').style.transform='scaleX(1)'; $('spTime').textContent=sec(LIMIT); renderDots();
    prepare(0);
  }
  function again(){
    $('spResult').hidden=true;
    if(pending){ show(); start(); } else { want=true; $('spCover').hidden=false; $('spStart').disabled=true; $('spStart').textContent='準備中…'; }
  }
  function start(){
    if(state!=='ready') return;
    state='play'; $('spCover').hidden=true; $('spBoard').classList.remove('cover');
    document.body.classList.add('sp-playing');
    var top=$('spBoard').getBoundingClientRect().top; if(top<60||top>innerHeight*.35) window.scrollTo({top:top+scrollY-(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gm-top'))||72)-$('spClock').parentNode.offsetHeight-10,behavior:'smooth'});
    t0=performance.now(); tick();
  }
  function elapsed(){ return (performance.now()-t0)/1000+extra; }
  function tick(){
    var e=elapsed(), left=Math.max(0,LIMIT-e);
    $('spTime').textContent=sec(left); $('spBar').style.transform='scaleX('+(left/LIMIT)+')';
    $('spClock').classList.toggle('hurry',left<3);
    if(left<=0) return end(false,LIMIT);
    raf=requestAnimationFrame(tick);
  }
  function renderDots(){ $('spDots').innerHTML=diffs.map(function(d){return '<i class="'+(d.hit?'on':'')+'"></i>'}).join(''); }
  function mark(d,cls){   // 在兩張圖上各畫一個圈（用百分比，縮放不跑位）
    [cvA,cvB].forEach(function(cv){
      var m=document.createElement('span'); m.className='sp-mark '+cls;
      m.style.cssText='left:'+(d.x/cv.width*100)+'%;top:'+(d.y/cv.height*100)+'%;width:'+(d.r*2.3/cv.width*100)+'%';
      cv.parentNode.querySelector('.sp-layer').appendChild(m);
    });
  }
  function tap(e){
    if(state!=='play') return;
    var cv=e.currentTarget, rc=cv.getBoundingClientRect(),
        x=(e.clientX-rc.left)/rc.width*cv.width, y=(e.clientY-rc.top)/rc.height*cv.height;
    var hit=diffs.filter(function(d){return !d.hit&&Math.hypot(d.x-x,d.y-y)<d.r*1.3})[0];
    if(hit){ hit.hit=true; found++; mark(hit,'ok'); renderDots(); if(navigator.vibrate) navigator.vibrate(30);
      if(found===N) end(true,elapsed()); return; }
    if(diffs.some(function(d){return d.hit&&Math.hypot(d.x-x,d.y-y)<d.r*1.3})) return;   // 點到已經找到的，不扣
    extra+=PENALTY;
    var b=document.createElement('span'); b.className='sp-miss'; b.textContent='−1 秒';
    b.style.left=(x/cv.width*100)+'%'; b.style.top=(y/cv.height*100)+'%';
    cv.parentNode.querySelector('.sp-layer').appendChild(b); setTimeout(function(){b.remove()},700);
    $('spClock').classList.remove('shake'); void $('spClock').offsetWidth; $('spClock').classList.add('shake');
  }
  function end(win,t){
    cancelAnimationFrame(raf); state='over'; document.body.classList.remove('sp-playing'); $('spTime').textContent=sec(Math.max(0,LIMIT-t)); $('spBar').style.transform='scaleX('+Math.max(0,1-t/LIMIT)+')'; $('spBoard').classList.add('over');
    diffs.forEach(function(d){ if(!d.hit) mark(d,'miss'); });
    played++; last=win?Math.round(t*100)/100:null;
    var mine=GM.board({game:'spot',score:last,asc:true,fmt:sec,unit:' 秒',rank:$('spRank'),top:$('spTop')});
    $('spResult').hidden=false;
    $('spHead').innerHTML=win?'<b>'+sec(t)+'</b> 秒找到 3 個亮點！'+(mine.better&&mine.n>1?'<small>刷新你的本週最佳</small>':'')
                              :'時間到！找到 <b>'+found+'</b> / 3 個<small>紅圈是漏掉的地方</small>';
    $('spHouse').innerHTML=cur.s?'這張是 <a href="../listings/'+esc(cur.s)+'/">'+esc(cur.t)+'</a>，正在賣喔 →':'';
    $('spAgain').focus({preventScroll:true});
    setTimeout(function(){ var r=$('spResult').getBoundingClientRect(); if(r.bottom>innerHeight) window.scrollBy({top:Math.min(r.top-120,r.bottom-innerHeight+16),behavior:'smooth'}); },900);   // 先讓人看一下紅綠圈，再捲到成績
  }

  function msg(s){ $('spCover').hidden=false; $('spCoverText').innerHTML=s; $('spStart').hidden=true; }

  // ---------- 綁定 ----------
  [cvA,cvB].forEach(function(cv){ cv.addEventListener('pointerdown',tap); });
  $('spStart').addEventListener('click',start);
  $('spAgain').addEventListener('click',again);
  $('spShare').addEventListener('click',function(){
    GM.share(last?'我 '+sec(last)+' 秒就找到 3 個不同，你能比我快嗎？👀':'10 秒找 3 個不同，我差一點點！換你試試 👀',$('spToast'));
  });

  fetch('photos.json?v='+(document.currentScript&&document.currentScript.getAttribute('data-v')||''))
    .then(function(r){return r.json()}).then(function(list){
      list.forEach(function(L){ L.i.forEach(function(src){ photos.push({s:L.s,t:L.t,src:'../listings/'+L.s+'/'+src}); }); });
      if(!photos.length) return msg('目前沒有可以玩的照片，過幾天再來看看！');
      prepare(0);
    }).catch(function(){ msg('照片清單載入失敗，請重新整理再試一次。'); });
})();
