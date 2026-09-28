/* 預售屋換約速算：換約後賣方實拿多少、房地合一稅列舉 vs 不列舉 */
(function () {
  var $ = RT.$, num = RT.val, wan = RT.wan, comma = RT.comma;
  var mode = 'item';          // item = 費用列舉、std = 不列舉（收入 3%，上限 30 萬）

  function picked(id, def) {
    var b = document.querySelector('#' + id + ' button[aria-pressed="true"]');
    return b ? +b.getAttribute('data-v') : def;
  }
  function pick(id, v) {
    [].forEach.call(document.querySelectorAll('#' + id + ' button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-v') === String(v) ? 'true' : 'false');
    });
  }
  function w(v) { return comma(Math.round(v * 100) / 100, Math.abs(v) < 100 ? 2 : 0) + ' 萬'; }

  function calc() {
    var cost = num('psCost');            // 取得總價（與建商簽約）
    var paid = num('psPaid');            // 已付款累計
    var sell = num('psSell');            // 出售（換約）總價
    var feeR = num('psFeeR');            // 服務費率 %
    var reg = num('psReg');              // 實價登錄費（萬）
    var rate = picked('psRate', 45);     // 房地合一稅率 %

    var box = $('psResult');
    if (sell <= 0 || cost <= 0) {
      box.innerHTML = '<div class="v-empty"><b>結果會出現在這裡</b>'
        + '<p>填「取得總價」和「出售總價」就會自動算：<br>・換約利潤、房地合一稅'
        + '<br>・費用列舉 vs 不列舉哪個划算<br>・屋主最後實際拿回多少現金</p></div>';
      return;
    }

    var profit = sell - cost;                         // 換約利潤（差價）
    var income = paid + profit;                       // 房地合一的「成交價額」
    var svc = sell * feeR / 100;                      // 仲介服務費
    var esc = sell * 0.0003;                          // 履保費：出售 × 萬分之三
    var itemFee = svc + esc + reg;                    // 列舉費用（憑證合計）
    var stdFee = Math.min(income * 0.03, 30);         // 不列舉：成交價額 3%，上限 30 萬

    var plan = function (fee) {
      var taxable = Math.max(0, profit - fee);
      var tax = taxable * rate / 100;
      return { fee: fee, taxable: taxable, tax: tax,
               back: paid + profit - itemFee - tax,   // 實際支出一律是列舉的那些，只有稅會變
               net: profit - itemFee - tax };
    };
    var A = plan(itemFee), B = plan(stdFee);
    var best = A.tax <= B.tax ? 'item' : 'std';
    var use = mode === 'item' ? A : B;

    var col = function (key, title, feeLabel, p) {
      var on = mode === key;
      return '<div class="ps-col' + (on ? ' on' : '') + '" data-plan="' + key + '">'
        + '<h4>' + title + (best === key ? '<span class="ps-best">划算</span>' : '') + '</h4>'
        + '<dl><dt>' + feeLabel + '</dt><dd>' + w(p.fee) + '</dd>'
        + '<dt>課稅所得</dt><dd>' + w(p.taxable) + '</dd>'
        + '<dt>房地合一稅</dt><dd class="hi">' + w(p.tax) + '</dd>'
        + '<dt>屋主拿回</dt><dd>' + w(p.back) + '</dd></dl>'
        + '<button type="button" class="ps-use"' + (on ? ' disabled' : '') + '>'
        + (on ? '✓ 已採用' : '點此採用') + '</button></div>';
    };

    box.innerHTML =
      '<div class="ps-top"><div><span>換約利潤（差價）</span><b>' + w(profit) + '</b></div>'
      + '<div><span>房地合一稅</span><b class="tax">' + w(use.tax) + '</b></div>'
      + '<div><span>屋主淨拿回現金</span><b class="back">' + w(use.back) + '</b></div>'
      + '<div><span>其中實際淨賺</span><b>' + w(use.net) + '</b></div></div>'
      + (profit < 0 ? '<p class="v-hint">換約價低於取得價，這筆是虧損，沒有房地合一稅（虧損可在三年內扣抵其他房地交易所得）。</p>' : '')
      + '<h3 class="ps-h3">列舉 vs 不列舉 — 點一欄採用</h3>'
      + '<div class="ps-cols">'
      + col('std', '不列舉費用', '成交價額 3%（上限 30 萬）', B)
      + col('item', '列舉費用', '憑證合計', A)
      + '</div>'
      + '<h3 class="ps-h3">計算明細</h3>'
      + '<table class="v-table ps-table"><tbody>'
      + '<tr><td>換約利潤（出售 − 取得）</td><td>' + w(profit) + '</td></tr>'
      + '<tr><td>成交價額＝已付款 ＋ 利潤</td><td>' + w(income) + '</td></tr>'
      + '<tr><td>取得成本＝已付款</td><td>' + w(paid) + '</td></tr>'
      + '<tr><td>服務費（出售 × ' + feeR + '%）</td><td>' + w(svc) + '</td></tr>'
      + '<tr><td>履保費（出售 × 萬分之三）</td><td>' + w(esc) + '</td></tr>'
      + '<tr><td>實價登錄申報費</td><td>' + w(reg) + '</td></tr>'
      + '<tr class="sum"><td>實際付出的費用合計</td><td>' + w(itemFee) + '</td></tr>'
      + '<tr><td>課稅所得（採用方案）</td><td>' + w(use.taxable) + '</td></tr>'
      + '<tr><td>房地合一稅（' + rate + '%）</td><td>' + w(use.tax) + '</td></tr>'
      + '<tr class="sum"><td>屋主淨拿回現金</td><td>' + w(use.back) + '</td></tr>'
      + '</tbody></table>'
      + '<button type="button" class="btn btn-line" data-rt-line="'
      + RT.esc('容瑜你好，我想問預售屋換約：\n・取得總價 ' + cost + ' 萬\n・已付款 ' + paid
        + ' 萬\n・想賣 ' + sell + ' 萬\n・估算房地合一稅 ' + w(use.tax) + '、實拿 ' + w(use.back)
        + '\n想問這樣賣划算嗎？')
      + '" data-toast="psToast">把我的數字丟給容瑜看</button>'
      + '<p class="v-note" id="psToast"></p>';
  }

  ['psCost', 'psPaid', 'psSell', 'psFeeR', 'psReg'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('input', calc);
  });
  var rb = $('psRate');
  if (rb) rb.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    pick('psRate', b.getAttribute('data-v')); calc();
  });
  var res = $('psResult');
  if (res) res.addEventListener('click', function (e) {
    var c = e.target.closest('.ps-col'); if (!c || !e.target.closest('.ps-use')) return;
    mode = c.getAttribute('data-plan'); calc();
  });
  var rst = $('psReset');
  if (rst) rst.addEventListener('click', function () {
    ['psCost', 'psPaid', 'psSell'].forEach(function (id) { $(id).value = ''; });
    calc();
  });
  var form = $('psForm');
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); calc(); });
  calc();
})();
