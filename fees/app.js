/* 買賣雜費試算：代書、規費這些每家收費不同，所以算區間不是單一數字 */
(function () {
  var RT = window.RT, $ = RT.$, esc = RT.esc;
  var role = 'buyer';
  // 這份程式也會被「我要買房」「我要賣房」的合併頁載入，網址不一樣，
  // 所以資料檔的位置要從 script 自己的網址推，不能寫死相對路徑
  var me = document.currentScript || document.querySelector('script[src*="fees/app.js"]') || { src: '' };
  var HERE = (me.src || '').replace(/[?#].*$/, '').replace(/app\.js$/, '') || '';

  function setRole(r) {
    role = r;
    document.querySelectorAll('#feRole button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-r') === r ? 'true' : 'false');
    });
    $('feDeedWrap').hidden = r !== 'buyer';     // 契稅是買方在繳
    $('feEraWrap').hidden = r !== 'seller';
    $('feLandBox').hidden = r !== 'seller';
    $('feLoanText').textContent = r === 'buyer' ? '有辦房貸（要設定銀行抵押權）' : '原本有房貸（要塗銷抵押權）';
    calc(); docs(); landTax();
  }

  // 幾百元的零頭沒有意義，一律進退到百位
  function r100(x, up) { return (up ? Math.ceil(x / 100 - 1e-6) : Math.floor(x / 100 + 1e-6)) * 100; }
  function range(lo, hi) {
    return lo === hi ? '約 ' + RT.comma(Math.round(lo / 100) * 100) + ' 元'
      : RT.comma(r100(lo, false)) + '～' + RT.comma(r100(hi, true)) + ' 元';
  }
  function wan(x) { return (x / 10000).toFixed(1).replace(/\.0$/, ''); }

  function calc() {
    var total = RT.val('feTotal') * 10000;
    var buyer = role === 'buyer';
    if (!(total > 0)) {
      $('feResult').innerHTML = '<div class="v-empty"><b>費用會出現在這裡</b>'
        + '<p>填成交總價，就會逐項列出買方或賣方要付的雜費，以及合計大約落在多少到多少</p></div>';
      return;
    }
    var loan = $('feLoan').checked;
    var extra = Math.max(0, Math.floor(RT.val('feExtra')));
    var deed = RT.val('feDeed') * 10000;

    // [項目, 說明, 下限, 上限]；下限是 null 的只列出來，不算進合計
    var items = [];
    if (buyer) {
      items.push(['房仲服務費', '成交價的 2%', total * 0.02, total * 0.02]);
      items.push(['契稅', deed > 0 ? '房屋評定現值 × 6%' : '房屋稅單核定契價的 6%（填了契價才會算）',
        deed > 0 ? deed * 0.06 : null, deed > 0 ? deed * 0.06 : null]);
      items.push(['印花稅、地政規費代辦費', '通常幾千元', 1000, 9000]);
      items.push(['建物（土地）過戶代辦費', '每筆約 6,000～9,000 元', 6000, 9000]);
      items.push(['代書簽約撰寫費', '約 2,000 元', 2000, 2000]);
      items.push(['履約保證費', '成交價的 0.03%', total * 0.0003, total * 0.0003]);
      if (loan) items.push(['銀行抵押權設定費', '約 6,000～9,000 元', 6000, 9000]);
      items.push(['實價登錄代辦費', '約 1,500～2,000 元', 1500, 2000]);
    } else {
      items.push(['房仲服務費', '成交價的 4%', total * 0.04, total * 0.04]);
      if ($('feEra').value === 'old') {
        items.push(['土增稅＋財產交易所得稅', '105 年以前取得：依稅單金額', null, null]);
      } else {
        items.push(['土增稅＋房地合一稅', '105 年以後取得：依稅單；房地合一稅可以用「賣方實拿」試算', null, null]);
        items.push(['房地合一稅代申報費', '每筆約 5,000～8,000 元', 5000, 8000]);
      }
      items.push(['代書簽約撰寫費', '約 2,000 元', 2000, 2000]);
      items.push(['履約保證費', '成交價的 0.03%', total * 0.0003, total * 0.0003]);
      if (loan) items.push(['銀行抵押權塗銷費', '約 2,000～5,000 元', 2000, 5000]);
      items.push(['實價登錄代辦費', '約 1,500～2,000 元', 1500, 2000]);
    }
    if (extra > 0) items.push(['建物、土地額外增加 ' + extra + ' 筆', '每筆加收 2,000～3,000 元',
      2000 * extra, 3000 * extra]);

    var lo = 0, hi = 0, rows = '';
    items.forEach(function (it) {
      var has = it[2] != null;
      if (has) { lo += it[2]; hi += it[3]; }
      rows += '<tr><td><b>' + esc(it[0]) + '</b><small>' + esc(it[1]) + '</small></td>'
        + '<td class="fe-n' + (has ? '' : ' fe-na') + '">' + (has ? range(it[2], it[3]) : '依稅單') + '</td></tr>';
    });

    $('feResult').innerHTML =
      '<div class="v-big"><span>' + (buyer ? '買到房時' : '賣掉房時') + '，雜費合計大約</span>'
      + '<strong>' + wan(r100(lo, false)) + '～' + wan(r100(hi, true)) + ' 萬</strong></div>'
      + '<div class="v-table-wrap"><table class="v-table fe-table"><tbody>' + rows + '</tbody></table></div>'
      + '<p class="v-note">以上是區間估算，代書費與規費依各事務所和實際稅單為準；標「依稅單」的項目沒有算進合計'
      + (buyer ? '另外還有銀行開辦費、火險地震險等貸款相關費用，依各家銀行規定'
               : '土地增值稅與房地合一稅金額差很多，簽約前可以先請代書試算') + '</p>'
      + '<a class="btn btn-line v-cta" href="' + RT.LINE_URL + '" target="_blank" rel="noopener"'
      + ' data-rt-line="容瑜你好，我想問買賣雜費：成交總價 ' + RT.val('feTotal') + ' 萬，我是'
      + (buyer ? '買方' : '賣方') + '，想確認實際要準備多少" data-toast="feToast">把這筆試算傳給容瑜</a>'
      + '<p class="toast" id="feToast" role="status"></p>';
  }


  // ── 「要準備什麼資料」清單 ──────────────────────────
  // 上面表格標「依稅單」的那幾項，這裡告訴使用者每一項要準備什麼、去哪裡拿。
  // 資料查核日：2026-10-21（民國 115 年 10 月）
  var L = function (t, w, must) {
    return '<li' + (must ? ' class="fd-must"' : '') + '><b>' + t + '</b><span>' + w + '</span></li>';
  };
  var A = function (u, t) { return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>'; };

  var DOCS = {
    buyer: [{
      h: '契稅：只要一個數字「房屋評定現值」',
      p: '契稅 ＝ 房屋評定現值 × 6%，<b>跟成交價無關</b>，成交價 2,000 萬還是 800 萬，契稅都一樣，'
       + '因為課稅基礎是政府評定的房屋現值，買方繳，契約成立起 30 天內申報',
      li: [
        L('① 最快：跟屋主要「房屋稅繳款書」',
          '每年 5 月開徵那張，4 月底寄到屋主家，看上面的〈房屋課稅現值〉欄——數字通常是幾十萬到一兩百萬，'
          + '不會是幾千萬，話術：「屋主，麻煩把 5 月那張房屋稅單拍給我，我幫買方先把契稅算出來，」', 1),
        L('② 要精準：房屋稅籍證明書',
          '稅單上<b>只有課稅現值，沒有免稅現值</b>，而契稅的基礎是兩者相加，一般自住中古屋通常沒有免稅部分，'
          + '兩者相同；要確定就申請這張，桃園線上辦：'
          + A('https://iservice.tytax.gov.tw/etouch/login', 'e觸即發跨域稅務通')
          + '（行動自然人憑證／自然人憑證／已註冊健保卡），約 3 個工作天'),
        L('③ 只要房屋稅籍編號：免憑證線上查',
          A('https://www.tytax.gov.tw/HousenoSearch.aspx?n=32&amp;sms=10321', '桃園市地方稅務局・房屋稅籍編號查詢')
          + '，輸入房屋地址＋驗證碼就有，不用憑證'),
        L('⚠️ 建物謄本上沒有這個數字',
          '這是最多人搞錯的地方，謄本是<b>地政</b>資料（面積、權利、登記），評定現值是<b>稅籍</b>資料，'
          + '兩個不同機關，謄本上有的是「土地公告現值」，那是賣方算土增稅用的，不是這個'),
        L('順帶一提：還有兩筆也是看現值算的',
          '印花稅 ＝ 公契金額 × 1‰（實務上即 土地公告現值＋房屋評定現值）；'
          + '土地登記規費 ＝ 土地申報地價 × 1‰ ＋ 房屋核定契價 × 1‰，另加書狀費每張 80 元'),
      ],
      tool: ['https://www.tytax.gov.tw/Tax_Deed.aspx?n=58&amp;sms=10330', '桃園市地方稅務局・契稅線上試算'],
    }],

    land: {
      h: '土地增值稅：不管 105 年前後，賣掉都要繳',
      p: '土增稅只課<b>土地</b>，房屋那塊不課，漲價總數額 ＝ 本次申報移轉現值 −（前次移轉現值 × 物價指數）− 改良費用，'
       + '再依漲價倍數走 20%／30%／40% 三級累進，持有超過 20／30／40 年，超過 20% 的那一段分別減徵 20／30／40%',
      li: [
        L('先找到「地號」，不然什麼都查不到',
          '土增稅課的是<b>土地</b>不是房子，所以所有查詢系統都只認<b>地號</b>——'
          + '打社區名、地址、「電梯大樓」都查不到，不是你操作錯<br>'
          + '<b>最快：翻建物謄本</b>，「標示部」的〈基地坐落〉欄就是地號（例：中壢區○○段 123 地號）'
          + '你本來就會調謄本，這是最省事的路<br>'
          + '沒有謄本的話用 ' + A('https://easymap.land.moi.gov.tw/', '內政部・地籍圖資網路便民服務系統')
          + '，可以直接用門牌地址反查地號<br>'
          + '⚠️ 電梯大樓的土地常橫跨<b>好幾個地號</b>，每個地號的公告現值和持分都不一樣，'
          + '要逐筆查、逐筆算再加總，只抓一個地號會嚴重低估', 1),
        L('前次移轉現值（元／㎡）',
          '土地謄本「<b>所有權部</b>」就有，跟〈原規定地價〉並列在該所有權人那一欄'
          + '有些謄本版面會寫成「前次移轉現值（年月）」，括號裡就是前次移轉年月，一併抄下來<br>'
          + '謄本調不到或看不懂的話，'
          + A('https://www.land.tycg.gov.tw/chaspx/SQry1.aspx/517', '桃園市地政局・地價資料查詢（含增值稅試算）')
          + ' 選行政區＋段＋地號，輸入屋主身分證字號＋驗證碼，會自動帶出前次移轉現值、物價指數、'
          + '持有年限並<b>直接把土增稅算出來</b>，可以拿來跟自己算的對一次', 1),
        L('公告土地現值（元／㎡）',
          '土地謄本「標示部」就有，或免費線上查（免身分證、免驗證碼）：'
          + A('https://www.land.tycg.gov.tw/chaspx/SQry1.aspx/517', '桃園市地政局地價資料查詢')
          + '，桃園 115 年公告土地現值全市平均調幅 +1.88%', 1),
        L('土地面積（㎡）、權利範圍、前次移轉年月',
          '都在土地謄本上：面積在「標示部」，權利範圍與登記日期在「所有權部」'
          + '⚠️ 公寓大樓的土地常橫跨好幾個地號，每個地號的現值和持分都不一樣，要<b>逐筆算再加總</b>，'
          + '只抓一個地號會嚴重低估', 1),
        L('臺灣地區消費者物價總指數（稅務專用）',
          A('https://www.stat.gov.tw/cp.aspx?n=2665', '主計總處・時間數列查詢')
          + ' 第 4 項「各年月為基期之消費者物價總指數－稅務專用」'
          + '這是一張矩陣表，要用「前次移轉的年月」去對，目前最新是 <b>115 年 9 月版</b>'
          + '規則：<b>指數低於 100% 時仍以 100% 計</b>，所以近一兩年內的短期買賣多半就是 100%', 1),
        L('改良土地費用（選填，可以扣）',
          '工程受益費繳納收據、土地重劃費用證明書、改良土地費用證明書，有繳過就一定要附，可以扣稅基'),
        L('💰 自用住宅 10% 優惠 ← 差很多，一定要幫屋主確認',
          '官方範例：同一筆地一般稅率要 159 萬，自用住宅只要 59 萬，<b>差 100 萬</b>'
          + '「一生一次」都市土地 300㎡（約 90.7 坪）以內、非都市 700㎡；'
          + '「一生一屋」用過一生一次之後才能用，都市 150㎡、非都市 350㎡，且要設籍滿 6 年、持有滿 6 年、'
          + '出售前 5 年無出租營業、本人與配偶未成年子女名下無其他房屋'
          + '<b>申請時機：最遲在土增稅繳款書的繳納期限屆滿前，逾期就不能再申請，只能按一般稅率</b>'
          + '一生一次用掉沒有，可線上查：' + A('https://www.etax.nat.gov.tw/etwmain/etw108w', '財政部電子稅務文件'), 1),
        L('⚠️ 繼承來的土地，原地價算法不一樣',
          '前次移轉現值用「被繼承人過世那天的當期公告現值」，<b>不是被繼承人當年買進的價格</b>'
          + '不知道這條會算出天文數字'),
      ],
      tool: ['https://www.land.tycg.gov.tw/chaspx/SQry1.aspx/517', '桃園市地政局・土增稅線上試算（會自動帶出前次移轉現值）'],
    },

    newEra: {
      h: '房地合一稅（105 年 1 月 1 日以後取得）',
      p: '完成所有權移轉登記的<b>次日起 30 天內</b>要單獨申報，<b>不論賺賠、不論有沒有要繳錢都要報</b>，沒報會被罰'
       + '詳細金額請用「賣方實拿」那個工具算，這裡只列要準備的東西',
      li: [
        L('取得日（判斷新舊制用）',
          '建物謄本「所有權部」的〈登記日期〉<b>不是簽約日、不是交屋日</b>', 1),
        L('當年的買賣契約書（取得成本）',
          '契約不見的話：找當年的代書調檔、法拍用法院「不動產權利移轉證書」上的拍定價、'
          + '或用銀行房貸撥款紀錄與存摺匯款紀錄佐證', 1),
        L('取得時的必要費用收據',
          '契稅、印花稅、代書費、地政規費、公證費、仲介費，代書當年會給一份「買方費用結算表」，上面全都有'),
        L('裝修改良的單據',
          '能增加房屋價值或效能、且非 2 年內即耗竭的工程才算，要有合約、發票或收據、匯款紀錄'),
        L('土地漲價總數額 ← 可以抵稅，不填會多繳',
          '土地增值稅單上就有，金額不小，一定要填', 1),
        L('本次的仲介服務費收據',
          '算「可認列移轉費用」用，沒有單據的話可以用法定上限：成交價 3%、最多 30 萬'),
      ],
      tool: ['../seller/', '用「賣方實拿」把房地合一稅算出來'],
    },

    oldEra: {
      h: '舊制財產交易所得稅（105 年 1 月 1 日以前取得）',
      p: '<b>土地免所得稅，只有房屋那一塊要課</b>而且不是 30 天內報——是賣掉的<b>次年 5 月併入綜合所得稅</b>申報'
       + '很多屋主以為「賣完沒接到通知就沒事」，隔年沒報，被國稅局比對實價登錄抓到補稅加罰',
      li: [
        L('取得日與取得原因',
          '建物謄本「所有權部」的〈登記日期〉與〈登記原因〉<b>繼承取得的看「被繼承人」的取得日</b>，'
          + '不是繼承那天——被繼承人在 104/12/31 以前買的，不論何時繼承、何時賣，都走舊制', 1),
        L('出售時的房屋評定現值',
          '跟買方契稅同一個數字：房屋稅繳款書的〈房屋課稅現值〉欄，或申請房屋稅籍證明書', 1),
        L('土地公告現值（出售當年度）',
          '土地謄本「標示部」，要乘上持分：公告現值 × 土地面積 × 權利範圍'
          + '這個數字是用來把成交價拆成房屋、土地兩塊的', 1),
        L('【算法一】核實課稅：有單據就用這個',
          '房屋所得 ＝ 房屋部分成交價 −（原始取得成本＋取得費用）− 改良費用 − 移轉費用'
          + '契約通常只寫房地總價，要先拆：房屋價 ＝ 總價 × 〔房屋評定現值 ÷（房屋評定現值＋土地公告現值）〕'
          + '<b>可扣</b>：當年買價、契稅印花代書規費仲介費、登記前的房貸利息、增值性的裝修費、本次仲介費廣告費清潔搬運費'
          + '<b>不可扣</b>：持有期間的房屋稅、地價稅、管理費、房貸利息、違約金'),
        L('【算法二】推計課稅：拿不出單據時',
          '財產交易所得 ＝ 房屋評定現值 × 行政區比率'
          + '<b>114 年度桃園各區</b>（財政部 115/3/4 台財稅字第11400690240號令）：'
          + '桃園區、中壢區 38%｜八德區 37%｜蘆竹、龜山 35%｜<b>平鎮區 30%</b>｜楊梅、大園 27%｜'
          + '龍潭、大溪 23%｜新屋 18%｜<b>觀音區 16%</b>｜復興 8%'
          + '<br>⚠️ <b>115 年度的標準還沒公告</b>（通常在次年 3 月前後發布，即 116 年 3 月左右），'
          + '上面是 114 年度數字，只能拿來估算'),
        L('⚠️ 最後要繳多少，網頁算不出來',
          '這筆所得要<b>併入綜合所得總額</b>，稅率看屋主當年度的全部收入、免稅額、扣除額、扶養人數、'
          + '有沒有夫妻合併申報，115 年度級距是 61 萬／138 萬／277 萬／519 萬，對應 5%～40%'
          + '同一筆 200 萬的售屋所得，落在不同屋主身上稅差可以超過 70 萬，所以這裡只幫你算出「所得額」，'
          + '實際稅額請找會計師或國稅局'),
      ],
      tool: ['https://www.etax.nat.gov.tw/etwmain/etw158w/2501', '財政部・買賣案件一頁試算（土增稅＋契稅＋印花稅＋所得稅）'],
    },
  };

  function docs() {
    var list = role === 'buyer' ? DOCS.buyer
      : [DOCS.land, $('feEra').value === 'old' ? DOCS.oldEra : DOCS.newEra];
    $('feDocs').innerHTML = '<h2 class="fd-h">上面標「依稅單」的，要準備什麼？</h2>'
      + '<p class="fd-sub">這幾項沒辦法只用成交價算出來，下面是每一項要準備的資料、去哪裡拿</p>'
      + list.map(function (d, i) {
          return '<details class="fd"' + (i === 0 ? ' open' : '') + '><summary>' + d.h + '</summary>'
            + '<p class="fd-p">' + d.p + '</p><ul class="fd-list">' + d.li.join('') + '</ul>'
            + (d.tool ? '<p class="fd-tool">👉 ' + A(d.tool[0], d.tool[1]) + '</p>' : '')
            + '</details>';
        }).join('')
      + '<p class="fd-ver">稅率與申請管道查核日：2026-10-21（民國 115 年 10 月）'
      + '各項金額最終以稅捐稽徵機關核定為準</p>';
  }


  // ── 土增稅試算 ──────────────────────────────────────
  // 公式依財政部稅務入口網「土地增值稅試算」與桃園市地方稅務局試算頁。
  // 已用財政部節稅手冊的官方範例驗算過：公告現值 160,000元/㎡×50㎡、前次 20,000、
  // 指數 200%、改良 80,000、持有 35 年 → 一般 1,592,800 元、自用 592,000 元，完全吻合。
  function share(txt) {
    var t = String(txt || '').trim();
    if (!t) return 1;
    var m = t.match(/^(\d+(?:\.\d+)?)\s*[\/分之]+\s*(\d+(?:\.\d+)?)$/);
    if (m) {                       // 「1/2」與「2分之1」寫法都吃
      var x = parseFloat(m[1]), y = parseFloat(m[2]);
      return t.indexOf('分之') >= 0 ? (y / x) : (x / y);
    }
    var n = parseFloat(t);
    return isFinite(n) && n > 0 ? (n > 1 ? 1 : n) : 1;
  }

  // 物價指數：主計總處「各年月為基期之消費者物價總指數－稅務專用」整張表，
  // 由 fees/cpi.json 載入（民國 48 年起逐月）。填了原因發生年月就自動帶入。
  var CPI = null;
  fetch(HERE + 'cpi.json').then(function (r) { return r.json(); }).then(function (d) {
    CPI = d;
    var n = $('ltCpiNote'); if (n) n.textContent = '資料版本：' + d.ver;
    fillCpi();
  }).catch(function () {});

  function fillCpi() {
    if (!CPI) return;
    var y = RT.val('ltY'), m = RT.val('ltM');
    var box = $('ltCpi'), note = $('ltCpiAuto');
    if (!(y > 0) || !(m >= 1 && m <= 12)) { note.textContent = ''; return; }
    var v = (CPI.idx[y] || {})[m];
    if (v == null) {
      note.textContent = '這個年月查不到指數，請自己去主計總處的表上對';
      note.className = 'lt-bad';
      return;
    }
    if (box.value === '' || box.dataset.auto === '1') {   // 她自己改過就不要再覆蓋
      box.value = v; box.dataset.auto = '1';
    }
    note.textContent = '已帶入民國 ' + y + ' 年 ' + m + ' 月的指數 ' + v + '％'
      + (v < 100 ? '（低於 100%，依規定以 100% 計）' : '');
    note.className = 'lt-ok';
    landTax();
  }
  $('ltCpi').addEventListener('input', function () { this.dataset.auto = '0'; });

  // 原因發生日期（民國年／月）→ 持有到今天幾年。土增稅的長期持有減徵看這個。
  function heldYears() {
    var y = RT.val('ltY'), m = RT.val('ltM') || 1;
    var out = $('ltYrOut');
    if (!(y > 0) || m < 1 || m > 12) { out.textContent = '—'; out.className = ''; return 0; }
    var now = new Date();
    var yr = (now.getFullYear() - 1911 - y) + (now.getMonth() + 1 - m) / 12;
    if (yr < 0) { out.textContent = '日期在未來'; out.className = 'lt-bad'; return 0; }
    var cut = yr > 40 ? '減徵 40%' : yr > 30 ? '減徵 30%' : yr > 20 ? '減徵 20%' : '未滿 20 年，無減徵';
    out.textContent = '持有 ' + yr.toFixed(2) + ' 年・' + cut;
    out.className = 'lt-ok';
    return yr;
  }

  function landTax() {
    var box = $('feLandBox');
    if (box.hidden) return;
    var area = RT.val('ltArea'), sh = share($('ltShare').value), yr = heldYears();
    var now = RT.val('ltNow'), prev = RT.val('ltPrev'), cpi = RT.val('ltCpi'), imp = RT.val('ltImp');
    var credit = RT.val('ltCredit');
    $('ltUrbanWrap').hidden = !$('ltSelf').checked;
    // 繼承來的土地：原地價與起算日都看「繼承開始日」，不是被繼承人當年買的那天。
    // 這是最常算錯的一條，錯了會算出天文數字。
    var inh = $('ltInherit').checked;
    $('ltPrevWhere').innerHTML = inh
      ? '<b>繼承開始日（被繼承人過世那天）的當期公告現值</b>，不是被繼承人當年的買價'
      : '謄本・所有權部〈前次移轉現值〉';
    $('ltYWhere').innerHTML = inh
      ? '填<b>繼承開始日</b>（被繼承人過世的年月）'
      : '謄本・所有權部〈原因發生日期〉推算';

    if (!(area > 0 && now > 0 && prev > 0)) {
      $('ltOut').innerHTML = '土地面積、本次公告土地現值、前次移轉現值這三格填了就會算';
      return;
    }
    var idx = Math.max(100, cpi || 100) / 100;        // 指數低於 100% 仍以 100% 計
    var ha = area * sh;                               // 持分後的面積
    var total = now * ha;                             // 本次申報移轉現值總額
    var base = prev * idx * ha;                       // 調整後前次移轉現值總額
    var gain = total - base - imp;                    // 漲價總數額
    if (gain <= 0) {
      $('ltOut').innerHTML = '<b>土增稅 0 元</b>（漲價總數額 ≤ 0，沒有漲價就不課）';
      return;
    }
    var ratio = gain / base;
    var lv = ratio < 1 ? 1 : ratio < 2 ? 2 : 3;
    var R = {
      2: yr > 40 ? [0.26, 0.06] : yr > 30 ? [0.27, 0.07] : yr > 20 ? [0.28, 0.08] : [0.30, 0.10],
      3: yr > 40 ? [0.32, 0.18] : yr > 30 ? [0.34, 0.21] : yr > 20 ? [0.36, 0.24] : [0.40, 0.30],
    };
    var gen = function (g, b) { return lv === 1 ? g * 0.20 : g * R[lv][0] - b * R[lv][1]; };

    var tax, note = '';
    if ($('ltSelf').checked) {
      var cap = $('ltUrban').value === 'n' ? 700 : 300;   // 一生一次的面積上限
      if (ha <= cap) {
        tax = gain * 0.10;
        note = '全部適用自用住宅 10%';
      } else {                                            // 超過上限的部分回到一般稅率
        var p = cap / ha;
        tax = gain * p * 0.10 + gen(gain * (1 - p), base * (1 - p));
        note = '自用只到 ' + cap + ' ㎡（你有 ' + ha.toFixed(1) + ' ㎡），超過的 '
             + (ha - cap).toFixed(1) + ' ㎡ 按一般稅率';
      }
      note += '<br>一般稅率要 ' + RT.comma(Math.round(gen(gain, base))) + ' 元，<b>自用省下 '
            + RT.comma(Math.round(gen(gain, base) - tax)) + ' 元</b>';
    } else {
      tax = gen(gain, base);
      note = '勾「自用住宅 10%」可以看省多少';
    }
    var cut = yr > 40 ? '40 年以上減徵 40%' : yr > 30 ? '超過 30 年減徵 30%'
            : yr > 20 ? '超過 20 年減徵 20%' : '持有未滿 20 年，無減徵';
    // 增繳地價稅可以抵繳，但上限是應納土增稅的 5%（土地稅法 31 條第 3 項）
    var used = 0;
    if (credit > 0) { used = Math.min(credit, tax * 0.05); tax -= used; }
    $('ltOut').innerHTML =
      '<b class="lt-big">土增稅約 ' + RT.comma(Math.round(Math.max(0, tax))) + ' 元</b>'
      + (used > 0 ? '<br>已扣掉可抵繳的 ' + RT.comma(Math.round(used)) + ' 元'
          + (credit > used ? '（你填 ' + RT.comma(credit) + ' 元，但上限是應納稅額的 5%）' : '') : '')
      + '<br>漲價總數額 ' + RT.comma(Math.round(gain)) + ' 元・漲價 ' + (ratio * 100).toFixed(0)
      + '%（第 ' + lv + ' 級）・' + cut
      + (cpi && cpi < 100 ? '<br>你填的指數 ' + cpi + '% 低於 100%，依規定以 100% 計' : '')
      + '<br>' + note
      + (inh ? '<br><small>繼承取得：前次移轉現值要用繼承開始日的當期公告現值，持有期間也從那天起算'
             + '（繼承移轉本身免徵土增稅，這裡算的是你現在要賣掉這一次，）</small>' : '')
      + '<br><small>這是估算值，實際以稅捐稽徵機關核定的稅單為準，自用住宅 10% 要另外申請並符合要件</small>';
  }

  ['ltArea','ltShare','ltY','ltM','ltNow','ltPrev','ltCpi','ltImp','ltCredit'].forEach(function (id) {
    $(id).addEventListener('input', landTax);
  });
  ['ltY','ltM'].forEach(function (id) { $(id).addEventListener('input', fillCpi); });
  $('ltSelf').addEventListener('change', landTax);
  $('ltInherit').addEventListener('change', landTax);
  $('ltUrban').addEventListener('change', landTax);

  document.querySelectorAll('#feRole button').forEach(function (b) {
    b.addEventListener('click', function () { setRole(b.getAttribute('data-r')); });
  });
  // 合併頁（我要買房／我要賣房）會在表單上標 data-role 鎖死身分，沒有切換鈕、也不理網址
  var lockRole = $('feForm').getAttribute('data-role');
  ['feTotal', 'feDeed', 'feExtra'].forEach(function (id) { $(id).addEventListener('input', calc); });
  $('feEra').addEventListener('change', function(){ calc(); docs(); });
  $('feLoan').addEventListener('change', calc);

  if (lockRole) {
    setRole(lockRole);
  } else {
    // 單獨開 /fees/ 的時候，從「我要賣房」點進來是 #seller，「我要買房」是 #buyer
    var fromHash = function () { setRole(location.hash === '#seller' ? 'seller' : 'buyer'); };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }
})();
