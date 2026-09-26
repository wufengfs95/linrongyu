/* 猜價王：一筆桃園實價登錄成交，猜房屋總價（不含車位），5 題一局。
   每題分數：誤差 0% 得 100 分，誤差 50% 以上 0 分，中間線性。題庫同「誰比較貴」：game/deals.json */
(function(){
  var RT=window.RT, GM=window.GM, $=RT.$, esc=RT.esc;
  var KIND={a:'電梯大樓',b:'華廈',c:'公寓',d:'透天厝'};
  var N=5, deals=[], qs=[], idx=0, score=0, log=[], locked=true, last=0;

  function deal(r){ return {town:r[0],road:r[1],k:r[2],y:r[3],q:r[4],u:r[5],a:r[6],f:r[7],tf:r[8],age:r[9],p:Math.round(r[5]*r[6])}; }
  function floorText(d){ return d.k==='d'?'透天 '+d.tf+' 層':d.f+' 樓（共 '+d.tf+' 樓）'; }
  function card(d){
    return '<div class="gm-deal"><span class="kind">'+KIND[d.k]+'</span>'+
      '<h3><small>'+esc(d.town)+'</small>'+esc(d.road)+'</h3>'+
      '<dl><dt>屋齡</dt><dd>'+(d.age?d.age+' 年':'新成屋')+'</dd><dt>樓層</dt><dd>'+floorText(d)+'</dd>'+
      '<dt>坪數</dt><dd>'+d.a+' 坪</dd><dt>成交</dt><dd>'+d.y+' 年 Q'+d.q+'</dd></dl>'+
      '<div class="gm-ans">實際成交 <b>'+RT.comma(d.p)+'</b> 萬<br><small>每坪 '+d.u.toFixed(1)+' 萬（不含車位）</small></div></div>';
  }
  function pts(guess,real){ return Math.max(0,Math.round(100*(1-Math.abs(guess-real)/real/.5))); }
  function setGuess(v){ v=Math.max(50,Math.min(9999,Math.round(v))); $('guNum').value=v; $('guRange').value=Math.min(3000,Math.max(100,v)); }

  // 一局 5 題：型態盡量不重複（大樓、華廈、公寓、透天都會遇到）
  function pickRound(){
    var pool=GM.shuffle(deals.slice()), out=[], kinds={};
    pool.forEach(function(d){ if(out.length<N&&!kinds[d.k]){ kinds[d.k]=1; out.push(d); } });
    pool.forEach(function(d){ if(out.length<N&&out.indexOf(d)<0) out.push(d); });
    return GM.shuffle(out);
  }
  function start(){
    qs=pickRound(); idx=0; score=0; log=[];
    $('guScore').textContent=0; $('guStart').hidden=true; $('guPlay').hidden=false; $('guResult').hidden=true;
    ask();
  }
  function ask(){
    var d=qs[idx];
    $('guNo').textContent=idx+1; $('guDeal').innerHTML=card(d);
    // 滑桿起點：用這一區這一型態的平均單價×坪數，給一個不會太離譜、也不會洩題的起點
    var same=deals.filter(function(x){return x.town===d.town&&x.k===d.k}), avg=same.reduce(function(s,x){return s+x.u},0)/(same.length||1);
    setGuess(Math.round(avg*d.a/10)*10||800);
    $('guWhy').textContent=''; $('guWhy').className='gm-why'; $('guNextRow').hidden=true;
    $('guSubmit').disabled=false; $('guRange').disabled=$('guNum').disabled=false; locked=false;
  }
  function submit(e){
    e.preventDefault(); if(locked) return;
    var g=RT.num($('guNum').value); if(!g) return; locked=true;
    var d=qs[idx], p=pts(g,d.p), err=Math.round((g/d.p-1)*100);
    score+=p; log.push({d:d,g:g,p:p}); $('guScore').textContent=score;
    $('guScore').classList.remove('gm-pop'); void $('guScore').offsetWidth; $('guScore').classList.add('gm-pop');
    $('guDeal').firstChild.classList.add('gm-reveal');
    $('guSubmit').disabled=true; $('guRange').disabled=$('guNum').disabled=true;
    $('guWhy').className='gm-why '+(p>=60?'ok':'no');
    $('guWhy').textContent=(p>=90?'神準！':p>=60?'很接近！':p>0?'有點差距，':'差很多！')+'你猜 '+RT.comma(g)+' 萬，'+
      (err===0?'完全猜中':'猜'+(err>0?'高':'低')+'了 '+Math.abs(err)+'%')+'，得 '+p+' 分';
    $('guNext').textContent=idx+1<N?'下一題 →':'看成績'; $('guNextRow').hidden=false; $('guNext').focus({preventScroll:true});
  }
  function next(){ idx++; if(idx<N) ask(); else end(); }
  function end(){
    last=score; $('guPlay').hidden=true; $('guStart').hidden=false; $('guGo').textContent='再猜一局';
    var mine=GM.board({game:'guess',score:score||null,asc:false,unit:' 分',rank:$('guRank'),top:$('guTop')});
    $('guHead').innerHTML='<b>'+score+'</b> 分<small>滿分 500・'+
      (score>=400?'你對桃園房價超有感，可以來當房仲了！':score>=250?'有抓到行情，再玩幾局會更準':'房價真的不好猜，這就是為什麼估價要看實價登錄')+
      (mine.better&&mine.n>1?'・刷新你的本週最佳':'')+'</small>';
    $('guExtra').innerHTML='<ul class="gm-rounds">'+log.map(function(x){
      return '<li><span>'+esc(x.d.town)+' '+esc(x.d.road)+'・'+KIND[x.d.k]+'</span><span>猜 '+RT.comma(x.g)+'／實際 <b>'+RT.comma(x.d.p)+'</b> 萬</span></li>'}).join('')+'</ul>';
    $('guCta').innerHTML='想知道<b>你家</b>現在值多少？<a href="../value/">房屋估價 →</a> 或上傳謄本用 <a href="../deed/">謄本估價 →</a><br>要更準的，<a href="https://line.me/ti/p/~0973263569" target="_blank" rel="noopener">LINE 容瑜</a>幫你拉同社區成交。';
    $('guResult').hidden=false;
    setTimeout(function(){ $('guResult').scrollIntoView({behavior:'smooth',block:'start'}); },100);
  }

  $('guRange').addEventListener('input',function(){ $('guNum').value=this.value; });
  $('guNum').addEventListener('input',function(){ var v=RT.num(this.value); if(v) $('guRange').value=Math.min(3000,Math.max(100,v)); });
  $('guForm').addEventListener('submit',submit);
  $('guNext').addEventListener('click',next);
  $('guGo').addEventListener('click',start);
  $('guAgain').addEventListener('click',function(){ start(); $('guPlay').scrollIntoView({behavior:'smooth',block:'center'}); });
  $('guShare').addEventListener('click',function(){
    GM.share(last?'猜價王我拿了 '+last+' 分（滿分 500）！猜桃園真實成交價，你能猜多準？🏠':'猜桃園真實成交價，比想像中難！你來試試 🏠',$('guToast'));
  });

  fetch('../game/deals.json?v='+(document.currentScript&&document.currentScript.getAttribute('data-v')||''))
    .then(function(r){return r.json()}).then(function(rows){
      deals=rows.map(deal); if(deals.length<N) throw 0;
      $('guGo').disabled=false; $('guGo').textContent='開始猜價';
    }).catch(function(){ $('guGo').textContent='資料載入失敗，請重新整理'; });
})();
