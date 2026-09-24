/* 買方配案：買方需求 → 從網站上架物件算符合度 → 勾選 → 產生可分享的專屬物件報告（條件都放在網址 # 後面） */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc;
  var ver=(document.querySelector('script[data-v]')||{getAttribute:function(){return ''}}).getAttribute('data-v');
  var ALL=[], picked={};

  function chips(el,values,sel){
    el.innerHTML=values.map(function(v){return '<button type="button" data-v="'+esc(v)+'" aria-pressed="'+(sel.indexOf(v)>=0?'true':'false')+'">'+esc(v)+'</button>'}).join('');
  }
  function chosen(el){ return [].map.call(el.querySelectorAll('[aria-pressed="true"]'),function(b){return b.getAttribute('data-v')}); }
  function need(){
    return {n:$('mName').value.trim(), lo:RT.val('mLo'), hi:RT.val('mHi'), areas:chosen($('mAreas')), kinds:chosen($('mKinds')),
            rm:RT.val('mRooms'), age:RT.val('mAge'), park:$('mPark').checked, note:$('mNote').value.trim()};
  }

  // 符合度：總價 40、區域 25、類型 15、房數 10、屋齡 5、車位 5；條件沒填就算符合
  function score(L,q){
    var s=0, why=[];
    var inBudget=(!q.lo||L.p>=q.lo)&&(!q.hi||L.p<=q.hi);
    if(inBudget){ s+=40; if(q.lo||q.hi) why.push([1,'總價在預算內']); }
    else { var over=q.hi&&L.p>q.hi?(L.p-q.hi)/q.hi:q.lo?(q.lo-L.p)/q.lo:0;
      if(over<=.1){ s+=25; why.push([0,'總價'+(L.p>q.hi?'超出預算 ':'低於預算 ')+Math.round(over*100)+'%，可以談']); } else why.push([-1,'總價不在預算內']); }
    if(!q.areas.length||q.areas.indexOf(L.area)>=0){ s+=25; if(q.areas.length) why.push([1,'在'+L.area]); } else why.push([-1,'不在想要的區域']);
    if(!q.kinds.length||q.kinds.indexOf(L.k)>=0){ s+=15; if(q.kinds.length) why.push([1,L.k]); } else why.push([-1,'類型不同（'+L.k+'）']);
    if(!q.rm||L.rm>=q.rm){ s+=10; if(q.rm&&L.rm) why.push([1,L.rm+' 房']); } else why.push([-1,L.rm?'只有 '+L.rm+' 房':'沒有房間格局']);
    if(!q.age||(L.age!=null&&L.age<=q.age)){ s+=5; if(q.age&&L.age!=null) why.push([1,'屋齡 '+L.age+' 年']); } else if(L.age!=null) why.push([-1,'屋齡 '+L.age+' 年']);
    if(!q.park||L.pk){ s+=5; if(q.park&&L.pk) why.push([1,'有車位']); } else why.push([-1,'沒有車位']);
    return {s:s,why:why};
  }

  function card(L,sc,pickable){
    return '<article class="rt-card'+(picked[L.s]?' on':'')+'">'+
      '<a class="ph" href="../listings/'+esc(L.s)+'/" target="_blank" rel="noopener"><img src="../'+esc(L.img)+'" alt="'+esc(L.t)+'" loading="lazy"></a>'+
      '<div class="bd">'+
        (sc?'<span class="rt-score s'+(sc.s>=85?3:sc.s>=60?2:1)+'">符合 '+sc.s+'%</span>':'')+
        '<h3><a href="../listings/'+esc(L.s)+'/" target="_blank" rel="noopener">'+esc(L.t)+'</a></h3>'+
        '<div class="price">'+RT.comma(L.p)+'<small> 萬</small></div>'+
        '<div class="meta">'+esc([L.area+L.road,L.lay,L.at?L.at+' 坪':'',L.age!=null?'屋齡 '+L.age+' 年':'',L.fl,L.pk].filter(Boolean).join('・'))+'</div>'+
        (L.mo?'<div class="meta">'+esc(L.mo)+'</div>':'')+
        (sc&&sc.why.length?'<ul class="rt-why">'+sc.why.map(function(w){return '<li class="'+(w[0]>0?'yes':w[0]<0?'no':'ask')+'">'+esc(w[1])+'</li>'}).join('')+'</ul>':'')+
        (L.ft&&L.ft.length&&!sc?'<ul class="rt-why">'+L.ft.map(function(f){return '<li class="yes">'+esc(f)+'</li>'}).join('')+'</ul>':'')+
        (pickable?'<label class="rt-pick"><input type="checkbox" data-pick="'+esc(L.s)+'"'+(picked[L.s]?' checked':'')+'> 挑進報告</label>':'')+
      '</div></article>';
  }

  function run(){
    var q=need();
    var list=ALL.map(function(L){return {L:L,sc:score(L,q)}}).sort(function(a,b){return b.sc.s-a.sc.s||a.L.p-b.L.p});
    var good=list.filter(function(x){return x.sc.s>=85}).length;
    $('mCount').textContent='網站上 '+ALL.length+' 間物件，完全符合 '+good+' 間，已依符合度排序。';
    $('mList').innerHTML=list.map(function(x){return card(x.L,x.sc,true)}).join('')||'<p>目前沒有上架物件。</p>';
    updatePickBar();
  }
  function updatePickBar(){
    var n=Object.keys(picked).filter(function(k){return picked[k]}).length;
    $('mPickN').textContent=n;
    $('mMake').disabled=!n;
  }

  function reportHash(){
    var q=need();
    return {n:q.n, lo:q.lo||'', hi:q.hi||'', a:q.areas.join(','), k:q.kinds.join(','), rm:q.rm||'', age:q.age||'', pk:q.park?1:'', note:q.note,
            pick:Object.keys(picked).filter(function(k){return picked[k]}).join(','), d:RT.today()};
  }

  function report(h){
    var ids=(h.pick||'').split(',').filter(Boolean);
    var items=ids.map(function(s){return ALL.filter(function(L){return L.s===s})[0]}).filter(Boolean);
    var cond=[h.lo||h.hi?'預算 '+(h.lo||'')+'～'+(h.hi||'')+' 萬':'', h.a?h.a.replace(/,/g,'、'):'', h.k?h.k.replace(/,/g,'、'):'',
              h.rm?h.rm+' 房以上':'', h.age?'屋齡 '+h.age+' 年內':'', h.pk?'要車位':''].filter(Boolean);
    var gone=ids.length-items.length;
    $('mReport').innerHTML='<div class="rt-report">'+
      '<p class="rt-kicker">有巢氏房屋 中壢環中加盟店・林容瑜</p>'+
      '<h2>'+(h.n?esc(h.n)+' 的':'')+'專屬物件報告</h2>'+
      '<p class="rt-sub">整理日期 '+esc(h.d||'')+'・共 '+items.length+' 間'+(cond.length?'・條件：'+esc(cond.join('、')):'')+'</p>'+
      (h.note?'<div class="v-judge v-ok"><b>容瑜的話</b>'+esc(h.note)+'</div>':'')+
      (gone?'<p class="v-warn">報告裡有 '+gone+' 間物件已經成交或下架，所以沒有顯示。想看類似的，直接 LINE 我。</p>':'')+
      '<div class="rt-cards">'+items.map(function(L){return card(L,null,false)}).join('')+'</div>'+
      '<div class="rt-actions no-print">'+
        '<button type="button" class="btn" id="mCopy">複製報告連結</button>'+
        '<button type="button" class="btn btn-ghost" onclick="window.print()">列印／存成 PDF</button>'+
        '<a class="btn btn-line" href="'+RT.LINE_URL+'" target="_blank" rel="noopener" data-rt-line="'+esc('容瑜你好，我看了你整理的物件報告，想約時間帶看：'+items.map(function(L){return L.t}).join('、'))+'" data-toast="mToast2">LINE 約帶看</a>'+
        '<a class="btn btn-ghost" href="./">重新配案</a></div>'+
      '<p class="toast" id="mToast2" role="status"></p>'+
      '<p class="v-disclaimer">物件資訊以現場與產權資料為準；價格可能已調整，帶看前容瑜會再跟你確認最新狀況。聯絡電話 0973-263-569。</p></div>';
    $('mTool').hidden=true; $('mReport').hidden=false; document.body.classList.add('rt-reporting');
    var c=$('mCopy'); if(c) c.addEventListener('click',function(){ RT.copy(location.href,$('mToast2'),'已複製報告連結，可以直接貼給客戶。'); });
  }

  function loadHashIntoForm(h){
    $('mName').value=h.n||''; $('mLo').value=h.lo||''; $('mHi').value=h.hi||''; $('mRooms').value=h.rm||''; $('mAge').value=h.age||'';
    $('mPark').checked=!!h.pk; $('mNote').value=h.note||'';
    (h.pick||'').split(',').filter(Boolean).forEach(function(s){picked[s]=true});
  }

  fetch('listings.json'+(ver?'?v='+ver:'')).then(function(r){return r.json()}).then(function(d){
    ALL=d;
    var h=RT.hashGet();
    var areas=[], kinds=[];
    ALL.forEach(function(L){ if(L.area&&areas.indexOf(L.area)<0) areas.push(L.area); if(L.k&&kinds.indexOf(L.k)<0) kinds.push(L.k); });
    chips($('mAreas'),areas,(h.a||'').split(','));
    chips($('mKinds'),kinds,(h.k||'').split(','));
    if(h.pick&&h.view==='report'){ loadHashIntoForm(h); report(h); return; }
    if(h.pick||h.n) loadHashIntoForm(h);
    run();
  }).catch(function(){ $('mList').innerHTML='<p class="v-warn">物件資料載入失敗，請重新整理頁面。</p>'; });

  document.addEventListener('click',function(e){
    var b=e.target.closest('.rt-chipset button'); if(!b) return;
    b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')==='true'?'false':'true'); run();
  });
  $('mForm').addEventListener('input',function(e){ if(!e.target.closest('#mNote')&&!e.target.closest('#mName')) run(); });
  $('mForm').addEventListener('submit',function(e){ e.preventDefault(); run(); $('mList').scrollIntoView({behavior:'smooth'}); });
  $('mList').addEventListener('change',function(e){
    var c=e.target.closest('[data-pick]'); if(!c) return;
    picked[c.getAttribute('data-pick')]=c.checked; c.closest('.rt-card').classList.toggle('on',c.checked); updatePickBar();
  });
  $('mMake').addEventListener('click',function(){
    var h=reportHash(); h.view='report';
    history.pushState(null,'',RT.hashUrl(h)); report(RT.hashGet()); window.scrollTo(0,0);
  });
  window.addEventListener('popstate',function(){ var h=RT.hashGet(); if(h.view==='report') report(h); else { $('mReport').hidden=true; $('mTool').hidden=false; document.body.classList.remove('rt-reporting'); } });
})();
