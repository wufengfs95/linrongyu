/* 新青安 3.0 資格快篩
   依財政部國庫署「青年安心成家購屋優惠貸款」115 年 8 月 1 日起的新版貸款原則，
   以及公股銀行問與答（nta.gov.tw/singlehtml/108、/109）；查核日 2026-10-22（民國 115 年 10 月）。

   只做「規則上過不過得了」，不做銀行徵信：成數、額度最後都要銀行依 5P 核定，
   所以結論只有三種——符合、不符合、要查證。 */
(function () {
  var $ = RT.$, esc = RT.esc, num = RT.num;

  // ── 規則常數（法規變動只要改這裡）──────────────────
  var AGE_MIN = 18;          // 民法成年
  var AGE_MAX = 50;          // 申貸時未滿 50 歲
  var AGE_PLUS_YEARS = 80;   // 申貸年齡 ＋ 核貸年限 不得逾 80
  var INCOME_MAX = 200;      // 本人年所得總額不得逾 200 萬
  var SHARE_MAX = 40;        // 持分換算面積合計未滿 40 ㎡ 仍可申辦
  var YEARS_MAX = 40;        // 貸款年限最長 40 年（含寬限期 5 年）
  var GRACE_MAX = 5;
  var LTV = 0.8;             // 最高成數 8 成
  var CAP = { tp: 3500, nt: 2500, hc: 2500, other: 2000 };   // 房價上限（萬）
  var CITY = { tp: '臺北市', nt: '新北市', hc: '新竹縣（市）', other: '其他縣市（含桃園）' };
  var QUOTA = { base: 1000, wed: 1200, kid: 1500 };           // 額度上限（萬）
  // 3＋3 補貼後的實際利率：前 3 年 1.775%，期滿後每年少補半碼，滿 6 年回復 2.275%
  var RATE = [1.775, 1.775, 1.775, 1.90, 2.025, 2.15];
  var RATE_END = 2.275;
  var DEADLINE = '118 年 7 月 31 日';

  // ── 單一檢查項的結果 ────────────────────────────
  // s：'ok' 過、'no' 不過、'ask' 要查證
  function row(s, title, why) { return { s: s, t: title, w: why }; }

  function check() {
    var out = [], age = num($('yaAge').value), inc = $('yaIncome').value;
    var own = $('yaOwn').value, area = num($('yaArea').value);
    var city = $('yaCity').value, price = num($('yaPrice').value);
    var use = $('yaUse').value, self = $('yaSelf').value, reg = $('yaReg').value;
    var used = $('yaUsed').checked, wed = $('yaWed').checked, kid = $('yaKid').checked;

    // 1 年齡
    if (!age) out.push(row('ask', '年齡', '先填申貸當下的年齡，規定是成年以上、申貸時未滿 ' + AGE_MAX + ' 歲，以向銀行申請那天算'));
    else if (age < AGE_MIN) out.push(row('no', '年齡 ' + age + ' 歲', '要年滿 ' + AGE_MIN + ' 歲（民法成年）才能申貸'));
    else if (age >= AGE_MAX) out.push(row('no', '年齡 ' + age + ' 歲', '申貸時要未滿 ' + AGE_MAX + ' 歲，滿 ' + AGE_MAX + ' 歲就不能辦了，改走一般首購'));
    else out.push(row('ok', '年齡 ' + age + ' 歲', '成年以上、未滿 ' + AGE_MAX + ' 歲，以向銀行申請那天的年齡為準'));

    // 2 年齡＋年限
    var maxYears = age ? Math.min(YEARS_MAX, AGE_PLUS_YEARS - age) : YEARS_MAX;
    if (age && age < AGE_MAX) {
      if (maxYears < YEARS_MAX) out.push(row('ok', '最長可以貸 ' + maxYears + ' 年', '申貸年齡加核貸年限不能超過 ' + AGE_PLUS_YEARS + '，' + age + ' 歲就是最多 ' + maxYears + ' 年，不是 ' + YEARS_MAX + ' 年'));
      else out.push(row('ok', '最長可以貸 ' + YEARS_MAX + ' 年', '含寬限期最長 ' + GRACE_MAX + ' 年，年齡加年限沒有超過 ' + AGE_PLUS_YEARS));
    }

    // 3 所得
    if (inc === '') out.push(row('ask', '本人年所得', '填年所得總額，上限 ' + INCOME_MAX + ' 萬（只看借款人本人，不含配偶），剛好 ' + INCOME_MAX + ' 萬還在範圍內'));
    else if (num(inc) > INCOME_MAX) out.push(row('no', '本人年所得 ' + RT.comma(num(inc)) + ' 萬', '超過 ' + INCOME_MAX + ' 萬就不能申辦，銀行會用 MyData 或綜所稅各類所得資料清單查'));
    else out.push(row('ok', '本人年所得 ' + RT.comma(num(inc)) + ' 萬', '沒有超過 ' + INCOME_MAX + ' 萬，銀行會用 MyData 或綜所稅各類所得資料清單查'));

    // 4 名下房屋（本人＋配偶＋未成年子女合計）
    if (own === '') out.push(row('ask', '名下房屋', '先選本人、配偶、未成年子女名下的情形'));
    else if (own === 'none') out.push(row('ok', '名下沒有房子', '銀行會調「全國財產稅總歸戶財產查詢清單」，三個人都查無建物就符合'));
    else if (own === 'park') out.push(row('ok', '只有車位或靈骨塔位', '車位、靈骨塔位經銀行依實況審認後可以視為無自有住宅，記得先跟承辦銀行確認'));
    else if (own === 'land') out.push(row('ok', '只有土地、沒有房屋', '名下只有土地沒有建物，可以申辦'));
    else if (own === 'sold') out.push(row('ok', '已經賣掉或移轉了', '提供登記謄本等資料證明已移轉就符合，申請日當下名下沒有房子就好'));
    else if (own === 'share' || own === 'inherit') {
      var who = own === 'share' ? '持分' : '繼承的公同共有住宅';
      if (!area) out.push(row('ask', who, '填持分換算後的面積合計（三個人加總），未滿 ' + SHARE_MAX + ' ㎡ 還可以申辦'
        + (own === 'inherit' ? '，繼承的從 115 年 8 月 1 日起可以按潛在應有部分計算，要附繼承系統表、除戶資料' : '')));
      else if (area < SHARE_MAX) out.push(row('ok', who + '合計 ' + area + ' ㎡', '未滿 ' + SHARE_MAX + ' ㎡，還在可以申辦的範圍'
        + (own === 'inherit' ? '，要附繼承系統表、除戶資料給銀行' : '')));
      else out.push(row('no', who + '合計 ' + area + ' ㎡', '持分換算面積合計達 ' + SHARE_MAX + ' ㎡ 就不算無自有住宅，不能申辦'));
    } else out.push(row('no', '名下有完整的房子', '本人、配偶或未成年子女名下有建物就不符合，要先處理掉名下的房子'));

    // 5 限貸一次
    if (used) out.push(row('no', '辦過新青安或農安貸款', '112 年 8 月 1 日以後核貸過新青安、或在農業金融機構核貸過農安貸款，就不能再辦，一生限一次'));
    else out.push(row('ok', '沒辦過新青安、農安貸款', '112 年 8 月 1 日以後沒有核貸紀錄，一生限貸一次的條件還在'));

    // 6 房價上限
    var cap = CAP[city] || CAP.other;
    if (!price) out.push(row('ask', '房屋總價', '填鑑價與買賣總價「取高」的那個數字，' + CITY[city] + '上限 ' + RT.comma(cap) + ' 萬'));
    else if (price > cap) out.push(row('no', '房屋總價 ' + RT.comma(price) + ' 萬', CITY[city] + '的上限是 ' + RT.comma(cap) + ' 萬，超過就不能用新青安，差 ' + RT.comma(price - cap) + ' 萬'));
    else out.push(row('ok', '房屋總價 ' + RT.comma(price) + ' 萬', CITY[city] + '上限 ' + RT.comma(cap) + ' 萬，用鑑價與買賣總價取高的那個比，還有 ' + RT.comma(cap - price) + ' 萬空間'));

    // 7 建物主要用途
    if (use === 'yes') out.push(row('ok', '主要用途是住宅', '謄本的建物主要用途要有「住」「住宅」「套房」或「公寓」字樣'));
    else if (use === 'no') out.push(row('no', '主要用途不是住宅', '辦公、商業用、工業用這類沒有「住」字樣的，銀行不能用新青安承作'));
    else out.push(row('ask', '建物主要用途', '去看建物謄本的「主要用途」欄，要有「住」「住宅」「套房」或「公寓」字樣才行'));

    // 8 自住
    if (self === 'self') out.push(row('ok', '買來自己住', '核貸時要簽自用住宅使用切結書，銀行貸後會查'));
    else if (self === 'rent') out.push(row('no', '會出租或營業', '分租、整層出租、頂樓加蓋出租都不行，被查到會停止補貼並追回已領的部分，只有出租屋頂裝太陽能、不影響居住可以'));
    else out.push(row('ask', '買來做什麼用', '要自己住才可以，核貸時要簽自用住宅使用切結書'));

    // 9 登記時點
    if (reg === 'within') out.push(row('ok', '登記日在申請日前 6 個月內', '符合「申請日前 6 個月內因買賣取得所有權」'));
    else if (reg === 'after') out.push(row('ok', '還沒過戶，會在核准後 6 個月內登記', '核准後 6 個月內完成所有權登記也可以，但預售屋還沒取得所有權不能先申請保留額度'));
    else if (reg === 'over') out.push(row('no', '登記日已經超過 6 個月', '登記日要在申請日前 6 個月內，超過就過了申辦時點'));
    else out.push(row('ask', '所有權登記日', '看建物謄本的登記日期，要在申請日前 6 個月內，或核准後 6 個月內完成登記'));

    return { rows: out, maxYears: maxYears, price: price, wed: wed, kid: kid, age: age };
  }

  // ── 把檢查結果畫出來 ────────────────────────────
  var MARK = { ok: '✅', no: '❌', ask: '⚠️' };

  function render() {
    var r = check(), rows = r.rows;
    var bad = rows.filter(function (x) { return x.s === 'no'; });
    var ask = rows.filter(function (x) { return x.s === 'ask'; });
    var state = bad.length ? 'no' : (ask.length ? 'ask' : 'ok');
    var head = { ok: '符合新青安 3.0 資格', no: '不能用新青安 3.0', ask: '還有 ' + ask.length + ' 項要確認' }[state];
    var sub = { ok: '下面是額度和月付，最後還是要銀行徵信核定',
                no: '不符合的有 ' + bad.length + ' 項，下面標 ❌ 的就是',
                ask: '標 ⚠️ 的補一補就知道結果了' }[state];

    var list = rows.map(function (x) {
      return '<li class="ya-' + x.s + '"><b>' + MARK[x.s] + ' ' + esc(x.t) + '</b><span>' + esc(x.w) + '</span></li>';
    }).join('');

    var html = '<div class="v-big ya-' + state + '"><span>' + esc(sub) + '</span><strong>' + esc(head) + '</strong></div>'
      + '<ul class="ya-list">' + list + '</ul>';

    if (state !== 'no') html += money(r);

    html += '<p class="v-note">這是依貸款原則做的規則快篩，不是銀行的核貸結果，'
      + '成數和額度銀行會依 5P 原則個案審核，不是每一案都貸得到最高 8 成、最高額度，'
      + '申辦期間到 ' + DEADLINE + '</p>'
      + '<a class="btn btn-line v-cta" href="' + RT.LINE_URL + '" target="_blank" rel="noopener"'
      + ' data-rt-line="' + esc(lineMsg(r, state, head)) + '" data-toast="yaToast">把這份結果傳給容瑜</a>'
      + '<p class="toast" id="yaToast" role="status"></p>';

    $('yaResult').innerHTML = html;
  }

  // 額度、成數、年限、月付
  function money(r) {
    var quota = r.kid ? QUOTA.kid : (r.wed ? QUOTA.wed : QUOTA.base);
    var label = r.kid ? '育有未成年子女' : (r.wed ? '申請日前 2 年內結婚登記' : '一般');
    if (!r.price) {
      return '<div class="ya-note">填房屋總價，這裡就會算出可貸多少、月付多少<br>'
        + '你現在適用的額度上限是 <b>' + RT.comma(quota) + ' 萬</b>（' + label + '）</div>';
    }
    var byLtv = r.price * LTV, loan = Math.min(quota, byLtv), yrs = r.maxYears;
    var p = RT.pmt(loan * 10000, RATE[0], yrs * 12);
    var pEnd = RT.pmt(loan * 10000, RATE_END, yrs * 12);
    var grace = loan * 10000 * RATE[0] / 100 / 12;
    var cap = byLtv < quota ? '八成上限' : '額度上限';

    return '<div class="sl-cards ya-cards">'
      + card('最多可以貸', RT.comma(Math.round(loan)) + ' 萬', '卡在' + cap + '：' + label + '額度 ' + RT.comma(quota)
             + ' 萬、總價八成 ' + RT.comma(Math.round(byLtv)) + ' 萬，取低的那個')
      + card('自備款至少', RT.comma(Math.round(r.price - loan)) + ' 萬', '總價減掉可貸，另外還有仲介服務費、契稅、代書費等雜費')
      + card('前 3 年月付', RT.yuan(p), '利率 ' + RATE[0] + '%、' + yrs + ' 年本息平均攤還')
      + card('補貼期滿後月付', RT.yuan(pEnd), '滿 6 年回復 ' + RATE_END + '%，每月多 ' + RT.yuan(pEnd - p))
      + '</div>'
      + '<div class="ya-note"><b>利率怎麼走：</b>前 3 年 ' + RATE[0] + '%，第 4 年 ' + RATE[3] + '%、第 5 年 '
      + RATE[4] + '%、第 6 年 ' + RATE[5] + '%，第 7 年起回復 ' + RATE_END + '%（機動，會隨郵儲利率調整）<br>'
      + '<b>有寬限期的話：</b>最長 ' + GRACE_MAX + ' 年只繳息，每月約 ' + RT.yuan(grace)
      + '，寬限期算在 ' + yrs + ' 年裡面，期滿本金要用剩下的年數攤完，月付會跳上去</div>';
  }

  function card(t, big, why) {
    return '<div class="sl-card"><span>' + esc(t) + '</span><strong>' + esc(big) + '</strong><em>' + esc(why) + '</em></div>';
  }

  function lineMsg(r, state, head) {
    var m = '容瑜你好，我用新青安資格快篩算過：' + head;
    if (r.age) m += '，' + r.age + ' 歲';
    if (r.price) m += '，看的房子總價 ' + RT.comma(r.price) + ' 萬';
    return m + '，想請你幫我確認一下';
  }

  // ── 連動：選到持分／繼承才問面積 ──────────────────
  function sync() {
    var own = $('yaOwn').value;
    $('yaAreaWrap').hidden = !(own === 'share' || own === 'inherit');
    render();
  }

  $('yaForm').addEventListener('input', sync);
  $('yaForm').addEventListener('change', sync);
  sync();
})();
