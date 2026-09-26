/* 誰比較貴：兩筆桃園實價登錄成交，猜哪一間每坪單價比較高，猜錯就結束，成績是連對題數。
   題庫是 build.py 產生的 game/deals.json：[行政區, 路段, 型態, 年, 季, 單價(萬/坪), 坪數, 樓層, 總樓層, 屋齡] */
(function(){
  var RT=window.RT, GM=window.GM, $=RT.$, esc=RT.esc;
  var KIND={a:'電梯大樓',b:'華廈',c:'公寓',d:'透天厝'};
  var deals=[], pair=null, streak=0, locked=false, seen={}, last=0;

  function deal(r){ return {town:r[0],road:r[1],k:r[2],y:r[3],q:r[4],u:r[5],a:r[6],f:r[7],tf:r[8],age:r[9]}; }
  function floorText(d){ return d.k==='d'?'透天 '+d.tf+' 層':d.f+' 樓（共 '+d.tf+' 樓）'; }
  function card(d,i){
    return '<button type="button" class="gm-deal" data-i="'+i+'"><span class="kind">'+KIND[d.k]+'</span>'+
      '<h3><small>'+esc(d.town)+'</small>'+esc(d.road)+'</h3>'+
      '<dl><dt>屋齡</dt><dd>'+(d.age?d.age+' 年':'新成屋')+'</dd><dt>樓層</dt><dd>'+floorText(d)+'</dd>'+
      '<dt>坪數</dt><dd>'+d.a+' 坪</dd><dt>成交</dt><dd>'+d.y+' 年 Q'+d.q+'</dd></dl>'+
      '<div class="gm-ans">每坪 <b>'+d.u.toFixed(1)+'</b> 萬<br><small>房屋總價約 '+RT.comma(Math.round(d.u*d.a))+' 萬（不含車位）</small></div></button>';
  }

  // 越後面越難：兩間單價差距門檻從 35% 一路降到 8%；前幾題盡量同一區比較有感
  function gap(){ return streak<3?.35:streak<6?.22:streak<10?.14:.08; }
  function pickPair(tries){
    var g=tries?.05:gap();   // 第二輪找不到就放寬，避免題庫太小時卡住
    for(var t=0;t<400;t++){
      var a=deals[Math.floor(Math.random()*deals.length)], b=deals[Math.floor(Math.random()*deals.length)];
      if(a===b||seen[a.id]||seen[b.id]) continue;
      var r=Math.max(a.u,b.u)/Math.min(a.u,b.u)-1;
      if(r<g||(streak>=6&&r>g*2.5)) continue;          // 後期也不要差太多，不然太簡單
      if(t<200&&a.town!==b.town) continue;
      seen[a.id]=seen[b.id]=1; return [a,b];
    }
    seen={}; return tries?[deals[0],deals[1]]:pickPair(1);
  }
  // 猜完之後說明為什麼：挑最明顯的一兩個差異
  function why(w,l){
    var s=[];
    if(w.town!==l.town) s.push(w.town+'行情本來就比'+l.town+'高');
    if(l.age-w.age>=10) s.push('屋齡新 '+(l.age-w.age)+' 年');
    if(w.age-l.age>=10) s.push('雖然舊了 '+(w.age-l.age)+' 年，單價還是比較高');
    if(w.k!==l.k&&(w.k==='a'||w.k==='b')&&(l.k==='c'||l.k==='d')) s.push(KIND[w.k]+'有電梯，單價通常比'+KIND[l.k]+'高');
    if(w.k==='d'&&l.k!=='d') s.push('透天含土地，單價算起來比較高');
    if(w.a<l.a*.7) s.push('坪數小，總價低，單價反而容易高');
    return s.length?s.slice(0,2).join('，')+'。':'地段、社區條件不同，單價就差很多。';
  }

  function show(){
    pair=pickPair(); locked=false;
    $('hiPair').innerHTML=card(pair[0],0)+card(pair[1],1);
    $('hiPair').classList.remove('gm-reveal');
    $('hiWhy').textContent=''; $('hiWhy').className='gm-why'; $('hiNextRow').hidden=true;
  }
  function pick(i){
    if(locked) return; locked=true;
    var me=pair[i], other=pair[1-i], ok=me.u>=other.u, els=$('hiPair').querySelectorAll('.gm-deal');
    $('hiPair').classList.add('gm-reveal');
    els[i].classList.add('pick');
    els[me.u>=other.u?i:1-i].classList.add('win'); els[me.u>=other.u?1-i:i].classList.add('lose');
    var w=ok?me:other, l=ok?other:me, diff=Math.round((w.u/l.u-1)*100);
    if(ok){
      streak++; $('hiStreak').textContent=streak; $('hiStreak').parentNode.classList.add('hot');
      pop($('hiStreak'));
      $('hiWhy').className='gm-why ok'; $('hiWhy').textContent='答對！每坪貴了 '+diff+'%：'+why(w,l);
      $('hiNextRow').hidden=false; $('hiNext').focus({preventScroll:true});
    } else {
      $('hiWhy').className='gm-why no'; $('hiWhy').textContent='差一點！另一間每坪貴了 '+diff+'%：'+why(w,l);
      $('hiPair').classList.add('gm-shake');
      setTimeout(function(){ $('hiPair').classList.remove('gm-shake'); end(); },1400);
    }
  }
  function pop(el){ el.classList.remove('gm-pop'); void el.offsetWidth; el.classList.add('gm-pop'); }

  function start(){
    streak=0; last=0; $('hiStreak').textContent=0; $('hiStreak').parentNode.classList.remove('hot');
    $('hiStart').hidden=true; $('hiPlay').hidden=false; $('hiResult').hidden=true;
    show();
  }
  function end(){
    last=streak;
    var mine=GM.board({game:'higher',score:streak||null,asc:false,unit:' 題',rank:$('hiRank'),top:$('hiTop')});
    $('hiBest').textContent=mine.best||0;
    $('hiHead').innerHTML='連對 <b>'+streak+'</b> 題'+
      '<small>'+(streak>=10?'太強了，你對桃園房價比很多人都熟！':streak>=5?'很有眼光！再挑戰看看能不能破 10 題':'房價真的很難猜，多玩幾次就有感覺了')+
      (mine.better&&mine.n>1?'・刷新你的本週最佳':'')+'</small>';
    $('hiCta').innerHTML='想知道你家每坪值多少？<a href="../value/">房屋估價 →</a> 30 秒算出行情區間，<br>想拿同社區的成交比一比，<a href="https://line.me/ti/p/~0973263569" target="_blank" rel="noopener">LINE 容瑜</a>幫你查。';
    $('hiResult').hidden=false;
    setTimeout(function(){ $('hiResult').scrollIntoView({behavior:'smooth',block:'center'}); },100);
  }

  $('hiPair').addEventListener('click',function(e){ var b=e.target.closest('.gm-deal'); if(b) pick(+b.getAttribute('data-i')); });
  $('hiNext').addEventListener('click',show);
  $('hiGo').addEventListener('click',start);
  $('hiAgain').addEventListener('click',function(){ start(); $('hiPlay').scrollIntoView({behavior:'smooth',block:'center'}); });
  $('hiShare').addEventListener('click',function(){
    GM.share(last?'我在「誰比較貴」連對 '+last+' 題桃園房價！你能贏我嗎？🏠':'猜桃園哪一間每坪比較貴，比想像中難！你來試試 🏠',$('hiToast'));
  });
  (function(){ var r=RT.store.get('rt-game-higher',{}); if(r.w===GM.week()&&r.best) $('hiBest').textContent=r.best; })();

  fetch('../game/deals.json?v='+(document.currentScript&&document.currentScript.getAttribute('data-v')||''))
    .then(function(r){return r.json()}).then(function(rows){
      deals=rows.map(deal); deals.forEach(function(d,i){d.id=i});
      if(deals.length<20) throw 0;
      $('hiGo').disabled=false; $('hiGo').textContent='開始猜';
    }).catch(function(){ $('hiGo').textContent='資料載入失敗，請重新整理'; });
})();
