(function(){
  var LINE_URL='https://line.me/ti/p/~0973263569';
  var lv='es', data=null, map, layers={}, schoolLayer, stationLayer, selected=null, marker=null;
  var $=function(id){return document.getElementById(id)};
  var LV={es:'國小',jh:'國中'};

  // 每所學校一個顏色（黃金角分散色相，相鄰學校比較不會撞色）；學校圖示用同色相的深色，白色圖案才看得清楚
  var hue=function(sid){return Math.round((sid*137.508)%360)};
  var color=function(sid){return 'hsl('+hue(sid)+',58%,52%)'};
  var deep=function(sid){return 'hsl('+hue(sid)+',60%,38%)'};
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
    return Object.assign(base,{fillColor:color(sid),fillOpacity:.25,color:'#1F3A5F',weight:1.2,dashArray:'4 4'});
  }
  function restyle(){
    Object.keys(layers).forEach(function(vid){
      layers[vid].setStyle(styleOf(vid));
      if(selected===+vid) layers[vid].setStyle({weight:4,color:'#16293F',dashArray:null,opacity:1});
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
    layers[v.id].setStyle({weight:4,color:'#16293F',dashArray:null,opacity:1}).bringToFront();
    if(opts.fit!==false) map.fitBounds(layers[v.id].getBounds(),{maxZoom:16,padding:[30,30]});
    var k=kind(v.id,'es'), kj=kind(v.id,'jh');
    var tip=(k==='split'||kj==='split')?'<p class="sm-tip">這個里依「鄰」分校或有自由學區，請確認門牌在第幾鄰（戶口名簿或里辦公處可查）。</p>':'';
    var rm=((data.remarks||{})[v.t]||[]).filter(function(t){return t.indexOf(v.v)>=0});
    var msg='容瑜你好，我想了解'+v.t+v.v+'附近的房子（學區：'+(assignOf(v.id,'es').map(function(r){return data.schools[r[0]].n}).filter(function(x,i,a){return a.indexOf(x)===i}).join('、')||'—')+'）';
    var pt=opts.pt||centroidOf(v), exact=!!opts.pt, groups=NEAR?nearbyGroups(v,pt[0],pt[1]):null;
    $('smResult').innerHTML='<div class="sm-r-head"><b>'+esc(v.t)+' '+esc(v.v)+'</b>'+(opts.label?'<span>'+esc(opts.label)+'</span>':'')+'</div>'+
      '<h3>國小學區</h3>'+schoolList(v,'es')+'<h3>國中學區</h3>'+schoolList(v,'jh')+tip+
      (rm.length?'<div class="sm-remarks"><b>官方備註</b>'+rm.map(function(t){return '<p>'+esc(t)+'</p>'}).join('')+'</div>':'')+
      (groups?nearbyHtml(groups,exact):'')+
      '<a class="btn btn-line sm-line" href="'+LINE_URL+'" target="_blank" rel="noopener" data-line-msg="'+esc(msg)+'" data-toast="smToast">LINE 問我這一區的房子</a>'+
      '<p class="toast" id="smToast" role="status"></p>';
    if(groups) drawNearby(groups,pt,exact);
    $('smResult').hidden=false;
    $('smTown').value=v.t; fillVillages(v.t); $('smVill').value=String(v.id);
    try{ history.replaceState(null,'','?v='+encodeURIComponent(v.t+v.v)); }catch(e){}
    if(window.innerWidth<900) $('smResult').scrollIntoView({behavior:'smooth',block:'start'});
  }

  // ---- 地圖圖示（24×24 白色圖案）：國小＝有旗子的校舍、國中＝學士帽、台鐵、捷運、機場 ----
  var GLYPH={
    es:'<path d="M11.3 2h1.4v5.2h-1.4z"/><path d="M12.7 2l4.8 1.6-4.8 1.6z"/><path d="M2.5 11L12 6l9.5 5z"/><path fill-rule="evenodd" d="M4.5 12h15v9h-15zm5.5 3.5h4V21h-4z"/>',
    jh:'<path d="M12 3.5L1 9l11 5.5L23 9z"/><path d="M5.5 12.2v4.3c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-4.3L12 15.5z"/><path d="M20.3 9.6h1.4v6.4h-1.4z"/><circle cx="21" cy="17.2" r="1.4"/>',
    tra:'<path fill-rule="evenodd" d="M12 2C7.6 2 5 2.8 5 5.8v9.4C5 17.3 6.6 19 8.6 19L7 21h2.2l1.6-2h2.4l1.6 2H17l-1.6-2c2 0 3.6-1.7 3.6-3.8V5.8C19 2.8 16.4 2 12 2zM7 7h10v4.6H7zm1.6 6.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm6.8 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/>',
    mrt:'<path fill-rule="evenodd" d="M7 3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-2.4 2.9L19 21h-2.2l-1.6-2H8.8l-1.6 2H5l1.4-2.1A3 3 0 0 1 4 16V6a3 3 0 0 1 3-3zm-.5 3.5v5h11v-5zm1.5 7.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm8 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>',
    air:'<path transform="rotate(45 12 12)" d="M12 2c.9 0 1.5.8 1.5 1.8V9l8 4.6v2.1l-8-2.4v5.1l2.2 1.6V22L12 21l-3.7 1v-2l2.2-1.6v-5.1l-8 2.4v-2.1l8-4.6V3.8C10.5 2.8 11.1 2 12 2z"/>',
    cart:'<path d="M1.6 2.6h3.3l.7 2.4h16l-2.5 8.2H8.1l.4 1.5h11v2H7L3.4 4.6H1.6z"/><circle cx="9" cy="19.6" r="1.9"/><circle cx="17.6" cy="19.6" r="1.9"/>',
    stall:'<path d="M2.6 3h18.8l1.5 4.4H1.1z"/><path d="M3.6 9h2.2v12H3.6zm14.6 0h2.2v12h-2.2z"/><path d="M6.6 13.4h10.8v3.4H6.6z"/>',
    cross:'<path d="M9.6 2.5h4.8v7.1h7.1v4.8h-7.1v7.1H9.6v-7.1H2.5V9.6h7.1z"/>',
    tree:'<path d="M12 2.2l4.6 6.2h-2.4l4 5.4h-2.6l3.4 4.6H5l3.4-4.6H5.8l4-5.4H7.4z"/><path d="M10.6 18.4h2.8V22h-2.8z"/>'
  };
  var LINES={tra:{t:'台鐵',c:'#2E6DB4',g:'tra',sq:1},a:{t:'機場捷運',c:'#8246AF',g:'mrt'},g:{t:'捷運綠線',c:'#3E9C35',g:'mrt'}};
  var AIR_C='#1F3A5F';
  var POI={su:{t:'超市',c:'#D9822B',g:'cart'},hm:{t:'量販',c:'#D9822B',g:'cart'},dp:{t:'百貨',c:'#D9822B',g:'cart'},
    mk:{t:'市場',c:'#B8622A',g:'stall'},ho:{t:'醫院',c:'#C2413C',g:'cross'},pk:{t:'公園',c:'#2E7D5B',g:'tree'}};

  function svg(g){return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+GLYPH[g]+'</svg>'}
  function pin(g,fill,size){  // 學校：水滴形圖釘，尖端對準學校位置
    return '<svg viewBox="0 0 26 34" width="'+size+'" height="'+Math.round(size*34/26)+'" aria-hidden="true">'+
      '<path d="M13 32.5S2.5 20.6 2.5 12.8a10.5 10.5 0 0 1 21 0C23.5 20.6 13 32.5 13 32.5z" fill="'+fill+'" stroke="#fff" stroke-width="2"/>'+
      '<svg x="5.5" y="5" width="15" height="15" viewBox="0 0 24 24" fill="#fff">'+GLYPH[g]+'</svg></svg>';
  }
  function badge(k,build,size,dot){  // 車站：台鐵方形、捷運圓形；興建中＝白底虛線框
    var L0=LINES[k];
    return '<span class="sm-st'+(L0.sq?' sq':'')+(build?' build':'')+'" style="--c:'+L0.c+';width:'+size+'px;height:'+size+'px">'+(dot?'':svg(L0.g))+'</span>';
  }
  function airBadge(size){ return '<span class="sm-st sm-air" style="--c:'+AIR_C+';width:'+size+'px;height:'+size+'px">'+svg('air')+'</span>'; }
  function lineText(ls){ return ls.map(function(l){return LINES[l[0]].t+(l[1]?' '+l[1]:'')+(l[2]?'（興建中）':'')}).join('、'); }

  function drawSchools(){
    if(schoolLayer) schoolLayer.remove();
    if(!$('smSchools').checked || map.getZoom()<12) return;  // 全市比例下學校太擠，放大才顯示
    var z=map.getZoom(), size=z>=16?30:z>=14?26:22, h=Math.round(size*34/26);
    schoolLayer=L.layerGroup();
    data.schools.forEach(function(s){
      if(s.lv!==lv||!s.lat) return;
      var m=L.marker([s.lat,s.lng],{keyboard:false,icon:L.divIcon({className:'sm-pin',iconSize:[size,h],iconAnchor:[size/2,h],tooltipAnchor:[0,-h],html:pin(s.lv,deep(s.id),size)})});
      m.bindTooltip(esc(s.n)+(s.ap?'（位置為概略）':''),{permanent:true,direction:'top',offset:[0,-2],className:'sm-label'});
      m.on('click',function(){ var v=villageAt(s.lat,s.lng); if(v) select(v,{fit:false,label:s.n,pt:[s.lat,s.lng]}); });
      schoolLayer.addLayer(m);
    });
    schoolLayer.addTo(map);
  }

  // 車站、機場：全市比例顯示小點，放大才顯示圖案；放到 14 級以上站名常駐
  function drawStations(){
    if(stationLayer) stationLayer.remove();
    stationLayer=L.layerGroup();
    var z=map.getZoom(), size=z>=14?50:z>=12?40:26, show={tra:$('smTra').checked,a:$('smMrt').checked,g:$('smMrt').checked};
    (data.stations||[]).forEach(function(h){
      var ls=h.l.filter(function(l){return show[l[0]]}); if(!ls.length) return;
      var w=ls.length*size+(ls.length-1)*2, build=ls.every(function(l){return l[2]});
      var m=L.marker([h.lat,h.lng],{zIndexOffset:1000,keyboard:false,icon:L.divIcon({className:'sm-hub',iconSize:[w,size],iconAnchor:[w/2,size/2],tooltipAnchor:[w/2,0],
        html:ls.map(function(l){return badge(l[0],l[2],size)}).join('')})});
      if(z>=14) m.bindTooltip(esc(h.n)+(build?'（興建中）':''),{permanent:true,direction:'right',className:'sm-label sm-st-label'});
      else m.bindTooltip('<b>'+esc(h.n)+'</b><br>'+esc(lineText(ls)),{direction:'right',className:'sm-label'});
      m.on('click',function(){ var v=villageAt(h.lat,h.lng); if(v) select(v,{fit:false,label:h.n+'｜'+lineText(ls),pt:[h.lat,h.lng]}); });
      stationLayer.addLayer(m);
    });
    var A=data.airport;
    if(A && $('smAir').checked){
      var as=z>=12?58:36;
      var am=L.marker([A.lat,A.lng],{zIndexOffset:1100,keyboard:false,icon:L.divIcon({className:'sm-hub',iconSize:[as,as],iconAnchor:[as/2,as/2],tooltipAnchor:[as/2,0],html:airBadge(as)})});
      am.bindTooltip(esc(A.n),{permanent:true,direction:'right',className:'sm-label sm-air-label'});
      am.on('click',function(){ map.setView([A.lat,A.lng],Math.max(map.getZoom(),14)); });
      stationLayer.addLayer(am);
    }
    stationLayer.addTo(map);
  }

  // ---- 附近生活機能（學校、車站、超市賣場市場、醫院、公園）----
  var NEAR=null, nearLayer=null, refMarker=null;

  function buildNear(){
    NEAR={school:data.schools.filter(function(s){return s.lat}),
      station:(data.stations||[]).map(function(h){return {n:h.n,lat:h.lat,lng:h.lng,l:h.l}}),
      shop:[],hosp:[],park:[]};
    (data.poi||[]).forEach(function(p){
      var o={k:p[0],n:p[1],lat:p[2],lng:p[3]};
      (o.k==='ho'?NEAR.hosp:o.k==='pk'?NEAR.park:NEAR.shop).push(o);
    });
  }
  function dist(la1,ln1,la2,ln2){
    var x=(la2-la1)*110540, y=(ln2-ln1)*111320*Math.cos(la1*Math.PI/180);
    return Math.sqrt(x*x+y*y);
  }
  function distText(m){ return m<950?Math.round(m/10)*10+' 公尺':(m/1000).toFixed(1)+' 公里'; }
  function nearest(items,lat,lng,max,limit){
    return items.map(function(o){o.d=dist(lat,lng,o.lat,o.lng); return o})
      .filter(function(o){return o.d<=max}).sort(function(a,b){return a.d-b.d}).slice(0,limit);
  }
  function centroidOf(v){  // 里的中心點（面積加權）
    var best=null, bestA=0;
    v.p.forEach(function(poly){
      var ring=poly[0], a=0, cx=0, cy=0;
      for(var i=0,j=ring.length-1;i<ring.length;j=i++){
        var f=ring[j][1]*ring[i][0]-ring[i][1]*ring[j][0];
        a+=f; cy+=(ring[j][0]+ring[i][0])*f; cx+=(ring[j][1]+ring[i][1])*f;
      }
      if(Math.abs(a)>Math.abs(bestA)){ bestA=a; best=[cy/(3*a),cx/(3*a)]; }
    });
    return best||[v.p[0][0][0][0],v.p[0][0][0][1]];
  }
  function nearbyGroups(v,lat,lng){
    var inDistrict=function(s){ return assignOf(v.id,s.lv).some(function(r){return r[0]===s.id}) };
    var sch=nearest(NEAR.school.filter(function(s){return s.lv==='es'}),lat,lng,3000,2)
      .concat(nearest(NEAR.school.filter(function(s){return s.lv==='jh'}),lat,lng,4000,2))
      .map(function(s){ return {n:s.n,d:s.d,lat:s.lat,lng:s.lng,tag:inDistrict(s)?'學區':LV[s.lv]} });
    var st=nearest(NEAR.station,lat,lng,6000,3).map(function(h){
      return {n:h.n,d:h.d,lat:h.lat,lng:h.lng,tag:lineText(h.l).replace('（興建中）','・興建中')};
    });
    var poi=function(list,max,limit){
      return nearest(list,lat,lng,max,limit).map(function(o){
        return {n:o.n,d:o.d,lat:o.lat,lng:o.lng,k:o.k,tag:POI[o.k].t};
      });
    };
    return [{t:'附近學校',items:sch},{t:'附近車站',items:st},
      {t:'超市・賣場・市場',items:poi(NEAR.shop,2000,4)},
      {t:'附近醫院',items:poi(NEAR.hosp,6000,2)},
      {t:'附近公園',items:poi(NEAR.park,1500,3)}];
  }
  function nearbyHtml(groups,exact){
    return '<div class="sm-near"><h3>附近生活機能 <small>'+(exact?'從你選的位置':'從里的中心')+'量直線距離</small></h3>'+
      groups.map(function(g){
        return '<section><b>'+esc(g.t)+'</b>'+(g.items.length
          ? '<ul>'+g.items.map(function(it){
              return '<li><button type="button" class="sm-go" data-lat="'+it.lat+'" data-lng="'+it.lng+'">'+
                '<span class="nm">'+esc(it.n)+'</span><em>'+esc(it.tag)+'</em><span class="dt">'+distText(it.d)+'</span></button></li>';
            }).join('')+'</ul>'
          : '<p class="sm-empty">附近查不到</p>')+'</section>';
      }).join('')+'</div>';
  }
  function drawNearby(groups,pt,exact){
    if(nearLayer) nearLayer.remove();
    if(refMarker){ refMarker.remove(); refMarker=null; }
    nearLayer=L.layerGroup();
    groups.forEach(function(g){ g.items.forEach(function(it){
      if(!it.k) return;  // 學校、車站本來就有圖示了
      var m=L.marker([it.lat,it.lng],{zIndexOffset:900,keyboard:false,icon:L.divIcon({className:'sm-hub',iconSize:[20,20],iconAnchor:[10,10],tooltipAnchor:[10,0],
        html:'<span class="sm-st sm-poi" style="--c:'+POI[it.k].c+';width:20px;height:20px">'+svg(POI[it.k].g)+'</span>'})});
      m.bindTooltip('<b>'+esc(it.n)+'</b><br>'+POI[it.k].t+'・'+distText(it.d),{direction:'right',className:'sm-label'});
      nearLayer.addLayer(m);
    })});
    if(exact) nearLayer.addLayer(L.marker(pt,{zIndexOffset:1200,keyboard:false,
      icon:L.divIcon({className:'sm-hub',iconSize:[18,18],iconAnchor:[9,9],html:'<span class="sm-ref"></span>'})}));
    nearLayer.addTo(map);
  }

  // 圖例的小圖示（跟地圖上同一套圖案）
  document.querySelectorAll('[data-lg]').forEach(function(el){
    var k=el.getAttribute('data-lg');
    el.innerHTML=k==='es'||k==='jh'?pin(k,'hsl(95,60%,38%)',20):k==='air'?airBadge(24):badge(k,k==='g',24);
  });

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
      select(v,{label:'查詢：'+q,pt:[lat,lng]});
    }).catch(function(){ status('地址查詢暫時無法使用，請直接選行政區和里。'); });
  }

  function init(){
    buildNear();
    map=L.map('smMap',{zoomControl:true,preferCanvas:true}).setView([24.93,121.2],11);
    L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',{
      maxZoom:19, attribution:'© 內政部國土測繪中心｜地址查詢 © OpenStreetMap'}).addTo(map);
    var bounds=null;
    data.villages.forEach(function(v){
      var poly=L.polygon(v.p,styleOf(v.id));
      poly.on('click',function(e){ select(v,{fit:false,pt:[e.latlng.lat,e.latlng.lng]}); });
      poly.bindTooltip(v.t+' '+v.v,{sticky:true,className:'sm-label'});
      poly.addTo(map); layers[v.id]=poly;
      bounds=bounds?bounds.extend(poly.getBounds()):poly.getBounds();
    });
    window.addEventListener('resize',function(){ map.invalidateSize(); });
    map.on('zoomend',function(){ drawSchools(); drawStations(); });
    $('smTown').innerHTML='<option value="">選擇行政區</option>'+data.towns.map(function(t){return '<option>'+t+'</option>'}).join('');
    $('smCount').textContent=data.schools.filter(function(s){return s.lv===lv}).length;
    drawSchools(); drawStations();

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
      status(''); select(v,{label:'你目前的位置',pt:[lat,lng]});
    },function(){ status('無法取得位置，請確認已允許定位。'); },{enableHighAccuracy:true,timeout:10000});
  });
  $('smTown').addEventListener('change',function(){ fillVillages(this.value); });
  $('smVill').addEventListener('change',function(){ var v=data.villages[+this.value]; if(v) select(v); });
  $('smSchools').addEventListener('change',function(){ if(data) drawSchools(); });
  ['smTra','smMrt','smAir'].forEach(function(id){ $(id).addEventListener('change',function(){ if(data) drawStations(); }); });
  $('smResult').addEventListener('click',function(e){
    var ln=e.target.closest('[data-line-msg]');
    if(ln){  // 結果卡是動態產生的，自己處理「複製訊息再開 LINE」
      e.preventDefault();
      var msg=ln.getAttribute('data-line-msg'), toast=$('smToast');
      var open=function(ok){ if(toast) toast.textContent=ok?'已複製訊息，LINE 開啟後貼上送出就好。':''; window.open(LINE_URL,'_blank','noopener'); };
      try{ navigator.clipboard.writeText(msg).then(function(){open(true)},function(){open(false)}); }catch(err){ open(false); }
      return;
    }
    var go=e.target.closest('.sm-go');  // 生活機能清單：點了就把地圖移過去
    if(go){
      map.setView([+go.getAttribute('data-lat'),+go.getAttribute('data-lng')],17);
      if(window.innerWidth<900) $('smMap').scrollIntoView({behavior:'smooth'});
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
