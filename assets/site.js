(function(){
  var LINE_URL='https://line.me/ti/p/~0973263569';

  // 先把訊息複製起來，再開 LINE（個人 LINE 無法預填訊息，只能請客人貼上）
  function copyThenOpenLine(msg,toast){
    var done=function(ok){
      if(toast) toast.textContent=ok?'已複製訊息，LINE 開啟後加好友、貼上送出就好。':'請手動複製：'+msg.replace(/\n/g,' ');
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

  // 物件頁「LINE 預約帶看」
  document.querySelectorAll('[data-line-msg]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.preventDefault();
      copyThenOpenLine(btn.getAttribute('data-line-msg'),document.getElementById(btn.getAttribute('data-toast')));
    });
  });

  // 物件頁相簿
  var main=document.getElementById('galleryMain');
  if(main){
    document.querySelectorAll('.thumbs button').forEach(function(b){
      b.addEventListener('click',function(){
        main.src=b.getAttribute('data-src');
        main.classList.toggle('contain',b.getAttribute('data-fit')==='contain');
        var link=document.getElementById('galleryLink'); if(link) link.href=main.getAttribute('src');
        main.alt=b.querySelector('img').alt;
        document.querySelectorAll('.thumbs button').forEach(function(x){x.setAttribute('aria-current',x===b?'true':'false')});
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
