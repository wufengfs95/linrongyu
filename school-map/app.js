(function(){
  var LINE_URL='https://line.me/ti/p/~0973263569';
  var lv='es', data=null, map, layers={}, schoolLayer, selected=null, marker=null;
  var $=function(id){return document.getElementById(id)};
  var LV={es:'國小',jh:'國中'};

  // 每所學校一個顏色（黃金角分散色相，相鄰學校比較不會撞色）
  var color=function(sid){return 'hsl('+Math.round((sid*137.508)%360)+',58%,52%)'};
  var tel=function(t){t=(t||'').replace(/\D/g,''); return t?(t.length<=8?'03-'+t:t):''};
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};

  function assignOf(vid,level){return ((data.assign[vid]||{})[level])||[]}
  function kind(vid,level){
    var a=assignOf(vid,level); if(!a.length) return 'none';
    var ids={}; a.forEach(function(r){ids[r[0]]=1});
    if(Object.keys(ids).length===1 && !a[0][1] && !a[0][2]) return 'basic';
    return 'split';
  }
  function primary(vid,level){
    var a=assignOf(vid,level), p=a.filter(function(r){return !r[2]})[0]||a[0];
    return p?p[0]:null;
  }
  function styleOf(vid){
    var k=kind(vid,lv), sid=primary(vid,lv), base={weight:1,color:'#ffffff',opacity:.9};
    if(k==='none') return Object.assign(base,{fillColor:'#cccccc',fillOpacity:.15});
    if(k==='basic') return Object.assign(base,{fillColor:color(sid),fillOpacity:.45});
    return Object.assign(base,{fillColor:color(sid),fillOpacity:.25,color:'#2B4344',weight:1.2,dashArray:'4 4'});
  }
  function restyle(){
    Object.keys(layers).forEach(function(vid){
      layers[vid].setStyle(styleOf(vid));
      if(selected===+vid) layers[vid].setStyle({weight:4,color:'#1F2E2F',dashArray:null,opacity:1});
    });
    drawSchools();
  }

  // 點在不在多邊形裡（處理多塊、內洞）
  function inside(lat,lng,polys){
    var hit=false;
    polys.forEach(function(poly){poly.forEach(function(ring){
      for(var i=0,j=ring.length-1;i<ring.length;j=i++){
        var yi=ring[i][0],xi=ring[i][1],yj=ring[j][0],xj=ring[j][1];
        if((yi>lat)!==(yj>lat) && lng<(xj-xi)*(lat-yi)/(yj-yi)+xi) hit=!hit;
      }
    })});
    return hit;
  }
  function villageAt(lat,lng){
    for(var k=0;k<data.villages.length;k++){ if(inside(lat,lng,data.villages[k].p)) return data.villages[k]; }
    return null;
  }

  function schoolList(v,level){
    var a=assignOf(v.id,level), groups={}, order=[];
    a.forEach(function(r){ if(!groups[r[0]]){groups[r[0]]=[];order.push(r[0]);} groups[r[0]].push(r); });
    if(!order.length) return '<p class="sm-empty">查不到，請以官方公告為準。</p>';
    return '<ul class="sm-schools">'+order.map(function(sid){
      var s=data.schools[sid], rows=groups[sid];
      var notes=rows.map(function(r){
        var t=r[1]?('第 '+esc(r[1])+' 鄰'):'全里';
        if(r[1] && !/^[\d、\-～~，,\s]+$/.test(r[1])) t=esc(r[1]);
        return '<span class="'+(r[2]?'free':'')+'">'+(r[2]?'◎自由學區：':'')+t+'</span>';
      }).join('');
      return '<li><i style="background:'+color(sid)+'"></i><div><b>'+esc(s.t)+' '+esc(s.n)+'</b>'+
        (tel(s.tel)?'<a class="sm-tel" href="tel:'+tel(s.tel)+'">'+tel(s.tel)+'</a>':'')+
        '<div class="sm-lin">'+notes+'</div>'+
        (s.lat?'<button type="button" class="sm-fly" data-sid="'+sid+'">在地圖上看學校</button>':'')+'</div></li>';
    }).join('')+'</ul>';
  }

  function select(v,opts){
    opts=opts||{};
    if(selected!==null && layers[selected]) layers[selected].setStyle(styleOf(selected));
    selected=v.id;
    layers[v.id].setStyle({weight:4,color:'#1F2E2F',dashArray:null,opacity:1}).bringToFront();
    if(opts.fit!==false) map.fitBounds(layers[v.id].getBounds(),{maxZoom:16,padding:[30,30]});
    var k=kind(v.id,'es'), kj=kind(v.id,'jh');
    var tip=(k==='split'||kj==='split')?'<p class="sm-tip">這個里依「鄰」分校或有自由學區，請確認門牌在第幾鄰（戶口名簿或里辦公處可查）。</p>':'';
    var rm=((data.remarks||{})[v.t]||[]).filter(function(t){return t.indexOf(v.v)>=0});
    var msg='容瑜你好，我想了解'+v.t+v.v+'附近的房子（學區：'+(assignOf(v.id,'es').map(function(r){return data.schools[r[0]].n}).filter(function(x,i,a){return a.indexOf(x)===i}).join('、')||'—')+'）';
    $('smResult').innerHTML='<div class="sm-r-head"><b>'+esc(v.t)+' '+esc(v.v)+'</b>'+(opts.label?'<span>'+esc(opts.label)+'</span>':'')+'</div>'+
      '<h3>國小學區</h3>'+schoolList(v,'es')+'<h3>國中學區</h3>'+schoolList(v,'jh')+tip+
      (rm.length?'<div class="sm-remarks"><b>官方備註</b>'+rm.map(function(t){return '<p>'+esc(t)+'</p>'}).join('')+'</div>':'')+
      '<a class="btn btn-line sm-line" href="'+LINE_URL+'" target="_blank" rel="noopener" data-line-msg="'+esc(msg)+'" data-toast="smToast">LINE 問我這一區的房子</a>'+
      '<p class="toast" id="smToast" role="status"></p>';
    $('smResult').hidden=false;
    $('smTown').value=v.t; fillVillages(v.t); $('smVill').value=String(v.id);
    try{ history.replaceState(null,'','?v='+encodeURIComponent(v.t+v.v)); }catch(e){}
    if(window.innerWidth<900) $('smResult').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function drawSchools(){
    if(schoolLayer) schoolLayer.remove();
    if(!$('smSchools').checked || map.getZoom()<12) return;  // 全市比例下學校點太擠，放大才顯示
    schoolLayer=L.layerGroup();
    data.schools.forEach(function(s){
      if(s.lv!==lv||!s.lat) return;
      var m=L.circleMarker([s.lat,s.lng],{radius:6,color:'#fff',weight:2,fillColor:color(s.id),fillOpacity:1});
      m.bindTooltip(s.n+(s.ap?'（位置為概略）':''),{permanent:$('smLabels').checked,direction:'top',offset:[0,-6],className:'sm-label'});
      m.on('click',function(){ var v=villageAt(s.lat,s.lng); if(v) select(v,{fit:false,label:s.n}); });
      schoolLayer.addLayer(m);
    });
    schoolLayer.addTo(map);
  }

  function fillVillages(town){
    var vs=data.villages.filter(function(v){return v.t===town}).sort(function(a,b){return a.v.localeCompare(b.v,'zh-Hant')});
    $('smVill').innerHTML='<option value="">選擇里</option>'+vs.map(function(v){return '<option value="'+v.id+'">'+v.v+'</option>'}).join('');
  }

  function status(t){ $('smStatus').textContent=t||''; }

  function placeMarker(lat,lng,label){
    if(marker) marker.remove();
    marker=L.marker([lat,lng]).addTo(map).bindTooltip(label||'查詢位置');
  }

  // 先試著直接對到「區＋里」，對不到再用 OpenStreetMap 查地址
  function search(q){
    q=(q||'').trim(); if(!q) return;
    var clean=q.replace(/^桃園市|^桃園縣/,'');
    var hit=data.villages.filter(function(v){return clean.indexOf(v.v)>=0 && (clean.indexOf(v.t)>=0 || clean.indexOf(v.t.slice(0,2))>=0)})[0]
      || (data.villages.filter(function(v){return clean.indexOf(v.v)>=0}).length===1 && data.villages.filter(function(v){return clean.indexOf(v.v)>=0})[0]);
    if(hit){ status(''); select(hit); return; }
    status('查詢中…');
    var url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tw&accept-language=zh-TW&viewbox=120.95,25.15,121.5,24.58&bounded=1&q='+encodeURIComponent('桃園市 '+clean);
    fetch(url,{headers:{'Accept':'application/json'}}).then(function(r){return r.json()}).then(function(res){
      if(!res.length){ status('找不到這個地址，試試「區＋路名」或直接選行政區和里。'); return; }
      var lat=+res[0].lat, lng=+res[0].lon, v=villageAt(lat,lng);
      placeMarker(lat,lng,q);
      if(!v){ status('這個位置不在桃園市範圍內。'); return; }
      status('已定位到附近（地址定位可能只到路段，請確認所在的里）。');
      select(v,{label:'查詢：'+q});
    }).catch(function(){ status('地址查詢暫時無法使用，請直接選行政區和里。'); });
  }

  function init(){
    map=L.map('smMap',{zoomControl:true,preferCanvas:true}).setView([24.93,121.2],11);
    L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',{
      maxZoom:19, attribution:'© 內政部國土測繪中心｜地址查詢 © OpenStreetMap'}).addTo(map);
    var bounds=null;
    data.villages.forEach(function(v){
      var poly=L.polygon(v.p,styleOf(v.id));
      poly.on('click',function(){ select(v,{fit:false}); });
      poly.bindTooltip(v.t+' '+v.v,{sticky:true,className:'sm-label'});
      poly.addTo(map); layers[v.id]=poly;
      bounds=bounds?bounds.extend(poly.getBounds()):poly.getBounds();
    });
    window.addEventListener('resize',function(){ map.invalidateSize(); });
    map.on('zoomend',drawSchools);
    $('smTown').innerHTML='<option value="">選擇行政區</option>'+data.towns.map(function(t){return '<option>'+t+'</option>'}).join('');
    $('smCount').textContent=data.schools.filter(function(s){return s.lv===lv}).length;
    drawSchools();

    // 等版面排好（地圖容器有正確尺寸）再縮放，不然會停在很遠的比例
    setTimeout(function(){
      map.invalidateSize();
      var q=new URLSearchParams(location.search), name=q.get('v');
      var v=name?data.villages.filter(function(x){return x.t+x.v===name})[0]:null;
      if(v){ select(v); return; }  // 指定了里就直接縮放過去，不要先縮到全市（兩段動畫會互相蓋掉）
      if(bounds) map.fitBounds(bounds,{padding:[10,10],animate:false});
      if(q.get('q')){ $('smQ').value=q.get('q'); search(q.get('q')); }
    },60);
  }

  // ---- 介面事件 ----
  document.querySelectorAll('.sm-tabs button').forEach(function(b){
    b.addEventListener('click',function(){
      lv=b.getAttribute('data-lv');
      document.querySelectorAll('.sm-tabs button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
      $('smLevel').textContent=LV[lv];
      if(data){ $('smCount').textContent=data.schools.filter(function(s){return s.lv===lv}).length; restyle(); }
    });
  });
  $('smForm').addEventListener('submit',function(e){e.preventDefault(); if(data) search($('smQ').value);});
  $('smLocate').addEventListener('click',function(){
    if(!navigator.geolocation){ status('這個瀏覽器不支援定位。'); return; }
    status('定位中…');
    navigator.geolocation.getCurrentPosition(function(p){
      var lat=p.coords.latitude, lng=p.coords.longitude, v=villageAt(lat,lng);
      placeMarker(lat,lng,'你的位置');
      if(!v){ status('你目前不在桃園市範圍內。'); map.setView([lat,lng],14); return; }
      status(''); select(v,{label:'你目前的位置'});
    },function(){ status('無法取得位置，請確認已允許定位。'); },{enableHighAccuracy:true,timeout:10000});
  });
  $('smTown').addEventListener('change',function(){ fillVillages(this.value); });
  $('smVill').addEventListener('change',function(){ var v=data.villages[+this.value]; if(v) select(v); });
  $('smSchools').addEventListener('change',drawSchools);
  $('smLabels').addEventListener('change',drawSchools);
  $('smResult').addEventListener('click',function(e){
    var ln=e.target.closest('[data-line-msg]');
    if(ln){  // 結果卡是動態產生的，自己處理「複製訊息再開 LINE」
      e.preventDefault();
      var msg=ln.getAttribute('data-line-msg'), toast=$('smToast');
      var open=function(ok){ if(toast) toast.textContent=ok?'已複製訊息，LINE 開啟後貼上送出就好。':''; window.open(LINE_URL,'_blank','noopener'); };
      try{ navigator.clipboard.writeText(msg).then(function(){open(true)},function(){open(false)}); }catch(err){ open(false); }
      return;
    }
    var b=e.target.closest('.sm-fly'); if(!b) return;
    var s=data.schools[+b.getAttribute('data-sid')]; map.setView([s.lat,s.lng],16);
    if(window.innerWidth<900) $('smMap').scrollIntoView({behavior:'smooth'});
  });

  var sv=document.querySelector('script[data-v]'), dv=sv?sv.getAttribute('data-v'):'';  // 資料檔版本號，更新後不會用到舊快取
  fetch('data.json'+(dv?'?v='+dv:'')).then(function(r){return r.json()}).then(function(d){data=d; init();})
    .catch(function(){ status('地圖資料載入失敗，請重新整理。'); });
})();
