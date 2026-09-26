/* 預算內蓋夢想屋：每週一個預算，挑區域、型態、屋齡、房數、車位，用實價登錄中位單價估價。
   預算內才算數：夢想分數＝各項分數加總＋剩下的錢每 10 萬 1 分。估價表是 build.py 產生的 dream/prices.json */
(function(){
  var RT=window.RT, GM=window.GM, $=RT.$, esc=RT.esc;
  var BUDGETS=[800,1000,1200,1500];
  var GROUPS=[
    {k:'t',n:'區域',o:[['桃園區','桃園區',30],['中壢區','中壢區',30],['八德區','八德區',20],['平鎮區','平鎮區',20],['楊梅區','楊梅區',10],['龍潭區','龍潭區',10]]},
    {k:'k',n:'型態',o:[['a','電梯大樓',25],['b','華廈',15],['c','公寓',5],['d','透天厝',30]]},
    {k:'g',n:'屋齡',o:[['0','5 年內新屋',30],['1','6～15 年',20],['2','16～30 年',10],['3','30 年以上',0]]},
    {k:'r',n:'房數',o:[['2','2 房',10],['3','3 房',20],['4','4 房',30]]},
    {k:'p',n:'車位',o:[['平面','平面車位',20],['機械','機械車位',10],['','不要車位',0]]}
  ];
  var KIND={a:'電梯大樓',b:'華廈',c:'公寓',d:'透天'};
  var AREA={2:25,3:34,4:45}, AREA_D={3:45,4:60};   // 房數 → 坪數（不含車位）；透天大一點
  var P=null, pick={}, budget=1000, listings=[], last=null;

  function wk(){ return +GM.week().slice(-2); }
  function opt(g,v){ return GROUPS.filter(function(x){return x.k===g})[0].o.filter(function(o){return o[0]===v})[0]; }
  function complete(){ return GROUPS.every(function(g){ return pick[g.k]!=null; }); }

  // 型態會限制其他選項：透天沒有 2 房、車位是自家門口；公寓沒有車位
  function blocked(g,v){
    if(g==='r'&&v==='2'&&pick.k==='d') return '透天沒有 2 房';
    if(g==='p'&&pick.k==='d') return '透天自己有車庫';
    if(g==='p'&&v&&pick.k==='c') return '公寓通常沒有車位';
    return '';
  }
  function fix(){   // 換型態之後，把不合的選項改掉
    if(pick.k==='d'){ if(pick.r==='2') pick.r='3'; pick.p='門口'; }
    else if(pick.p==='門口') pick.p=null;
    if(pick.k==='c'&&pick.p) pick.p='';
  }
  function estimate(){
    if(!P||!complete()) return null;
    var T=P.towns[pick.t], cell=T&&T.u[pick.k][+pick.g];
    if(!cell) return {none:1};
    var area=(pick.k==='d'?AREA_D:AREA)[pick.r], park=pick.p&&pick.p!=='門口'?(T.park[pick.p]||0):0;
    return {u:cell[0], n:cell[1], area:area, park:park, total:Math.round(cell[0]*area+park)};
  }
  function points(){
    var s=0; GROUPS.forEach(function(g){ if(g.k==='p'&&pick.p==='門口') s+=15; else if(pick[g.k]!=null) s+=opt(g.k,pick[g.k])[2]; }); return s;
  }

  function render(){
    $('drGroups').innerHTML=GROUPS.map(function(g){
      return '<div class="dr-group"><b>'+g.n+'</b><div class="dr-opts">'+g.o.map(function(o){
        var why=blocked(g.k,o[0]), on=pick[g.k]===o[0];
        return '<button type="button" data-g="'+g.k+'" data-v="'+o[0]+'" aria-pressed="'+on+'"'+(why?' disabled title="'+why+'"':'')+'>'+
          esc(o[1])+'<small>+'+o[2]+'</small></button>'}).join('')+
        (g.k==='p'&&pick.k==='d'?'<span class="dr-note">透天自己有車庫 +15</span>':'')+'</div></div>'}).join('');
    var e=estimate(), pt=points();
    $('drScore').textContent=pt;
    var bar=$('drBar'), go=$('drGo');
    if(!e){ $('drPrice').innerHTML='<p class="dr-hint">每一項都選好，就會用實價登錄算出這間大概多少錢</p>'; bar.style.transform='scaleX(0)';
      go.disabled=true; go.textContent='先把每一項都選好'; return; }
    if(e.none){ $('drPrice').innerHTML='<p class="dr-hint no">這個組合近一年半成交太少（不到 8 筆），估不準，換一個條件試試</p>';
      bar.style.transform='scaleX(0)'; go.disabled=true; go.textContent='換一個組合'; return; }
    var over=e.total>budget, left=budget-e.total, bonus=over?0:Math.floor(left/10);
    bar.style.transform='scaleX('+Math.min(1,e.total/budget)+')'; bar.classList.toggle('over',over);
    $('drPrice').innerHTML='<p class="dr-total'+(over?' no':'')+'">估價 <b>'+RT.comma(e.total)+'</b> 萬'+
      (over?'<span>超出預算 '+RT.comma(-left)+' 萬</span>':'<span>還剩 '+RT.comma(left)+' 萬（+'+bonus+' 分）</span>')+'</p>'+
      '<p class="dr-how">每坪 '+e.u+' 萬（中位數，'+e.n+' 筆成交）× '+e.area+' 坪'+(e.park?' ＋ '+pick.p+'車位 '+e.park+' 萬':'')+'</p>';
    $('drScore').textContent=pt+bonus;
    go.disabled=over; go.textContent=over?'超出預算，換便宜一點的條件':'就決定是這間！（'+(pt+bonus)+' 分）';
  }

  function done(){
    var e=estimate(); if(!e||e.none||e.total>budget) return;
    var bonus=Math.floor((budget-e.total)/10), score=points()+bonus; last=score;
    var desc=pick.t+'・'+KIND[pick.k]+'・'+opt('g',pick.g)[1]+'・'+pick.r+' 房'+(pick.p==='門口'?'・自家車庫':pick.p?'・'+pick.p+'車位':'');
    var mine=GM.board({game:'dream',score:score,asc:false,unit:' 分',rank:$('drRank'),top:$('drTop')});
    $('drHead').innerHTML='夢想分數 <b>'+score+'</b> 分<small>'+esc(desc)+'・估價 '+RT.comma(e.total)+' 萬'+(mine.better&&mine.n>1?'・刷新你的本週最佳':'')+'</small>';
    // 我正在賣、預算內的物件：同一區優先
    var kname={a:'電梯大樓',b:'華廈',c:'公寓',d:'透天'}[pick.k];
    var fit=listings.filter(function(L){return !L.land&&L.p<=budget}).sort(function(a,b){
      return (b.area===pick.t)-(a.area===pick.t)||(b.k===kname)-(a.k===kname)||a.p-b.p; }).slice(0,3);
    $('drExtra').innerHTML=fit.length?'<p class="dr-sub">我正在賣、預算 '+RT.comma(budget)+' 萬以內的房子：</p><div class="dr-list">'+fit.map(function(L){
      return '<a href="../listings/'+esc(L.s)+'/"><img src="../'+esc(L.img)+'" alt="" loading="lazy"><span><b>'+esc(L.t)+'</b>'+esc(L.area)+'・'+esc(L.lay||L.k)+'・<em>'+RT.comma(L.p)+' 萬</em></span></a>'}).join('')+'</div>':'';
    var h={hi:budget,a:pick.t,k:kname,rm:pick.r,pk:pick.p&&pick.p!=='門口'?1:''};
    $('drCta').innerHTML='想找真的符合條件的房子？<a href="'+esc('../match/'+RT.hashUrl(h).replace(/^[^#]*/,''))+'">用買方配案存下這組條件 →</a><br>或 <a href="https://line.me/ti/p/~0973263569" target="_blank" rel="noopener">LINE 容瑜</a>，我幫你找實價登錄以外、還沒上網的物件。';
    $('drResult').hidden=false;
    setTimeout(function(){ $('drResult').scrollIntoView({behavior:'smooth',block:'start'}); },100);
  }

  $('drGroups').addEventListener('click',function(e){
    var b=e.target.closest('button[data-g]'); if(!b||b.disabled) return;
    pick[b.getAttribute('data-g')]=b.getAttribute('data-v'); fix(); render(); $('drResult').hidden=true;
  });
  $('drGo').addEventListener('click',done);
  $('drAgain').addEventListener('click',function(){ pick={}; $('drResult').hidden=true; render(); $('drGroups').scrollIntoView({behavior:'smooth',block:'center'}); });
  $('drShare').addEventListener('click',function(){
    GM.share(last?'本週預算 '+RT.comma(budget)+' 萬，我蓋出 '+last+' 分的夢想屋！你能蓋幾分？🏡':'同樣的預算，你會選新房還是大坪數？來蓋你的夢想屋 🏡',$('drToast'));
  });

  budget=BUDGETS[wk()%BUDGETS.length]; $('drBudget').textContent=RT.comma(budget);
  render();
  var v=document.currentScript&&document.currentScript.getAttribute('data-v')||'';
  fetch('prices.json?v='+v).then(function(r){return r.json()}).then(function(d){ P=d; render(); })
    .catch(function(){ $('drMsg').textContent='估價資料載入失敗，請重新整理。'; });
  fetch('../match/listings.json').then(function(r){return r.json()}).then(function(d){ listings=d; }).catch(function(){});
})();
