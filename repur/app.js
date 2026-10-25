/* 重購退稅試算：土地增值稅（土地稅法 35、36、37）與房地合一稅（所得稅法 14-8）
   這是兩套完全不同的制度，很多要件剛好相反，所以兩邊的檢核與金額一定要分開算：

     價格基準   土增稅＝土地的「申報移轉現值」（土地稅法 36 條明文）；房地合一＝房地「成交總價」
     算法       土增稅是門檻型（差多少退多少，上限已繳額）；房地合一是比率型
     所有權人   土增稅必須同一人；房地合一可以本人或配偶
     設籍的人   土增稅是本人、配偶或直系親屬；房地合一是本人、配偶或未成年子女（成年子女不算）
     期限       兩套都是 2 年，但土增稅後手那筆另看是否 30 日內申報

   查核日 2026-10-25（民國 115 年）。來源見頁面最下方。
   法規變動時，這裡的常數與 repur_page() 的說明要一起改。 */
(function () {
  var RT = window.RT, $ = RT.$, esc = RT.esc, num = RT.val;

  var YEARS = 2;                 // 兩次移轉登記相隔上限
  var HOLD = 5;                  // 重購後列管年數（兩套都是 5 年）
  var CAP = { u: 300, n: 700 };  // 新購地面積上限：都市 3 公畝＝300㎡、非都市 7 公畝＝700㎡
  var PING = 0.3025;

  var wan = function (v) { return RT.comma(Math.round(v * 100) / 100, 2) + ' 萬'; };
  var on = function (id) { var e = $(id); return !!(e && e.checked); };

  // ── 兩次完成移轉登記日 ──────────────────────
  function gap() {
    var a = $('rpSellDate').value, b = $('rpBuyDate').value;
    if (!a || !b) return null;
    var da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
    if (isNaN(da) || isNaN(db)) return null;
    var first = da <= db ? da : db, last = da <= db ? db : da;
    // 用「同月同日」算 2 年，不要寫死 730 天，閏年才不會差一天
    var limit = new Date(first.getFullYear() + YEARS, first.getMonth(), first.getDate());
    return { days: Math.round((last - first) / 86400000), ok: last <= limit,
             sellFirst: da <= db, limit: limit.toISOString().slice(0, 10) };
  }

  // ── 土增稅：A ＝ 新購現值 −（出售現值 − 已繳土增稅），退 min(已繳, max(A,0)) ──
  function landTax() {
    var vNew = num('rpLandNew'), vOld = num('rpLandOld'), paid = num('rpLandPaid');
    if (!vOld || !paid) return { has: false };
    if (paid > vOld) return { has: true, bad: '已繳的土增稅比申報移轉現值還大，有一個填錯了' };
    var area = num('rpArea'), cap = CAP[$('rpZone').value] || CAP.u;
    if (area && area > cap) {
      return { has: true, over: true, cap: cap,
               bad: '新購土地' + area + ' ㎡ 超過上限 ' + cap + ' ㎡（約 ' + (cap * PING).toFixed(1)
                    + ' 坪），超過的部分怎麼拆算官方沒有明定，這個數字要問地方稅務局' };
    }
    var a = vNew - (vOld - paid);
    return { has: true, a: a, paid: paid, vOld: vOld, vNew: vNew,
             refund: Math.min(paid, Math.max(a, 0)), full: a >= paid && a > 0, none: a <= 0 };
  }

  // ── 房地合一：退（或扣抵）＝ 已繳 × min(重購價 ÷ 出售價, 100%) ──
  function houseTax() {
    var pNew = num('rpHouseNew'), pOld = num('rpHouseOld'), paid = num('rpHousePaid');
    if (!pOld || !paid) return { has: false };
    var raw = pNew / pOld, rate = Math.min(raw, 1);
    return { has: true, rate: rate, paid: paid, pOld: pOld, pNew: pNew,
             refund: paid * rate, full: raw >= 1 };
  }

  // ── 要件：每一條註明會卡到哪一套稅 ──────────────
  // who: 'land' 只影響土增稅、'house' 只影響房地合一、'both' 兩套都卡
  function checks(g) {
    var r = [];
    var add = function (who, s, t, w) { r.push({ who: who, s: s, t: t, w: w }); };

    if (!g) add('both', 'ask', '兩次移轉登記日', '把賣掉那戶和買進那戶的「完成移轉登記日」都填上，才知道有沒有在 ' + YEARS + ' 年內');
    else if (!g.ok) add('both', 'no', '相隔超過 ' + YEARS + ' 年',
      '兩次完成移轉登記日相隔 ' + g.days + ' 天，期限到 ' + g.limit + '，超過就兩套都不能退');
    else add('both', 'ok', (g.sellFirst ? '先賣後買' : '先買後賣') + '，相隔 ' + g.days + ' 天',
      g.sellFirst ? '在 ' + YEARS + ' 年內，兩套都是稅先繳、之後再申請退還'
                  : '在 ' + YEARS + ' 年內，房地合一是申報時直接扣抵應納稅額、不是退現金；土增稅還是事後退');

    add('both', on('rpNoRent') ? 'ok' : 'no',
      on('rpNoRent') ? '兩戶都沒有出租或營業' : '有出租或營業',
      '兩戶都不能出租、供營業或執行業務使用，公益出租、社宅包租代管也算出租');

    // 設籍：兩套認的人不一樣
    add('land', on('rpSetLand') ? 'ok' : 'no',
      on('rpSetLand') ? '土增稅的設籍 OK' : '土增稅：設籍不符',
      '出售地與新購地都要有本人、配偶或直系親屬設籍（土地稅法 9 條），成年子女、父母都算');
    add('house', on('rpSetHouse') ? 'ok' : 'no',
      on('rpSetHouse') ? '房地合一的設籍與居住 OK' : '房地合一：設籍或居住不符',
      '兩戶都要本人、配偶或未成年子女設籍「並實際居住」，成年子女不算，'
      + '國稅局會查水電度數，設了戶籍沒住一樣不准');

    add('land', on('rpSameOwner') ? 'ok' : 'no',
      on('rpSameOwner') ? '土增稅：所有權人同一人' : '土增稅：所有權人不同人',
      '土增稅的出售地與新購地必須是同一個人的名字，掛到配偶名下就整個不符合，這點跟房地合一相反');
    add('house', on('rpSpouseOk') ? 'ok' : 'no',
      on('rpSpouseOk') ? '房地合一：用本人或配偶名義' : '房地合一：名義不符',
      '房地合一可以用本人或配偶的名義重購，但成年子女、父母不行');

    add('land', on('rpYear1') ? 'ok' : 'ask',
      on('rpYear1') ? '出售前一年沒有出租或營業' : '出售前一年有沒有出租或營業',
      '土增稅多的一道要件（土地稅法 35 條第 3 項），房地合一的條文沒有「一年內」這幾個字');

    add('house', on('rpPresale') ? 'no' : 'ok',
      on('rpPresale') ? '買的是預售屋' : '買的不是預售屋',
      '預售屋還沒取得所有權、沒辦法自住，不適用，要等交屋完成移轉登記之後才開始算那 2 年');
    add('house', on('rpHeldFirst') ? 'ok' : 'no',
      on('rpHeldFirst') ? '不是買新賣新' : '可能是買新賣新',
      '賣掉的那戶要是買新戶之前就持有的，先買一間新的、再把另一間剛買的賣掉（買新賣新）不適用');

    if (g && !g.sellFirst) add('land', on('rpHadSelf') ? 'ok' : 'ask',
      on('rpHadSelf') ? '先買後賣：買地時名下已有自用住宅' : '先買後賣：買地時名下有自用住宅嗎',
      '土增稅的先買後賣，要在買新地的當下就已經持有供自用住宅使用的土地');

    return r;
  }

  var MARK = { ok: '✅', no: '❌', ask: '⚠️' };

  function render() {
    var g = gap(), rows = checks(g), lt = landTax(), ht = houseTax();
    var blocks = function (who) {
      return rows.filter(function (x) { return (x.who === 'both' || x.who === who) && x.s === 'no'; });
    };
    var landBad = blocks('land'), houseBad = blocks('house');
    var landR = (!landBad.length && lt.has && !lt.bad) ? lt.refund : 0;
    var houseR = (!houseBad.length && ht.has) ? ht.refund : 0;
    var total = landR + houseR;

    var anyBad = landBad.length && houseBad.length;
    var state = anyBad ? 'no' : (rows.some(function (x) { return x.s === 'ask'; }) ? 'ask' : 'ok');
    var head, sub;
    if (anyBad) { head = '兩套都不符合'; sub = '下面標 ❌ 的就是卡住的地方'; }
    else if (!lt.has && !ht.has) { head = '填金額就會算'; sub = '兩套稅各填各的，有填哪一套就算哪一套'; }
    else { head = '最多可以退 ' + wan(total); sub = '土增稅與房地合一是兩套稅、兩個機關，要分開申請'; }

    var html = '<div class="v-big rp-' + state + '"><span>' + esc(sub) + '</span><strong>' + esc(head) + '</strong></div>';

    if (lt.has || ht.has) {
      html += '<div class="sl-cards rp-cards">';
      if (lt.has) html += card('土地增值稅',
        landBad.length ? '不符合' : (lt.bad ? '要問稅務局' : (lt.none ? '不能退' : wan(lt.refund))),
        landBad.length ? '卡在：' + landBad[0].t
          : (lt.bad ? lt.bad
            : (lt.none
              ? '新購現值 ' + wan(lt.vNew) + ' 沒有超過「出售現值 ' + wan(lt.vOld) + ' 減已繳 ' + wan(lt.paid)
                + '」的 ' + wan(lt.vOld - lt.paid) + '，還差 ' + wan(Math.abs(lt.a))
              : (lt.full ? '不足支付新地價的部分 ' + wan(lt.a) + ' 已經大於已繳的 ' + wan(lt.paid) + '，所以全退'
                 : '不足支付新地價的部分只有 ' + wan(lt.a) + '，退稅以這個為限，不是已繳的 ' + wan(lt.paid)))));
      if (ht.has) html += card('房地合一稅',
        houseBad.length ? '不符合' : wan(ht.refund),
        houseBad.length ? '卡在：' + houseBad[0].t
          : (ht.full
            ? '重購 ' + wan(ht.pNew) + ' 不低於出售 ' + wan(ht.pOld) + '，比率 100%，已繳的全部退'
            : '比率 ' + (ht.rate * 100).toFixed(1) + '%（重購 ' + wan(ht.pNew) + ' ÷ 出售 ' + wan(ht.pOld)
              + '），' + wan(ht.paid) + ' × ' + (ht.rate * 100).toFixed(1) + '% = ' + wan(ht.refund))
          + (g && !g.sellFirst ? '　先買後賣是在申報時扣抵，不是退現金' : ''));
      html += '</div>';
    }

    html += '<ul class="ya-list rp-list">' + rows.map(function (x) {
      return '<li class="ya-' + x.s + '"><b>' + MARK[x.s] + ' ' + esc(x.t)
        + (x.who !== 'both' ? '<em class="rp-tag">' + (x.who === 'land' ? '土增稅' : '房地合一') + '</em>' : '')
        + '</b><span>' + esc(x.w) + '</span></li>';
    }).join('') + '</ul>';

    html += '<div class="ya-note rp-warn"><b>退完還沒結束，' + HOLD + ' 年內會被追回來：</b>'
      + '重購的房地在 ' + HOLD + ' 年內改作其他用途或再轉手，退掉的稅要追繳，'
      + '<b>戶籍遷出也算</b>，土增稅連夫妻之間贈與都算再移轉<br>'
      + '<b>三個期限不要搞混：</b>土增稅的退稅請求權時效 10 年（稅捐稽徵法 28 條）；'
      + '房地合一先賣後買的申請時效是重購完成移轉登記<b>次日</b>起 5 年；重購後列管也是 5 年，是三件事</div>';

    html += '<p class="v-note">這是依法條算的參考值，不是核定結果<b>土增稅找土地所在地的地方稅務局、'
      + '房地合一找戶籍地國稅局，兩邊要分開申請</b>，差幾天、面積剛好卡線、含車位、繼承取得這種案子，'
      + '報數字給客戶之前請先打 0800-000-321 問過</p>'
      + '<a class="btn btn-line v-cta" href="' + RT.LINE_URL + '" target="_blank" rel="noopener"'
      + ' data-rt-line="' + esc('容瑜你好，我想問重購退稅：'
        + (lt.has ? '土增稅算出來 ' + (landBad.length ? '不符合' : wan(landR)) + '、' : '')
        + (ht.has ? '房地合一算出來 ' + (houseBad.length ? '不符合' : wan(houseR)) + '，' : '')
        + '想請你幫我確認') + '" data-toast="rpToast">把這筆試算傳給容瑜</a>'
      + '<p class="toast" id="rpToast" role="status"></p>';

    $('rpResult').innerHTML = html;

    // 先買後賣才需要問「買地時名下已有自用住宅」
    $('rpHadSelfWrap').hidden = !(g && !g.sellFirst);
  }

  function card(t, big, why) {
    return '<div class="sl-card"><span>' + esc(t) + '</span><strong>' + esc(big) + '</strong><em>' + esc(why) + '</em></div>';
  }

  $('rpForm').addEventListener('input', render);
  $('rpForm').addEventListener('change', render);
  render();
})();
