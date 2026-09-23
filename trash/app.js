/* 桃園垃圾車時間查詢：資料來自桃園市環境管理處「垃圾清運路線即時查詢系統」的公開班表 */
(function(){
  var data=null, WEEK='日一二三四五六', today=new Date().getDay();
  var $=function(id){return document.getElementById(id)};
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var ver=(document.querySelector('script[data-v]')||{getAttribute:function(){return ''}}).getAttribute('data-v');

  function status(msg,cls){ var el=$('tqStatus'); el.className='tq-status'+(cls?' '+cls:''); el.innerHTML=msg||''; }
  function runsToday(d){ return d && d.indexOf(WEEK[today])>=0; }
  function dayTag(r){
    return runsToday(r.d)
      ? '<span class="tq-day on">今天有收</span>'
      : '<span class="tq-day off">今天停收</span>';
  }
  function timeCell(p){
    var t=p[1]||'—', rc=p[2]==='同'?p[1]:p[2];
    return '<b>'+esc(t)+'</b>'+(rc&&rc!==t?'<span class="tq-rc">回收 '+esc(rc)+'</span>':'');
  }

  // 搜尋：地點名稱或里名
  function search(q){
    q=(q||'').trim().replace(/\s+/g,'');
    if(!q){ status('請輸入路名、門牌或里名，例如「忠孝路」。','err'); return; }
    if(q.length<2){ status('至少輸入兩個字。','err'); return; }
    var hits=[];
    data.towns.forEach(function(t){
      t.routes.forEach(function(r){
        r.p.forEach(function(p){
          if(p[0].indexOf(q)>=0 || (p[3]&&p[3].indexOf(q)>=0)) hits.push({t:t.t,r:r,p:p});
        });
      });
    });
    if(!hits.length){
      status('找不到「'+esc(q)+'」。試試只打路名（例如「中華路」），或改用下面的行政區、路線查。','err');
      $('tqResult').innerHTML=''; return;
    }
    hits.sort(function(a,b){ return (runsToday(b.r.d)-runsToday(a.r.d)) || a.t.localeCompare(b.t,'zh-Hant'); });
    status('找到 <b>'+hits.length+'</b> 個清運點'+(hits.length>60?'（先顯示前 60 個，可以輸入更完整的地址）':''));
    $('tqResult').innerHTML='<div class="tq-cards">'+hits.slice(0,60).map(function(h){
      return '<div class="tq-card'+(runsToday(h.r.d)?' hit':'')+'">'+
        '<div class="tq-card-top"><b>'+esc(h.p[0])+'</b>'+dayTag(h.r)+'</div>'+
        '<div class="tq-times">'+timeCell(h.p)+'</div>'+
        '<div class="tq-sub">'+esc(h.t)+(h.p[3]?' '+esc(h.p[3]):'')+'｜路線：'+esc(h.r.n)+
        '｜收運日：'+esc(h.r.d||'—')+(h.r.r?'（資源回收 '+esc(h.r.r)+'）':'')+'</div>'+
        '<button type="button" class="tq-more" data-town="'+esc(h.t)+'" data-route="'+esc(h.r.n)+'">看整條路線班表 →</button>'+
        '</div>';
    }).join('')+'</div>';
  }

  function showRoute(townName,routeName){
    var t=data.towns.filter(function(x){return x.t===townName})[0]; if(!t) return;
    var r=t.routes.filter(function(x){return x.n===routeName})[0]; if(!r) return;
    $('tqTown').value=townName; fillRoutes(townName); $('tqRoute').value=routeName;
    status('');
    $('tqResult').innerHTML='<div class="tq-route">'+
      '<div class="tq-route-head"><b>'+esc(townName)+'　'+esc(r.n)+'</b>'+dayTag(r)+'</div>'+
      '<p class="tq-route-sub">收運日：'+esc(r.d||'—')+(r.r?'　資源回收：'+esc(r.r):'')+'　共 '+r.p.length+' 個清運點</p>'+
      '<div class="v-table-wrap"><table class="v-table tq-table"><thead><tr><th>順序</th><th>清運點</th><th>里別</th><th>垃圾車</th><th>資源回收</th></tr></thead><tbody>'+
      r.p.map(function(p,i){
        var rc=p[2]==='同'?p[1]:p[2];
        return '<tr><td>'+(i+1)+'</td><td>'+esc(p[0])+'</td><td>'+esc(p[3]||'—')+'</td><td><b>'+esc(p[1]||'—')+'</b></td><td>'+esc(rc||'—')+'</td></tr>';
      }).join('')+'</tbody></table></div></div>';
    $('tqResult').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function fillRoutes(townName){
    var t=data.towns.filter(function(x){return x.t===townName})[0];
    $('tqRoute').innerHTML='<option value="">選擇路線</option>'+(t?t.routes.map(function(r){
      return '<option>'+esc(r.n)+(runsToday(r.d)?'（今天有收）':'')+'</option>'}).join(''):'');
  }

  // ---- 介面 ----
  $('tqForm').addEventListener('submit',function(e){ e.preventDefault(); if(data) search($('tqQ').value); });
  $('tqTown').addEventListener('change',function(){
    if(!data) return;
    if(!this.value){ $('tqRoute').innerHTML='<option value="">先選行政區</option>'; return; }
    fillRoutes(this.value);
  });
  $('tqRoute').addEventListener('change',function(){
    if(data && this.value) showRoute($('tqTown').value, this.value.replace('（今天有收）',''));
  });
  $('tqResult').addEventListener('click',function(e){
    var b=e.target.closest('.tq-more'); if(!b) return;
    showRoute(b.getAttribute('data-town'), b.getAttribute('data-route'));
  });

  status('班表載入中…');
  fetch('data.json'+(ver?'?v='+ver:'')).then(function(r){return r.json()}).then(function(d){
    data=d;
    $('tqTown').innerHTML='<option value="">選擇行政區</option>'+d.towns.map(function(t){return '<option>'+esc(t.t)+'</option>'}).join('');
    $('tqCount').textContent=d.points.toLocaleString();
    $('tqToday').textContent='星期'+WEEK[today];
    status('');
    var q=new URLSearchParams(location.search).get('q');
    if(q){ $('tqQ').value=q; search(q); }
  }).catch(function(){ status('班表載入失敗，請重新整理再試一次。','err'); });
})();
