/* 委託物件競品分析：屋主的房子＋想開的價 → 同社區／同路段實價登錄成交＋手動輸入的在售競品 → 開價落點、建議開價、屋主溝通版 */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc;
  var meta=null, kind='a';
  var xmeta=null, xcache={};                 // 非住宅與土地走另一份資料（extra_data.py 產的 x-*.json）
  var isX=function(k){ return 'abcd'.indexOf(k)<0; };
  var isLand=function(k){ return k.charAt(0)==='L'||k.charAt(0)==='N'; };
  function xMeta(){
    if(xmeta) return Promise.resolve(xmeta);
    return fetch(RT.dataRoot+'x-meta.json').then(function(r){return r.json()}).then(function(m){xmeta=m;return m});
  }
  function xTown(t){
    if(xcache[t]) return Promise.resolve(xcache[t]);
    return fetch(RT.dataRoot+'x-'+encodeURIComponent(t)+'.json')
      .then(function(r){ if(!r.ok) throw new Error('no town'); return r.json(); })
      .then(function(d){ xcache[t]=d; return d; });
  }
  // 車位坪數：車格本身只有 4.16 坪（建築技術規則 60 條 2.5×5.5m），權狀上多出來的是車道分攤。
  // 這組數字對得上不動產估價師公會第十號公報的經驗值，也對得上她自己實價登錄的中位數
  // （中壢平面 9.63、機械 4.86 坪）
  var PARK_AREA={'平面':10,'機械':5};
  // 車位產權型態 → 要不要扣價、要不要從權狀坪數扣坪
  var PK={'0':{t:'無車位',price:0,area:0},
          '1':{t:'車位有獨立坪數',price:1,area:1},
          '2':{t:'車位含在公設',price:1,area:1,est:1},
          '3':{t:'無產權／約定專用',price:0,area:0,note:'權狀坪不含車位'},
          '9':{t:'車位狀況待確認',price:0,area:0,ask:1}};
  var BOOKMARKLET="javascript:(function(){var P=function(t){var m,b=0,re=/([\\d,]+(?:\\.\\d+)?)\\s*(億|萬)/g;while(m=re.exec(t)){var v=parseFloat(m[1].replace(/,/g,''));if(m[2]==='億')v*=1e4;if(v>b)b=v}return Math.round(b)};var A=function(t){var m=t.match(/權狀[^\\d]{0,4}([\\d.]+)\\s*坪/)||t.match(/([\\d.]+)\\s*坪/);return m?parseFloat(m[1]):0};var ok=function(e){if(e.children.length>12)return false;var t=e.innerText||'';return !!t&&t.length<=300&&/萬/.test(t)&&/坪/.test(t)};var all=[].filter.call(document.querySelectorAll('div,li,article,section,a'),ok);var leaf=all.filter(function(e){return !all.some(function(o){return o!==e&&e.contains(o)})});var seen={},out=[];leaf.forEach(function(e){var t=e.innerText.replace(/\\s+/g,' ').trim();var p=P(t),a=A(t);if(!(p>=100&&p<=5e4)||!(a>=3&&a<=500))return;var u=p/a;if(!(u>=3&&u<=200))return;var k=/車位/.test(t)&&!/無車位/.test(t)?9:0;var key=p+'_'+a;if(seen[key])return;seen[key]=1;out.push([p,a,k,t.split(' ')[0].slice(0,14).replace(/[|~]/g,' ')].join('~'))});if(!out.length){alert('這一頁沒有抓到物件。請在「搜尋結果列表」頁按，並先往下捲讓物件載入出來。');return}var u='__URL__#__TAB__c='+encodeURIComponent(out.slice(0,25).join('|'));if(!window.open(u,'_blank'))location.href=u})()";

  function compRow(v){
    v=v||{};
    var div=document.createElement('div'); div.className='rt-comp';
    div.setAttribute('data-pt',v.pt||'平面');
    div.innerHTML='<input type="number" inputmode="numeric" placeholder="開價（萬）" aria-label="競品開價（萬）" data-f="p" value="'+esc(v.p||'')+'">'+
      '<input type="number" inputmode="decimal" step="0.1" placeholder="權狀坪數" aria-label="競品權狀坪數" data-f="a" value="'+esc(v.a||'')+'">'+
      '<select aria-label="競品車位" data-f="k">'+
        ['0','1','2','3','9'].map(function(c){
          return '<option value="'+c+'"'+(String(v.k||'0')===c?' selected':'')+'>'+PK[c].t+'</option>';
        }).join('')+'</select>'+
      '<input type="number" inputmode="decimal" step="0.1" placeholder="車位坪" aria-label="競品車位坪數" data-f="pa" value="'+esc(v.pa||'')+'">'+
      '<input type="text" placeholder="樓層／備註（選填）" aria-label="競品備註" data-f="n" value="'+esc(v.n||'')+'">'+
      '<button type="button" class="rt-x" aria-label="刪除這筆">×</button>';
    $('cComps').appendChild(div);
  }
  function comps(){
    return [].map.call($('cComps').querySelectorAll('.rt-comp'),function(d){
      var o={}; d.querySelectorAll('[data-f]').forEach(function(i){o[i.getAttribute('data-f')]=i.value.trim()});
      o.pt=d.getAttribute('data-pt')||'平面';
      return o;
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

  function findDealsX(inp,d){
    var ri=(function(){ var t=(inp.road||'').trim(); if(!t) return -1;
      var i=d.roads.indexOf(t); if(i>=0) return i;
      for(var k=0;k<d.roads.length;k++){ if(d.roads[k].indexOf(t)===0||t.indexOf(d.roads[k])===0) return k; }
      return -1; })();
    var last=xmeta.seasons[xmeta.seasons.length-1], ly=+last.slice(0,3), lq=+last.slice(4);
    // x 資料沒有時間指數，單價不做時間校正，所以用「近幾季」控制可比性
    var map=function(r){ return {u:r[4], raw:r[4], y:r[2], q:r[3], a:r[5], f:0, tf:0, by:0,
                                 road:d.roads[r[0]]||'', lane:0}; };
    var near=function(r,roadOnly,seasons,areaTol){
      if(r[1]!==inp.kind) return false;
      if(roadOnly&&r[0]!==ri) return false;
      if((ly-r[2])*4+(lq-r[3])>seasons) return false;
      if(inp.area&&areaTol&&Math.abs(r[5]-inp.area)/inp.area>areaTol) return false;
      return true;
    };
    var nm=(xmeta.kindName||{})[inp.kind]||'同類型';
    var tries=[[true,8,.4,'同路段（'+inp.road+'）近 2 年、坪數相近的'+nm],
               [true,12,.7,'同路段（'+inp.road+'）近 3 年的'+nm],
               [false,6,.4,inp.town+'近 1.5 年、坪數相近的'+nm],
               [false,12,.7,inp.town+'近 3 年的'+nm],
               [false,12,0,inp.town+'近 3 年全部的'+nm]];
    for(var i=0;i<tries.length;i++){
      var t=tries[i]; if(t[0]&&ri<0) continue;
      var rs=d.rows.filter(function(r){return near(r,t[0],t[1],t[2])});
      if(rs.length>=5) return {rows:rs.map(map), scope:t[3], community:false};
    }
    return {rows:[],scope:'',community:false};
  }


  // ── 客戶版表格 ────────────────────────────────────────
  // 她的流程：先一鍵產生預覽看過，確定 OK 才列印。所以這裡只產生畫面，不自動開列印。
  function makeReport(inp,got,deals,cs,r){
    var band = !r.mine ? null
      : (function(g){
          return g>15 ? {k:'high', t:'明顯高於行情', c:'這個價格會變成比較基準裡最貴的一間，買方多半直接略過。'}
               : g>8  ? {k:'over', t:'略高於行情',   c:'在合理議價空間的上緣，可以試水溫 2～4 週，沒帶看就要調整。'}
               : g>=-3? {k:'fit',  t:'符合行情',     c:'開在行情附近，保留了正常議價空間，是好賣的價格。'}
               :        {k:'low',  t:'低於行情',     c:'會很快成交，但可能少賺，建議再確認一次。'};
        })((r.mine/r.mid-1)*100);

    var now=new Date();
    var d=now.getFullYear()-1911+' 年 '+(now.getMonth()+1)+' 月 '+now.getDate()+' 日';
    var kn=(meta.kindName&&meta.kindName[inp.kind])||(xmeta&&xmeta.kindName&&xmeta.kindName[inp.kind])||'';
    var where=inp.town+(inp.road?' '+inp.road:'')+(inp.lane?inp.lane+'巷':'');

    var rows=function(list){
      return list.slice().sort(function(a,b){return a.u-b.u}).map(function(c){
        return '<tr><td>'+esc(c.n||'—')+'</td><td>'+PK[c.k].t+'</td><td class="n">'+RT.comma(c.p)+'</td>'+
               '<td class="n">'+c.a+'</td><td class="n">'+c.u.toFixed(1)+'</td></tr>';
      }).join('');
    };
    var solid=cs.filter(function(c){return !c.ask&&c.k!=='3'});

    var recent=deals.slice().sort(function(a,b){return b.y-a.y||b.q-a.q}).slice(0,10);

    $('cReport').innerHTML=
      '<div class="cr-head"><div><b>委託物件行情分析</b><small>'+esc(where)+(kn?'・'+esc(kn):'')+'　'+inp.area+' 坪</small></div>'+
        '<div class="cr-date">'+d+'</div></div>'+
      (band?'<div class="cr-band cr-'+band.k+'"><span>屋主開價 '+RT.wan(inp.ask)+'</span><b>'+band.t+'</b>'+
        '<p>'+esc(band.c)+'</p></div>':'')+
      '<div class="cr-cards">'+
        '<div><span>成交中位單價</span><b>'+r.mid.toFixed(1)+' 萬/坪</b></div>'+
        '<div><span>預估成交價</span><b>'+RT.wan(r.deal)+'</b></div>'+
        '<div><span>建議開價</span><b>'+r.listLo+'～'+r.listHi+' 萬</b></div>'+
      '</div>'+
      '<div class="cr-sec"><h3>行情依據</h3><p>'+esc(got.scope)+'，共 '+deals.length+' 筆實價登錄成交，'+
        '單價落在 '+r.lo.toFixed(1)+'～'+r.hi.toFixed(1)+' 萬/坪。'+
        (r.mine?'屋主開價換算房屋單價 '+r.mine.toFixed(1)+' 萬/坪，比 '+r.pos.toFixed(0)+'% 的成交還貴。':'')+'</p>'+
        '<table class="cr-tab"><thead><tr><th>成交</th><th>位置</th><th>樓層</th><th>坪數</th><th>單價</th></tr></thead><tbody>'+
        recent.map(function(x){return '<tr><td>'+x.y+' Q'+x.q+'</td><td>'+esc(x.road+(x.lane?x.lane+'巷':''))+'</td>'+
          '<td class="n">'+(x.f||'—')+(x.tf?'/'+x.tf:'')+'</td><td class="n">'+x.a.toFixed(1)+'</td>'+
          '<td class="n">'+x.raw.toFixed(1)+'</td></tr>'}).join('')+'</tbody></table></div>'+
      (solid.length?'<div class="cr-sec"><h3>附近在售的競品</h3>'+
        '<table class="cr-tab"><thead><tr><th>物件</th><th>車位</th><th>開價(萬)</th><th>權狀坪</th><th>單價</th></tr></thead>'+
        '<tbody>'+rows(solid)+'</tbody></table>'+
        '<p class="cr-note">單價皆已換算成不含車位的房屋單價，基準一致才能互相比較。</p></div>':'')+
      '<div class="cr-foot"><p>資料來源：內政部不動產交易實價查詢服務網（'+esc(meta.updated||'')+'）。'+
        '本分析為依成交資料自動統計的參考值，非不動產估價師之估價報告；屋況、景觀、樓層、裝潢均會影響實際成交價。</p>'+
        '<p class="cr-me"><b>有巢氏房屋　中壢環中加盟店　林容瑜</b>　0973-263-569</p></div>';

    $('cReportWrap').hidden=false;
    $('cReportWrap').scrollIntoView({block:'start',behavior:'smooth'});
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
    var load=isX(inp.kind)
      ? xMeta().then(function(){ return xTown(inp.town); }).then(function(d){ return {d:d,x:true}; })
      : RT.town(inp.town).then(function(d){ return {d:d,x:false}; });
    load.then(function(w){
      var d=w.d;
      var got=w.x?findDealsX(inp,d):findDeals(inp,d), deals=got.rows;
      if(!deals.length){ $('cResult').innerHTML='<p class="v-warn">找不到夠多的相近成交，請確認路段名稱，或放寬條件（不填完工年）。</p>'; return; }
      var us=deals.map(function(x){return x.u}), mid=RT.median(us), lo=RT.quantile(us,.25), hi=RT.quantile(us,.75);
      var parkV=inp.park?(meta.towns[inp.town].park[inp.park]||(inp.park==='平面'?150:90)):0;
      var deal=mid*inp.area+parkV, listLo=Math.round(deal*1.05/10)*10-2, listHi=Math.round(deal*1.08/10)*10+8;
      var mine=inp.ask?(inp.ask-parkV)/inp.area:0;
      // 車位行情用她自己實價登錄算出來的分區中位數，不要寫死
      var tp=(meta.towns[inp.town]||{}).park||{};
      var cs=inp.comps.map(function(c){
        var rule=PK[String(c.k||'0')]||PK['0'];
        var pt=(c.pt==='機械')?'機械':'平面';
        var pv=rule.price?(tp[pt]||tp['平面']||150):0;
        var pa=rule.area?(RT.num(c.pa)||PARK_AREA[pt]):0;
        var a=RT.num(c.a)-pa, p=RT.num(c.p)-pv;
        return {u:p/a,p:RT.num(c.p),a:RT.num(c.a),k:String(c.k||'0'),n:c.n,
                pv:pv,pa:pa,est:!!rule.est,ask:!!rule.ask};
      }).filter(function(c){return c.u>0&&isFinite(c.u)&&c.a>c.pa+5});
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
      // 車位基準一樣的才放在一起比。「無產權車位」權狀坪本來就不含車位、
      // 書籤抓回來的又看不出含不含，這兩種單價基準不同，混在一起取中位數會歪
      var ctab=function(list,title,note,open){
        if(!list.length) return '';
        return '<details class="v-samples"'+(open?' open':'')+'><summary>'+title+'（'+list.length+' 間）</summary>'+
          '<div class="v-table-wrap"><table class="v-table"><thead><tr><th>備註</th><th>車位</th><th>開價</th><th>權狀坪</th><th>換算單價</th></tr></thead><tbody>'+
          list.slice().sort(function(a,b){return a.u-b.u}).map(function(c){
            return '<tr><td>'+esc(c.n||'-')+'</td><td>'+PK[c.k].t+(c.est?'<small>（坪數估計）</small>':'')+'</td><td>'+
              RT.comma(c.p)+' 萬</td><td>'+c.a+'</td><td>'+c.u.toFixed(1)+'</td></tr>';
          }).join('')+'</tbody></table></div><p class="v-note">'+note+'</p></details>';
      };
      var solid=cs.filter(function(c){return !c.ask&&c.k!=='3'});
      var loose=cs.filter(function(c){return c.ask||c.k==='3'});
      html+=ctab(solid,'在售競品・已換算成不含車位的房屋單價',
        '車位價用'+inp.town+'實價登錄的車位成交中位數（平面 '+(tp['平面']||'—')+' 萬、機械 '+(tp['機械']||'—')+
        ' 萬）扣除；車位坪數有填就用填的，沒填用平面 10 坪、機械 5 坪估。標「坪數估計」的是車位含在公設、'+
        '沒有獨立登記坪數，數字是推估的，跟屋主說明時要講清楚。',1);
      html+=ctab(loose,'在售競品・車位基準不同，單獨看',
        '這一組<b>沒有</b>扣車位，所以單價不能跟上面那組直接比。'+
        '「無產權／約定專用」的車位不在權狀坪數裡，扣了會把單價算高三成；'+
        '「待確認」是書籤從 591 抓回來的，591 的列表沒有車位欄位，看不出坪數含不含車位，'+
        '請你確認後在上面把車位欄位改掉，它就會併進上面那組。');
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
        '<button type="button" class="btn btn-main" id="cMake">📄 產生客戶版表格</button>'+
        '<a class="btn btn-line" href="'+RT.LINE_URL+'" target="_blank" rel="noopener" data-rt-line="'+esc(talk)+'" data-toast="cToast">LINE 請容瑜實際評估</a></div><p class="toast" id="cToast" role="status"></p>'+
        '<p class="v-disclaimer">本分析依內政部實價登錄成交資料自動統計，非不動產估價師的估價報告；屋況、景觀、樓層、裝潢會影響實際價格。</p>';
      $('cResult').innerHTML=html;
      $('cCopy').onclick=function(){ RT.copy($('cTalk').value,$('cToast'),'已複製，可以直接貼給屋主。'); };
      // 客戶版表格：先在畫面上產生預覽，確認沒問題再按列印
      $('cMake').onclick=function(){ makeReport(inp,got,deals,cs,{mid:mid,lo:lo,hi:hi,deal:deal,mine:mine,
        listLo:listLo,listHi:listHi,parkV:parkV,verdict:verdict,pos:pos}); };
      $('cShare').onclick=function(){
        var h={k:inp.kind,t:inp.town,r:inp.road,l:inp.lane||'',b:inp.built||'',a:inp.area,f:inp.floor||'',tf:inp.tops||'',pk:inp.park,ask:inp.ask||'',
               c:inp.comps.map(function(c){return [c.p,c.a,c.k||'0',c.n.replace(/[|~]/g,' '),c.pa||'',c.pt||''].join('~')}).join('|')};
        history.replaceState(null,'',RT.hashUrl(h)); RT.copy(location.href,$('cToast'),'已複製分析連結，打開就會直接看到這份分析。');
      };
    });
  }

  function setKind(k){
    kind=k; $('cKind2').value=k;
    var land=isLand(k);
    // 土地沒有屋齡、樓層、車位可填
    document.querySelectorAll('.bldonly').forEach(function(e){ e.hidden=land; });
    $('cAreaLab').textContent=land?'土地坪數':'房屋坪數（不含車位）';
    $('cH1').textContent=land?'屋主的土地':'屋主的房子';
    var mine=$('cMine'); if(mine) mine.hidden=true;
  }
  $('cKind2').addEventListener('change',function(){
    setKind(this.value); suggestMine();
    $('cTown').dispatchEvent(new Event('change'));
  });
  $('cTown').addEventListener('change',function(){
    var t=this.value; if(!t) return;
    var fill=function(d){ $('cRoadList').innerHTML=d.roads.map(function(r){return '<option value="'+esc(r)+'">'}).join('');
      $('cRoad').placeholder='例：'+d.roads.slice(0,2).join('、'); };
    (isX(kind)?xMeta().then(function(){return xTown(t)}):RT.town(t)).then(fill).catch(function(){});
  });
  // ── 自動帶入①：我自己在賣的同區案件 ──────────────────
  var mineRows = null, mineHit = [];
  function loadMine(){
    if (mineRows) return Promise.resolve(mineRows);
    return fetch('../match/listings.json').then(function(r){return r.json()})
      .then(function(d){ mineRows = d; return d; });
  }
  function suggestMine(){
    var btn = $('cMine'), town = $('cTown').value, road = $('cRoad').value.trim();
    if (!town) { btn.hidden = true; return; }
    loadMine().then(function(rows){
      var wantLand = isLand(kind);
      mineHit = rows.filter(function(r){
        return !!r.land === wantLand && r.area === town && r.p > 0 && r.at > 0;
      }).sort(function(a, b){                                        // 同路段的排前面
        var x = road && a.road && a.road.indexOf(road) >= 0 ? 0 : 1;
        var y = road && b.road && b.road.indexOf(road) >= 0 ? 0 : 1;
        return x - y;
      });
      btn.hidden = !mineHit.length;
      btn.textContent = '＋ 加入我在 ' + town + ' 的 ' + mineHit.length + ' 間在售案件';
    }).catch(function(){ btn.hidden = true; });
  }
  $('cMine').addEventListener('click', function(){
    mineHit.forEach(function(r){
      compRow({ p: r.p, a: r.at, k: String(r.pk2 == null ? 9 : r.pk2), pa: r.pa || '',
                pt: r.pt || '平面', n: '自家 ' + (r.c || '') });
    });
    blank();                       // 清掉沒填的空列
    this.hidden = true;
  });

  // 沒填東西的空白列，自動帶入之後就不留著佔版面
  function blank(){
    [].forEach.call($('cComps').querySelectorAll('.rt-comp'), function(d){
      var empty = true;
      d.querySelectorAll('[data-f]').forEach(function(i){ if (i.value.trim()) empty = false; });
      if (empty) d.remove();
    });
  }

  // ── 自動帶入②：「抓競品」書籤 ────────────────────────
  // 在她自己的瀏覽器、她已經打開的那一頁上讀資料，等同幫她複製貼上，
  // 不是伺服器去爬 591，所以沒有 CORS、擋機器人或條款的問題。
  var base = location.href.split('#')[0];
  var tab = location.pathname.indexOf('/price/') >= 0 ? 'compete&' : '';
  $('cBookmark').setAttribute('href',
    BOOKMARKLET.replace('__URL__', base).replace('__TAB__', tab));
  $('cBookmark').addEventListener('click', function(e){
    e.preventDefault();
    alert('這顆是「書籤」，不是按鈕。\n\n請用滑鼠把它拖到瀏覽器上方的書籤列（只要做一次）。\n之後在 591 等網站的搜尋結果頁點一下它，那一頁的物件就會自動帶回來。');
  });

  $('cTown').addEventListener('change', suggestMine);
  $('cRoad').addEventListener('change', suggestMine);

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
    }
    // 競品要獨立處理：書籤只會帶 c=，不會帶屋主資料（h.t），不能綁在上面那個 if 裡面
    var got=(h.c||'').split('|').filter(Boolean);
    got.forEach(function(s){ var p=s.split('~');
      compRow({p:p[0],a:p[1],k:p[2]==='1'?'1':(p[2]||'0'),n:p[3],pa:p[4]||'',pt:p[5]||'平面'}); });
    if(h.t) calc();
    else if(got.length){
      $('cStatus').textContent='已經帶入 '+got.length+' 間在售競品。填好上面屋主的房子，就可以產生分析。';
      $('cComps').scrollIntoView({block:'center',behavior:'smooth'});
    }
    // 預設不放空白列：競品走自動帶入，要手打再按「＋ 手動加一間」
  });
})();

// 客戶版表格的列印與關閉（表格本身是先產生預覽，確認後才按列印）
document.addEventListener('click',function(e){
  if(e.target.id==='cPrint') window.print();
  if(e.target.id==='cClose') document.getElementById('cReportWrap').hidden=true;
});
