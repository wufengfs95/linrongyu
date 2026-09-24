/* 委託物件競品分析：屋主的房子＋想開的價 → 同社區／同路段實價登錄成交＋手動輸入的在售競品 → 開價落點、建議開價、屋主溝通版 */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc;
  var meta=null, kind='a', PARK_AREA=10;   // 在售競品含車位時，車位坪數先抓 10 坪

  function compRow(v){
    v=v||{};
    var div=document.createElement('div'); div.className='rt-comp';
    div.innerHTML='<input type="number" inputmode="numeric" placeholder="開價（萬）" aria-label="競品開價（萬）" data-f="p" value="'+esc(v.p||'')+'">'+
      '<input type="number" inputmode="decimal" step="0.1" placeholder="權狀坪數" aria-label="競品權狀坪數" data-f="a" value="'+esc(v.a||'')+'">'+
      '<select aria-label="競品車位" data-f="k"><option value="">無車位</option><option value="1"'+(v.k?' selected':'')+'>有車位</option></select>'+
      '<input type="text" placeholder="樓層／備註（選填）" aria-label="競品備註" data-f="n" value="'+esc(v.n||'')+'">'+
      '<button type="button" class="rt-x" aria-label="刪除這筆">×</button>';
    $('cComps').appendChild(div);
  }
  function comps(){
    return [].map.call($('cComps').querySelectorAll('.rt-comp'),function(d){
      var o={}; d.querySelectorAll('[data-f]').forEach(function(i){o[i.getAttribute('data-f')]=i.value.trim()}); return o;
    }).filter(function(o){return RT.num(o.p)>0&&RT.num(o.a)>0});
  }
  function input(){
    return {kind:kind, town:$('cTown').value, road:$('cRoad').value.trim(), lane:RT.val('cLane'), built:RT.val('cBuilt'),
            area:RT.val('cArea'), floor:RT.val('cFloor'), tops:RT.val('cTops'), park:$('cPark').value, ask:RT.val('cAsk'), comps:comps()};
  }

  function findDeals(inp,d){
    var ri=RT.roadIndex(d,inp.road), idx=meta.towns[inp.town].index, last=meta.seasons[meta.seasons.length-1];
    var ly=+last.slice(0,3), lq=+last.slice(4), age=inp.built?ly-inp.built:null;
    var map=function(r,adj){ return {u:adj?r[4]*(idx[r[2]+'S'+r[3]]||1):r[4], raw:r[4], y:r[2], q:r[3], a:r[5], f:r[6], tf:r[7], by:r[10], road:d.roads[r[0]]||'', lane:r[9]}; };
    var ok=function(r){ return r[1]===inp.kind&&!r[13]; };
    if(ri>=0&&inp.built){
      var sc=d.rows.filter(function(r){ return ok(r)&&r[0]===ri&&Math.abs(r[10]-inp.built)<=1&&(inp.lane?r[9]===inp.lane:(!inp.tops||r[7]===inp.tops))
        &&(!inp.area||Math.abs(r[5]-inp.area)/inp.area<=.45); });   // 排除同社區的套房、大坪數
      if(sc.length>=3) return {rows:sc.map(function(r){return map(r,false)}), scope:'同社區（'+inp.road+(inp.lane?inp.lane+'巷':'')+'・民國 '+inp.built+' 年完工）', community:true};
    }
    var near=function(r,roadOnly,seasons,ageTol,areaTol){
      if(!ok(r)) return false;
      if(roadOnly&&r[0]!==ri) return false;
      if((ly-r[2])*4+(lq-r[3])>seasons) return false;
      if(inp.area&&Math.abs(r[5]-inp.area)/inp.area>areaTol) return false;
      if(age!=null&&r[8]>=0&&Math.abs(r[8]-age)>ageTol) return false;
      return true;
    };
    var tries=[[true,8,6,.35,'同路段（'+inp.road+'）近 2 年、屋齡坪數相近'],[true,12,10,.5,'同路段（'+inp.road+'）近 3 年'],
               [false,6,6,.3,inp.town+'近 1.5 年、屋齡坪數相近'],[false,12,12,.5,inp.town+'近 3 年']];
    for(var i=0;i<tries.length;i++){
      var t=tries[i]; if(t[0]&&ri<0) continue;
      var rs=d.rows.filter(function(r){return near(r,t[0],t[1],t[2],t[3])});
      if(rs.length>=5) return {rows:rs.map(function(r){return map(r,true)}), scope:t[4], community:false};
    }
    return {rows:[],scope:'',community:false};
  }

  function strip(deals,mine,cs,lo,hi){
    var all=deals.map(function(x){return x.u}).concat(cs.map(function(c){return c.u})); if(mine) all.push(mine);
    var min=Math.min.apply(null,all)*.95, max=Math.max.apply(null,all)*1.05, W=640;
    var X=function(v){return 20+(v-min)/(max-min)*(W-40)};
    var s='<svg class="rt-strip" viewBox="0 0 '+W+' 120" role="img" aria-label="單價落點圖">'+
      '<rect x="'+X(lo)+'" y="30" width="'+(X(hi)-X(lo))+'" height="44" rx="6" class="band"/>'+
      '<text x="'+X((lo+hi)/2)+'" y="24" text-anchor="middle" class="lb">行情區間 '+lo.toFixed(1)+'～'+hi.toFixed(1)+'</text>';
    deals.forEach(function(x,i){ s+='<circle cx="'+X(x.u)+'" cy="'+(44+(i%3)*8)+'" r="4" class="deal"><title>成交 '+x.u.toFixed(1)+' 萬/坪</title></circle>'; });
    cs.forEach(function(c,i){ s+='<rect x="'+(X(c.u)-5)+'" y="'+(80+(i%2)*10)+'" width="10" height="10" class="comp"><title>在售 '+c.u.toFixed(1)+' 萬/坪</title></rect>'; });
    if(mine) s+='<line x1="'+X(mine)+'" x2="'+X(mine)+'" y1="28" y2="104" class="mine"/><text x="'+Math.min(Math.max(X(mine),50),W-50)+'" y="116" text-anchor="middle" class="lb mine-t">屋主開價 '+mine.toFixed(1)+'</text>';
    return s+'</svg><p class="rt-legend"><span class="i deal"></span>實價登錄成交 <span class="i comp"></span>在售競品 <span class="i mine"></span>屋主開價（萬/坪，不含車位）</p>';
  }

  function calc(){
    var inp=input();
    if(!inp.town||!inp.area){ $('cResult').innerHTML='<div class="v-empty"><b>先填行政區和坪數</b><p>路段、巷、完工年都填，才找得到同社區的成交。</p></div>'; return; }
    RT.town(inp.town).then(function(d){
      var got=findDeals(inp,d), deals=got.rows;
      if(!deals.length){ $('cResult').innerHTML='<p class="v-warn">找不到夠多的相近成交，請確認路段名稱，或放寬條件（不填完工年）。</p>'; return; }
      var us=deals.map(function(x){return x.u}), mid=RT.median(us), lo=RT.quantile(us,.25), hi=RT.quantile(us,.75);
      var parkV=inp.park?(meta.towns[inp.town].park[inp.park]||(inp.park==='平面'?150:90)):0;
      var deal=mid*inp.area+parkV, listLo=Math.round(deal*1.05/10)*10-2, listHi=Math.round(deal*1.08/10)*10+8;
      var mine=inp.ask?(inp.ask-parkV)/inp.area:0;
      var cs=inp.comps.map(function(c){ var a=RT.num(c.a)-(c.k?PARK_AREA:0), p=RT.num(c.p)-(c.k?parkV||120:0); return {u:p/a,p:RT.num(c.p),a:RT.num(c.a),k:c.k,n:c.n}; }).filter(function(c){return c.u>0&&isFinite(c.u)});
      var pos=mine?us.filter(function(u){return u<mine}).length/us.length*100:0;
      var html='<div class="v-price"><span>預估成交價（'+esc(got.scope)+'）</span><b>'+RT.wan(deal)+'</b>'+
        '<span class="v-unit">成交中位單價 <b>'+mid.toFixed(1)+' 萬/坪</b>（行情區間 '+lo.toFixed(1)+'～'+hi.toFixed(1)+'）'+(parkV?'＋車位約 '+parkV+' 萬':'')+'</span></div>'+
        '<div class="v-meta"><span>比對 <b>'+deals.length+'</b> 筆成交</span><span>建議開價 <b>'+listLo+'～'+listHi+' 萬</b></span>'+(cs.length?'<span>在售競品 <b>'+cs.length+'</b> 間</span>':'')+'</div>';
      var verdict='';
      if(mine){
        var gap=(mine/mid-1)*100, rank=cs.filter(function(c){return c.u<mine}).length+1;
        var cls=gap>15?'v-bad':gap>8?'v-ok':gap<-3?'v-good':'v-ok';
        verdict=gap>15?'開價比成交行情高 '+gap.toFixed(0)+'%，會變成比較基準裡最貴的一間，買方多半直接略過，帶看量會很少。':
                gap>8?'開價比成交行情高 '+gap.toFixed(0)+'%，在合理議價空間的上緣，可以試水溫 2～4 週，沒帶看就要調。':
                gap>=-3?'開價在行情附近（'+RT.pct(gap,0)+'），保留了正常議價空間，是好賣的價格。':
                '開價比成交行情低 '+(-gap).toFixed(0)+'%，會很快成交，但可能少賺，建議再確認一次。';
        html+='<div class="v-judge '+cls+'"><b>屋主開價 '+RT.wan(inp.ask)+'（房屋單價 '+mine.toFixed(1)+' 萬/坪）</b>'+esc(verdict)+
          '<br>比 '+pos.toFixed(0)+'% 的成交還貴'+(cs.length?'；在 '+(cs.length+1)+' 間在售物件裡，單價排第 '+rank+' 便宜':'')+'。</div>';
      }
      html+=strip(deals,mine,cs,lo,hi);
      // 近期成交表
      var recent=deals.slice().sort(function(a,b){return b.y-a.y||b.q-a.q}).slice(0,12);
      html+='<details class="v-samples" open><summary>比對的成交（最近 '+recent.length+' 筆）</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>成交</th><th>位置</th><th>樓層</th><th>坪數</th><th>單價</th><th>房屋總價</th></tr></thead><tbody>'+
        recent.map(function(x){return '<tr><td>'+x.y+' Q'+x.q+'</td><td>'+esc(x.road+(x.lane?x.lane+'巷':''))+'</td><td>'+(x.f||'-')+'/'+(x.tf||'-')+'</td><td>'+x.a.toFixed(1)+'</td><td>'+x.raw.toFixed(1)+'</td><td>'+RT.comma(x.raw*x.a)+' 萬</td></tr>'}).join('')+
        '</tbody></table></div>'+(got.community?'':'<p class="v-note">非同社區的成交已依行政區每季行情校正到最新一季。</p>')+'</details>';
      if(cs.length) html+='<details class="v-samples" open><summary>在售競品</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>備註</th><th>車位</th><th>開價</th><th>坪數</th><th>換算單價</th></tr></thead><tbody>'+
        cs.sort(function(a,b){return a.u-b.u}).map(function(c){return '<tr><td>'+esc(c.n||'-')+'</td><td>'+(c.k?'有':'無')+'</td><td>'+RT.comma(c.p)+' 萬</td><td>'+c.a+'</td><td>'+c.u.toFixed(1)+'</td></tr>'}).join('')+
        '</tbody></table></div><p class="v-note">有車位的競品已扣掉估計車位價（'+(parkV||120)+' 萬）和車位坪數（約 '+PARK_AREA+' 坪），再換算房屋單價。</p></details>';
      // 屋主溝通版
      var talk='【'+(inp.road||inp.town)+(inp.lane?inp.lane+'巷':'')+' 行情分析】\n'+
        '我把'+got.scope+'近期的實價登錄都拉出來比過了，共 '+deals.length+' 筆，成交單價大多落在 '+lo.toFixed(1)+'～'+hi.toFixed(1)+' 萬/坪，中位數 '+mid.toFixed(1)+' 萬。\n'+
        '以您家 '+inp.area+' 坪'+(parkV?'＋車位':'')+' 來算，合理成交價大約 '+RT.wan(deal)+'。\n'+
        (cs.length?'目前附近同時在賣的還有 '+cs.length+' 間，開價換算單價 '+Math.min.apply(null,cs.map(function(c){return c.u})).toFixed(1)+'～'+Math.max.apply(null,cs.map(function(c){return c.u})).toFixed(1)+' 萬/坪，買方一定會拿來比。\n':'')+
        (mine?'您想開的 '+RT.wan(inp.ask)+'，'+verdict+'\n':'')+
        '我的建議是開 '+listLo+'～'+listHi+' 萬，保留議價空間，也不會被買方的價格篩選擋掉。\n'+
        '資料來源：內政部實價登錄（'+meta.updated+'）。有巢氏房屋 中壢環中加盟店 林容瑜 0973-263-569';
      html+='<h3 class="rt-h3">屋主溝通版</h3><textarea class="rt-talk" id="cTalk" rows="9">'+esc(talk)+'</textarea>'+
        '<div class="rt-actions"><button type="button" class="btn" id="cCopy">複製文字</button><button type="button" class="btn btn-ghost" id="cShare">複製分析連結</button>'+
        '<a class="btn btn-line" href="'+RT.LINE_URL+'" target="_blank" rel="noopener" data-rt-line="'+esc(talk)+'" data-toast="cToast">LINE 請容瑜實際評估</a></div><p class="toast" id="cToast" role="status"></p>'+
        '<p class="v-disclaimer">本分析依內政部實價登錄成交資料自動統計，非不動產估價師的估價報告；屋況、景觀、樓層、裝潢會影響實際價格。</p>';
      $('cResult').innerHTML=html;
      $('cCopy').onclick=function(){ RT.copy($('cTalk').value,$('cToast'),'已複製，可以直接貼給屋主。'); };
      $('cShare').onclick=function(){
        var h={k:inp.kind,t:inp.town,r:inp.road,l:inp.lane||'',b:inp.built||'',a:inp.area,f:inp.floor||'',tf:inp.tops||'',pk:inp.park,ask:inp.ask||'',
               c:inp.comps.map(function(c){return [c.p,c.a,c.k?1:0,c.n.replace(/[|~]/g,' ')].join('~')}).join('|')};
        history.replaceState(null,'',RT.hashUrl(h)); RT.copy(location.href,$('cToast'),'已複製分析連結，打開就會直接看到這份分析。');
      };
    });
  }

  function setKind(k){ kind=k; document.querySelectorAll('#cKinds button').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-k')===k?'true':'false')}); }
  document.querySelectorAll('#cKinds button').forEach(function(b){ b.addEventListener('click',function(){ setKind(b.getAttribute('data-k')); }); });
  $('cTown').addEventListener('change',function(){
    var t=this.value; if(!t) return;
    RT.town(t).then(function(d){ $('cRoadList').innerHTML=d.roads.map(function(r){return '<option value="'+esc(r)+'">'}).join(''); $('cRoad').placeholder='例：'+d.roads.slice(0,2).join('、'); });
  });
  $('cAdd').addEventListener('click',function(){ compRow(); });
  $('cComps').addEventListener('click',function(e){ var x=e.target.closest('.rt-x'); if(x) x.parentNode.remove(); });
  $('cForm').addEventListener('submit',function(e){ e.preventDefault(); calc(); if(window.innerWidth<900) $('cResult').scrollIntoView({behavior:'smooth'}); });

  RT.meta().then(function(m){
    meta=m; var h=RT.hashGet();
    RT.fillTowns($('cTown'),m,h.t||'中壢區');
    $('cUpdated').textContent=m.updated;
    $('cTown').dispatchEvent(new Event('change'));
    if(h.t){
      setKind(h.k||'a'); $('cRoad').value=h.r||''; $('cLane').value=h.l||''; $('cBuilt').value=h.b||''; $('cArea').value=h.a||'';
      $('cFloor').value=h.f||''; $('cTops').value=h.tf||''; $('cPark').value=h.pk||''; $('cAsk').value=h.ask||'';
      (h.c||'').split('|').filter(Boolean).forEach(function(s){ var p=s.split('~'); compRow({p:p[0],a:p[1],k:p[2]==='1',n:p[3]}); });
      calc();
    }
    if(!$('cComps').children.length){ compRow(); compRow(); }
  });
})();
