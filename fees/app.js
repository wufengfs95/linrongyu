/* 買賣雜費試算：代書、規費這些每家收費不同，所以算區間不是單一數字 */
(function () {
  var RT = window.RT, $ = RT.$, esc = RT.esc;
  var role = 'buyer';

  function setRole(r) {
    role = r;
    document.querySelectorAll('#feRole button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-r') === r ? 'true' : 'false');
    });
    $('feDeedWrap').hidden = r !== 'buyer';     // 契稅是買方在繳
    $('feEraWrap').hidden = r !== 'seller';
    $('feLoanText').textContent = r === 'buyer' ? '有辦房貸（要設定銀行抵押權）' : '原本有房貸（要塗銷抵押權）';
    calc();
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
        + '<p>填成交總價，就會逐項列出買方或賣方要付的雜費，以及合計大約落在多少到多少。</p></div>';
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
      + '<p class="v-note">以上是區間估算，代書費與規費依各事務所和實際稅單為準；標「依稅單」的項目沒有算進合計。'
      + (buyer ? '另外還有銀行開辦費、火險地震險等貸款相關費用，依各家銀行規定。'
               : '土地增值稅與房地合一稅金額差很多，簽約前可以先請代書試算。') + '</p>'
      + '<a class="btn btn-line v-cta" href="' + RT.LINE_URL + '" target="_blank" rel="noopener"'
      + ' data-rt-line="容瑜你好，我想問買賣雜費：成交總價 ' + RT.val('feTotal') + ' 萬，我是'
      + (buyer ? '買方' : '賣方') + '，想確認實際要準備多少。" data-toast="feToast">把這筆試算傳給容瑜</a>'
      + '<p class="toast" id="feToast" role="status"></p>';
  }

  document.querySelectorAll('#feRole button').forEach(function (b) {
    b.addEventListener('click', function () { setRole(b.getAttribute('data-r')); });
  });
  ['feTotal', 'feDeed', 'feExtra'].forEach(function (id) { $(id).addEventListener('input', calc); });
  $('feEra').addEventListener('change', calc);
  $('feLoan').addEventListener('change', calc);

  setRole('buyer');
})();
