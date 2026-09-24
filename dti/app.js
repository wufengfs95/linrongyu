/* 收支比試算（DTI）：月收入 − 既有負債 → 房貸每月還得起多少 → 可貸金額、可買總價 */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc;
  var DEBTS=['dCar','dPersonal','dStudent','dCard','dHome'];
  var CAPS=[[33,'1/3（最輕鬆）'],[50,'1/2（多數銀行好過件）'],[60,'60%（偏緊）'],[70,'70%（銀行上限）']];
  var RATES=[[1.775,'新青安前 3 年'],[2.2,'公股銀行首購常見'],[2.5,'一般房貸常見'],[2.8,'民營銀行、非首購']];
  var CASES={
    single:{title:'小資單身首購',inc:45000,inc2:0,dCar:0,dPersonal:0,dStudent:3000,dCard:0,dHome:0,down:150,rate:1.775,years:40,grace:0,cap:50,
      note:'學貸每月 3,000 元影響不大，但自備款只有 150 萬，真正卡住的是「自備款」不是收入。桃園中壢、平鎮 700～800 萬的兩房可以先鎖定，用新青安 40 年把月付壓低。'},
    couple:{title:'雙薪小家庭',inc:48000,inc2:42000,dCar:12000,dPersonal:0,dStudent:0,dCard:0,dHome:0,down:300,rate:2.2,years:30,grace:0,cap:50,
      note:'兩個人一起當借款人，收入可以合併計算。車貸每月 1.2 萬會直接吃掉可貸額度，如果車貸快繳完，等繳清再申請房貸，可貸金額會明顯變多。'},
    personal:{title:'有信貸的上班族',inc:60000,inc2:0,dCar:0,dPersonal:15000,dStudent:0,dCard:0,dHome:0,down:200,rate:2.2,years:30,grace:0,cap:50,
      note:'信貸是最傷可貸額度的負債：每月 1.5 萬的信貸，換算下來大約少貸 350 萬以上。手上有閒錢的話，先還信貸往往比多存自備款更有用。'},
    swap:{title:'換屋族（舊房還沒賣）',inc:70000,inc2:50000,dCar:0,dPersonal:0,dStudent:0,dCard:0,dHome:23000,down:500,rate:2.5,years:30,grace:0,cap:60,
      note:'舊房貸還在，銀行會把它算進負債，第二戶也不適用首購利率，成數通常只剩 5～7 成。建議先賣後買，或跟我討論「買賣同步」的時程安排，避免兩邊房貸一起扛。'}
  };

  function read(){
    var o={inc:RT.val('iInc'),inc2:RT.val('iInc2'),down:RT.val('iDown'),rate:RT.val('iRate'),years:RT.val('iYears'),
           grace:RT.val('iGrace'),cap:RT.val('iCap'),debts:{}};
    o.debt=0;
    DEBTS.forEach(function(k){ o.debts[k]=RT.val(k); o.debt+=o.debts[k]; });
    return o;
  }
  function loanFor(o,cap,rate){
    var M=(o.inc+o.inc2)*cap/100-o.debt;
    return {M:M, loan:M>0?RT.pv(M,rate,(o.years-o.grace)*12)/10000:0};
  }
  function buyFor(o,loan){
    var byRatio=loan/0.8;                   // 貸款 8 成
    return o.down>0?Math.min(byRatio,loan+o.down):byRatio;
  }

  function calc(caseNote){
    var o=read(), inc=o.inc+o.inc2;
    if(!inc){ $('dtiResult').innerHTML='<div class="v-empty"><b>先填月收入</b><p>月收入是本人（加上共同借款人）每月的固定收入，用報稅或薪轉的金額最準。</p></div>'; return; }
    if(!o.rate) o.rate=2.2;
    var now=o.debt/inc*100, main=loanFor(o,o.cap,o.rate), buy=buyFor(o,main.loan);
    var graceM=main.loan*10000*o.rate/1200;
    var needDown=buy-main.loan;
    var html='<div class="v-price"><span>依收支比 '+o.cap+'% 估算，最多可貸</span><b>'+(main.loan>0?RT.wan(main.loan):'0 萬')+'</b>'+
      '<span class="v-unit">房貸每月最多繳 <b>'+RT.yuan(Math.max(main.M,0))+'</b>（'+o.years+' 年、利率 '+o.rate+'%'+(o.grace?'、寬限期 '+o.grace+' 年後':'')+'）</span></div>';
    if(main.loan<=0){
      html+='<div class="v-judge v-bad"><b>目前負債偏高，房貸額度不夠</b>既有負債每月 '+RT.yuan(o.debt)+'，已經佔收入 '+now.toFixed(0)+'%。建議先把信貸、卡債這類高利負債還掉，再來看房。</div>';
    }else{
      html+='<div class="v-meta"><span>可買總價約 <b>'+RT.wan(buy)+'</b></span><span>需準備自備款 <b>'+RT.wan(needDown)+'</b>（不含 3～5% 雜費）</span>'+
        (o.grace?'<span>寬限期內每月只繳利息 <b>'+RT.yuan(graceM)+'</b></span>':'')+'</div>';
      var cls=now<15?'v-good':now<30?'v-ok':'v-bad';
      html+='<div class="v-judge '+cls+'"><b>現在的負債比：'+now.toFixed(1)+'%</b>'+
        (now<15?'負債很低，銀行最喜歡這種客戶，可以爭取較好的利率。':now<30?'還在合理範圍，房貸加上去之後注意總負債比不要超過 50～60%。':'負債已經偏高，會直接壓縮房貸額度，建議先處理。')+'</div>';
      if(o.down>0&&o.down<main.loan/4) html+='<p class="v-warn">收入撐得起，但自備款只夠買 '+RT.wan(buy)+'。卡關的是自備款，可以考慮新青安、首購成數較高的方案，或家人資助。</p>';
    }
    // 各收支比
    html+='<details class="v-samples" open><summary>不同收支比，能貸多少？</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>收支比</th><th>說明</th><th>每月可繳</th><th>可貸</th><th>可買總價</th></tr></thead><tbody>'+
      CAPS.map(function(c){ var r=loanFor(o,c[0],o.rate); return '<tr'+(c[0]===o.cap?' class="rt-on"':'')+'><td>'+c[0]+'%</td><td>'+esc(c[1])+'</td><td>'+RT.yuan(Math.max(r.M,0))+'</td><td>'+RT.wan(Math.max(r.loan,0))+'</td><td>'+RT.wan(Math.max(buyFor(o,r.loan),0))+'</td></tr>'; }).join('')+
      '</tbody></table></div></details>';
    // 各利率
    html+='<details class="v-samples" open><summary>利率差多少？（收支比 '+o.cap+'%、'+o.years+' 年）</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>利率</th><th>常見方案</th><th>可貸</th><th>同樣貸 '+RT.wan(Math.max(main.loan,0))+' 的月付</th></tr></thead><tbody>'+
      RATES.map(function(r){ var x=loanFor(o,o.cap,r[0]); return '<tr><td>'+r[0]+'%</td><td>'+esc(r[1])+'</td><td>'+RT.wan(Math.max(x.loan,0))+'</td><td>'+RT.yuan(RT.pmt(Math.max(main.loan,0)*10000,r[0],(o.years-o.grace)*12))+'</td></tr>'; }).join('')+
      '</tbody></table></div><p class="v-note">利率是 2026 年 9 月各類房貸的常見區間，實際要看銀行、職業、信用分數。新青安資格和逐年利率請用<a href="../youth-loan/">新青安試算</a>。</p></details>';
    // 還掉負債能多貸多少
    var tips=[];
    [['dPersonal','信貸'],['dCar','車貸'],['dCard','信用卡分期'],['dStudent','學貸']].forEach(function(p){
      var m=o.debts[p[0]]; if(m>0) tips.push('還清'+p[1]+'（每月 '+RT.comma(m)+' 元），可以多貸約 <b>'+RT.wan(RT.pv(m,o.rate,(o.years-o.grace)*12)/10000)+'</b>');
    });
    if(tips.length) html+='<div class="v-samples"><b style="color:var(--navy)">💡 還掉負債能多貸多少</b><ul class="rt-list">'+tips.map(function(t){return '<li>'+t+'</li>'}).join('')+'</ul></div>';
    if(caseNote) html+='<div class="v-judge v-ok"><b>容瑜的建議</b>'+esc(caseNote)+'</div>';
    var msg='容瑜你好，我用了收支比試算：月收入 '+RT.comma(inc)+' 元、每月負債 '+RT.comma(o.debt)+' 元、自備款 '+(o.down||'?')+' 萬，試算可貸約 '+RT.wan(Math.max(main.loan,0))+'、可買約 '+RT.wan(Math.max(buy,0))+'。想請你幫我看看實際能買哪裡。';
    html+='<a class="btn btn-line v-cta" href="'+RT.LINE_URL+'" target="_blank" rel="noopener" data-rt-line="'+esc(msg)+'" data-toast="dtiToast">LINE 請容瑜幫我看</a><p class="toast" id="dtiToast" role="status"></p>'+
      '<p class="v-disclaimer">試算結果僅供參考，實際可貸金額依銀行審核（職業、信用、年齡、物件鑑價）為準。</p>';
    $('dtiResult').innerHTML=html;
  }

  function setCase(k){
    var c=CASES[k];
    $('iInc').value=c.inc; $('iInc2').value=c.inc2||''; $('iDown').value=c.down;
    DEBTS.forEach(function(d){ $(d).value=c[d]||''; });
    $('iRate').value=c.rate; $('iYears').value=c.years; $('iGrace').value=c.grace; $('iCap').value=c.cap;
    document.querySelectorAll('.rt-cases button').forEach(function(b){ b.setAttribute('aria-pressed',b.getAttribute('data-case')===k?'true':'false'); });
    calc(c.note);
    if(window.innerWidth<900) $('dtiResult').scrollIntoView({behavior:'smooth'});
  }

  document.querySelectorAll('.rt-cases button').forEach(function(b){ b.addEventListener('click',function(){ setCase(b.getAttribute('data-case')); }); });
  document.querySelectorAll('.rt-chips [data-rate]').forEach(function(b){ b.addEventListener('click',function(){ $('iRate').value=b.getAttribute('data-rate'); calc(); }); });
  $('dtiForm').addEventListener('submit',function(e){ e.preventDefault(); calc(); if(window.innerWidth<900) $('dtiResult').scrollIntoView({behavior:'smooth'}); });
  $('dtiForm').addEventListener('input',function(){ if($('iInc').value) calc(); });
})();
