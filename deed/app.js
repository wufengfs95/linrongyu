/* 謄本估價：上傳建物謄本 PDF → 在瀏覽器裡判讀 → 用實價登錄找同社區／同路段成交 → 估價與建議開價
   謄本不會上傳到任何地方：PDF 用 pdf.js 在本機解析，行情資料跟「房屋估價」共用 ../value/data/ */
(function(){
  var LINE_URL='https://line.me/ti/p/~0973263569';
  var PING=3.305785;
  var meta=null, towns={}, parsed=null, last=null;
  var $=function(id){return document.getElementById(id)};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var KN={a:'住宅大樓',b:'華廈',c:'公寓',d:'透天厝'};
  var ver=(document.querySelector('script[data-v]')||{getAttribute:function(){return ''}}).getAttribute('data-v');
  var qs=function(p){return p?('?v='+p):''};
  var DATA='../value/data/';

  function money(v){ return v>=10000?(v/10000).toFixed(2)+' 億':Math.round(v).toLocaleString()+' 萬'; }
  function median(a){ if(!a.length) return null; var b=a.slice().sort(function(x,y){return x-y}); var m=b.length>>1;
    return b.length%2?b[m]:(b[m-1]+b[m])/2; }
  function quantile(a,p){ var b=a.slice().sort(function(x,y){return x-y}); var i=(b.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i);
    return b[lo]+(b[hi]-b[lo])*(i-lo); }
  function num(s){ return parseFloat(String(s||'').replace(/,/g,''))||0; }
  function nowRoc(){ var d=new Date(); return {y:d.getFullYear()-1911, m:d.getMonth()+1, d:d.getDate()}; }
  function yearsSince(y,m,d){ var n=nowRoc(); return (n.y-y)+((n.m-m)+((n.d-(d||1))/31))/12; }

  // ---------- 謄本文字 → 欄位 ----------
  var CN={'零':0,'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
  function cnNum(s){
    s=String(s||'').trim();
    if(/^\d+$/.test(s)) return parseInt(s,10);
    if(!s) return 0;
    var n=0, t=s.indexOf('十');
    if(t<0) return CN[s]!=null?CN[s]:0;
    n=(t===0?1:(CN[s.charAt(t-1)]||0))*10;
    if(t<s.length-1) n+=CN[s.charAt(t+1)]||0;
    return n;
  }
  function section(txt,start,ends){
    var i=txt.search(start); if(i<0) return '';
    var rest=txt.slice(i), j=-1;
    ends.forEach(function(e){ var k=rest.slice(1).search(e); if(k>=0 && (j<0||k+1<j)) j=k+1; });
    return j>0?rest.slice(0,j):rest;
  }
  function roadParts(addr){
    var a=String(addr||'').replace(/^桃園市/,'').replace(/^[^\s]{2}區/,'').replace(/^[^\s]{1,4}里/,'').replace(/^\d+鄰/,'');
    var m=a.match(/^(.{1,10}?(?:路|街|大道)(?:[一二三四五六七八九十]段)?)/);
    var road=m?m[1]:'', lane=0;
    var l=a.match(/(?:路|街|大道|段)(\d+)巷/); if(l) lane=parseInt(l[1],10);
    return {road:road, lane:lane};
  }
  function addrKey(a){  // 比對「屋主戶籍地址」跟「門牌」是不是同一戶用：門牌號＋樓層（六樓、6樓都換成 6）
    a=String(a||'').normalize('NFKC').replace(/\s/g,'').replace(/^桃園市/,'').replace(/^[^\s]{2}區/,'').replace(/^[^\s]{1,4}里/,'')
      .replace(/^\d+鄰/,'').replace(/-/g,'之');
    var m=a.match(/^(.*?號)(?:([\d一二三四五六七八九十]+)樓)?(之\d+)?/);
    return m?m[1]+'|'+(m[2]?cnNum(m[2]):'')+(m[3]||''):a;
  }

  function parseDeed(raw){
    var t=raw.normalize('NFKC').replace(/　/g,' ').replace(/[ \t]+/g,' ');
    var d={raw:t, warn:[]};
    var m;
    m=t.match(/桃園市\s*([^\s\d]{2}區)/); d.town=m?m[1]:'';
    m=t.match(/建物門牌\s*:\s*([^\s]+)/); d.addr=m?m[1]:'';
    if(!d.town){ m=d.addr.match(/([^\s\d]{2}區)/); if(m) d.town=m[1]; }
    var rp=roadParts(d.addr); d.road=rp.road; d.lane=rp.lane;
    m=t.match(/主要用途\s*:\s*([^\s]+)/); d.use=m?m[1]:'';
    m=t.match(/主要建材\s*:\s*([^\s]+)/); d.material=m?m[1]:'';
    m=t.match(/層數\s*:\s*0*(\d+|[一二三四五六七八九十]+)\s*層/); d.tops=m?cnNum(m[1]):0;
    var floors=[], re=/層次\s*:\s*([^\s:]+?)層/g;
    while((m=re.exec(t))){ var f=m[1]; if(/地下/.test(f)) continue; f=f.replace(/^第/,''); var n=cnNum(f); if(n && floors.indexOf(n)<0) floors.push(n); }
    d.floors=floors; d.floor=floors.length?floors[0]:0;
    m=t.match(/建築完成日期\s*:\s*民國\s*(\d+)\s*年\s*(\d+)\s*月/); d.builtY=m?+m[1]:0; d.builtM=m?+m[2]:0;
    d.age=d.builtY?Math.floor(yearsSince(d.builtY,d.builtM,1)):null;

    // 面積：主建物＋附屬＋共有（共有裡的車位另外拆出來）
    var head=section(t,/建物標示部|建物門牌/,[/共有部分/,/所有權部/]);
    m=head.match(/總面積\s*:\s*([\d,.]+)\s*平方公尺/); d.main=m?num(m[1]):0;
    var att=section(t,/附屬建物/,[/共有部分/,/所有權部/]), attSum=0;
    re=/面積\s*:\s*([\d,.]+)\s*平方公尺/g; while((m=re.exec(att))) attSum+=num(m[1]);
    d.attach=attSum;
    var common=section(t,/共有部分/,[/所有權部/]), cur=0, pendingPark=false, com=0, park=0;
    re=/總面積\s*:\s*([\d,.]+)\s*平方公尺|權利範圍\s*:\s*(\d+)\s*分之\s*(\d+)|含停車位/g;
    while((m=re.exec(common))){
      if(m[1]) cur=num(m[1]);
      else if(m[2]){ var s=cur*(+m[3])/(+m[2]); if(pendingPark){ park+=s; pendingPark=false; } else com+=s; }
      else pendingPark=true;
    }
    d.common=Math.max(0,com-park); d.parkArea=park;
    d.hasPark=park>0 || /含停車位/.test(common);
    m=t.match(/所有面積\s*:\s*([\d,.]+)\s*平方公尺/);
    d.total=m?num(m[1]):(d.main+d.attach+com);
    if(!d.main && d.total) d.warn.push('主建物面積讀不到，公設比無法計算。');
    d.mainP=d.main/PING; d.attachP=d.attach/PING; d.commonP=d.common/PING; d.parkP=park/PING; d.totalP=d.total/PING;
    d.houseP=d.totalP-d.parkP;
    d.pubRatio=d.totalP?(d.commonP/(d.totalP-d.parkP))*100:0;

    // 所有權部
    var own=section(t,/所有權部/,[/他項權利部/,/本查詢資料|列印時間|本謄本/]);
    d.ownerCount=0; m=own.match(/共\s*(\d+)\s*位所有權人/); if(m) d.ownerCount=+m[1];
    d.owners=[];
    own.split(/登記次序\s*:/).slice(1).forEach(function(b){
      var o={}, x;
      x=b.match(/登記日期\s*:\s*民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/); if(x){ o.regY=+x[1]; o.regM=+x[2]; o.regD=+x[3]; }
      x=b.match(/登記原因\s*:\s*([^\s]+)/); o.reason=x?x[1]:'';
      x=b.match(/原因發生日期\s*:\s*民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/); if(x){ o.y=+x[1]; o.m=+x[2]; o.d=+x[3]; }
      else if(o.regY){ o.y=o.regY; o.m=o.regM; o.d=o.regD; }
      x=b.match(/所有權人\s*:\s*([^\s]+)/); o.name=x?x[1]:'';
      x=b.match(/\(\s*(桃園市[^)]+?|[^\s)]+?[市縣][^)]+?)\s*\)/)||b.match(/(?:住址|地址)\s*:\s*([^\s(]+)/); o.addr=x?x[1].replace(/\s/g,''):'';
      x=b.match(/權利範圍\s*:\s*(?:全部\s*)?(\d+)\s*分之\s*(\d+)/); o.share=x?(+x[2])+'/'+(+x[1]):'';
      if(o.name) d.owners.push(o);
    });
    if(!d.ownerCount) d.ownerCount=d.owners.length;

    // 他項權利部
    var oth=section(t,/他項權利部/,[/本查詢資料|列印時間|本謄本|\*\s*本案/]);
    d.liens=[];
    oth.split(/登記次序\s*:/).slice(1).forEach(function(b){
      var l={}, x;
      x=b.match(/權利種類\s*:\s*([^\s]+)/); l.kind=x?x[1]:'';
      x=b.match(/權利人\s*:\s*([^\s]+)/); l.who=x?x[1]:'';
      x=b.match(/登記日期\s*:\s*民國\s*(\d+)\s*年\s*(\d+)\s*月/); if(x){ l.y=+x[1]; l.m=+x[2]; }
      x=b.match(/(?:擔保債權總金額|債權額)\s*:\s*新(?:台|臺)幣\s*([\d,]+)\s*元/); l.amt=x?num(x[1])/10000:0;
      l.bank=/銀行|農會|漁會|信用合作社|保險|人壽|郵政|中華郵政|合作社|資產管理|租賃/.test(l.who);
      if(l.kind||l.who) d.liens.push(l);
    });
    d.flags=[];
    ['查封','假扣押','假處分','預告登記','禁止處分','破產','拍賣','限制登記'].forEach(function(k){ if(t.indexOf(k)>=0) d.flags.push(k); });

    // 房屋型態
    if(d.tops>=11) d.kind='a';
    else if(d.tops>=6) d.kind='b';
    else if(d.floors.length>1 || (d.tops && d.tops<=5 && /住家|住宅/.test(d.use) && !/集合/.test(d.use) && d.floors.length>=d.tops)) d.kind='d';
    else d.kind='c';
    d.ok=!!(d.addr && d.totalP);
    return d;
  }

  // ---------- PDF → 文字（依 y 座標組成一行一行）----------
  function pdfText(buf){
    var lib=window.pdfjsLib;
    if(!lib) return Promise.reject(new Error('PDF 模組載入失敗'));
    lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return lib.getDocument({data:buf, cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', cMapPacked:true}).promise.then(function(pdf){
      var jobs=[];
      for(var p=1;p<=pdf.numPages;p++) jobs.push(pdf.getPage(p).then(function(pg){ return pg.getTextContent(); }));
      return Promise.all(jobs);
    }).then(function(pages){
      return pages.map(function(tc){
        var rows=[];
        tc.items.forEach(function(it){
          if(!it.str) return;
          var y=Math.round(it.transform[5]), x=it.transform[4], row=null;
          for(var i=0;i<rows.length;i++) if(Math.abs(rows[i].y-y)<=2){ row=rows[i]; break; }
          if(!row){ row={y:y,items:[]}; rows.push(row); }
          row.items.push({x:x,s:it.str,w:it.width||0});
        });
        rows.sort(function(a,b){return b.y-a.y});
        return rows.map(function(r){
          r.items.sort(function(a,b){return a.x-b.x});
          var out='', end=null;
          var prev=null;
          r.items.forEach(function(it){
            // 粗體字有些 PDF 是同一個字疊印好幾次（位置只差一點點），重複的跳過
            if(prev && prev.s===it.s && Math.abs(prev.x-it.x)<1.5) return;
            out+=(end!=null && it.x-end>4?' ':'')+it.s; end=it.x+it.w; prev=it;
          });
          return out;
        }).join('\n');
      }).join('\n');
    });
  }

  // ---------- 行情比對 ----------
  var metaP=null;
  function loadMeta(){
    if(!metaP) metaP=fetch(DATA+'meta.json'+qs(ver)).then(function(r){return r.json()}).then(function(m){
      meta=m;
      var ts=Object.keys(m.towns).sort();
      $('dTown').innerHTML='<option value="">選擇行政區</option>'+ts.map(function(t){return '<option>'+t+'</option>'}).join('');
      $('dUpdated').textContent=m.updated;
      return m;
    }).catch(function(e){ metaP=null; throw e; });
    return metaP;
  }
  function loadTown(t){
    if(towns[t]) return Promise.resolve(towns[t]);
    return fetch(DATA+encodeURIComponent(t)+'.json'+qs(ver)).then(function(r){ if(!r.ok) throw new Error('no town'); return r.json(); })
      .then(function(d){ towns[t]=d; return d; });
  }
  function floorFactor(f,tf){
    if(!f) return 1;
    if(f===1) return 1.04;
    if(tf && f===tf) return .97;
    if(f===4) return .97;
    if(f===2) return .98;
    return 1;
  }
  function roadIdx(d,road){
    if(!road) return -1;
    var i=d.roads.indexOf(road); if(i>=0) return i;
    for(var k=0;k<d.roads.length;k++){ if(d.roads[k].indexOf(road)===0||road.indexOf(d.roads[k])===0) return k; }
    return -1;
  }

  var LEVELS=[
    {road:1,age:6,area:.3,seasons:6,label:'近 1.5 年・屋齡坪數相近'},
    {road:1,age:10,area:.45,seasons:10,label:'近 2.5 年'},
    {road:0,age:6,area:.3,seasons:6,label:'近 1.5 年・屋齡坪數相近'},
    {road:0,age:10,area:.45,seasons:10,label:'近 2.5 年'},
    {road:0,age:20,area:.7,seasons:12,label:'近 3 年・條件放寬'}
  ];

  function estimate(inp){
    var d=towns[inp.town], tm=meta.towns[inp.town], idx=tm.index;
    var lastS=meta.seasons[meta.seasons.length-1], ly=+lastS.slice(0,3), lq=+lastS.slice(4);
    var mine=floorFactor(inp.floor,inp.tops), ri=roadIdx(d,inp.road);
    var townPark=(tm.park||{})[inp.parkType]||0;
    function ago(r){ return (ly-r[2])*4+(lq-r[3]); }

    // ① 同社區：同路段＋同巷（沒有巷就同總樓層）＋完工年 ±1
    var same=[];
    if(ri>=0 && inp.builtY){
      same=d.rows.filter(function(r){
        if(r[0]!==ri || r[1]!==inp.kind || ago(r)>12) return false;
        if(!r[10] || Math.abs(r[10]-inp.builtY)>1) return false;
        if(inp.lane) return r[9]===inp.lane;
        return !r[9] && (!inp.tops || r[7]===inp.tops);
      });
    }
    var cps=same.filter(function(r){return r[11]>0 && r[12]>0});
    var parkPrice=inp.parkType?(cps.length?median(cps.map(function(r){return r[11]})):townPark):0;
    var parkSrc=inp.parkType?(cps.length?'同社區 '+cps.length+' 筆車位拆價'+(cps.length>1?'中位數':''):'行政區'+inp.parkType+'車位中位數'):'';
    var parkAreaRef=cps.length?median(cps.map(function(r){return r[12]})):(inp.parkP||11);
    var parkRef=cps.length?median(cps.map(function(r){return r[11]})):((tm.park||{})['平面']||townPark||0);

    function comp(r,note,noIndex){
      var u=r[4], a=r[5];
      if(r[13]){  // 車位沒拆價：總價、坪數都含車位，扣掉估計的車位價與車位坪
        var ha=a-parkAreaRef; if(ha<8) return null;
        u=(r[4]*a-parkRef)/ha; a=ha; note='車位未拆價，已扣估計車位 '+Math.round(parkRef)+' 萬';
      }
      // 同社區不套全區的季指數：全區中位數會受「那一季賣了哪些社區」影響，同社區直接比比較準
      var f=noIndex?1:(idx[r[2]+'S'+r[3]]||1);
      return {u:u*f*(mine/floorFactor(r[6],r[7])), raw:u, y:r[2], q:r[3], a:a, f:r[6], tf:r[7],
              age:r[8], road:r[0]>=0?d.roads[r[0]]:'', lane:r[9], pp:r[11], mx:r[13], note:note||''};
    }
    var res=null;
    var sc=same.map(function(r){return comp(r,'',true)}).filter(function(c){
      return c && Math.abs(c.a-inp.houseP)/inp.houseP<=.45;   // 排除同社區的套房、大坪數
    });
    if(sc.length>=3){
      var us=sc.map(function(c){return c.u});
      var mid=median(us);
      res={mid:mid, lo:Math.max(quantile(us,.25),mid*.92), hi:Math.min(quantile(us,.75),mid*1.08), comps:sc,
           scope:'同社區（'+inp.road+(inp.lane?inp.lane+'巷':'')+'・'+inp.builtY+' 年完工）', level:'同社區近 3 年',
           conf:sc.length>=8?'高':sc.length>=5?'中':'低', community:true};
    } else {
      for(var li=0;li<LEVELS.length;li++){
        var L=LEVELS[li], cs=[];
        d.rows.forEach(function(r){
          if(r[1]!==inp.kind || r[13]) return;
          if(L.road && (ri<0 || r[0]!==ri)) return;
          if(ago(r)>L.seasons) return;
          if(Math.abs(r[5]-inp.houseP)/inp.houseP>L.area) return;
          if(inp.age!=null && r[8]>=0 && Math.abs(r[8]-inp.age)>L.age) return;
          cs.push(comp(r));
        });
        if(cs.length>=(L.road?8:12) || (li===LEVELS.length-1 && cs.length>=5)){
          var u2=cs.map(function(c){return c.u}).sort(function(x,y){return x-y});
          if(u2.length>=12){ var cut=Math.floor(u2.length*.1); u2=u2.slice(cut,u2.length-cut); }
          var m2=median(u2);
          res={mid:m2, lo:Math.max(quantile(u2,.25),m2*.86), hi:Math.min(quantile(u2,.75),m2*1.14), comps:cs,
               scope:L.road?inp.road+'一帶':inp.town+'全區', level:L.label, conf:cs.length>=25?'高':cs.length>=12?'中':'低',
               community:false, sameN:sc.length};
          break;
        }
      }
    }
    if(!res) return null;
    res.comps.sort(function(a,b){return (b.y*4+b.q)-(a.y*4+a.q)});
    res.parkPrice=parkPrice; res.parkSrc=parkSrc;
    return res;
  }

  // 開價尾數：個位數用 8，剛好超過 1,000／1,500／2,000… 一點點就壓回門檻下
  function nice(v){
    if(v<300) return Math.round(v);
    var n=Math.round((v-8)/10)*10+8, step=v>=3000?1000:500, T=Math.floor(v/step)*step;
    if(T>0 && v>=T && v<=T*1.015) n=T-2;
    return n;
  }
  function round10(v){ return Math.round(v/10)*10; }

  // ---------- 畫面 ----------
  function status(msg,cls){ var s=$('dStatus'); s.className='v-status'+(cls?' '+cls:''); s.innerHTML=msg||''; }

  function showForm(d){
    $('dTown').value=d.town||'';
    $('dRoad').value=d.road||''; $('dLane').value=d.lane||'';
    $('dHouse').value=d.houseP?d.houseP.toFixed(2):''; $('dParkP').value=d.parkP?d.parkP.toFixed(2):'';
    $('dFloor').value=d.floor||''; $('dTops').value=d.tops||''; $('dBuilt').value=d.builtY||'';
    $('dPark').value=d.hasPark?'平面':'';
    setKind(d.kind||'a');
  }
  function setKind(k){
    document.querySelectorAll('#dKinds button').forEach(function(b){ b.setAttribute('aria-pressed',b.getAttribute('data-k')===k?'true':'false'); });
  }
  function getKind(){ var b=document.querySelector('#dKinds button[aria-pressed="true"]'); return b?b.getAttribute('data-k'):'a'; }

  function deedSummary(d){
    var rows=[];
    function add(k,v){ if(v!==''&&v!=null) rows.push('<tr><th>'+k+'</th><td>'+v+'</td></tr>'); }
    add('建物門牌',esc(d.addr));
    add('權狀總坪數',d.totalP.toFixed(2)+' 坪');
    add('主建物',d.mainP?d.mainP.toFixed(2)+' 坪':'—');
    add('附屬建物',d.attachP?d.attachP.toFixed(2)+' 坪（陽台等）':'無');
    add('公設（不含車位）',d.commonP?d.commonP.toFixed(2)+' 坪・公設比 '+d.pubRatio.toFixed(1)+'%':'—');
    add('車位',d.hasPark?(d.parkP?d.parkP.toFixed(2)+' 坪':'有'):'無');
    add('樓層',(d.floors.length>1?d.floors.join('、'):d.floor||'—')+' 樓 / 共 '+(d.tops||'—')+' 層');
    add('屋齡',d.builtY?d.age+' 年（民國 '+d.builtY+' 年 '+d.builtM+' 月完工）':'—');
    add('用途・建材',esc([d.use,d.material].filter(Boolean).join('・')));
    return '<table class="d-kv">'+rows.join('')+'</table>';
  }

  function ownerNotes(d){
    var out=[];
    var n=d.ownerCount||d.owners.length;
    if(n>1) out.push({c:'warn',t:'共 '+n+' 位所有權人（'+d.owners.map(function(o){return esc(o.name)+' '+o.share}).join('、')+'），簽委託、議價都要每一位同意。'});
    else if(n===1) out.push({c:'ok',t:'單一所有權人（'+esc(d.owners[0].name)+'），產權單純。'});
    var o=d.owners[0];
    if(o && o.y){
      var yrs=yearsSince(o.y,o.m,o.d), rate, word;
      var oldRule=(o.y<105) && /買賣|拍賣|交換/.test(o.reason);
      if(/繼承/.test(o.reason)) word='繼承取得：持有期間可以併計被繼承人的持有期間，房地合一稅率要看原本取得的時間。';
      else if(oldRule) word='民國 105 年前買的，適用舊制（只課財產交易所得、併入綜所稅），稅負通常比較輕。';
      else {
        rate=yrs<2?45:yrs<5?35:yrs<10?20:15;
        word='房地合一稅率約 '+rate+'%'+(yrs<2?'，這時候賣稅很重，屋主開價通常會偏高':yrs<5?'，稅負仍偏重，屋主會想把稅轉嫁到價格':'')+'；若本人自住滿 6 年，可用 10% 優惠稅率（400 萬免稅額）。';
      }
      out.push({c:yrs<2?'bad':yrs<5?'warn':'ok',t:'民國 '+o.y+' 年 '+o.m+' 月以「'+esc(o.reason)+'」取得，持有約 '+yrs.toFixed(1)+' 年。'+word});
    }
    if(o && o.addr){
      var same=addrKey(o.addr)&&addrKey(d.addr)&&addrKey(o.addr)===addrKey(d.addr);
      out.push({c:'info',t:same?'所有權人登記地址就是這一戶，可能自住，直接按門鈴有機會遇到本人。'
                         :'所有權人地址在「'+esc(o.addr)+'」，跟門牌不同，這戶可能出租或空屋，開發用寄信聯絡比較實際。'});
    }
    // 抵押
    var banks=d.liens.filter(function(l){return l.bank}), priv=d.liens.filter(function(l){return !l.bank && /抵押/.test(l.kind)});
    var sum=d.liens.reduce(function(s,l){return s+(l.amt||0)},0);
    if(priv.length) out.push({c:'bad',t:'有私人（非金融機構）抵押：'+priv.map(function(l){return esc(l.who)+' '+Math.round(l.amt)+' 萬'}).join('、')+'，可能是民間借貸、資金壓力大，議價空間可能比較大，但要先確認清償狀況。'});
    if(d.flags.length) out.push({c:'bad',t:'謄本出現「'+d.flags.join('、')+'」字樣，產權有限制，要先處理才能過戶。'});
    if(!d.liens.length) out.push({c:'ok',t:'沒有設定抵押，屋主沒有房貸壓力，議價可能比較硬。'});
    else out.push({c:'info',t:'抵押設定合計 '+Math.round(sum)+' 萬（'+d.liens.map(function(l){return l.who}).filter(function(w,i,a){return a.indexOf(w)===i}).map(esc).join('、')+'）。'});
    // 推估購入價
    d.buy=null;
    if(o && /買賣/.test(o.reason) && banks.length){
      var first=banks.filter(function(l){return l.y && Math.abs((l.y*12+l.m)-(o.y*12+o.m))<=3});
      if(first.length){
        var amt=first.reduce(function(s,l){return s+l.amt},0), loan=amt/1.2;
        d.buy={lo:loan/.8, hi:loan/.7, loan:loan, y:o.y};
        out.push({c:'info',t:'買入時銀行設定 '+Math.round(amt)+' 萬，推估當時貸款約 '+Math.round(loan)+' 萬、購入價約 <b>'+Math.round(d.buy.lo)+'～'+Math.round(d.buy.hi)+' 萬</b>（設定金額通常是貸款 1.2 倍、貸 7～8 成）。屋主心理價常以這個加上漲幅當底線。'});
      }
    }
    return out;
  }

  function render(d,inp,res){
    var cond=+$('dCond').value, view=+$('dView').value, nego=+$('dNego').value/100;
    var adj=(1+cond/100)*(1+view/100);
    var houseMid=res.mid*inp.houseP*adj, houseLo=res.lo*inp.houseP*adj, houseHi=res.hi*inp.houseP*adj;
    var pp=res.parkPrice||0;
    var mid=houseMid+pp, lo=houseLo+pp, hi=houseHi+pp;
    var std=nice(mid*(1+nego)), fast=nice(mid*(1+nego/2)), test=nice(hi*(1+nego));
    if(fast>=std) fast=nice(std*.97);
    if(test<=std) test=nice(std*1.03);
    var floorP=round10(Math.max(mid,lo));
    last={d:d,inp:inp,res:res,mid:mid,lo:lo,hi:hi,std:std,fast:fast,test:test,floor:floorP,nego:nego,cond:cond,view:view};

    var notes=ownerNotes(d);
    var sold=res.comps.slice(0,12);
    var tbl='<div class="v-table-wrap"><table class="v-table"><thead><tr><th>成交</th><th>位置</th><th>樓層</th><th>坪數</th><th>原始單價</th><th>校正後</th></tr></thead><tbody>'+
      sold.map(function(c){
        return '<tr'+(c.mx?' class="d-mx" title="'+esc(c.note)+'"':'')+'><td>'+c.y+' 年 Q'+c.q+'</td><td>'+esc(c.road+(c.lane?c.lane+'巷':''))+'</td><td>'+(c.f?c.f+(c.tf?'/'+c.tf:''):'—')+'</td><td>'+c.a.toFixed(1)+'</td><td>'+c.raw.toFixed(1)+(c.mx?'*':'')+'</td><td><b>'+c.u.toFixed(1)+'</b></td></tr>';
      }).join('')+'</tbody></table></div>';

    var pitch=pitchText();
    var html='<div class="v-out">'+
      '<div class="d-hero"><span>建議開價（標準方案）</span><b>'+money(std)+'</b>'+
      '<div class="d-hero-sub"><span>預估成交 <b>'+money(round10(mid))+'</b>（'+money(round10(lo))+'～'+money(round10(hi))+'）</span><span>建議底價 <b>'+money(floorP)+'</b></span></div></div>'+
      '<div class="v-meta"><span>比對 <b>'+res.comps.length+'</b> 筆成交</span><span>範圍：'+esc(res.scope)+'・'+esc(res.level)+'</span>'+
      '<span>可信度：<b class="v-conf v-conf-'+(res.conf==='高'?'hi':res.conf==='中'?'mid':'low')+'">'+res.conf+'</b></span></div>'+
      (!res.community && res.sameN?'<p class="v-warn">同社區只找到 '+res.sameN+' 筆成交，太少，改用'+esc(res.scope)+'的行情估。建議再查 591、樂屋網同社區成交補強。</p>':'')+
      (!res.community && !res.sameN?'<p class="v-warn">實價登錄裡找不到同社區的成交（可能是新社區、門牌對不到，或同社區成交都含特殊交易），改用'+esc(res.scope)+'的行情估，誤差會比較大。</p>':'')+

      '<h3 class="d-h3">開價方案</h3><div class="d-plans">'+
        plan('快速成交',fast,'屋主急售、有資金壓力，想 1～2 個月內賣掉')+
        plan('標準',std,'一般情況，保留 '+Math.round(nego*100)+'% 議價空間',true)+
        plan('試水溫',test,'屋主堅持高價、不急；先講好 3～4 週沒人看就調價')+
      '</div>'+

      '<h3 class="d-h3">估價怎麼算的</h3><ul class="d-calc">'+
        '<li>基準單價（不含車位，'+(res.community?'同社區直接比、已校正樓層':'已校正成交時間與樓層')+'）：<b>'+res.mid.toFixed(1)+' 萬/坪</b>（區間 '+res.lo.toFixed(1)+'～'+res.hi.toFixed(1)+'）</li>'+
        (cond||view?'<li>個別調整：屋況 '+(cond>0?'+':'')+cond+'%、景觀採光 '+(view>0?'+':'')+view+'%</li>':'<li>屋況、景觀先當「一般」，沒有加減</li>')+
        '<li>房屋 '+inp.houseP.toFixed(2)+' 坪 × '+(res.mid*adj).toFixed(1)+' 萬 ≈ '+money(round10(houseMid))+'</li>'+
        (pp?'<li>車位（'+esc(inp.parkType)+'）：'+Math.round(pp)+' 萬，依'+esc(res.parkSrc)+'</li>':'')+
        '<li>合計預估成交 ≈ <b>'+money(round10(mid))+'</b>；標準開價 = 預估成交 × '+(1+nego).toFixed(2)+'，尾數調成 8</li>'+
        (d.buy?'<li>對照推估購入價 '+Math.round(d.buy.lo)+'～'+Math.round(d.buy.hi)+' 萬（民國 '+d.buy.y+' 年），預估成交'+(mid>d.buy.hi?'高於':'接近或低於')+'購入價'+(mid>d.buy.hi?'，屋主有獲利，開價好談':'，屋主可能不甘心，要準備說服')+'</li>':'')+
      '</ul>'+

      '<h3 class="d-h3">謄本判讀</h3>'+deedSummary(d)+
      '<ul class="d-notes">'+notes.map(function(n){return '<li class="d-'+n.c+'">'+n.t+'</li>'}).join('')+'</ul>'+
      (d.warn.length?'<p class="v-warn">'+d.warn.map(esc).join('<br>')+'</p>':'')+

      '<details class="v-samples" open><summary>比對到的成交（最近 '+sold.length+' 筆，共 '+res.comps.length+' 筆）</summary>'+
        '<p class="v-note">單價是萬元／坪、不含車位；「校正後」是把'+(res.community?'樓層':'成交時間、樓層')+'調到跟這戶一樣的條件。標 * 的是實價登錄車位沒拆價，已扣掉估計的車位價和車位坪數。</p>'+tbl+'</details>'+

      '<h3 class="d-h3">跟屋主怎麼說</h3><div class="d-pitch" id="dPitch">'+esc(pitch).replace(/\n/g,'<br>')+'</div>'+
      '<div class="d-actions"><button type="button" class="btn btn-main" data-copy="pitch">複製給屋主的說法</button>'+
      '<button type="button" class="btn btn-ghost" data-copy="note">複製成筆記（Obsidian）</button>'+
      '<button type="button" class="btn btn-ghost" onclick="window.print()">列印／存 PDF</button></div>'+
      '<p class="toast" id="dToast" role="status"></p>'+
      '<p class="v-disclaimer">本結果依謄本與內政部實價登錄成交資料自動統計，供仲介內部參考，不是不動產估價師的估價報告。屋況、裝潢、景觀、格局與產權狀況要現場確認後再調整。</p>'+
      '</div>';
    $('dResult').innerHTML=html; $('dResult').hidden=false;
    $('dResult').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function plan(name,v,desc,rec){
    return '<div class="d-plan'+(rec?' rec':'')+'"><span>'+name+(rec?' <i>推薦</i>':'')+'</span><b>'+money(v)+'</b><p>'+esc(desc)+'</p></div>';
  }
  function pitchText(){
    var L=last; if(!L) return '';
    var r=L.res, near=r.comps.slice(0,3).map(function(c){return c.y+' 年 '+(c.f?c.f+' 樓':'')+'每坪約 '+c.raw.toFixed(1)+' 萬'}).join('、');
    return '我把'+(r.community?'同社區':r.scope)+'最近的實價登錄都拉出來比過了，'+(near?'像是 '+near+'，':'')+
      '換算成你家這戶的條件，實際成交大概落在 '+Math.round(round10(L.lo))+'～'+Math.round(round10(L.hi))+' 萬。\n'+
      '我建議先開 '+Math.round(L.std)+' 萬，留一點讓買方談的空間，這個價位在網路上看起來有競爭力，比較容易約到帶看。'+
      '如果 3～4 週帶看的反應不好，我們再一起看數字調整。';
  }
  function noteText(){
    var L=last, d=L.d, r=L.res, n=nowRoc();
    var date=(n.y+1911)+'-'+('0'+n.m).slice(-2)+'-'+('0'+n.d).slice(-2);
    return '## 估價紀錄（'+date+'，網站謄本估價）\n\n'+
      '- 建議開價：'+Math.round(L.std)+' 萬（快速成交 '+Math.round(L.fast)+' 萬／試水溫 '+Math.round(L.test)+' 萬）\n'+
      '- 預估成交：'+Math.round(round10(L.mid))+' 萬（'+Math.round(round10(L.lo))+'～'+Math.round(round10(L.hi))+' 萬）\n'+
      '- 建議底價：'+Math.round(L.floor)+' 萬\n'+
      '- 基準單價：'+r.mid.toFixed(1)+' 萬/坪（不含車位），比對 '+r.comps.length+' 筆，範圍：'+r.scope+'，可信度'+r.conf+'\n'+
      '- 房屋 '+L.inp.houseP.toFixed(2)+' 坪'+(r.parkPrice?'＋'+L.inp.parkType+'車位 '+Math.round(r.parkPrice)+' 萬':'')+
      (L.cond||L.view?'，屋況 '+L.cond+'%、景觀 '+L.view+'%':'')+'，議價空間 '+Math.round(L.nego*100)+'%\n'+
      (d.buy?'- 推估購入價：'+Math.round(d.buy.lo)+'～'+Math.round(d.buy.hi)+' 萬（民國 '+d.buy.y+' 年）\n':'');
  }

  function run(){
    if(!parsed){ status('請先上傳謄本。','err'); return; }
    var inp={town:$('dTown').value, road:$('dRoad').value.trim(), lane:parseInt($('dLane').value,10)||0,
             houseP:parseFloat($('dHouse').value)||0, parkP:parseFloat($('dParkP').value)||0,
             floor:parseInt($('dFloor').value,10)||0, tops:parseInt($('dTops').value,10)||0,
             builtY:parseInt($('dBuilt').value,10)||0, parkType:$('dPark').value, kind:getKind()};
    inp.age=inp.builtY?Math.floor(yearsSince(inp.builtY,6,1)):null;
    if(!inp.town){ status('請選行政區（目前只有桃園市的行情資料）。','err'); return; }
    if(!inp.houseP||inp.houseP<5){ status('房屋坪數（不含車位）讀不到，請手動填。','err'); return; }
    status('比對實價登錄中…');
    loadMeta().then(function(){ return loadTown(inp.town); }).then(function(){
      var res=estimate(inp);
      if(!res){ status('這個條件的成交資料太少，估不出來。可以檢查路段、屋齡、型態是否正確。','err'); return; }
      status('');
      render(parsed,inp,res);
    }).catch(function(){ status('行情資料載入失敗，請重新整理再試一次。','err'); });
  }

  function handleText(txt,src){
    var d=parseDeed(txt);
    if(!d.ok){
      status('這份'+src+'讀不到門牌或面積。如果是拍照或掃描的圖片檔，電腦讀不到文字，請改用電傳謄本 PDF，或把謄本文字貼到下面的框框。','err');
      return;
    }
    parsed=d;
    loadMeta().then(function(){
      showForm(d);
      if(d.town && !meta.towns[d.town]){ status('這份謄本在「'+esc(d.town)+'」，目前只有桃園市的行情資料。','err'); return; }
      run();
    }).catch(function(){ status('行情資料載入失敗，請重新整理再試一次。','err'); });
  }

  function handleFile(f){
    if(!f) return;
    $('dFileName').textContent=f.name;
    if(!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)){ status('目前只支援 PDF（電傳謄本）。圖片檔請把謄本文字貼到下面的框框。','err'); return; }
    status('讀取謄本中…（在你的瀏覽器裡處理，不會上傳）');
    f.arrayBuffer().then(pdfText).then(function(t){ handleText(t,'PDF'); })
      .catch(function(){ status('PDF 讀取失敗，檔案可能有密碼或是掃描圖片。可以把謄本文字貼到下面的框框。','err'); });
  }

  // ---------- 事件 ----------
  var drop=$('dDrop');
  $('dFile').addEventListener('change',function(){ handleFile(this.files[0]); });
  ['dragenter','dragover'].forEach(function(e){ drop.addEventListener(e,function(ev){ ev.preventDefault(); drop.classList.add('on'); }); });
  ['dragleave','drop'].forEach(function(e){ drop.addEventListener(e,function(ev){ ev.preventDefault(); drop.classList.remove('on'); }); });
  drop.addEventListener('drop',function(ev){ handleFile(ev.dataTransfer.files[0]); });
  $('dPasteGo').addEventListener('click',function(){ var t=$('dPaste').value; if(t.trim()) handleText(t,'文字'); });
  document.querySelectorAll('#dKinds button').forEach(function(b){ b.addEventListener('click',function(){ setKind(b.getAttribute('data-k')); }); });
  $('dForm').addEventListener('submit',function(e){ e.preventDefault(); run(); });
  ['dCond','dView','dNego'].forEach(function(id){ $(id).addEventListener('change',function(){ $('dNegoV').textContent=$('dNego').value+'%'; if(last) run(); }); });
  $('dNego').addEventListener('input',function(){ $('dNegoV').textContent=this.value+'%'; });
  $('dResult').addEventListener('click',function(e){
    var b=e.target.closest('[data-copy]'); if(!b) return;
    var txt=b.getAttribute('data-copy')==='pitch'?pitchText():noteText();
    var done=function(ok){ $('dToast').textContent=ok?'已複製。':'複製失敗，請手動選取。'; };
    try{ navigator.clipboard.writeText(txt).then(function(){done(true)},function(){done(false)}); }catch(err){ done(false); }
  });
  loadMeta().catch(function(){});

  // 給測試用：在主控台可以呼叫 deedParse(文字)
  window.deedParse=parseDeed;
})();
