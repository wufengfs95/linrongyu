/* 自備款人生模擬：25 歲開始，每年選一個人生選擇＋遇到一個隨機事件，存到自備款、收支比也過關就能買房。
   成績是買到房的年紀（越小越好），45 歲還沒買到就結束。
   買房門檻跟銀行實務一致：自備款＝房價 2 成＋稅費雜支約 4%；房貸 8 成、30 年；
   收支比（房貸月付＋其他負債）÷ 銀行認列收入 ≤ 60%（兼差收入只認列 7 成）。收支比分級同 /dti/。 */
(function(){
  var RT=window.RT, GM=window.GM, $=RT.$, esc=RT.esc;
  var GOAL='中壢 2 房電梯華廈', DOWN=.2, FEE=.04, LTV=.8, YEARS=30, DTI=.6, END_AGE=45;
  var S, log, done, lastAge=0;

  function fresh(){ return {age:25, inc:42000, side:0, spouse:0, live:22000, debt:0, debtY:0, save:300000, price:900, rate:2.2,
                            used:{}, car:0, married:0, sideN:0, frugalN:0, bought:0}; }
  function wan(v){ return Math.abs(v)<1e6?(Math.round(v/1000)/10)+' 萬':RT.comma(Math.round(v/10000))+' 萬'; }   // 100 萬以下留一位小數
  function need(){ return S.price*1e4*(DOWN+FEE); }
  function pay(){ return RT.pmt(S.price*LTV*1e4,S.rate,YEARS*12); }
  function counted(){ return S.inc+S.spouse+S.side*.7; }            // 銀行認列的月收入
  function dti(){ return (pay()+S.debt)/counted(); }
  function monthlySave(){ return S.inc+S.side+S.spouse-S.live-S.debt; }
  function ready(){ return S.save>=need()&&dti()<=DTI; }
  function rnd(a,b){ return a+Math.random()*(b-a); }

  // 人生選擇：t 標題、d 說明、ok 能不能選、go 套用後回傳發生了什麼
  var CHOICES=[
    {k:'study',t:'📚 下班進修考證照',d:'今年花 3 萬學費，明年起月薪 +4,000',go:function(){ S.save-=30000; S.inc+=4000; return '考到證照，月薪加 4,000！'; }},
    {k:'job',t:'💼 跳槽拚加薪',d:'有機會加薪 6,000，也可能空窗兩個月',go:function(){
      if(Math.random()<.6){ S.inc+=6000; return '跳槽成功，月薪加 6,000！'; }
      S.save-=S.inc*2; S.inc+=2000; return '空窗了兩個月才找到工作，少領兩個月薪水，月薪只加 2,000。'; }},
    {k:'home',once:1,t:'🏠 搬回家住',d:'每月省 8,000 房租生活費，通勤遠一點',go:function(){ S.live-=8000; return '搬回家住，每個月多存 8,000。'; }},
    {k:'car',once:1,t:'🚗 買一台新車',d:'頭期 20 萬，車貸每月 12,000、5 年',ok:function(){return S.save>=200000},go:function(){
      S.save-=200000; S.debt+=12000; S.debtY=5; S.car=1; return '開新車很爽，但每個月多了 12,000 的車貸…'; }},
    {k:'side',t:'💻 下班兼差接案',d:'每月多 8,000，但銀行只認列 7 成',ok:function(){return S.sideN<2},go:function(){
      S.side+=8000; S.sideN++; return '兼差每月多賺 8,000。'; }},
    {k:'invest',t:'📈 拿 20 萬去投資',d:'可能賺 4 成，也可能賠 3 成',ok:function(){return S.save>=200000},go:function(){
      var r=Math.round(rnd(-.3,.4)*100)/100, g=200000*r; S.save+=g;
      return r>=0?'投資賺了 '+wan(g)+'（+'+Math.round(r*100)+'%）！':'投資賠了 '+wan(-g)+'（'+Math.round(r*100)+'%）…'; }},
    {k:'trip',t:'✈️ 出國玩犒賞自己',d:'花 8 萬，心情好，工作可能更有表現',go:function(){
      S.save-=80000; if(Math.random()<.5){ S.inc+=3000; return '玩得很開心，回來工作表現好，加薪 3,000！'; } return '玩得很開心，存款少了 8 萬。'; }},
    {k:'marry',once:1,t:'💍 結婚',d:'婚禮花 30 萬、收禮金 20 萬，夫妻收入可以合併申請房貸',ok:function(){return S.age>=27},go:function(){
      S.save-=100000; S.spouse=38000; S.live+=10000; S.married=1; return '結婚了！另一半月薪 3.8 萬，兩個人的收入可以一起算。'; }},
    {k:'frugal',t:'📒 開始記帳省錢',d:'每月生活費少 3,000',ok:function(){return S.frugalN<2},go:function(){
      S.live-=3000; S.frugalN++; return '記帳之後，每個月多存 3,000。'; }}
  ];
  // 每年的隨機事件：[權重, 發生什麼]
  var EVENTS=[
    [14,function(){ var m=Math.round(rnd(1,2.5)*10)/10, v=S.inc*m; S.save+=v; return '🎉 年終領了 '+m+' 個月，多存 '+wan(v)+'。'; }],
    [12,function(){ S.inc=Math.round(S.inc*1.03/100)*100; return '👍 公司調薪 3%。'; }],
    [10,function(){ S.rate=Math.min(3.5,S.rate+.125); return '📈 央行升息半碼，房貸利率變 '+S.rate.toFixed(3)+'%。'; }],
    [6, function(){ S.rate=Math.max(1.6,S.rate-.125); return '📉 央行降息半碼，房貸利率變 '+S.rate.toFixed(3)+'%。'; }],
    [10,function(){ var r=rnd(.04,.07); S.price=Math.round(S.price*(1+r)); return '🏗️ 房價漲了 '+Math.round(r*100)+'%，目標變 '+RT.comma(S.price)+' 萬。'; }],
    [6, function(){ S.save-=50000; return '🏥 家人住院，花了 5 萬。'; }],
    [6, function(){ S.save-=15000; return '📱 手機摔壞，換新花了 1.5 萬。'; }],
    [3, function(){ S.save-=S.inc*3; return '😰 公司裁員，找工作花了三個月。'; }],
    [14,function(){ return '☕ 平平安安的一年。'; }]
  ];
  function event(){ var sum=EVENTS.reduce(function(s,e){return s+e[0]},0), r=Math.random()*sum;
    for(var i=0;i<EVENTS.length;i++){ r-=EVENTS[i][0]; if(r<0) return EVENTS[i][1](); } return EVENTS[0][1](); }

  function deal(){   // 抽 3 張可以選的
    var ok=CHOICES.filter(function(c){ return !(c.once&&S.used[c.k])&&(!c.ok||c.ok()); });
    return GM.shuffle(ok).slice(0,3);
  }
  function tier(v){ return v<=.55?['t1','安全']:v<=.6?['t2','嚴審，勉強會過']:v<=.65?['t3','壓力太大']:v<=.7?['t4','要調整']:['t5','銀行不會過']; }

  function render(){
    var n=need(), d=dti(), tr=tier(d), pct=Math.min(100,Math.max(0,S.save/n*100));
    $('lfAge').textContent=S.age; $('lfSave').textContent=wan(Math.max(0,S.save));
    $('lfStat').innerHTML=
      '<div><span>月收入</span><b>'+RT.comma(S.inc+S.side+S.spouse)+'</b>'+(S.spouse?'<small>含另一半</small>':'')+'</div>'+
      '<div><span>每月可存</span><b>'+RT.comma(monthlySave())+'</b></div>'+
      '<div><span>目標房價</span><b>'+RT.comma(S.price)+' 萬</b></div>'+
      '<div><span>房貸利率</span><b>'+S.rate.toFixed(3)+'%</b></div>';
    $('lfDown').style.width=pct+'%'; $('lfDown').className='lf-fill'+(pct>=100?' ok':'');
    $('lfDownT').innerHTML='存了 <b>'+wan(Math.max(0,S.save))+'</b> / 需要 '+wan(n)+'<small>房價 2 成＋稅費雜支 4%</small>';
    $('lfDti').style.width=Math.min(100,d/.9*100)+'%'; $('lfDti').className='lf-fill '+tr[0];
    $('lfDtiT').innerHTML='收支比 <b>'+Math.round(d*100)+'%</b>・'+tr[1]+'<small>房貸月付 '+RT.comma(Math.round(pay()))+(S.debt?'＋其他負債 '+RT.comma(S.debt):'')+' ÷ 銀行認列收入 '+RT.comma(Math.round(counted()))+'</small>';
    var r=ready();
    $('lfBuy').disabled=!r; $('lfBuy').classList.toggle('lf-glow',r);
    $('lfBuy').textContent=r?'✅ 條件夠了，簽約買房！':S.save<n?'自備款還差 '+wan(n-S.save):'收支比要降到 60% 以下';
  }
  function showChoices(){
    $('lfChoices').innerHTML=deal().map(function(c){
      return '<button type="button" class="lf-card" data-k="'+c.k+'"><b>'+c.t+'</b><span>'+esc(c.d)+'</span></button>'}).join('');
  }
  function year(k){
    var c=CHOICES.filter(function(x){return x.k===k})[0]; if(!c||done) return;
    S.used[k]=1;
    var lines=[c.go()];
    S.save+=monthlySave()*12;                                  // 這一年存下來的
    if(S.debtY&&--S.debtY===0){ S.debt=0; lines.push('🚗 車貸繳完了！'); }
    lines.push(event());
    S.price=Math.round(S.price*1.02);                          // 房價每年基本漲 2%
    S.age++;
    log.unshift('<li><b>'+(S.age-1)+' 歲</b>'+lines.map(esc).join('<br>')+'</li>');
    $('lfLog').innerHTML=log.slice(0,6).join('');
    render();
    if(S.age>=END_AGE&&!ready()) return end(false);
    showChoices();
    if(ready()) $('lfBuy').scrollIntoView({behavior:'smooth',block:'center'});
  }

  function start(){
    S=fresh(); log=[]; done=false;
    $('lfStart').hidden=true; $('lfPlay').hidden=false; $('lfResult').hidden=true; $('lfLog').innerHTML='';
    render(); showChoices();
  }
  function end(win){
    done=true; lastAge=win?S.age:0; $('lfPlay').hidden=true; $('lfStart').hidden=false; $('lfGo').textContent='重新開始人生';
    var mine=GM.board({game:'life',score:win?S.age:null,asc:true,unit:' 歲',rank:$('lfRank'),top:$('lfTop')});
    var loan=S.price*LTV, tips=[];
    if(win){
      $('lfHead').innerHTML='<b>'+S.age+'</b> 歲買到'+GOAL+'！<small>'+(mine.better&&mine.n>1?'刷新你的本週最佳・':'')+'花了 '+(S.age-25)+' 年</small>';
      $('lfExtra').innerHTML='<ul class="gm-rounds">'+
        '<li><span>成交價</span><b>'+RT.comma(S.price)+' 萬</b></li>'+
        '<li><span>自備款（2 成）＋稅費雜支</span><b>'+wan(need())+'</b></li>'+
        '<li><span>房貸 8 成・'+YEARS+' 年・'+S.rate.toFixed(3)+'%</span><b>'+RT.comma(loan)+' 萬</b></li>'+
        '<li><span>每月房貸</span><b>'+RT.comma(Math.round(pay()))+' 元</b></li>'+
        '<li><span>收支比</span><b>'+Math.round(dti()*100)+'%</b></li></ul>';
    } else {
      $('lfHead').innerHTML='45 歲了，還差一點…<small>房價一直漲，自備款和收支比要同時過關真的不容易</small>';
      $('lfExtra').innerHTML='';
    }
    if(S.car) tips.push('🚗 車貸每月 12,000 會直接算進收支比，買房前能不買車就先別買。');
    if(S.married) tips.push('💍 夫妻可以合併申請房貸，兩個人的收入一起算，收支比馬上降很多。');
    if(S.sideN) tips.push('💻 兼差、接案收入銀行通常只認列 7 成，要有報稅或固定入帳紀錄。');
    tips.push('🧮 自備款抓「房價 × 2 成＋稅費雜支約 4%」，收支比最好在 55% 以下，過 60% 銀行就會很嚴。');
    $('lfExtra').innerHTML+='<div class="gm-review">'+tips.map(function(t){return '<div>'+esc(t)+'</div>'}).join('')+'</div>';
    $('lfCta').innerHTML='用你<b>真實的收入</b>算一次：<a href="../dti/">收支比試算 →</a>　<a href="../youth-loan/">新青安試算 →</a><br>不知道自己能買多少？<a href="https://line.me/ti/p/~0973263569" target="_blank" rel="noopener">LINE 容瑜</a>，幫你算自備款和能買的價位。';
    $('lfResult').hidden=false;
    setTimeout(function(){ $('lfResult').scrollIntoView({behavior:'smooth',block:'start'}); },100);
  }

  $('lfChoices').addEventListener('click',function(e){ var b=e.target.closest('.lf-card'); if(b) year(b.getAttribute('data-k')); });
  $('lfBuy').addEventListener('click',function(){ if(ready()&&!done) end(true); });
  $('lfGo').addEventListener('click',start);
  $('lfAgain').addEventListener('click',function(){ start(); $('lfPlay').scrollIntoView({behavior:'smooth',block:'start'}); });
  $('lfShare').addEventListener('click',function(){
    GM.share(lastAge?'我在「自備款人生」'+lastAge+' 歲就買到中壢的房子！你幾歲買得到？🏠':'玩「自備款人生」才知道存頭期款有多難… 你幾歲買得到房？🏠',$('lfToast'));
  });
})();
