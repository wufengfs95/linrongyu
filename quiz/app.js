/* 買房快問快答：題庫隨機抽 10 題是非題，每題 8 秒。答對 50 分＋剩餘秒數×10（最多 130 分）。
   題目只挑有明確答案的；法規變動（稅率、新青安條件）要記得回來改。 [題目, 對=1／錯=0, 解說] */
(function(){
  var RT=window.RT, GM=window.GM, $=RT.$, esc=RT.esc;
  var BANK=[
    ['公設比越高，同樣的權狀坪數，室內能用的空間越大。',0,'剛好相反。公設比越高，權狀裡算的公共設施越多，室內實際能用的坪數就越小。'],
    ['公設比＝公共設施面積 ÷ 權狀總面積。',1,'對。例如權狀 30 坪、公設 9 坪，公設比就是 30%。桃園新大樓常見 30～35%。'],
    ['大樓的權狀坪數，通常有包含公共設施。',1,'對。大樓權狀＝主建物＋附屬建物（陽台等）＋公設，所以看單價時要留意公設比。'],
    ['1 坪約等於 3.3058 平方公尺。',1,'對。謄本上寫的是平方公尺，除以 3.3058 就是坪數。'],
    ['「履約保證」是把買方付的價金放在第三方專戶，保障買賣雙方。',1,'對。錢先進履保專戶，等過戶、交屋完成才撥給賣方，任何一方出問題錢都不會被捲走。'],
    ['契稅是由買方繳。',1,'對。契稅的納稅義務人是買方（承受人），稅率是房屋評定現值的 6%。'],
    ['土地增值稅原則上由買方繳。',0,'錯。土地增值稅是賣方（原所有權人）要繳的，漲越多繳越多。'],
    ['房屋稅每年 5 月開徵，地價稅每年 11 月開徵。',1,'對。記法：5 月房屋、11 月土地。'],
    ['當年度的房屋稅、地價稅，通常以交屋日為準，由買賣雙方按比例分擔。',1,'對。一般買賣契約會約定以交屋日分算，交屋前賣方負擔、交屋後買方負擔。'],
    ['房地合一稅：個人持有 2 年內就賣掉，獲利稅率是 45%。',1,'對。2 年內 45%、2～5 年 35%、5～10 年 20%、超過 10 年 15%。'],
    ['自住的房子（本人、配偶或未成年子女設籍並住滿 6 年），獲利 400 萬以內免繳房地合一稅。',1,'對。符合自住條件，400 萬以內免稅，超過的部分稅率 10%。'],
    ['賣掉自住的房子後，2 年內再買自住的房子，符合條件可以申請重購退稅。',1,'對。土地增值稅和房地合一稅都有重購退稅，條件看新舊房子的價格，要在 2 年內辦。'],
    ['頂樓加蓋可以辦產權登記，有自己的權狀。',0,'錯。頂樓加蓋屬於違章建築，沒辦法登記，也不算在權狀坪數裡，隨時可能被報拆。'],
    ['用內政部版的「要約書」出價，不需要先付斡旋金。',1,'對。要約書不用交錢，一樣可以跟屋主出價，屋主簽回同意就成交。'],
    ['房貸寬限期內，每個月只繳利息、不用還本金。',1,'對。但寬限期結束後，本金要在剩下的年數還完，月付會一下子變高，要先算好。'],
    ['本息平均攤還，在利率不變時每個月繳的金額都一樣。',1,'對。前期繳的大多是利息，後期才慢慢變成本金。'],
    ['本金平均攤還，前期月付比較高，但總利息比本息平均攤還少。',1,'對。每月固定還一樣多的本金，本金降得快，利息就少；缺點是前幾年壓力比較大。'],
    ['房貸如果是機動利率，央行升息時月付可能跟著變高。',1,'對。大部分房貸都是機動利率，跟著銀行的指標利率調整。'],
    ['新青安貸款最長可以貸 40 年，寬限期最長 5 年。',1,'對。額度、利率怎麼算，可以用網站上的「新青安試算」算一下。'],
    ['只要年滿 18 歲，就一定能申請新青安。',0,'錯。還要本人、配偶和未成年子女名下都沒有自己的房子等條件，銀行也會審收入和信用。'],
    ['銀行估價如果比成交價低，貸款成數會用比較低的那個價格來算。',1,'對。所以估價不足時，自備款就要多準備，簽約前最好先請銀行初估。'],
    ['有些銀行會要求「屋齡＋貸款年數」不能超過一定年限，所以老房子能貸的年限可能比較短。',1,'對。老公寓常常貸不到 30 年，月付會比較高，買之前要先問銀行。'],
    ['買房的自備款，只要準備房價的兩成就夠了。',0,'不夠。兩成是頭期款，還要準備契稅、代書費、仲介服務費、履保費、保險費，大約再抓房價的 3～5%，另外還有裝修、搬家。'],
    ['仲介服務費，法規規定買賣雙方合計不能超過成交價的 6%。',1,'對。這是內政部的上限，實際收多少可以在委託時談。'],
    ['不是屋主，也可以申請房子的第二類謄本（個資會遮蔽）。',1,'對。任何人都可以申請第二類謄本，看得到面積、抵押等資料，屋主的個資會遮起來。'],
    ['民國 71～73 年間核發建照的房子，比較需要注意輻射鋼筋。',1,'對。輻射屋大多集中在這幾年，可以上核安會網站查詢清冊。'],
    ['海砂屋指的是混凝土的氯離子含量太高，鋼筋容易生鏽。',1,'對。常見跡象是天花板鋼筋外露、混凝土剝落，買前可以請專業單位做氯離子檢測。'],
    ['牆上有壁癌，重新油漆就解決了。',0,'錯。壁癌是水氣滲進牆裡，要先找出水從哪來、做好防水，不然油漆很快又會起泡。'],
    ['帶看時看到天花板有水漬，一定是現在還在漏水。',0,'不一定。可能是以前漏過、已經修好。要問清楚修繕紀錄，也要看屋主在「現況說明書」怎麼寫。'],
    ['屋主持有期間發生過非自然死亡，可以不告知買方。',0,'錯。這要寫在不動產說明書裡告知買方，隱瞞的話買方可以解約、求償。'],
    ['實價登錄的「公寓」，指的是 5 樓以下、沒有電梯的建物。',1,'對。有電梯、10 樓以下叫「華廈」，11 樓以上有電梯叫「住宅大樓」。'],
    ['預售屋的紅單可以自由轉賣給別人賺價差。',0,'錯。2023 年平均地權條例修法後，紅單禁止轉售，預售屋契約原則上也不能轉讓。'],
    ['辦房貸時，銀行通常會要求投保住宅火險和地震基本保險。',1,'對。房子是貸款的擔保品，銀行會要求保險，保費通常一年一繳。'],
    ['簽約前，仲介應該給買方看不動產說明書並解說。',1,'對。說明書裡有產權、屋況、稅費、周邊設施等資料，看完要簽名，有疑問一定要先問清楚。']
  ];
  var N=10, SEC=8, qs=[], idx=0, score=0, right=0, wrong=[], t0=0, raf=0, locked=true, last=0;

  function start(){
    qs=GM.shuffle(BANK.slice()).slice(0,N); idx=0; score=0; right=0; wrong=[];
    $('qzScore').textContent=0; $('qzStart').hidden=true; $('qzPlay').hidden=false; $('qzResult').hidden=true;
    ask();
  }
  function ask(){
    var q=qs[idx];
    $('qzNo').textContent=idx+1; $('qzQ').textContent=q[0];
    $('qzWhy').textContent=''; $('qzWhy').className='gm-why'; $('qzExp').hidden=true; $('qzNextRow').hidden=true;
    [].forEach.call(document.querySelectorAll('.gm-tf button'),function(b){ b.disabled=false; b.className=''; });
    locked=false; t0=performance.now(); tick();
  }
  function tick(){
    var left=Math.max(0,SEC-(performance.now()-t0)/1000);
    $('qzBar').style.transform='scaleX('+(left/SEC)+')';
    if(left<=0) return answer(-1);
    raf=requestAnimationFrame(tick);
  }
  function answer(a){
    if(locked) return; locked=true; cancelAnimationFrame(raf);
    var q=qs[idx], left=Math.max(0,SEC-(performance.now()-t0)/1000), ok=a===q[1];
    [].forEach.call(document.querySelectorAll('.gm-tf button'),function(b){
      b.disabled=true; var v=+b.getAttribute('data-a');
      if(v===q[1]) b.className='right'; else if(v===a) b.className='wrong';
    });
    if(ok){ var add=50+Math.round(left*10); score+=add; right++; $('qzScore').textContent=score;
      $('qzWhy').className='gm-why ok'; $('qzWhy').textContent='答對！+'+add+' 分';
      $('qzScore').classList.remove('gm-pop'); void $('qzScore').offsetWidth; $('qzScore').classList.add('gm-pop');
    } else { wrong.push(q);
      $('qzWhy').className='gm-why no'; $('qzWhy').textContent=a<0?'時間到！答案是「'+(q[1]?'對':'錯')+'」':'答錯了，答案是「'+(q[1]?'對':'錯')+'」';
    }
    $('qzExp').textContent=q[2]; $('qzExp').hidden=false;
    $('qzNext').textContent=idx+1<N?'下一題 →':'看成績'; $('qzNextRow').hidden=false; $('qzNext').focus({preventScroll:true});
  }
  function next(){ idx++; if(idx<N) ask(); else end(); }
  function end(){
    last=score; $('qzPlay').hidden=true; $('qzStart').hidden=false;
    $('qzGo').textContent='再答一輪';
    var mine=GM.board({game:'quiz',score:score||null,asc:false,unit:' 分',rank:$('qzRank'),top:$('qzTop')});
    $('qzHead').innerHTML='<b>'+score+'</b> 分<small>答對 '+right+' / '+N+' 題・'+
      (right>=9?'買房知識滿分等級，可以當親友的顧問了！':right>=6?'觀念不錯，看看下面答錯的題目補一下':'很多人都答錯這些，買房前把解說看一遍很有用')+
      (mine.better&&mine.n>1?'・刷新你的本週最佳':'')+'</small>';
    $('qzExtra').innerHTML=wrong.length?'<div class="gm-review">'+wrong.map(function(q){
      return '<div><b>'+esc(q[0])+'　答案：'+(q[1]?'對':'錯')+'</b>'+esc(q[2])+'</div>'}).join('')+'</div>':'';
    $('qzCta').innerHTML='買房、賣房還有其他問題？<a href="https://line.me/ti/p/~0973263569" target="_blank" rel="noopener">LINE 問容瑜</a>，一對一幫你看。';
    $('qzResult').hidden=false;
    setTimeout(function(){ $('qzResult').scrollIntoView({behavior:'smooth',block:'start'}); },100);
  }

  document.querySelector('.gm-tf').addEventListener('click',function(e){
    var b=e.target.closest('button'); if(b) answer(+b.getAttribute('data-a')); });
  document.addEventListener('keydown',function(e){   // 電腦版：O／X 或 ←→ 也能答
    if(locked) return; var k=e.key.toLowerCase();
    if(k==='o'||k==='arrowleft') answer(1); else if(k==='x'||k==='arrowright') answer(0); });
  $('qzNext').addEventListener('click',next);
  $('qzGo').addEventListener('click',start);
  $('qzAgain').addEventListener('click',function(){ start(); $('qzPlay').scrollIntoView({behavior:'smooth',block:'center'}); });
  $('qzShare').addEventListener('click',function(){
    GM.share(last?'買房快問快答我拿了 '+last+' 分！10 題買房常識，你能拿幾分？📝':'10 題買房常識是非題，比想像中難！你來試試 📝',$('qzToast'));
  });
})();
