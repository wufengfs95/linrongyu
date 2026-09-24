/* 桃園房屋估價：用內政部實價登錄的成交資料，找條件相近的鄰居比價 */
(function(){
  var LINE_URL='https://line.me/ti/p/~0973263569';
  var meta=null, towns={}, kind='a', chosen=null;
  var $=function(id){return document.getElementById(id)};
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var KN={a:'住宅大樓',b:'華廈',c:'公寓',d:'透天厝'};
  var ver=(document.querySelector('script[data-v]')||{getAttribute:function(){return ''}}).getAttribute('data-v');
  var qs=function(p){return p?('?v='+p):''};

  function money(v){ return v>=10000?(v/10000).toFixed(2)+' 億':Math.round(v)+' 萬'; }
  function pct(v){ return (v>0?'+':'')+v.toFixed(1)+'%'; }
  function median(a){ if(!a.length) return null; var b=a.slice().sort(function(x,y){return x-y}); var m=b.length>>1;
    return b.length%2?b[m]:(b[m-1]+b[m])/2; }
  function quantile(a,p){ var b=a.slice().sort(function(x,y){return x-y}); var i=(b.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i);
    return b[lo]+(b[hi]-b[lo])*(i-lo); }

  // 樓層調整：一樓（含店面）另外處理，頂樓、四樓、二樓略低
  function floorFactor(f,tf){
    if(!f) return 1;
    if(f===1) return 1.04;
    if(tf && f===tf) return .97;
    if(f===4) return .97;
    if(f===2) return .98;
    return 1;
  }

  function status(msg,cls){
    $('vStatus').className='v-status'+(cls?' '+cls:'');
    $('vStatus').innerHTML=msg||'';
  }

  function loadTown(t){
    if(towns[t]) return Promise.resolve(towns[t]);
    return fetch('data/'+encodeURIComponent(t)+'.json'+qs(ver)).then(function(r){return r.json()}).then(function(d){
      towns[t]=d; return d;
    });
  }

  function fillRoads(t){
    var d=towns[t];
    $('vRoadList').innerHTML=d.roads.map(function(r){return '<option value="'+esc(r)+'">'}).join('');
    $('vRoad').placeholder='例：'+d.roads.slice(0,2).join('、')+'（可不填）';
  }
  function roadIndex(t,text){
    text=(text||'').trim().replace(/^桃園市|區$/g,'');
    if(!text) return -1;
    var roads=towns[t].roads, i=roads.indexOf(text);
    if(i>=0) return i;
    for(var k=0;k<roads.length;k++){ if(roads[k].indexOf(text)===0||text.indexOf(roads[k])===0) return k; }
    return -2;  // 有填但對不到
  }

  // 逐步放寬條件找比價樣本：先同路段、近期、屋齡坪數相近，不夠再放寬
  var LEVELS=[
    {road:1,age:6,area:.3,seasons:6,label:'近 1.5 年・屋齡坪數相近'},
    {road:1,age:10,area:.45,seasons:10,label:'近 2.5 年'},
    {road:0,age:6,area:.3,seasons:6,label:'近 1.5 年・屋齡坪數相近'},
    {road:0,age:10,area:.45,seasons:10,label:'近 2.5 年'},
    {road:0,age:20,area:.7,seasons:12,label:'近 3 年・條件放寬'}
  ];

  function estimate(inp){
    var d=towns[inp.town], idx=meta.towns[inp.town].index;
    var last=meta.seasons[meta.seasons.length-1], ly=+last.slice(0,3), lq=+last.slice(4);
    var mine=floorFactor(inp.floor,inp.tops);
    for(var li=0;li<LEVELS.length;li++){
      var L=LEVELS[li], comps=[];
      for(var i=0;i<d.rows.length;i++){
        var r=d.rows[i];                     // [路段, 型態, 年, 季, 單價, 坪數, 樓層, 總樓層, 屋齡]
        if(r[1]!==inp.kind || r[13]) continue;   // r[13]=1：車位未拆價，只給謄本估價用
        if(L.road && inp.road>=0 && r[0]!==inp.road) continue;
        var age=(ly-r[2])*4+(lq-r[3]);       // 距今幾季
        if(age>L.seasons) continue;
        if(Math.abs(r[5]-inp.area)/inp.area>L.area) continue;
        if(inp.age!=null && r[8]>=0 && Math.abs(r[8]-inp.age)>L.age) continue;
        var f=idx[r[2]+'S'+r[3]]||1;
        comps.push({u:r[4]*f*(mine/floorFactor(r[6],r[7])), raw:r[4], y:r[2], q:r[3],
                    road:r[0]>=0?d.roads[r[0]]:'', a:r[5], f:r[6], tf:r[7], age:r[8]});
      }
      if(comps.length>=(L.road?8:12) || li===LEVELS.length-1){
        if(comps.length<5) continue;
        var us=comps.map(function(c){return c.u}).sort(function(x,y){return x-y});
        if(us.length>=12){ var cut=Math.floor(us.length*.1); us=us.slice(cut,us.length-cut); }  // 去掉最高最低各 10%
        var mid=median(us), lo=Math.max(quantile(us,.25),mid*.86), hi=Math.min(quantile(us,.75),mid*1.14);
        comps.sort(function(a,b){return (b.y*4+b.q)-(a.y*4+a.q)});
        var scope=(L.road&&inp.road>=0)?(inp.roadName+'一帶')
          :(inp.town+'全區'+(inp.road>=0?'（'+inp.roadName+'相近成交太少，已擴大範圍）':''));
        return {mid:mid,lo:lo,hi:hi,n:comps.length,level:L,scope:scope,comps:comps,
                conf:comps.length>=25?'高':comps.length>=12?'中':'低'};
      }
    }
    return null;
  }

  function sampleTable(comps){
    return '<div class="v-table-wrap"><table class="v-table"><thead><tr><th>成交時間</th><th>路段</th><th>坪數</th><th>樓層</th><th>屋齡</th><th>原始單價</th><th>校正後</th></tr></thead><tbody>'+
      comps.slice(0,10).map(function(c){
        return '<tr><td>'+c.y+' 年 Q'+c.q+'</td><td>'+esc(c.road||'—')+'</td><td>'+c.a.toFixed(1)+'</td><td>'+
          (c.f?c.f+(c.tf?'/'+c.tf:'')+' 樓':'—')+'</td><td>'+(c.age>=0?c.age+' 年':'—')+'</td><td>'+c.raw.toFixed(1)+'</td><td><b>'+c.u.toFixed(1)+'</b></td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function render(inp,res){
    var park=meta.towns[inp.town].park||{}, parkPrice=inp.park?(park[inp.park]||0):0;
    var lo=res.lo*inp.area, hi=res.hi*inp.area, mid=res.mid*inp.area;
    var totalLo=lo+parkPrice, totalHi=hi+parkPrice;
    var msg='容瑜你好，我用網站估價：'+inp.town+(inp.roadName?' '+inp.roadName:'')+'，'+KN[inp.kind]+
      ' '+inp.area+' 坪'+(inp.floor?'・'+inp.floor+'樓':'')+(inp.age!=null?'・屋齡 '+inp.age+' 年':'')+
      (inp.park?'・'+inp.park+'車位':'')+'，估出來是 '+money(totalLo)+'～'+money(totalHi)+'，想請你幫我看實際行情。';
    var html='<div class="v-out">'+
      '<div class="v-price"><span>估計總價區間</span><b>'+money(totalLo)+' ～ '+money(totalHi)+'</b>'+
      '<span class="v-unit">每坪約 '+res.lo.toFixed(1)+'～'+res.hi.toFixed(1)+' 萬（中位 '+res.mid.toFixed(1)+' 萬）'+
      (parkPrice?'；另含'+inp.park+'車位 '+parkPrice+' 萬':'')+'</span></div>'+
      '<div class="v-meta"><span>比對 <b>'+res.n+'</b> 筆成交</span><span>範圍：'+esc(res.scope)+'・'+res.level.label+'</span>'+
      '<span>可信度：<b class="v-conf v-conf-'+(res.conf==='高'?'hi':res.conf==='中'?'mid':'low')+'">'+res.conf+'</b></span></div>';
    if(inp.paid){
      var d=(inp.paid-mid-parkPrice)/(mid+parkPrice)*100;
      var cls=inp.paid>totalHi?'bad':inp.paid<totalLo?'good':'ok';
      var word=inp.paid>totalHi?'偏高':inp.paid<totalLo?'買得不錯':'在合理範圍';
      html+='<div class="v-judge v-'+cls+'"><b>買貴鑑定：'+word+'</b><span>你的成交價 '+money(inp.paid)+
        '，跟估價中位（'+money(mid+parkPrice)+'）差 '+pct(d)+'。</span>'+
        (cls==='bad'?'<span>價差可能來自裝潢、樓層景觀、車位或屋況，建議讓我看過實際條件再判斷。</span>':'')+'</div>';
    }
    if(inp.floor===1) html+='<p class="v-warn">一樓常含店面、庭院或增建，線上估價誤差大，建議找我實際看過再報價。</p>';
    if(inp.kind==='d') html+='<p class="v-warn">透天厝的土地坪數、面寬、臨路差很多，線上估價僅供參考。</p>';
    html+='<details class="v-samples" open><summary>看比對到的成交（'+res.comps.length+' 筆中的最近 10 筆）</summary>'+
      '<p class="v-note">「校正後」是把成交時間、樓層差異調整到跟你家一樣的條件之後的單價（萬元／坪）。</p>'+
      sampleTable(res.comps)+'</details>'+
      '<a class="btn btn-line v-cta" href="'+LINE_URL+'" target="_blank" rel="noopener" data-line-msg="'+esc(msg)+'" data-toast="vToast">LINE 給容瑜看實際行情</a>'+
      '<p class="toast" id="vToast" role="status"></p>'+
      '<p class="v-disclaimer">本結果是用內政部實價登錄成交資料自動統計的參考價，不是不動產估價師的估價報告。實際成交價會受屋況、裝潢、景觀、產權與談判影響。</p>'+
      '</div>';
    $('vResult').innerHTML=html;
    $('vResult').hidden=false;
    $('vResult').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function submit(e){
    e.preventDefault();
    var town=$('vTown').value, area=parseFloat($('vArea').value), age=$('vAge').value===''?null:parseInt($('vAge').value,10);
    var floor=parseInt($('vFloor').value,10)||0, tops=parseInt($('vTops').value,10)||0;
    var roadText=$('vRoad').value;
    var park=$('vPark').value, paid=parseFloat($('vPaid').value)||0;
    if(!town){ status('請先選行政區。','err'); return; }
    if(!area||area<5||area>300){ status('請填權狀坪數（不含車位），例如 32.5。','err'); return; }
    status('計算中…');
    loadTown(town).then(function(){
      var road=roadIndex(town,roadText), noRoad=road===-2;
      if(noRoad) road=-1;
      var inp={town:town,kind:kind,area:area,age:age,floor:floor,tops:tops,road:road,park:park,paid:paid,
               roadName:road>=0?towns[town].roads[road]:''};
      var res=estimate(inp);
      if(!res){
        status('這個條件的成交資料太少，估不出可靠區間。可以放寬條件（不指定路段），或直接<a href="'+LINE_URL+'" target="_blank" rel="noopener">加 LINE 請容瑜幫你查</a>。','err');
        $('vResult').hidden=true;
        return;
      }
      status(noRoad?'「'+esc(roadText)+'」在這一區的成交資料裡找不到，已改用全區行情估。':'');
      render(inp,res);
    }).catch(function(){ status('資料載入失敗，請重新整理再試一次。','err'); });
  }

  // ---- 介面 ----
  document.querySelectorAll('.v-kinds button').forEach(function(b){
    b.addEventListener('click',function(){
      kind=b.getAttribute('data-k');
      document.querySelectorAll('.v-kinds button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
    });
  });
  $('vTown').addEventListener('change',function(){
    var t=this.value;
    if(!t){ $('vRoad').innerHTML='<option value="-1">先選行政區</option>'; return; }
    $('vRoad').innerHTML='<option value="-1">載入中…</option>';
    loadTown(t).then(function(){ fillRoads(t); });
  });
  $('vForm').addEventListener('submit',submit);
  $('vResult').addEventListener('click',function(e){
    var ln=e.target.closest('[data-line-msg]'); if(!ln) return;
    e.preventDefault();
    var msg=ln.getAttribute('data-line-msg'), toast=$('vToast');
    var open=function(ok){ if(toast) toast.textContent=ok?'已複製估價內容，LINE 開啟後貼上送出就好。':''; window.open(LINE_URL,'_blank','noopener'); };
    try{ navigator.clipboard.writeText(msg).then(function(){open(true)},function(){open(false)}); }catch(err){ open(false); }
  });

  fetch('data/meta.json'+qs(ver)).then(function(r){return r.json()}).then(function(m){
    meta=m;
    var ts=Object.keys(m.towns).filter(function(t){return m.towns[t].n>=200}).sort();
    $('vTown').innerHTML='<option value="">選擇行政區</option>'+ts.map(function(t){return '<option>'+t+'</option>'}).join('');
    $('vUpdated').textContent=m.updated;
    $('vTotal').textContent=m.total.toLocaleString();
    // 行情速查表
    var order=['a','b','c','d'];
    $('vQuick').innerHTML='<table class="v-table"><thead><tr><th>行政區</th>'+order.map(function(k){return '<th>'+KN[k]+'</th>'}).join('')+'</tr></thead><tbody>'+
      ts.map(function(t){
        var k=m.towns[t].kinds;
        return '<tr><td>'+t+'</td>'+order.map(function(x){return '<td>'+(k[x]?k[x].m.toFixed(1):'—')+'</td>'}).join('')+'</tr>';
      }).join('')+'</tbody></table>';
  }).catch(function(){ status('行情資料載入失敗，請重新整理。','err'); });
})();
