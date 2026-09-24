/* 新青安 3.0 貸款試算（2026-08-01 起申辦，至 2029-07-31）
   額度：一般 1,000 萬、新婚（婚後 2 年內）1,200 萬、有未成年子女 1,500 萬
   房價上限：台北市 3,500 萬、新北市／新竹縣市 2,500 萬、其他縣市 2,000 萬
   利率：前 3 年 1.775%（政府補貼 1.5 碼＋公股減收半碼），第 4 年起每年補貼少半碼，第 7 年起回到原利率 2.275%
   其他：未滿 50 歲、本人年所得 ≤ 200 萬、年齡＋貸款年限 ≤ 80、本人配偶未成年子女無自有住宅、最長 40 年、寬限期最長 5 年、一生一次 */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc;
  var CAP={normal:1000,married:1200,kids:1500}, CAP_NAME={normal:'一般',married:'新婚',kids:'育有未成年子女'};
  var BASE=1.775, STEP=0.125, FULL=2.275;
  function yRate(y,base){ var add=Math.min(Math.max(y-3,0),4)*STEP; return Math.min(base+add, base+4*STEP); }

  // 逐月模擬：利率每年可能變，寬限期只繳息，之後每次利率變動都用剩餘本金、剩餘期數重算月付
  function simulate(P,years,grace,rateOf){
    var n=years*12, bal=P, paid=0, interest=0, pay=0, cur=null, rows=[];
    for(var m=1;m<=n&&bal>0.5;m++){
      var y=Math.ceil(m/12), r=rateOf(y), i=bal*r/1200;
      if(m<=grace*12){ pay=i; }
      else if(cur!==r||m===grace*12+1){ pay=RT.pmt(bal,r,n-m+1); }
      cur=r;
      var princ=Math.min(pay-i,bal); if(m<=grace*12) princ=0;
      bal-=princ; interest+=i; paid+=i+princ;
      if((m-1)%12===0) rows.push({y:y,r:r,pay:pay});
    }
    return {rows:rows,interest:interest,paid:paid};
  }

  function calc(){
    var type=document.querySelector('#yType [aria-pressed="true"]').getAttribute('data-t');
    var city=$('yCity'), limit=+city.value, price=RT.val('yPrice'), ratio=RT.val('yRatio')||80,
        age=RT.val('yAge'), income=RT.val('yIncome'), years=RT.val('yYears')||40, grace=RT.val('yGrace'),
        other=RT.val('yOther')||2.4;
    if(!price){ $('yResult').innerHTML='<div class="v-empty"><b>先填房屋總價</b><p>填好總價，就會算出新青安能貸多少、超過的部分要搭配多少一般房貸，以及每年的月付變化。</p></div>'; return; }
    var cap=CAP[type], loan=price*ratio/100, yl=Math.min(loan,cap), ol=Math.max(loan-yl,0), down=price-loan;
    var maxYears=age?Math.min(40,80-age):40, useYears=Math.min(years,maxYears);
    var checks=[
      [price<=limit, '房價 '+RT.wan(price)+(price<=limit?' 在':' 超過')+city.options[city.selectedIndex].text+'上限 '+RT.wan(limit)],
      [!age||age<50, age?'年齡 '+age+' 歲'+(age<50?'，未滿 50 歲':'，已滿 50 歲不能申請'):'申貸時要未滿 50 歲'],
      [!income||income<=200, income?'本人年所得 '+income+' 萬'+(income<=200?'，沒超過 200 萬':'，超過 200 萬'):'本人年所得不能超過 200 萬'],
      [!age||years<=maxYears, age?'年齡＋年限：'+age+'＋'+years+'＝'+(age+years)+(age+years<=80?'，沒超過 80':'，超過 80，年限最多只能 '+maxYears+' 年'):'申貸年齡加貸款年限不能超過 80'],
      [null, '本人、配偶、未成年子女名下都沒有自有住宅（要自己確認）'],
      [null, '新青安一生只能貸一次；'+(type==='married'?'新婚是指結婚 2 年內':type==='kids'?'要有未成年子女':'單身也可以申請')]
    ];
    var ok=checks.every(function(c){return c[0]!==false});
    var ys=simulate(yl*10000,useYears,grace,function(y){return yRate(y,BASE)});
    var os=ol>0?simulate(ol*10000,useYears,grace,function(){return other}):null;
    var ns=simulate(yl*10000,useYears,0,function(y){return yRate(y,BASE)});
    var first=ys.rows[0].pay+(os?os.rows[0].pay:0);
    var afterGrace=grace?(ys.rows[grace]||ys.rows[ys.rows.length-1]).pay+(os?(os.rows[grace]||os.rows[os.rows.length-1]).pay:0):first;
    var y7=(ys.rows[6]||ys.rows[ys.rows.length-1]).pay+(os?(os.rows[6]||os.rows[os.rows.length-1]).pay:0);

    var html='<div class="v-price"><span>新青安可貸（'+CAP_NAME[type]+'額度上限 '+RT.wan(cap)+'）</span><b>'+RT.wan(yl)+'</b>'+
      (ol>0?'<span class="v-unit">另外搭配一般房貸 <b>'+RT.wan(ol)+'</b>（利率 '+other+'%）・總貸款 '+RT.wan(loan)+'（'+(ratio/10)+' 成）</span>':'<span class="v-unit">總貸款 '+RT.wan(loan)+'（'+(ratio/10)+' 成），全部都能用新青安</span>')+'</div>';
    html+='<div class="v-meta"><span>自備款 <b>'+RT.wan(down)+'</b>（另備 3～5% 雜費）</span><span>年限 <b>'+useYears+' 年</b></span>'+(grace?'<span>寬限期 <b>'+grace+' 年</b></span>':'')+'</div>';
    html+='<div class="rt-kpis">'+
      '<div><span>'+(grace?'寬限期（只繳息）':'前 3 年')+'每月</span><b>'+RT.yuan(first)+'</b></div>'+
      (grace?'<div><span>寬限期結束後每月</span><b>'+RT.yuan(afterGrace)+'</b></div>':'')+
      '<div><span>第 7 年起每月</span><b>'+RT.yuan(y7)+'</b></div>'+
      '<div><span>總利息</span><b>'+RT.wan((ys.interest+(os?os.interest:0))/10000)+'</b></div></div>';
    html+='<div class="v-judge '+(ok?'v-good':'v-bad')+'"><b>'+(ok?'✅ 符合新青安基本條件':'⚠️ 有條件不符合')+'</b><ul class="rt-list rt-checks">'+
      checks.map(function(c){return '<li class="'+(c[0]===false?'no':c[0]?'yes':'ask')+'">'+esc(c[1])+'</li>'}).join('')+'</ul></div>';
    if(grace) html+='<p class="v-warn">寬限期 '+grace+' 年期間只繳利息、本金沒有減少，寬限期結束後月付會跳到 '+RT.yuan(afterGrace)+'。新青安部分總利息會比不用寬限期多 '+RT.wan((ys.interest-ns.interest)/10000)+'。</p>';
    // 每年月付
    html+='<details class="v-samples" open><summary>每年的利率和月付</summary><div class="v-table-wrap"><table class="v-table"><thead><tr><th>年度</th><th>新青安利率</th><th>新青安月付</th>'+(os?'<th>一般房貸月付</th>':'')+'<th>合計月付</th></tr></thead><tbody>';
    var lastR=null;
    for(var i=0;i<ys.rows.length;i++){
      var r=ys.rows[i], o=os?os.rows[i]:null, show=i<8||r.r!==lastR||i===grace;
      if(!show) continue; lastR=r.r;
      html+='<tr'+(i<grace?' class="rt-grace"':'')+'><td>第 '+r.y+' 年'+(i<grace?'（寬限）':'')+'</td><td>'+r.r.toFixed(3)+'%</td><td>'+RT.yuan(r.pay)+'</td>'+(os?'<td>'+RT.yuan(o?o.pay:0)+'</td>':'')+'<td><b>'+RT.yuan(r.pay+(o?o.pay:0))+'</b></td></tr>';
      if(i===7&&ys.rows.length>8){ html+='<tr><td colspan="'+(os?5:4)+'" style="text-align:center;color:var(--muted)">之後利率不變，月付相同，繳到第 '+useYears+' 年</td></tr>'; break; }
    }
    html+='</tbody></table></div><p class="v-note">利率以 2026 年 9 月公股銀行新青安一段式機動利率 1.775% 計算，第 4～6 年補貼逐年減少半碼，第 7 年起 2.275%。央行調整利率時會跟著變動。</p></details>';
    var msg='容瑜你好，我用了新青安試算：'+CAP_NAME[type]+'、總價 '+price+' 萬、貸 '+(ratio/10)+' 成（新青安 '+RT.wan(yl)+(ol?'＋一般房貸 '+RT.wan(ol):'')+'），'+useYears+' 年、寬限 '+grace+' 年，月付約 '+RT.yuan(grace?afterGrace:first)+'。想請你幫我找符合新青安的物件。';
    html+='<a class="btn btn-line v-cta" href="'+RT.LINE_URL+'" target="_blank" rel="noopener" data-rt-line="'+esc(msg)+'" data-toast="yToast">LINE 請容瑜幫我找物件</a><p class="toast" id="yToast" role="status"></p>'+
      '<p class="v-disclaimer">試算僅供參考，實際核貸額度、成數、利率依承辦銀行（臺銀、土銀、合庫、一銀、華銀、彰銀、兆豐、臺企銀）審核為準。</p>';
    $('yResult').innerHTML=html;
  }

  document.querySelectorAll('#yType button').forEach(function(b){ b.addEventListener('click',function(){
    document.querySelectorAll('#yType button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')}); calc(); }); });
  $('yForm').addEventListener('submit',function(e){ e.preventDefault(); calc(); if(window.innerWidth<900) $('yResult').scrollIntoView({behavior:'smooth'}); });
  $('yForm').addEventListener('input',calc);
  var q=new URLSearchParams(location.search); if(q.get('amt')){ $('yPrice').value=q.get('amt'); calc(); }
})();
