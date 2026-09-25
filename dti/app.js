/* 收支比試算（DTI）：銀行認列收入 vs 既有負債＋最低生活費＋新房貸月付 → 收支比、風險分級、調整建議 */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc;

  // 115 年各縣市最低生活費（衛福部／各直轄市公告，每人每月）
  var LIVING={'臺北市':20744,'新北市':17750,'桃園市':17186,'臺中市':16431,'臺南市':15515,'高雄市':16970,
    '基隆市':15515,'新竹市':15515,'新竹縣':15515,'苗栗縣':15515,'彰化縣':15515,'南投縣':15515,'雲林縣':15515,
    '嘉義市':15515,'嘉義縣':15515,'屏東縣':15515,'宜蘭縣':15515,'花蓮縣':15515,'臺東縣':15515,'澎湖縣':15515,
    '金門縣':15173,'連江縣':15173};
  // 收入類型 → 銀行認列比例
  var KIND={salary:[1,'受薪（固定薪資）'],self:[0.7,'自營、接案'],bonus:[0.7,'業務（獎金為主）']};
  var OTHER=[['oRent','租金收入',0.7],['oDiv','股利配息（年領÷12）',0.65],['oPart','兼職、其他收入',0.7]];
  var DEBTS=[['dHome','既有房貸'],['dPersonal','信貸'],['dCar','車貸'],['dStudent','學貸'],['dCard','信用卡分期／循環'],['dStock','股票質借利息'],['dOther','其他貸款']];
  var TIERS=[[55,'安全區','t1','收支比在安全範圍，銀行核貸機率高，利率也比較好談。'],
             [60,'嚴審區','t2','開始進入嚴審，銀行會要完整的收入證明（薪轉存摺、扣繳憑單），部分銀行會要求保證人。'],
             [65,'高壓力區','t3','過件難度明顯提高，建議降低貸款成數、拉長年限，或加保證人。'],
             [70,'需調整區','t4','多半要調整條件才過得了：砍成數、加保證人或換方案，優先還掉信貸、卡債。'],
             [Infinity,'高風險區','t5','過件難度很高，建議重新抓購屋預算：降總價、多準備自備款，或等負債減少再申請。']];
  var RATES=[[1.775,'新青安 3.0（前 3 年）'],[2.2,'公股銀行首購常見'],[2.321,'五大銀行實際平均'],[2.5,'一般房貸常見'],[2.8,'民營銀行、非首購']];
  var CASES={
    single:{mode:1,city:'桃園市',dep:0,inc1:65000,k1:'salary',dStudent:3000,price:650,ratio:80,rate:1.775,years:40,grace:0,
      note:'月薪 6.5 萬、學貸每月 3,000 元，用新青安 40 年買 650 萬的兩房，收支比剛好落在 55% 安全區內，總價再往上加就會進嚴審區。中壢、平鎮這個價位還有不少選擇。'},
    couple:{mode:2,city:'桃園市',dep:0,inc1:60000,k1:'salary',inc2:50000,k2:'salary',dCar:8000,price:1100,ratio:80,rate:1.775,years:40,grace:0,
      note:'夫妻合併申請，收入加在一起算，但兩個人的負債也都會算進去。車貸每月 8,000 元如果快繳完，等繳清再送件，收支比可以降到嚴審區以內。'},
    self:{mode:1,city:'桃園市',dep:0,inc1:100000,k1:'self',price:1000,ratio:80,rate:2.5,years:30,grace:0,
      note:'自營收入銀行通常只認 7 成，月入 10 萬只算 7 萬。報稅收入越完整越好；收支比偏高時，最常見的解法是配偶或二等親當保證人，或拉長到 40 年。'},
    swap:{mode:2,city:'桃園市',dep:0,inc1:70000,k1:'salary',inc2:50000,k2:'salary',dHome:23000,dPersonal:8000,price:1800,ratio:70,rate:2.5,years:30,grace:0,
      note:'舊房貸還在，銀行會把它算進負債，第二戶成數也比較低，兩邊一起扛收支比會爆表。建議先賣後買，或跟我討論「買賣同步」的時程安排。'}
  };
  var FIELDS=['city','dep','inc1','k1','inc2','k2','oRent','oDiv','oPart','gInc','gDebt','price','ratio','rate','years','grace'].concat(DEBTS.map(function(d){return d[0]}));
  var mode=1, step=0;

  function tierOf(d){ for(var i=0;i<TIERS.length;i++) if(d<=TIERS[i][0]) return i; return 4; }

  function read(){
    var o={city:$('city').value,dep:RT.val('dep'),price:RT.val('price'),ratio:RT.val('ratio')||80,rate:RT.val('rate')||2.2,
      years:RT.val('years')||30,grace:RT.val('grace'),gInc:RT.val('gInc'),gDebt:RT.val('gDebt'),mode:mode};
    o.inc=[];
    o.inc.push({label:mode===2?'本人':'月收入',raw:RT.val('inc1'),r:KIND[$('k1').value][0],kind:KIND[$('k1').value][1]});
    if(mode===2) o.inc.push({label:'配偶',raw:RT.val('inc2'),r:KIND[$('k2').value][0],kind:KIND[$('k2').value][1]});
    OTHER.forEach(function(x){ var v=RT.val(x[0]); if(v) o.inc.push({label:x[1],raw:v,r:x[2]}); });
    if(o.gInc) o.inc.push({label:'保證人收入',raw:o.gInc,r:1});
    o.income=o.inc.reduce(function(s,x){return s+x.raw*x.r},0);
    o.debt=0; o.debts=[];
    DEBTS.forEach(function(d){ var v=RT.val(d[0]); if(v){ o.debts.push([d[1],v]); o.debt+=v; } });
    if(o.gDebt){ o.debts.push(['保證人負債',o.gDebt]); o.debt+=o.gDebt; }
    o.people=mode+o.dep+(o.gInc?1:0);
    o.living=(LIVING[o.city]||15515)*o.people;
    o.loan=o.price*o.ratio/100;                     // 萬
    o.n=(o.years-o.grace)*12;
    o.pay=RT.pmt(o.loan*10000,o.rate,o.n);          // 寬限期後月付（銀行看這個）
    o.gracePay=o.loan*10000*o.rate/1200;
    o.out=o.debt+o.living+o.pay;
    o.dti=o.income>0?o.out/o.income*100:Infinity;
    return o;
  }
  // 目標收支比 → 最多可貸（萬）
  function maxLoan(o,target,rate,years){
    var M=o.income*target/100-o.debt-o.living;
    return M>0?RT.pv(M,rate||o.rate,((years||o.years)-o.grace)*12)/10000:0;
  }
  function dtiWith(o,ch){ // 改條件後的收支比
    var loan=(ch.price!=null?ch.price:o.price)*(ch.ratio!=null?ch.ratio:o.ratio)/100;
    var pay=RT.pmt(loan*10000,ch.rate||o.rate,((ch.years||o.years)-o.grace)*12);
    var inc=o.income+(ch.inc||0), out=o.debt-(ch.debt||0)+o.living+(ch.living||0)+pay;
    return inc>0?out/inc*100:Infinity;
  }

  function gauge(d){
    var pos=Math.max(0,Math.min(100,(Math.min(d,90)-30)/60*100));
    return '<div class="dt-gauge" aria-hidden="true"><div class="dt-bar"><i class="t1"></i><i class="t2"></i><i class="t3"></i><i class="t4"></i><i class="t5"></i></div>'+
      '<span class="dt-pin" style="left:'+pos+'%"></span><div class="dt-ticks"><span style="left:41.7%">55</span><span style="left:50%">60</span><span style="left:58.3%">65</span><span style="left:66.7%">70</span></div></div>';
  }

  function calc(caseNote){
    var o=read(), R=$('dtiResult');
    if(!o.inc[0].raw&&o.income<=0){ R.innerHTML=R.getAttribute('data-empty'); return; }
    if(!o.price){ R.innerHTML='<div class="v-empty"><b>再填「房貸規劃」的房屋總價</b><p>收入填好了，負債有的話也填上，最後填想買的總價、成數、利率，就能算出收支比。</p>'+
      '<p>先參考：依收支比 55%，你最多可貸約 <b>'+RT.wan(maxLoan(o,55))+'</b>（'+o.rate+'%、'+o.years+' 年）。</p></div>'; return; }
    var t=tierOf(o.dti), T=TIERS[t], d=o.dti;
    var html='<div class="dt-head"><span>收支負債比（DTI）</span><b class="dt-'+T[2]+'">'+(isFinite(d)?d.toFixed(1)+'%':'—')+'</b><em class="dt-tag dt-'+T[2]+'">'+T[1]+'</em></div>'+
      gauge(d)+'<p class="dt-say">'+T[3]+'</p>';
    // 明細
    html+='<details class="v-samples" open><summary>收支明細</summary><div class="v-table-wrap"><table class="v-table dt-tbl"><tbody>'+
      '<tr class="dt-sec"><td colspan="3">銀行認列收入</td></tr>'+
      o.inc.filter(function(x){return x.raw}).map(function(x){ return '<tr><td>'+esc(x.label)+(x.kind?'<small>'+esc(x.kind)+'</small>':'')+'</td><td>'+RT.comma(x.raw)+' × '+Math.round(x.r*100)+'%</td><td>'+RT.yuan(x.raw*x.r)+'</td></tr>'; }).join('')+
      '<tr class="dt-sum"><td>收入合計</td><td></td><td>'+RT.yuan(o.income)+'</td></tr>'+
      '<tr class="dt-sec"><td colspan="3">每月支出</td></tr>'+
      o.debts.map(function(x){ return '<tr><td>'+esc(x[0])+'</td><td></td><td>'+RT.yuan(x[1])+'</td></tr>'; }).join('')+
      '<tr><td>最低生活費<small>'+esc(o.city)+' '+RT.comma(LIVING[o.city])+' 元 × '+o.people+' 人</small></td><td></td><td>'+RT.yuan(o.living)+'</td></tr>'+
      '<tr><td>新房貸月付<small>貸 '+RT.wan(o.loan)+'・'+o.rate+'%・'+o.years+' 年'+(o.grace?'・寬限 '+o.grace+' 年後':'')+'</small></td><td></td><td>'+RT.yuan(o.pay)+'</td></tr>'+
      '<tr class="dt-sum"><td>支出合計</td><td></td><td>'+RT.yuan(o.out)+'</td></tr>'+
      '</tbody></table></div>'+(o.grace?'<p class="v-note">寬限期內每月只繳利息 '+RT.yuan(o.gracePay)+'，但銀行審核看的是寬限期結束後的月付。</p>':'')+'</details>';
    // 可貸金額
    var m55=maxLoan(o,55), m65=maxLoan(o,65);
    html+='<div class="v-meta"><span>收支比 55% 內最多可貸 <b>'+RT.wan(m55)+'</b></span><span>65% 內最多可貸 <b>'+RT.wan(m65)+'</b></span>'+
      '<span>本案需貸 <b>'+RT.wan(o.loan)+'</b>、自備款 <b>'+RT.wan(o.price-o.loan)+'</b>（另備 3～5% 稅費）</span></div>';
    // 調整建議
    if(t>0){
      var tips=[], need55=(o.out/0.55)-o.income;
      if(need55>0) tips.push('每月認列收入再多 <b>'+RT.yuan(need55)+'</b>，就能回到 55% 安全區（例如配偶一起申請、加保證人）。');
      if(o.years<40) tips.push('年限拉到 40 年：收支比降到 <b>'+dtiWith(o,{years:40}).toFixed(1)+'%</b>。');
      if(o.ratio>70) tips.push('成數降到 7 成（多準備 '+RT.wan(o.price*(o.ratio-70)/100)+' 自備款）：收支比降到 <b>'+dtiWith(o,{ratio:70}).toFixed(1)+'%</b>。');
      var safePrice=m55/(o.ratio/100);
      if(safePrice>0&&safePrice<o.price) tips.push('同樣條件，55% 安全區能買的總價約 <b>'+RT.wan(safePrice)+'</b>。');
      o.debts.forEach(function(x){ if(x[0]==='信貸'||x[0]==='車貸'||x[0]==='信用卡分期／循環') tips.push('還清'+x[0]+'（每月 '+RT.comma(x[1])+' 元）：收支比降到 <b>'+dtiWith(o,{debt:x[1]}).toFixed(1)+'%</b>。'); });
      if(!o.gInc) tips.push('加一位保證人，他的收入可以一起算，但他的負債和生活費也會算進來。在「收入」步驟最下面可以試填。');
      html+='<div class="v-samples"><b class="dt-tip">💡 怎麼調，收支比會下降？</b><ul class="rt-list">'+tips.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul></div>';
    }
    // 利率比較
    html+='<details class="v-samples"><summary>換個利率差多少？（貸 '+RT.wan(o.loan)+'、'+o.years+' 年）</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>利率</th><th>方案</th><th>月付</th><th>收支比</th></tr></thead><tbody>'+
      RATES.map(function(r){ var dd=dtiWith(o,{rate:r[0]}); return '<tr'+(r[0]===o.rate?' class="rt-on"':'')+'><td>'+r[0]+'%</td><td>'+esc(r[1])+'</td><td>'+RT.yuan(RT.pmt(o.loan*10000,r[0],o.n))+'</td><td class="dt-'+TIERS[tierOf(dd)][2]+'">'+dd.toFixed(1)+'%</td></tr>'; }).join('')+
      '</tbody></table></div><p class="v-note">利率每升 0.5%，收支比大約升 2～3 個百分點，送件前最好預留空間。新青安逐年利率請用<a href="../youth-loan/">新青安試算</a>。</p></details>';
    if(caseNote) html+='<div class="v-judge v-ok"><b>容瑜的建議</b>'+esc(caseNote)+'</div>';
    var msg='容瑜你好，我用了收支比試算：'+(mode===2?'夫妻合併、':'')+'認列收入 '+RT.comma(Math.round(o.income))+' 元、每月負債 '+RT.comma(o.debt)+' 元，想買 '+RT.wan(o.price)+'、貸 '+o.ratio+'%，收支比 '+(isFinite(d)?d.toFixed(1):'?')+'%（'+T[1]+'）。想請你幫我看看怎麼安排。';
    html+='<a class="btn btn-line v-cta" href="'+RT.LINE_URL+'" target="_blank" rel="noopener" data-rt-line="'+esc(msg)+'" data-toast="dtiToast">LINE 請容瑜幫我看</a><p class="toast" id="dtiToast" role="status"></p>'+
      '<p class="v-disclaimer">試算結果僅供參考，各銀行認列方式不同，實際核貸依銀行審核（職業、信用、年齡、物件鑑價）為準。</p>';
    R.innerHTML=html;
    save();
  }

  function setMode(m){
    mode=m;
    document.querySelectorAll('#dtMode button').forEach(function(b){ b.setAttribute('aria-pressed',+b.getAttribute('data-m')===m?'true':'false'); });
    document.querySelectorAll('.dt-p2').forEach(function(el){ el.hidden=m!==2; });
  }
  function go(i){
    step=Math.max(0,Math.min(3,i));
    document.querySelectorAll('.dt-step').forEach(function(el,k){ el.hidden=k!==step; });
    document.querySelectorAll('#dtSteps button').forEach(function(b,k){ b.setAttribute('aria-current',k===step?'step':'false'); b.classList.toggle('done',k<step); });
    $('dtPrev').hidden=step===0;
    $('dtNext').textContent=step===3?'看試算結果':'下一步';
  }

  function fill(c){
    FIELDS.forEach(function(k){ var el=$(k); if(!el) return;
      var v=c[k]; if(v==null) v=(el.tagName==='SELECT'?el.getAttribute('data-def'):'');
      el.value=v; });
    setMode(c.mode||1);
  }
  function save(){ var o={mode:mode}; FIELDS.forEach(function(k){ o[k]=$(k).value; }); RT.store.set('rt-dti',o); }

  document.querySelectorAll('#dtMode button').forEach(function(b){ b.addEventListener('click',function(){ setMode(+b.getAttribute('data-m')); calc(); }); });
  document.querySelectorAll('#dtSteps button').forEach(function(b,k){ b.addEventListener('click',function(){ go(k); }); });
  $('dtPrev').addEventListener('click',function(){ go(step-1); });
  $('dtNext').addEventListener('click',function(){
    if(step<3) return go(step+1);
    calc(); if(window.innerWidth<900) $('dtiResult').scrollIntoView({behavior:'smooth'});
  });
  document.querySelectorAll('.rt-chips [data-rate]').forEach(function(b){ b.addEventListener('click',function(){ $('rate').value=b.getAttribute('data-rate'); calc(); }); });
  document.querySelectorAll('.rt-cases button').forEach(function(b){ b.addEventListener('click',function(){
    var k=b.getAttribute('data-case');
    document.querySelectorAll('.rt-cases button').forEach(function(x){ x.setAttribute('aria-pressed',x===b?'true':'false'); });
    fill(CASES[k]); go(3); calc(CASES[k].note);
    $('dtiResult').scrollIntoView({behavior:'smooth'});
  }); });
  document.querySelectorAll('[data-go-calc]').forEach(function(b){ b.addEventListener('click',function(){ $('dtTool').scrollIntoView({behavior:'smooth'}); }); });
  $('dtiForm').addEventListener('input',function(){ calc(); });
  $('dtiForm').addEventListener('submit',function(e){ e.preventDefault(); });

  // ---- 公股銀行利率比較（資料在 rates.json，每季排程更新） ----
  var BANKS=null;
  function drawBanks(){
    if(!BANKS) return;
    var loan=RT.val('brLoan'), yrs=RT.val('brYears')||30, a=BANKS.avg;
    $('brUpdated').textContent='資料更新：'+BANKS.updated;
    $('brAvg').innerHTML='<b>'+a.rate+'%</b><span>'+esc(a.label)+'（'+esc(a.month)+'，<a href="'+esc(a.src)+'" target="_blank" rel="noopener">中央銀行</a>）<br>這是大家實際拿到的平均利率，同樣貸 '+RT.wan(loan)+'、'+yrs+' 年，月付約 <b>'+RT.yuan(RT.pmt(loan*10000,a.rate,yrs*12))+'</b></span>'+
      '<button type="button" class="dt-use" data-use="'+a.rate+'" data-years="'+yrs+'">用這個利率算</button>';
    $('brBody').innerHTML=BANKS.banks.map(function(b){
      var n=Math.min(yrs,b.years)*12;
      return '<tr><td><b>'+esc(b.bank)+'</b> <em class="dt-btag">'+esc(b.tag)+'</em><small>'+esc(b.plan)+'・最長 '+b.years+' 年</small><small>'+esc(b.text)+'</small>'+
        '<small><a href="'+esc(b.src)+'" target="_blank" rel="noopener">官網</a>・查核 '+esc(b.checked)+'</small></td>'+
        '<td>'+(b.rate!=null?b.rate+'% 起':'依個案核定')+'</td>'+
        '<td>'+(b.rate!=null&&loan?RT.yuan(RT.pmt(loan*10000,b.rate,n)):'—')+'</td>'+
        '<td>'+(b.rate!=null?'<button type="button" class="dt-use" data-use="'+b.rate+'" data-years="'+Math.min(yrs,b.years)+'">用這個利率算</button>':'')+'</td></tr>';
    }).join('');
  }
  fetch('rates.json'+(document.querySelector('script[data-v]')?'?v='+document.querySelector('script[data-v]').getAttribute('data-v'):''))
    .then(function(r){return r.json()}).then(function(d){
      BANKS=d; RATES[2]=[d.avg.rate,'五大銀行實際平均（'+d.avg.month+'）']; drawBanks();
    }).catch(function(){ $('brBody').innerHTML='<tr><td colspan="4">利率資料讀取失敗，請重新整理。</td></tr>'; });
  ['brLoan','brYears'].forEach(function(id){ $(id).addEventListener('input',drawBanks); $(id).addEventListener('change',drawBanks); });
  document.addEventListener('click',function(e){
    var b=e.target.closest('.dt-use'); if(!b) return;
    $('rate').value=b.getAttribute('data-use');
    if(b.getAttribute('data-years')) $('years').value=b.getAttribute('data-years');
    if(!$('price').value&&RT.val('brLoan')) $('price').value=Math.round(RT.val('brLoan')/0.8);
    go(3); calc(); $('dtTool').scrollIntoView({behavior:'smooth'});
  });

  $('dtiResult').setAttribute('data-empty',$('dtiResult').innerHTML);
  var saved=RT.store.get('rt-dti',null);
  if(saved){ fill(saved); setMode(+saved.mode||1); calc(); } else setMode(1);
  go(0);
})();
