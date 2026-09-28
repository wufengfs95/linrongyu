/* 繼承分配計算機：應繼分、特留分（含 115/8/17 修法）、遺產稅粗估 */
(function () {
  var $ = RT.$, num = RT.val;

  // 115 年度遺產稅金額（財政部公告，自 111 年起未調整）
  var TAX = { free: 1333, spouse: 553, child: 56, parent: 138, care: 56, funeral: 138 };
  var BRACKET = [[5000, 0.10, 0], [10000, 0.15, 250], [Infinity, 0.20, 750]];
  var NEWLAW = '2027-02-17';   // 民法 1223 修正施行日（115/8/17 公布，公布後六個月施行）

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function frac(n, d) {
    if (!n) return '0';
    var g = gcd(n, d);
    n /= g; d /= g;
    return d === 1 ? String(n) : n + '/' + d;
  }
  function fw(v) { return v >= 10000 ? (v / 10000).toFixed(2) + ' 億' : RT.comma(Math.round(v * 10) / 10, v < 100 ? 1 : 0) + ' 萬'; }

  // 應繼分：民法 1138、1141、1144
  function shares(f) {
    var out = [], D = 10080;                 // 用共同分母表示，避免浮點數
    var kids = f.kid, par = f.par, sib = f.sib, gp = f.gp, sp = f.spouse;
    var order = kids > 0 ? 1 : par > 0 ? 2 : sib > 0 ? 3 : gp > 0 ? 4 : 0;
    var n = order === 1 ? kids : order === 2 ? par : order === 3 ? sib : order === 4 ? gp : 0;
    var label = { 1: '子女', 2: '父母', 3: '兄弟姊妹', 4: '祖父母' }[order];
    if (!sp && !order) return { out: [], order: 0 };
    if (!order) { out.push({ who: '配偶', n: 1, each: D, kind: 'spouse' }); return { out: out, order: 0 }; }
    if (!sp) {
      out.push({ who: label, n: n, each: D / n, kind: 'heir', order: order });
    } else if (order === 1) {
      var per = D / (n + 1);
      out.push({ who: '配偶', n: 1, each: per, kind: 'spouse' });
      out.push({ who: label, n: n, each: per, kind: 'heir', order: order });
    } else if (order === 2 || order === 3) {
      out.push({ who: '配偶', n: 1, each: D / 2, kind: 'spouse' });
      out.push({ who: label, n: n, each: D / 2 / n, kind: 'heir', order: order });
    } else {
      out.push({ who: '配偶', n: 1, each: D * 2 / 3, kind: 'spouse' });
      out.push({ who: label, n: n, each: D / 3 / n, kind: 'heir', order: order });
    }
    return { out: out, order: order, D: D };
  }

  // 特留分：民法 1223。兄弟姊妹在 2027/2/17 起沒有特留分
  function reserveRate(kind, order, newLaw) {
    if (kind === 'spouse') return 0.5;
    if (order === 1 || order === 2) return 0.5;
    if (order === 3) return newLaw ? 0 : 1 / 3;
    if (order === 4) return 1 / 3;
    return 0;
  }

  function estateTax(f, net) {
    var ded = TAX.funeral;
    var lines = [['喪葬費扣除額', TAX.funeral]];
    if (f.spouse) { ded += TAX.spouse; lines.push(['配偶扣除額', TAX.spouse]); }
    if (f.kid > 0) { ded += TAX.child * f.kid; lines.push(['直系血親卑親屬 ' + f.kid + ' 人 × 56 萬', TAX.child * f.kid]); }
    if (f.par > 0) { ded += TAX.parent * f.par; lines.push(['父母 ' + f.par + ' 人 × 138 萬（遺有父母就能扣）', TAX.parent * f.par]); }
    var taxable = Math.max(0, net - TAX.free - ded);
    var tax = 0, br = null;
    for (var i = 0; i < BRACKET.length; i++) {
      if (taxable <= BRACKET[i][0]) { br = BRACKET[i]; break; }
    }
    tax = taxable * br[1] - br[2];
    return { ded: ded, lines: lines, taxable: taxable, tax: Math.max(0, tax), rate: br[1] * 100 };
  }

  function calc() {
    var f = { spouse: $('ihSpouse').value === '1', kid: num('ihKid'), par: num('ihPar'),
              sib: num('ihSib'), gp: num('ihGp') };
    var net = num('ihNet');
    var died = $('ihDied').value;
    var newLaw = died >= NEWLAW;
    var box = $('ihResult');

    var s = shares(f);
    if (!s.out.length) {
      box.innerHTML = '<div class="v-empty"><b>結果會出現在這裡</b>'
        + '<p>先勾配偶、填人數，就會算出：<br>・每個人的應繼分（民法 1138、1141、1144）'
        + '<br>・每個人最少保障的特留分（民法 1223）<br>・遺產稅粗估（115 年度免稅額與扣除額）</p></div>';
      return;
    }

    var D = s.D || 10080;
    var rows = s.out.map(function (o) {
      var rate = reserveRate(o.kind, o.order, newLaw);
      var res = o.each * rate;
      return { who: o.who, n: o.n, each: o.each, res: res, rate: rate,
               eachTxt: frac(o.each, D), resTxt: res ? frac(Math.round(res), D) : '無' };
    });

    var money = net > 0;
    var tbl = '<table class="v-table ih-table"><thead><tr><th>繼承人</th><th>人數</th>'
      + '<th>每人應繼分</th>' + (money ? '<th>金額</th>' : '')
      + '<th>每人特留分</th>' + (money ? '<th>金額</th>' : '') + '</tr></thead><tbody>'
      + rows.map(function (r) {
          return '<tr><td>' + r.who + '</td><td>' + r.n + '</td>'
            + '<td><b>' + r.eachTxt + '</b></td>' + (money ? '<td>' + fw(net * r.each / D) + '</td>' : '')
            + '<td' + (r.res ? '' : ' class="none"') + '>' + r.resTxt + '</td>'
            + (money ? '<td>' + (r.res ? fw(net * r.res / D) : '—') + '</td>' : '') + '</tr>';
        }).join('') + '</tbody></table>';

    var sibNote = '';
    if (f.sib > 0 && s.order === 3) {
      sibNote = newLaw
        ? '<p class="ih-warn"><b>兄弟姊妹已沒有特留分。</b>民法第 1223 條 115 年 8 月 17 日修正公布、'
          + '116 年 2 月 17 日起施行，刪除兄弟姊妹的特留分。被繼承人可以用遺囑把遺產全部留給別人，'
          + '兄弟姊妹不能再主張扣減。但<b>沒有立遺囑的話，兄弟姊妹仍依法定應繼分繼承</b>。</p>'
        : '<p class="ih-warn"><b>這個日期仍適用舊法，兄弟姊妹的特留分是應繼分的 1/3。</b>'
          + '民法第 1223 條的修正（刪除兄弟姊妹特留分）要到 <b>116 年 2 月 17 日</b>才施行，'
          + '用哪一版看<b>過世那天</b>，不是看遺囑日期。</p>';
    }

    var taxHtml = '';
    if (money) {
      var t = estateTax(f, net);
      taxHtml = '<h3 class="ih-h3">遺產稅粗估</h3>'
        + '<table class="v-table ih-table"><tbody>'
        + '<tr><td>遺產總額</td><td>' + fw(net) + '</td></tr>'
        + '<tr><td>免稅額</td><td>−' + fw(TAX.free) + '</td></tr>'
        + t.lines.map(function (l) { return '<tr><td>' + l[0] + '</td><td>−' + fw(l[1]) + '</td></tr>'; }).join('')
        + '<tr class="sum"><td>課稅遺產淨額</td><td>' + fw(t.taxable) + '</td></tr>'
        + '<tr class="sum"><td>應納遺產稅（' + t.rate + '%）</td><td>' + fw(t.tax) + '</td></tr>'
        + '</tbody></table>'
        + '<p class="v-hint">房子請用市價概估；<b>實際遺產稅是按公告土地現值＋房屋評定現值計算，通常低於市價</b>，'
        + '所以真正要繳的多半比這裡算的少。未計入農地、公共設施保留地、被繼承人的債務、剩餘財產差額分配請求權與生前贈與歸扣。</p>';
    }

    box.innerHTML = '<h3 class="ih-h3">應繼分與特留分</h3>' + tbl + sibNote
      + '<p class="v-hint">應繼分＝沒有遺囑時依法各拿多少（民法 1138、1141、1144）；'
      + '特留分＝就算有遺囑，法律保障每個人最少能拿到的部分（民法 1223）。'
      + '被繼承人只能自由處分「遺產減掉全部特留分」的那一塊。</p>'
      + taxHtml
      + '<button type="button" class="btn btn-line" data-rt-line="'
      + RT.esc('容瑜你好，我想問繼承的事：\n・' + (f.spouse ? '有配偶' : '沒有配偶')
        + '、子女 ' + f.kid + ' 人、父母 ' + f.par + ' 人、兄弟姊妹 ' + f.sib + ' 人、祖父母 ' + f.gp + ' 人'
        + (money ? '\n・遺產概估 ' + net + ' 萬' : '') + '\n想問房子要怎麼分、要不要先處理')
      + '" data-toast="ihToast">把我的狀況丟給容瑜看</button>'
      + '<p class="v-note" id="ihToast"></p>';
  }

  ['ihKid', 'ihPar', 'ihSib', 'ihGp', 'ihNet'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('input', calc);
  });
  ['ihSpouse', 'ihDied'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('change', calc);
  });
  document.querySelectorAll('.ih-step').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = $(b.getAttribute('data-t'));
      t.value = Math.max(0, (parseInt(t.value, 10) || 0) + (+b.getAttribute('data-d')));
      calc();
    });
  });
  var dd = $('ihDied');
  if (dd && !dd.value) {                    // 預設今天，訪客開頁時才決定，不寫死在 HTML 裡
    var d = new Date();
    dd.value = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  var form = $('ihForm');
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); calc(); });
  calc();
})();
