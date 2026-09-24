/* 新工具共用：格式化、房貸公式、實價登錄資料、LINE 複製、分享網址（window.RT） */
(function(){
  var LINE_URL='https://line.me/ti/p/~0973263569';
  var RT={LINE_URL:LINE_URL};
  RT.$=function(id){return document.getElementById(id)};
  RT.esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  RT.num=function(v){ var n=parseFloat(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; };
  RT.val=function(id){ var el=RT.$(id); return el?RT.num(el.value):0; };
  RT.comma=function(v,d){ return Number(v).toLocaleString('zh-TW',{maximumFractionDigits:d||0,minimumFractionDigits:d||0}); };
  RT.wan=function(v){ return v>=10000?(v/10000).toFixed(2)+' 億':RT.comma(Math.round(v))+' 萬'; };
  RT.yuan=function(v){ return RT.comma(Math.round(v))+' 元'; };
  RT.today=function(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); };
  RT.pct=function(v,d){ return (v>0?'+':'')+v.toFixed(d==null?1:d)+'%'; };
  RT.median=function(a){ if(!a.length) return null; var b=a.slice().sort(function(x,y){return x-y}), m=b.length>>1;
    return b.length%2?b[m]:(b[m-1]+b[m])/2; };
  RT.quantile=function(a,p){ var b=a.slice().sort(function(x,y){return x-y}); if(!b.length) return null;
    var i=(b.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i); return b[lo]+(b[hi]-b[lo])*(i-lo); };

  // 本利均攤月付：本金 P（元）、年利率 r（%）、期數 n（月）
  RT.pmt=function(P,r,n){ if(n<=0) return 0; var i=r/1200; return i?P*i/(1-Math.pow(1+i,-n)):P/n; };
  // 反推：每月可付 M、年利率 r、期數 n → 可貸本金
  RT.pv=function(M,r,n){ if(n<=0||M<=0) return 0; var i=r/1200; return i?M*(1-Math.pow(1+i,-n))/i:M*n; };

  // ---- 實價登錄資料（跟房屋估價共用 value/data） ----
  // 每筆：[路段序, 型態, 年, 季, 單價, 坪數, 樓層, 總樓層, 屋齡, 巷, 完工年, 車位價(萬), 車位坪, 車位未拆價]
  RT.KN={a:'住宅大樓',b:'華廈',c:'公寓',d:'透天厝'};
  var ver=(document.querySelector('script[data-v]')||{getAttribute:function(){return ''}}).getAttribute('data-v');
  var towns={}, meta=null;
  RT.dataRoot='../value/data/';
  RT.meta=function(){
    if(meta) return Promise.resolve(meta);
    return fetch(RT.dataRoot+'meta.json'+(ver?'?v='+ver:'')).then(function(r){return r.json()}).then(function(m){meta=m;return m});
  };
  RT.town=function(t){
    if(towns[t]) return Promise.resolve(towns[t]);
    return fetch(RT.dataRoot+encodeURIComponent(t)+'.json'+(ver?'?v='+ver:'')).then(function(r){return r.json()}).then(function(d){towns[t]=d;return d});
  };
  RT.roadIndex=function(d,text){
    text=(text||'').trim().replace(/^桃園市/,'').replace(/^.{2}區/,'');
    if(!text) return -1;
    var i=d.roads.indexOf(text); if(i>=0) return i;
    for(var k=0;k<d.roads.length;k++){ if(d.roads[k].indexOf(text)===0||text.indexOf(d.roads[k])===0) return k; }
    return -2;
  };
  RT.seasonLabel=function(y,q){ return y+' 年 Q'+q; };
  RT.seasonsAgo=function(m,y,q){ var last=m.seasons[m.seasons.length-1]; return (+last.slice(0,3)-y)*4+(+last.slice(4)-q); };
  RT.fillTowns=function(sel,m,keep){
    sel.innerHTML='<option value="">選擇行政區</option>'+Object.keys(m.towns).map(function(t){
      return '<option'+(t===keep?' selected':'')+'>'+RT.esc(t)+'</option>'}).join('');
  };

  // ---- LINE：先複製訊息再開 LINE（個人帳號連結沒辦法預填文字） ----
  RT.line=function(msg,toast){
    var open=function(ok){ if(toast) toast.textContent=ok?'已複製內容，LINE 開啟後貼上送出就好。':'LINE 開啟後，把想問的事傳給我就好。';
      window.open(LINE_URL,'_blank','noopener'); };
    if(navigator.clipboard&&window.isSecureContext) navigator.clipboard.writeText(msg).then(function(){open(true)},function(){open(false)});
    else open(false);
  };
  RT.copy=function(text,toast,done){
    var ok=function(){ if(toast) toast.textContent=done||'已複製。'; };
    if(navigator.clipboard&&window.isSecureContext) navigator.clipboard.writeText(text).then(ok,function(){ if(toast) toast.textContent='複製失敗，請長按選取文字自己複製。'; });
    else { var t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select();
      try{document.execCommand('copy');ok()}catch(e){} t.remove(); }
  };
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-rt-line]'); if(!b) return;
    e.preventDefault(); RT.line(b.getAttribute('data-rt-line'),RT.$(b.getAttribute('data-toast')));
  });

  // ---- 分享網址：把表單值放在 # 後面（不會送到伺服器） ----
  RT.hashGet=function(){ var o={}; location.hash.replace(/^#/,'').split('&').forEach(function(kv){
    if(!kv) return; var p=kv.split('='); o[decodeURIComponent(p[0])]=decodeURIComponent(p.slice(1).join('=')||''); }); return o; };
  RT.hashUrl=function(o){ return location.href.split('#')[0]+'#'+Object.keys(o).filter(function(k){return o[k]!==''&&o[k]!=null})
    .map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(o[k])}).join('&'); };

  RT.store={
    get:function(k,d){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
    set:function(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
  };
  window.RT=RT;
})();
