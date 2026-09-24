/* 社區實價登錄追蹤：選路段 → 選社區（同巷＋同完工年＋同型態）→ 歷年成交、每季單價走勢；
   追蹤清單存在這支手機／電腦（localStorage），下次打開會標出「上次看過之後的新成交」 */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc, KEY='rt-community-watch';
  var meta=null, cur=null;

  function ckey(r){ return [r[1],r[9],r[10],r[9]?0:r[7]].join('-'); }     // 型態-巷-完工年-(沒巷就用總樓層)
  function label(g,road){
    return road+(g.lane?' '+g.lane+' 巷':'')+(g.by?'・民國 '+g.by+' 年完工':'')+'・'+RT.KN[g.kind]+(!g.lane&&g.tops?'・'+g.tops+' 樓':'');
  }
  function groups(d,ri){
    var m={};
    d.rows.forEach(function(r){
      if(r[0]!==ri||r[13]) return;
      var k=ckey(r); (m[k]=m[k]||{key:k,kind:r[1],lane:r[9],by:r[10],tops:r[9]?0:r[7],rows:[]}).rows.push(r);
    });
    return Object.keys(m).map(function(k){return m[k]}).filter(function(g){return g.rows.length>=2&&g.by})
      .sort(function(a,b){return b.rows.length-a.rows.length});
  }
  function sid(r){ return r[2]*10+r[3]; }

  function showGroups(){
    var t=$('kTown').value, road=$('kRoad').value.trim();
    if(!t||!road){ $('kGroups').innerHTML=''; return; }
    RT.town(t).then(function(d){
      var ri=RT.roadIndex(d,road);
      if(ri<0){ $('kGroups').innerHTML='<p class="v-warn">找不到「'+esc(road)+'」，請從下拉選單選路段（例：'+esc(d.roads.slice(0,3).join('、'))+'）。</p>'; return; }
      road=d.roads[ri]; $('kRoad').value=road;
      var gs=groups(d,ri);
      $('kGroups').innerHTML=gs.length?'<p class="v-hint">'+esc(road)+' 找到 '+gs.length+' 個社區（近三年有 2 筆以上成交），點一個看成交：</p><div class="rt-glist">'+
        gs.map(function(g){ var last=g.rows.reduce(function(a,r){return sid(r)>sid(a)?r:a});
          return '<button type="button" data-g="'+esc(g.key)+'"><b>'+esc(label(g,road))+'</b><span>'+g.rows.length+' 筆・最近 '+last[2]+' Q'+last[3]+'</span></button>'; }).join('')+'</div>'
        :'<p class="v-warn">'+esc(road)+' 近三年沒有同社區 2 筆以上的成交。</p>';
      $('kGroups').querySelectorAll('[data-g]').forEach(function(b){ b.addEventListener('click',function(){
        show(t,road,gs.filter(function(g){return g.key===b.getAttribute('data-g')})[0]); if(window.innerWidth<900) $('kResult').scrollIntoView({behavior:'smooth'}); }); });
    });
  }

  function chart(rows){
    var ss=meta.seasons, by={};
    rows.forEach(function(r){ (by[r[2]+'S'+r[3]]=by[r[2]+'S'+r[3]]||[]).push(r[4]); });
    var vals=ss.map(function(s){return by[s]?RT.median(by[s]):null}), have=vals.filter(function(v){return v!=null});
    var max=Math.max.apply(null,have)*1.1, min=Math.min.apply(null,have)*.85, W=640, H=180, bw=(W-40)/ss.length;
    var Y=function(v){return H-24-(v-min)/(max-min)*(H-50)};
    var s='<svg class="rt-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="每季成交中位單價">';
    vals.forEach(function(v,i){
      var x=20+i*bw;
      if(v!=null) s+='<rect x="'+(x+bw*.18)+'" y="'+Y(v)+'" width="'+(bw*.64)+'" height="'+(H-24-Y(v))+'" rx="3" class="bar"><title>'+ss[i]+'：'+v.toFixed(1)+' 萬/坪（'+by[ss[i]].length+' 筆）</title></rect>'+
        '<text x="'+(x+bw/2)+'" y="'+(Y(v)-5)+'" text-anchor="middle" class="v">'+v.toFixed(1)+'</text>';
      if(i%2===0||ss.length<9) s+='<text x="'+(x+bw/2)+'" y="'+(H-8)+'" text-anchor="middle" class="lb">'+ss[i].replace('S','Q')+'</text>';
    });
    return s+'</svg>';
  }

  var SIZES=[['','全部坪數',0,999],['s','20 坪以下',0,20],['m','20～40 坪',20,40],['l','40 坪以上',40,999]];
  function show(t,road,g,size){
    size=size||'';
    var sz=SIZES.filter(function(x){return x[0]===size})[0];
    var watch=RT.store.get(KEY,[]), w=watch.filter(function(x){return x.id===t+'|'+road+'|'+g.key})[0];
    var seen=w?w.seen:null;
    cur={id:t+'|'+road+'|'+g.key, t:t, road:road, key:g.key, label:label(g,road)};
    var allRows=g.rows, rows=g.rows.filter(function(r){return r[5]>=sz[2]&&r[5]<sz[3]}).sort(function(a,b){return sid(b)-sid(a)||b[6]-a[6]});
    var last=meta.seasons[meta.seasons.length-1], ly=+last.slice(0,3), lq=+last.slice(4);
    var ago=function(r){return (ly-r[2])*4+(lq-r[3])};
    var y1=rows.filter(function(r){return ago(r)<4}).map(function(r){return r[4]}), y0=rows.filter(function(r){return ago(r)>=4&&ago(r)<8}).map(function(r){return r[4]});
    var m1=RT.median(y1), m0=RT.median(y0), all=RT.median(rows.map(function(r){return r[4]}));
    var fresh=seen!=null?rows.filter(function(r){return sid(r)>seen}).length:0;
    var sizeBar='<div class="rt-chipset rt-sizes">'+SIZES.map(function(x){ var n=allRows.filter(function(r){return r[5]>=x[2]&&r[5]<x[3]}).length;
      return n?'<button type="button" data-size="'+x[0]+'" aria-pressed="'+(x[0]===size)+'">'+x[1]+'（'+n+'）</button>':''; }).join('')+'</div>';
    if(!rows.length){ $('kResult').innerHTML=sizeBar+'<p class="v-warn">這個坪數沒有成交。</p>'; bindSize(t,road,g); return; }
    var html='<div class="v-price"><span>'+esc(t)+'</span><b class="rt-title">'+esc(cur.label)+'</b>'+
      '<span class="v-unit">近三年 <b>'+rows.length+'</b> 筆成交・最近一筆 <b>'+rows[0][2]+' 年 Q'+rows[0][3]+'</b>・全部中位 '+all.toFixed(1)+' 萬/坪</span></div>'+sizeBar;
    html+='<div class="rt-kpis"><div><span>近一年中位單價</span><b>'+(m1!=null?m1.toFixed(1)+' 萬':'沒有成交')+'</b><small>'+y1.length+' 筆</small></div>'+
      '<div><span>前一年中位單價</span><b>'+(m0!=null?m0.toFixed(1)+' 萬':'沒有成交')+'</b><small>'+y0.length+' 筆</small></div>'+
      '<div><span>一年漲跌</span><b class="'+(m1&&m0?(m1>=m0?'up':'down'):'')+'">'+(m1&&m0?RT.pct((m1/m0-1)*100):'—')+'</b><small>單價中位數比較</small></div></div>';
    if(fresh) html+='<div class="v-judge v-good"><b>🔔 上次看過之後，有 '+fresh+' 筆新成交</b>表格裡標「新」的就是。</div>';
    html+='<h3 class="rt-h3">每季成交中位單價（萬元／坪，不含車位）</h3>'+chart(rows);
    html+='<div class="v-table-wrap"><table class="v-table"><thead><tr><th>成交</th><th>樓層</th><th>坪數</th><th>單價</th><th>房屋總價</th><th>車位</th></tr></thead><tbody>'+
      rows.map(function(r){ var n=seen!=null&&sid(r)>seen;
        return '<tr'+(n?' class="rt-new"':'')+'><td>'+r[2]+' Q'+r[3]+(n?' <span class="rt-badge">新</span>':'')+'</td><td>'+(r[6]||'-')+'/'+(r[7]||'-')+'</td><td>'+r[5].toFixed(1)+'</td><td>'+r[4].toFixed(1)+'</td><td>'+RT.comma(r[4]*r[5])+' 萬</td><td>'+(r[11]?r[11]+' 萬':'-')+'</td></tr>'; }).join('')+
      '</tbody></table></div><p class="v-note">實價登錄只公布到季，不公布門牌號碼與日期；房屋總價不含車位。</p>';
    var msg='容瑜你好，我想追蹤「'+t+cur.label+'」的實價登錄，有新成交的時候麻煩通知我。';
    html+='<div class="rt-actions"><button type="button" class="btn" id="kWatch">'+(w?'✓ 已在追蹤清單（更新為已讀）':'＋ 加入我的追蹤清單')+'</button>'+
      '<a class="btn btn-line" href="'+RT.LINE_URL+'" target="_blank" rel="noopener" data-rt-line="'+esc(msg)+'" data-toast="kToast">有新成交請容瑜 LINE 我</a></div><p class="toast" id="kToast" role="status"></p>';
    $('kResult').innerHTML=html; bindSize(t,road,g);
    $('kWatch').onclick=function(){
      var list=RT.store.get(KEY,[]).filter(function(x){return x.id!==cur.id});
      list.unshift({id:cur.id,t:t,road:road,key:g.key,label:cur.label,seen:Math.max.apply(null,allRows.map(sid)),n:allRows.length});
      var ok=RT.store.set(KEY,list);
      $('kToast').textContent=ok?'已加入追蹤清單（存在這個瀏覽器）。實價登錄每季更新，下次打開這頁就會標出新成交。':'這個瀏覽器不能存資料（可能是無痕模式），改用 LINE 請我幫你盯。';
      this.textContent='✓ 已在追蹤清單（更新為已讀）'; renderWatch();
    };
  }

  function bindSize(t,road,g){
    $('kResult').querySelectorAll('[data-size]').forEach(function(b){ b.addEventListener('click',function(){ show(t,road,g,b.getAttribute('data-size')); }); });
  }

  function renderWatch(){
    var list=RT.store.get(KEY,[]);
    if(!list.length){ $('kWatchList').innerHTML=''; return; }
    Promise.all(list.map(function(w){return RT.town(w.t).then(function(d){
      var n=d.rows.filter(function(r){return d.roads[r[0]]===w.road&&!r[13]&&ckey(r)===w.key&&sid(r)>w.seen}).length; return {w:w,n:n}; })})).then(function(rs){
      $('kWatchList').innerHTML='<h2>我的追蹤清單</h2><div class="rt-glist">'+rs.map(function(x){
        return '<div class="rt-witem"><button type="button" data-w="'+esc(x.w.id)+'"><b>'+esc(x.w.t+' '+x.w.label)+'</b><span>'+(x.n?'<em class="rt-badge">'+x.n+' 筆新成交</em>':'沒有新成交')+'</span></button>'+
          '<button type="button" class="rt-x" data-del="'+esc(x.w.id)+'" aria-label="取消追蹤">×</button></div>'; }).join('')+'</div>';
    });
  }
  $('kWatchList').addEventListener('click',function(e){
    var del=e.target.closest('[data-del]');
    if(del){ RT.store.set(KEY,RT.store.get(KEY,[]).filter(function(x){return x.id!==del.getAttribute('data-del')})); renderWatch(); return; }
    var b=e.target.closest('[data-w]'); if(!b) return;
    var w=RT.store.get(KEY,[]).filter(function(x){return x.id===b.getAttribute('data-w')})[0]; if(!w) return;
    RT.town(w.t).then(function(d){ var ri=d.roads.indexOf(w.road), g=groups(d,ri).filter(function(g){return g.key===w.key})[0];
      if(g){ $('kTown').value=w.t; $('kRoad').value=w.road; show(w.t,w.road,g); $('kResult').scrollIntoView({behavior:'smooth'}); } });
  });

  $('kTown').addEventListener('change',function(){
    var t=this.value; $('kGroups').innerHTML=''; if(!t) return;
    RT.town(t).then(function(d){ $('kRoadList').innerHTML=d.roads.map(function(r){return '<option value="'+esc(r)+'">'}).join(''); $('kRoad').placeholder='例：'+d.roads.slice(0,2).join('、'); });
  });
  $('kForm').addEventListener('submit',function(e){ e.preventDefault(); showGroups(); });
  $('kRoad').addEventListener('change',showGroups);

  RT.meta().then(function(m){ meta=m; RT.fillTowns($('kTown'),m,'中壢區'); $('kTown').dispatchEvent(new Event('change')); $('kUpdated').textContent=m.updated; renderWatch(); });
})();
