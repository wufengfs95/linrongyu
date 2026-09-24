/* 物件追蹤：貼物件網址＋開價存進追蹤清單（這個瀏覽器的 localStorage），之後更新價格會記下歷史，算出累計降幅。
   網頁沒辦法自己去讀 591、信義、永慶的頁面（對方網站擋跨站讀取），所以價格要自己更新，或 LINE 請容瑜幫忙盯。 */
(function(){
  var RT=window.RT, $=RT.$, esc=RT.esc, KEY='rt-track';
  var SITES=[[/591\.com\.tw/,'591'],[/sinyi\.com\.tw/,'信義'],[/yungching\.com\.tw/,'永慶'],[/hbhousing\.com\.tw/,'住商'],
             [/etwarm\.com\.tw/,'東森'],[/u-trust\.com\.tw/,'有巢氏'],[/twhg\.com\.tw/,'台灣房屋'],[/rakuya\.com\.tw/,'樂屋'],
             [/housefun\.com\.tw/,'好房網'],[/wufengfs95\.github\.io/,'容瑜']];
  var today=RT.today;
  function site(u){ for(var i=0;i<SITES.length;i++) if(SITES[i][0].test(u)) return SITES[i][1]; try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return '其他'} }
  function load(){ return RT.store.get(KEY,[]); }
  function save(list){ if(!RT.store.set(KEY,list)) $('tToast').textContent='這個瀏覽器不能存資料（可能是無痕模式），關掉就會不見。'; }

  function render(){
    var list=load();
    var down=list.filter(function(x){return x.h[x.h.length-1].p<x.h[0].p}).length;
    $('tSum').innerHTML=list.length?'追蹤 <b>'+list.length+'</b> 間・降價 <b>'+down+'</b> 間・'+list.filter(function(x){return x.st}).length+' 間已下架／成交':'';
    if(!list.length){ $('tList').innerHTML='<div class="v-empty"><b>還沒有追蹤的物件</b><p>在左邊貼上物件網址和開價，就會出現在這裡。<br>之後看到降價，按「更新價格」記下來，就會算出累計降了多少。</p></div>'; $('tAsk').hidden=true; return; }
    $('tAsk').hidden=false;
    $('tList').innerHTML=list.map(function(x,i){
      var first=x.h[0].p, now=x.h[x.h.length-1].p, ch=first?(now/first-1)*100:0;
      return '<article class="rt-track'+(x.st?' off':'')+'">'+
        '<div class="rt-thead"><span class="rt-src">'+esc(site(x.u))+'</span>'+(x.st?'<span class="rt-badge gray">'+esc(x.st)+'</span>':'')+
          '<h3><a href="'+esc(x.u)+'" target="_blank" rel="noopener noreferrer">'+esc(x.t||x.u)+'</a></h3></div>'+
        '<div class="rt-tprice"><b>'+RT.comma(now)+' 萬</b>'+(x.h.length>1?'<span class="'+(ch<0?'down':ch>0?'up':'')+'">'+(ch?RT.pct(ch):'持平')+'（'+(now-first>0?'+':'')+RT.comma(now-first)+' 萬）</span>':'')+
          (x.a?'<small>單價 '+(now/x.a).toFixed(1)+' 萬/坪</small>':'')+'</div>'+
        '<ol class="rt-hist">'+x.h.map(function(h){return '<li><span>'+esc(h.d)+'</span>'+RT.comma(h.p)+' 萬</li>'}).join('')+'</ol>'+
        (x.n?'<p class="v-note">'+esc(x.n)+'</p>':'')+
        '<form class="rt-upd" data-i="'+i+'"><input type="number" inputmode="numeric" placeholder="新開價（萬）" aria-label="新開價（萬）">'+
          '<button type="submit" class="btn btn-ghost">更新價格</button>'+
          '<select aria-label="狀態" data-st="'+i+'"><option value="">追蹤中</option><option'+(x.st==='已下架'?' selected':'')+'>已下架</option><option'+(x.st==='已成交'?' selected':'')+'>已成交</option></select>'+
          '<button type="button" class="rt-x" data-del="'+i+'" aria-label="刪除">×</button></form>'+
      '</article>';
    }).join('');
    var msg='容瑜你好，我在追蹤這幾間物件，有降價或成交再麻煩通知我：\n'+list.filter(function(x){return !x.st}).map(function(x){return '・'+(x.t||'')+' '+x.h[x.h.length-1].p+' 萬 '+x.u}).join('\n');
    $('tAsk').setAttribute('data-rt-line',msg);
  }

  $('tForm').addEventListener('submit',function(e){
    e.preventDefault();
    var u=$('tUrl').value.trim(), p=RT.val('tPrice');
    if(!/^https?:\/\//.test(u)){ $('tToast').textContent='請貼上完整網址（https:// 開頭）。'; return; }
    if(!p){ $('tToast').textContent='請填目前開價（萬）。'; return; }
    var list=load();
    if(list.some(function(x){return x.u===u})){ $('tToast').textContent='這間已經在追蹤清單裡了。'; return; }
    list.unshift({u:u,t:$('tTitle').value.trim(),a:RT.val('tArea'),n:$('tNote').value.trim(),h:[{d:today(),p:p}],st:''});
    save(list); this.reset(); $('tToast').textContent='已加入追蹤。'; render();
    history.replaceState(null,'',location.pathname);
  });
  $('tList').addEventListener('submit',function(e){
    var f=e.target.closest('.rt-upd'); if(!f) return; e.preventDefault();
    var p=RT.num(f.querySelector('input').value); if(!p) return;
    var list=load(), x=list[+f.getAttribute('data-i')];
    if(x.h.length>1&&x.h[x.h.length-1].d===today()) x.h[x.h.length-1].p=p; else x.h.push({d:today(),p:p});   // 第一筆是原始開價，永遠保留
    save(list); render();
  });
  $('tList').addEventListener('change',function(e){
    var s=e.target.closest('[data-st]'); if(!s) return;
    var list=load(); list[+s.getAttribute('data-st')].st=s.value; save(list); render();
  });
  $('tList').addEventListener('click',function(e){
    var d=e.target.closest('[data-del]'); if(!d) return;
    if(!confirm('確定不追蹤這間了？')) return;
    var list=load(); list.splice(+d.getAttribute('data-del'),1); save(list); render();
  });
  // 備份：換手機或清瀏覽器前，複製備份碼；在新裝置貼上還原
  $('tExport').addEventListener('click',function(){ RT.copy(JSON.stringify(load()),$('tToast'),'已複製備份碼，存在 LINE 記事本或備忘錄，換手機時貼回來。'); });
  $('tImport').addEventListener('click',function(){
    var s=prompt('貼上備份碼'); if(!s) return;
    try{ var add=JSON.parse(s), list=load(), have={}; list.forEach(function(x){have[x.u]=1});
      add.forEach(function(x){ if(x&&/^https?:\/\//.test(x.u)&&x.h&&x.h.length&&!have[x.u]) list.push(x); }); save(list); render(); $('tToast').textContent='已還原。';
    }catch(err){ $('tToast').textContent='備份碼格式不對。'; }
  });

  // 從書籤一鍵加入：…/track/#url=<網址>&t=<標題>
  var h=RT.hashGet(); if(h.url){ $('tUrl').value=h.url; $('tTitle').value=(h.t||'').slice(0,60); $('tPrice').focus(); }
  var bm="javascript:location.href='"+location.href.split('#')[0]+"#url='+encodeURIComponent(location.href)+'&t='+encodeURIComponent(document.title)";
  $('tBookmark').setAttribute('href',bm);
  render();
})();
