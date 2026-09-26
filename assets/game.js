/* 房產遊戲室共用：每週排行榜、玩家暱稱、分享。每個遊戲頁在 tools.js 之後載入。
   BOARD 填 Apps Script 網址（000_Agent/tools/game-board/board.gs）就會用線上週排行；
   沒填就只記這個瀏覽器自己的本週最佳，暱稱欄也會藏起來。 */
(function(){
  var BOARD='';   // 部署 board.gs 後，把「網頁應用程式」網址貼在這裡（所有遊戲共用）
  var RT=window.RT, esc=RT.esc, GM={online:!!BOARD};
  var ME=RT.store.get('rt-game-me',null);
  if(!ME){ var old=RT.store.get('rt-spot',{});   // 找亮點最早自己存的代號，沿用才不會排行榜重複
    ME={id:old.id||Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4), name:old.name||''};
    RT.store.set('rt-game-me',ME); }
  GM.me=ME;
  GM.setName=function(n){ ME.name=String(n||'').trim().slice(0,12); RT.store.set('rt-game-me',ME); };

  // 本週（台灣時間，週一開始）：2026-W39，跟 board.gs 的 week_() 一樣
  GM.week=function(){
    var d=new Date(Date.now()+8*3600e3); d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
    var day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
    var y=d.getUTCFullYear(), w=Math.ceil(((d-Date.UTC(y,0,1))/864e5+1)/7);
    return y+'-W'+('0'+w).slice(-2);
  };
  GM.shuffle=function(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)), t=a[i]; a[i]=a[j]; a[j]=t; } return a; };

  // 這個瀏覽器的本週紀錄：{w, n 挑戰次數, best}
  GM.local=function(game,score,asc){
    var k='rt-game-'+game, r=RT.store.get(k,{}), wk=GM.week();
    if(r.w!==wk) r={w:wk,n:0,best:null};
    r.n++;
    var better=score!=null&&(r.best==null||(asc?score<r.best:score>r.best));
    if(better) r.best=score;
    RT.store.set(k,r); r.better=better; return r;
  };

  /* 送出成績並顯示排行榜
     o = {game, score（沒過關給 null）, asc（越小越好，如秒數）, fmt（成績怎麼顯示）, unit, rank, top（放結果的元素）} */
  GM.board=function(o){
    var mine=GM.local(o.game,o.score,o.asc), fmt=o.fmt||String, unit=o.unit||'';
    function local(){
      o.rank.innerHTML=(mine.best!=null?'你本週最佳 <b>'+esc(fmt(mine.best))+'</b>'+unit:'本週還沒有成績')+'・已挑戰 '+mine.n+' 次';
      o.top.innerHTML='';
    }
    if(!BOARD){ local(); return mine; }
    o.rank.textContent='排行榜讀取中…';
    fetch(BOARD,{method:'POST',body:JSON.stringify({g:o.game,w:GM.week(),id:ME.id,n:ME.name||'匿名玩家',s:o.score})})  // text/plain，不會觸發 CORS 預檢
      .then(function(r){return r.json()}).then(function(res){
        if(!res.ok) return local();
        var top=res.top||[];
        var line=top.length?'本週第一名 <b>'+esc(fmt(top[0].s))+'</b>'+unit:'本週還沒有人上榜';
        if(res.rank) line+='，你第 <b>'+res.rank+'</b> 名<small>（共 '+res.total+' 人）</small>';
        else line+='，快來搶第一！';
        o.rank.innerHTML=line;
        o.top.innerHTML=top.length?'<ol class="gm-top">'+top.map(function(r){
          return '<li'+(r.me?' class="me"':'')+'><span>'+esc(r.n)+'</span><b>'+esc(fmt(r.s))+'</b></li>'}).join('')+'</ol>':'';
      }).catch(local);
    return mine;
  };

  // 暱稱欄：<p class="gm-name" hidden><input data-gm-name></p>，有開線上排行榜才顯示
  document.querySelectorAll('[data-gm-name]').forEach(function(el){
    el.value=ME.name||'';
    el.addEventListener('change',function(){ GM.setName(el.value); });
    var row=el.closest('.gm-name'); if(row) row.hidden=!BOARD;
  });

  GM.share=function(text,toast){
    var url=location.href.split('#')[0]; text+='\n'+url;
    if(navigator.share) navigator.share({text:text}).catch(function(){});
    else RT.copy(text,toast,'已複製，貼到 LINE 揪朋友來比。');
  };
  window.GM=GM;
})();
