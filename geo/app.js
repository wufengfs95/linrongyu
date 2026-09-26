/* 桃園地理王：給一個車站、學校或地標，在衛星地圖（國土測繪中心正射影像，沒有路名）上點出位置。
   5 題一局；距離 300 公尺內 200 分，10 公里以上 0 分，中間線性。題庫是 build.py 產生的 geo/places.json */
(function(){
  var RT=window.RT, GM=window.GM, $=RT.$, esc=RT.esc, L=window.L;
  var N=5, FULL=.3, ZERO=10, BOUNDS=[[24.83,121.02],[25.12,121.42]];   // 題目集中在平地，復興山區不出題
  var places=[], towns=[], qs=[], idx=0, score=0, log=[], map, pin, answer, line, last=0, state='idle';

  function km(a,b){   // 兩點直線距離（公里）
    var R=6371, r=Math.PI/180, dLat=(b[0]-a[0])*r, dLng=(b[1]-a[1])*r;
    var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2*R*Math.asin(Math.sqrt(h));
  }
  function pts(d){ return d<=FULL?200:Math.max(0,Math.round(200*(1-(d-FULL)/(ZERO-FULL)))); }
  function dist(d){ return d<1?Math.round(d*1000)+' 公尺':d.toFixed(1)+' 公里'; }
  function icon(cls,txt){ return L.divIcon({className:'ge-pin '+cls,html:'<span>'+(txt||'')+'</span>',iconSize:[28,28],iconAnchor:[14,28]}); }

  function initMap(){
    map=L.map('geMap',{zoomControl:true,attributionControl:true,minZoom:10,maxZoom:18,maxBounds:[[24.55,120.85],[25.3,121.6]]});
    L.tileLayer('https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}',{maxZoom:18,attribution:'影像 © 內政部國土測繪中心'}).addTo(map);
    towns.forEach(function(t){   // 只標行政區名，當作方向感的提示
      L.marker([t[1],t[2]],{interactive:false,keyboard:false,icon:L.divIcon({className:'ge-town',html:t[0],iconSize:[64,22],iconAnchor:[32,11]})}).addTo(map);
    });
    map.on('click',function(e){
      if(state!=='play') return;
      if(pin) pin.setLatLng(e.latlng); else pin=L.marker(e.latlng,{icon:icon('me','你')}).addTo(map);
      $('geOk').disabled=false; $('geWhy').textContent='確定的話按「就是這裡！」，也可以再點別的地方';
    });
  }
  function clear(){ [pin,answer,line].forEach(function(x){ if(x) map.removeLayer(x); }); pin=answer=line=null; }

  // 一局 5 題：車站或地標 2 題、中壢平鎮的學校 2 題、其他隨機 1 題，不重複
  function pickRound(){
    var P=GM.shuffle(places.slice()), out=[];
    function take(f,n){ P.filter(f).slice(0,n).forEach(function(p){ if(out.indexOf(p)<0) out.push(p); }); }
    take(function(p){return /台鐵|機場捷運|地標/.test(p[1])},2);
    take(function(p){return /國小|國中/.test(p[1])&&/中壢|平鎮/.test(p[4])&&out.indexOf(p)<0},2);
    take(function(p){return out.indexOf(p)<0},N-out.length);
    return GM.shuffle(out);
  }
  function start(){
    qs=pickRound(); idx=0; score=0; log=[];
    $('geScore').textContent=0; $('geStart').hidden=true; $('gePlay').hidden=false; $('geResult').hidden=true;
    if(!map) initMap(); else map.invalidateSize();
    ask();
  }
  function ask(){
    var q=qs[idx]; clear(); state='play';
    map.fitBounds(BOUNDS); map.invalidateSize();
    $('geNo').textContent=idx+1; $('geBar').style.transform='scaleX('+idx/N+')';
    $('geCat').textContent=q[1]; $('geName').textContent=q[0]+(/國小|國中/.test(q[1])?'（'+q[4]+'）':'');
    $('geWhy').className='gm-why'; $('geWhy').textContent='點地圖放上圖釘，可以放大、拖曳';
    $('geOk').hidden=false; $('geOk').disabled=true; $('geNext').hidden=true;
  }
  function confirm(){
    if(state!=='play'||!pin) return; state='reveal';
    var q=qs[idx], ll=pin.getLatLng(), d=km([ll.lat,ll.lng],[q[2],q[3]]), p=pts(d);
    score+=p; log.push({q:q,d:d,p:p}); $('geScore').textContent=score; $('geBar').style.transform='scaleX('+(idx+1)/N+')';
    $('geScore').classList.remove('gm-pop'); void $('geScore').offsetWidth; $('geScore').classList.add('gm-pop');
    answer=L.marker([q[2],q[3]],{icon:icon('ans','✓')}).addTo(map).bindTooltip(esc(q[0]),{permanent:true,direction:'top',offset:[0,-26],className:'ge-tip'});
    line=L.polyline([ll,[q[2],q[3]]],{color:'#fff',weight:3,dashArray:'6 6'}).addTo(map);
    map.fitBounds(L.latLngBounds([ll,[q[2],q[3]]]).pad(.6),{maxZoom:15});
    $('geWhy').className='gm-why '+(p>=120?'ok':'no');
    $('geWhy').textContent=(p===200?'神準！':p>=120?'很接近！':p>0?'有點遠，':'差很遠！')+'差 '+dist(d)+'，得 '+p+' 分';
    $('geOk').hidden=true; $('geNext').hidden=false; $('geNext').textContent=idx+1<N?'下一題 →':'看成績'; $('geNext').focus({preventScroll:true});
  }
  function next(){ idx++; if(idx<N) ask(); else end(); }
  function end(){
    state='over'; last=score; $('gePlay').hidden=true; $('geStart').hidden=false; $('geGo').textContent='再玩一局';
    var mine=GM.board({game:'geo',score:score||null,asc:false,unit:' 分',rank:$('geRank'),top:$('geTop')});
    $('geHead').innerHTML='<b>'+score+'</b> 分<small>滿分 1,000・'+
      (score>=800?'桃園活地圖就是你！':score>=500?'很熟桃園喔，再玩幾局衝高分':'桃園比想像中大吧，多玩幾次就熟了')+
      (mine.better&&mine.n>1?'・刷新你的本週最佳':'')+'</small>';
    $('geExtra').innerHTML='<ul class="gm-rounds">'+log.map(function(x){
      return '<li><span>'+esc(x.q[0])+'</span><span>差 '+dist(x.d)+'・<b>'+x.p+'</b> 分</span></li>'}).join('')+'</ul>';
    $('geCta').innerHTML='想知道某個地址的學區、附近車站和生活機能？<a href="../school-map/">學區・機能地圖 →</a><br>在中壢、平鎮找房子，<a href="https://line.me/ti/p/~0973263569" target="_blank" rel="noopener">LINE 容瑜</a>帶你實地看。';
    $('geResult').hidden=false;
    setTimeout(function(){ $('geResult').scrollIntoView({behavior:'smooth',block:'start'}); },100);
  }

  $('geOk').addEventListener('click',confirm);
  $('geNext').addEventListener('click',next);
  $('geGo').addEventListener('click',function(){ start(); $('gePlay').scrollIntoView({behavior:'smooth',block:'start'}); });
  $('geAgain').addEventListener('click',function(){ start(); $('gePlay').scrollIntoView({behavior:'smooth',block:'start'}); });
  $('geShare').addEventListener('click',function(){
    GM.share(last?'桃園地理王我拿了 '+last+' 分（滿分 1,000）！你有多熟桃園？📍':'在衛星地圖上找桃園的車站、學校，比想像中難！你來試試 📍',$('geToast'));
  });

  if(!L){ $('geGo').textContent='地圖載入失敗，請重新整理'; return; }
  fetch('places.json?v='+(document.currentScript&&document.currentScript.getAttribute('data-v')||''))
    .then(function(r){return r.json()}).then(function(d){
      places=d.places; towns=d.towns; if(places.length<N) throw 0;
      $('geGo').disabled=false; $('geGo').textContent='開始找';
    }).catch(function(){ $('geGo').textContent='資料載入失敗，請重新整理'; });
})();
