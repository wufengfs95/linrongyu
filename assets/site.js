(function(){
  var LINE_URL='https://line.me/ti/p/~0973263569';

  // 先把訊息複製起來，再開 LINE（個人 LINE 無法預填訊息，只能請客人貼上）
  function copyThenOpenLine(msg,toast){
    var done=function(ok){
      if(toast) toast.textContent=ok?'':'請手動複製：'+msg.replace(/\n/g,' ');
      window.open(LINE_URL,'_blank','noopener');
    };
    try{navigator.clipboard.writeText(msg).then(function(){done(true)},function(){done(false)})}
    catch(err){done(false)}
  }

  // 首頁預約表單
  var form=document.getElementById('bookForm');
  if(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var val=function(id){return document.getElementById(id).value.trim()};
      var need=(form.querySelector('input[name=need]:checked')||{}).value||'';
      var msg='容瑜你好，我想預約諮詢：\n'+
        '・需求：'+need+'\n'+
        '・稱呼：'+(val('bk-name')||'（未填）')+'\n'+
        '・區域：'+val('bk-area')+'\n'+
        '・希望日期：'+(val('bk-date')||'都可以')+'\n'+
        '・聯絡時段：'+val('bk-time')+
        (val('bk-note')?'\n・備註：'+val('bk-note'):'');
      copyThenOpenLine(msg,document.getElementById('bk-toast'));
    });
  }

  // 買賣流程頁：切換買方／賣方
  var prBtns=[].slice.call(document.querySelectorAll('.pr-tabs button'));
  if(prBtns.length){
    prBtns.forEach(function(b){
      b.addEventListener('click',function(){
        var key=b.getAttribute('data-pr');
        prBtns.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
        document.querySelectorAll('.pr-pane').forEach(function(p){
          p.hidden = p.getAttribute('data-pane')!==key;
        });
      });
    });
  }

  // 回到最上面
  var toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', '回到最上面');
  toTop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M12 19V6"/><path d="M5.5 12.5 12 6l6.5 6.5"/></svg>';
  document.body.appendChild(toTop);
  var toTopSync = function () {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y > 400) { toTop.classList.add('show'); } else { toTop.classList.remove('show'); }
  };
  window.addEventListener('scroll', toTopSync, { passive: true });
  toTopSync();
  toTop.addEventListener('click', function () {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  });

  // 頁尾版權年份：起始 2026，之後每年自動變成 2026–今年
  var fy = document.getElementById('footYear');
  if (fy) {
    var startYear = 2026;
    var nowYear = new Date().getFullYear();
    fy.textContent = nowYear > startYear ? startYear + '–' + nowYear : String(startYear);
  }

  // 微信：QR 彈窗 + 複製微信號
  var wxM = document.getElementById('wxModal');
  if (wxM) {
    var wxOpen = function (e) { if (e) e.preventDefault(); wxM.hidden = false; document.body.style.overflow = 'hidden'; };
    var wxShut = function () { wxM.hidden = true; document.body.style.overflow = ''; };
    [].slice.call(document.querySelectorAll('[data-wx]')).forEach(function (a) {
      a.addEventListener('click', wxOpen);
    });
    wxM.addEventListener('click', function (e) { if (e.target === wxM) wxShut(); });
    var wxX = wxM.querySelector('.wx-x');
    if (wxX) wxX.addEventListener('click', wxShut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wxM.hidden) wxShut(); });
    var wxC = wxM.querySelector('.wx-copy'), wxI = document.getElementById('wxId');
    if (wxC && wxI) wxC.addEventListener('click', function () {
      var id = wxI.textContent.trim(), done = function () {
        var old = wxC.textContent; wxC.textContent = '已複製 ✓';
        setTimeout(function () { wxC.textContent = old; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id).then(done, function () { });
      } else {
        var ta = document.createElement('textarea');
        ta.value = id; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { }
        document.body.removeChild(ta);
      }
    });
  }

  // 買方需求配對表單
  var bform=document.getElementById('buyerForm');
  if(bform){
    bform.addEventListener('submit',function(e){
      e.preventDefault();
      var pick=function(n){   // 類型、區域是複選，其餘單選；都用同一個函式取值
        return [].slice.call(bform.querySelectorAll('input[name='+n+']:checked'))
          .map(function(el){return el.value}).join('、')||'不限';
      };
      var val=function(id){var el=document.getElementById(id);return el?el.value.trim():''};
      var msg='容瑜你好，我想找房子：\n'+
        '・類型：'+pick('bkind')+'\n'+
        '・區域：'+pick('barea')+'\n'+
        '・房數：'+pick('broom')+'\n'+
        '・總價：'+pick('bbudget')+'\n'+
        '・時程：'+pick('bwhen')+'\n'+
        '・稱呼：'+(val('by-name')||'（未填）')+'\n'+
        '・方便聯絡：'+val('by-contact')+
        (val('by-note')?'\n・其他條件：'+val('by-note'):'');
      copyThenOpenLine(msg,document.getElementById('by-toast'));
    });
  }

  // 物件頁「LINE 預約帶看」
  document.querySelectorAll('[data-line-msg]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.preventDefault();
      copyThenOpenLine(btn.getAttribute('data-line-msg'),document.getElementById(btn.getAttribute('data-toast')));
    });
  });

  // 物件頁相簿：縮圖、左右箭頭、鍵盤左右鍵、手機左右滑
  var main=document.getElementById('galleryMain');
  var thumbs=[].slice.call(document.querySelectorAll('.thumbs button'));
  if(main&&thumbs.length){
    var cur=0, link=document.getElementById('galleryLink'), idx=document.getElementById('galleryIndex');
    var cleanOn=false;
    var btn=document.getElementById('declutterBtn'), note=document.getElementById('declutterNote');
    var show=function(i){
      cur=(i+thumbs.length)%thumbs.length;
      var b=thumbs[cur];
      var clean=b.getAttribute('data-clean');
      main.src=(cleanOn&&clean)?clean:b.getAttribute('data-src');
      if(note){
        var miss=cleanOn&&!clean;
        note.hidden=!miss;
        if(miss) note.textContent='這張照片還沒有清空版本，顯示原圖';
      }
      main.alt=b.querySelector('img').alt;
      main.classList.toggle('contain',b.getAttribute('data-fit')==='contain');
      if(link) link.href=main.getAttribute('src');
      if(idx) idx.textContent=cur+1;
      thumbs.forEach(function(x,j){x.setAttribute('aria-current',j===cur?'true':'false')});
      var row=b.parentNode;
      row.scrollTo({left:b.offsetLeft-row.clientWidth/2+b.clientWidth/2,behavior:'smooth'});
    };
    thumbs.forEach(function(b,i){b.addEventListener('click',function(){show(i)})});
    if(btn){
      btn.addEventListener('click',function(){
        cleanOn=!cleanOn;
        btn.setAttribute('aria-pressed',cleanOn?'true':'false');
        btn.textContent=cleanOn?'關閉一鍵清空 ×':'一鍵清空';
        thumbs.forEach(function(x){
          var im=x.querySelector('img'), cs=x.getAttribute('data-clean-s');
          if(!im) return;
          if(!im.dataset.orig) im.dataset.orig=im.getAttribute('src');
          im.src=(cleanOn&&cs)?cs:im.dataset.orig;
        });
        show(cur);
      });
    }
    var prev=document.querySelector('.gal-nav.prev'), next=document.querySelector('.gal-nav.next');
    if(prev) prev.addEventListener('click',function(){show(cur-1)});
    if(next) next.addEventListener('click',function(){show(cur+1)});
    document.addEventListener('keydown',function(e){
      if(/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')) return;
      if(e.key==='ArrowLeft') show(cur-1);
      if(e.key==='ArrowRight') show(cur+1);
    });
    var box=main.closest('.gal-main'), x0=null;
    box.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
    box.addEventListener('touchend',function(e){
      if(x0===null) return;
      var dx=e.changedTouches[0].clientX-x0; x0=null;
      if(Math.abs(dx)>40) show(dx<0?cur+1:cur-1);
    });
  }

  // 分享：手機用系統分享，電腦複製網址
  document.querySelectorAll('[data-share-url]').forEach(function(b){
    var label=b.textContent;
    b.addEventListener('click',function(){
      var url=b.getAttribute('data-share-url');
      if(navigator.share){navigator.share({title:b.getAttribute('data-share-title')||document.title,url:url}).catch(function(){});return;}
      var done=function(){b.textContent='已複製網址';setTimeout(function(){b.textContent=label},2000)};
      try{navigator.clipboard.writeText(url).then(done,function(){b.textContent=url})}catch(err){b.textContent=url}
    });
  });

  // 改版首頁：工具依「買房、賣房、學區」篩選
  var tabs=[].slice.call(document.querySelectorAll('.v2-tabs button'));
  tabs.forEach(function(b){
    b.addEventListener('click',function(){
      var tag=b.getAttribute('data-tag');
      tabs.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
      document.querySelectorAll('.v2-tool').forEach(function(card){
        card.hidden=!!tag && (card.getAttribute('data-tags')||'').split(' ').indexOf(tag)<0;
      });
    });
  });

  // 免費工具頁：依分類篩選（版面比照物件列表）
  var tgrid=document.getElementById('toolGrid');
  if(tgrid){
    var tcount=document.getElementById('toolCount');
    var tbtns=[].slice.call(document.querySelectorAll('.tool-filter .fbtn'));
    var gtabs=[].slice.call(document.querySelectorAll('.tgtabs .tgt'));
    var secs=[].slice.call(tgrid.querySelectorAll('.tgroup'));
    var tag='', gnow=(secs[0]||{dataset:{}}).dataset.g||'';

    var apply=function(){
      var total=0;
      // 先決定每張卡在目前分類下顯不顯示，再算每個分頁剩幾個
      secs.forEach(function(sec){
        var n=0;
        sec.querySelectorAll('.v2-tool').forEach(function(c){
          var ok=!tag||(c.getAttribute('data-tags')||'').split(' ').indexOf(tag)>=0;
          c.hidden=!ok; if(ok) n++;
        });
        sec.dataset.n=n; total+=n;
      });
      // 分頁按鈕：沒工具的整顆收起來
      var avail=[];
      gtabs.forEach(function(b){
        var sec=secs.filter(function(s){return s.dataset.g===b.dataset.gt})[0];
        var n=sec?+sec.dataset.n:0;
        b.hidden=!n;
        var num=b.querySelector('.tgt-n'); if(num) num.textContent=n;
        if(n) avail.push(b.dataset.gt);
      });
      if(avail.indexOf(gnow)<0) gnow=avail[0]||'';
      gtabs.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.gt===gnow?'true':'false')});
      secs.forEach(function(sec){ sec.hidden = sec.dataset.g!==gnow || !+sec.dataset.n; });
      if(tcount) tcount.textContent=total?'共 '+total+' 個工具':'這個分類目前沒有工具';
    };

    tbtns.forEach(function(b){
      b.addEventListener('click',function(){
        tag=b.getAttribute('data-tag')||'';
        tbtns.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
        apply();
      });
    });
    gtabs.forEach(function(b){
      b.addEventListener('click',function(){ gnow=b.dataset.gt; apply(); });
    });
    apply();
  }

  // 物件列表篩選
  var grid=document.getElementById('listingGrid');
  if(grid){
    var state={area:'',type:'',price:''};
    var count=document.getElementById('listingCount');
    var inRange=function(price,range){
      if(!range) return true;
      var p=range.split('-');
      return price>=parseFloat(p[0]||0)&&(p[1]===''||price<parseFloat(p[1]));
    };
    var apply=function(){
      var n=0;
      grid.querySelectorAll('.card-l').forEach(function(c){
        var ok=(!state.area||c.dataset.area===state.area)&&(!state.type||c.dataset.type===state.type)&&inRange(parseFloat(c.dataset.price),state.price);
        c.hidden=!ok; if(ok) n++;
      });
      if(count) count.textContent=n?'共 '+n+' 間':'沒有符合的物件，換個條件看看，或直接加 LINE 問我。';
    };
    document.querySelectorAll('.fbtn').forEach(function(b){
      b.addEventListener('click',function(){
        var key=b.dataset.key;
        state[key]=b.dataset.val;
        document.querySelectorAll('.fbtn[data-key="'+key+'"]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
        apply();
      });
    });

    // 排序：沒有該項數值的（例如土地沒有建坪）一律排在最後，不管升冪降冪
    var cards=[].slice.call(grid.querySelectorAll('.card-l'));
    cards.forEach(function(c,i){ c.dataset.order=i; });
    var sortSel=document.getElementById('listingSort');
    if(sortSel){
      var num=function(c,k){ var v=parseFloat(c.dataset[k]); return isFinite(v)?v:0; };
      sortSel.addEventListener('change',function(){
        var v=sortSel.value, arr=cards.slice();
        if(v){
          var p=v.split('-'), key=p[0], dir=p[1]==='desc'?-1:1;
          arr.sort(function(a,b){
            if(key==='posted'){
              var pa=a.dataset.posted||'', pb=b.dataset.posted||'';
              return pa===pb ? num(a,'order')-num(b,'order') : (pa<pb?-1:1)*dir;
            }
            var va=num(a,key), vb=num(b,key);
            if(!va&&!vb) return num(a,'order')-num(b,'order');
            if(!va) return 1;            // 沒有數值的沉到最後
            if(!vb) return -1;
            return va===vb ? num(a,'order')-num(b,'order') : (va-vb)*dir;
          });
        } else {
          arr.sort(function(a,b){ return num(a,'order')-num(b,'order'); });
        }
        arr.forEach(function(c){ grid.appendChild(c); });
      });
    }
  }
})();
