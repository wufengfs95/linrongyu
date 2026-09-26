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

  // 買方需求配對表單
  var bform=document.getElementById('buyerForm');
  if(bform){
    bform.addEventListener('submit',function(e){
      e.preventDefault();
      var pick=function(n){var el=bform.querySelector('input[name='+n+']:checked');return el?el.value:''};
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
    tbtns.forEach(function(b){
      b.addEventListener('click',function(){
        var tag=b.getAttribute('data-tag')||'';
        tbtns.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
        var n=0;
        tgrid.querySelectorAll('.v2-tool').forEach(function(c){
          var ok=!tag||(c.getAttribute('data-tags')||'').split(' ').indexOf(tag)>=0;
          c.hidden=!ok; if(ok) n++;
        });
        if(tcount) tcount.textContent='共 '+n+' 個工具';
      });
    });
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
  }
})();
