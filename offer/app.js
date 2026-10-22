/* 出價試算：各家銀行估價×成數 → 可貸金額；每個出價要準備多少現金（頭期＋服務費＋其他）、新青安與首購月付 */
(function () {
  var $ = RT.$, num = RT.val, esc = RT.esc, comma = RT.comma;

  // 新青安 3.0：前 3 年一段式 1.775%、最長 40 年、額度一般 1,000 萬（財政部國庫署公告，2026-09-29 核對；變動時也要改 build.py 出價試算頁的「青安 3.0 重點整理」表）
  var QA = { rate: 1.775, years: 40, cap: 1000 };
  var KEY = 'rt-offer';
  // 使用者要求：填的數字一律不保存（重新整理或關掉網頁就清空，每次解鎖都是空白的）
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}   // 舊版存過的數字一併清掉
  var EXAMPLE = [{ name: '', val: 0, ratio: 0 }, { name: '', val: 0, ratio: 0 }, { name: '', val: 0, ratio: 0 }];
  var nm = function (b) { return b.name || ('第 ' + (banks.indexOf(b) + 1) + ' 家'); };
  var FIELDS = ['oFrom', 'oTo', 'oStep', 'oFee', 'oOther', 'oQaRate', 'oQaYears', 'oQaGrace', 'oFgRate', 'oFgYears', 'oFgGrace', 'oArea', 'oParkA', 'oParkP', 'oGvRate', 'oGvYears', 'oGvGrace'];

  var saved = null;
  var banks = saved && saved.banks && saved.banks.length ? saved.banks : EXAMPLE.map(function (b) { return Object.assign({}, b); });
  var pick = saved && saved.pick != null ? saved.pick : -1;     // -1＝自動用可貸最多的那家
  var picked = null;
  if (saved) FIELDS.forEach(function (id) { if (saved[id] != null && saved[id] !== '') $(id).value = saved[id]; });
  if (saved && saved.lower === false) $('oLower').checked = false;

  function save() {
    var s = { banks: banks, pick: pick, lower: $('oLower').checked };
    FIELDS.forEach(function (id) { s[id] = $(id).value; });
    return s;
  }
  var w1 = function (v) { return comma(Math.round(v * 10) / 10, (Math.round(v * 10) % 10) ? 1 : 0); };
  var loanOf = function (b) { return b.val * b.ratio / 100; };
  function bestIdx() {
    var m = 0;
    banks.forEach(function (b, i) { if (loanOf(b) > loanOf(banks[m])) m = i; });
    return m;
  }
  var cur = function () { return pick >= 0 && pick < banks.length ? pick : bestIdx(); };

  // ---- 銀行估價列 ----
  function drawBanks() {
    $('oBanks').innerHTML = banks.map(function (b, i) {
      return '<div class="of-bank" data-i="' + i + '">'
        + '<div class="field of-name"><label for="obn' + i + '">銀行</label><input type="text" id="obn' + i + '" data-k="name" placeholder="例：土地銀行" value="' + esc(b.name) + '"></div>'
        + '<div class="field"><label for="obv' + i + '">估價（萬）</label><input type="number" id="obv' + i + '" data-k="val" inputmode="decimal" placeholder="例：740" value="' + (b.val || '') + '"></div>'
        + '<div class="field"><label for="obr' + i + '">成數（%）</label><input type="number" id="obr' + i + '" data-k="ratio" inputmode="decimal" placeholder="例：80" value="' + (b.ratio || '') + '"></div>'
        + '<div class="of-out"><span>可貸</span><b id="obo' + i + '">' + w1(loanOf(b)) + ' 萬</b></div>'
        + '<button type="button" class="rt-x" data-del="' + i + '" aria-label="刪除' + esc(nm(b)) + '"' + (banks.length < 2 ? ' disabled' : '') + '>×</button>'
        + '</div>';
    }).join('');
    drawPick();
  }
  function drawPick() {
    var best = bestIdx();
    $('oPick').innerHTML = '<option value="-1">自動：可貸最多的那家</option>' + banks.map(function (b, i) {
      return '<option value="' + i + '">' + esc(nm(b)) + (loanOf(b) ? '（可貸 ' + w1(loanOf(b)) + ' 萬）' : '（還沒填）') + (i === best ? '★' : '') + '</option>';
    }).join('');
    $('oPick').value = String(pick < banks.length ? pick : -1);
  }
  $('oBanks').addEventListener('input', function (e) {
    var row = e.target.closest('.of-bank'); if (!row) return;
    var i = +row.getAttribute('data-i'), k = e.target.getAttribute('data-k');
    banks[i][k] = k === 'name' ? e.target.value : RT.num(e.target.value);
    $('obo' + i).textContent = w1(loanOf(banks[i])) + ' 萬';
    drawPick(); calc();
  });
  $('oBanks').addEventListener('click', function (e) {
    var d = e.target.closest('[data-del]'); if (!d) return;
    banks.splice(+d.getAttribute('data-del'), 1);
    if (pick >= banks.length) pick = -1;
    drawBanks(); calc();
  });
  $('oAdd').addEventListener('click', function () {
    banks.push({ name: '', val: 0, ratio: 0 });
    drawBanks(); calc();
    var last = $('obv' + (banks.length - 1)); if (last) last.focus();
  });
  $('oPick').addEventListener('change', function () { pick = +this.value; calc(); });
  $('oForm').addEventListener('input', function (e) { if (!e.target.closest('.of-bank')) calc(); });
  $('oForm').addEventListener('change', function (e) {
    if (e.target.id === 'oGov') $('oGovBox').hidden = !e.target.checked;
    if (e.target.id === 'oLower' || e.target.id === 'oGov') calc();
  });
  $('oForm').addEventListener('submit', function (e) { e.preventDefault(); });

  // ---- 計算 ----
  function rows() {
    var b = banks[cur()], out = [];
    var from = num('oFrom'), to = num('oTo'), step = Math.max(1, num('oStep'));
    if (to < from) to = from;
    var qaR = num('oQaRate'), qaY = num('oQaYears'), qaG = num('oQaGrace');
    var fgR = num('oFgRate'), fgY = num('oFgYears'), fgG = num('oFgGrace');
    var gov = $('oGov').checked, gvR = num('oGvRate'), gvY = num('oGvYears'), gvG = num('oGvGrace');
    for (var p = from; p <= to + 1e-9 && out.length < 40; p += step) {
      var base = $('oLower').checked ? Math.min(b.val, p) : b.val;
      var loan = Math.max(0, Math.min(base * b.ratio / 100, p));
      var fee = p * num('oFee') / 100, other = num('oOther');
      var qaLoan = Math.min(loan, QA.cap), rest = loan - qaLoan;
      var restPay = rest > 0 ? RT.pmt(rest * 1e4, fgR, (fgY - fgG) * 12) : 0;
      var houseA = num('oArea') - num('oParkA');
      out.push({
        unit: num('oArea') > 0 && houseA > 0 ? (p - num('oParkP')) / houseA : null,
        p: p, loan: loan, down: p - loan, fee: fee, other: other, cash: p - loan + fee + other,
        qa: RT.pmt(qaLoan * 1e4, qaR, (qaY - qaG) * 12) + restPay,
        fg: RT.pmt(loan * 1e4, fgR, (fgY - fgG) * 12),
        qaG: qaG > 0 ? qaLoan * 1e4 * qaR / 1200 + (rest > 0 ? rest * 1e4 * fgR / 1200 : 0) : null,
        fgG: fgG > 0 ? loan * 1e4 * fgR / 1200 : null,
        gv: gov ? RT.pmt(loan * 1e4, gvR, (gvY - gvG) * 12) : null,
        gvG: gov && gvG > 0 ? loan * 1e4 * gvR / 1200 : null,
        over: rest > 0
      });
    }
    return { b: b, out: out };
  }

  function calc() {
    var r = rows(), b = r.b, out = r.out;
    if (!b || !b.val || !b.ratio || num('oFrom') <= 0 || !out.length) {
      $('oResult').innerHTML = '<div class="v-empty"><b>結果會出現在這裡</b><p>填至少一家銀行的估價和成數，再填出價範圍（從幾萬到幾萬），就會列出每個出價：<br>・可以貸多少<br>・頭期款＋服務費，總共要準備多少現金<br>・新青安 3.0、一般首購每月各繳多少</p></div>';
      save(); return;
    }
    var qaG = num('oQaGrace'), fgG = num('oFgGrace');
    var hasUnit = out[0].unit != null, hasGov = out[0].gv != null;
    var head = '<p class="of-basis">依 <b>' + esc(nm(b)) + '</b> 估價 ' + w1(b.val) + ' 萬、貸 ' + w1(b.ratio) + '%（可貸 ' + w1(loanOf(b)) + ' 萬）'
      + ($('oLower').checked ? '，出價低於估價時用出價算' : '') + '</p>'
      + (hasUnit ? '<p class="of-basis">車位拆算：權狀 ' + w1(num('oArea')) + ' 坪，扣車位 ' + w1(num('oParkA')) + ' 坪、' + w1(num('oParkP')) + ' 萬，房屋 ' + w1(num('oArea') - num('oParkA')) + ' 坪</p>' : '');
    var u = function (v, t) { return v + '<i class="of-u">' + t + '</i>'; };
    var tb = out.map(function (x) {
      return '<tr class="' + (picked === x.p ? 'rt-on' : '') + '" data-p="' + x.p + '" tabindex="0">'
        + '<td><b>' + u(w1(x.p), '萬') + '</b></td><td>' + u(w1(x.loan), '萬') + '</td><td>' + u(w1(x.down), '萬') + '</td><td>' + u(w1(x.fee), '萬') + '</td>'
        + (x.other ? '<td>' + u(w1(x.other), '萬') + '</td>' : '<td>—</td>')
        + '<td class="of-cash">' + u(w1(x.cash), '萬') + '</td>'
        + '<td class="of-qa">' + u(comma(Math.round(x.qa)), '元') + (x.qaG ? '<small>寬限 ' + comma(Math.round(x.qaG)) + ' 元</small>' : '') + '</td>'
        + '<td class="of-fg">' + u(comma(Math.round(x.fg)), '元') + (x.fgG ? '<small>寬限 ' + comma(Math.round(x.fgG)) + ' 元</small>' : '') + '</td>'
        + (hasGov ? '<td class="of-gv">' + u(comma(Math.round(x.gv)), '元') + (x.gvG ? '<small>寬限 ' + comma(Math.round(x.gvG)) + ' 元</small>' : '') + '</td>' : '')
        + (hasUnit ? '<td class="of-unit">' + u(comma(x.unit, 1), '萬/坪') + '</td>' : '') + '</tr>';
    }).join('');
    var notes = [];
    if (out.some(function (x) { return x.over; })) notes.push('可貸超過新青安 3.0 額度 ' + comma(QA.cap) + ' 萬，超過的部分用首購利率另計，已加進新青安 3.0 月付');
    if (out.some(function (x) { return x.p > b.val; })) notes.push('出價超過估價後，銀行能貸的錢不會再變多，多出來的都是自備款');
    if (qaG > 0 || fgG > 0 || (hasGov && num('oGvGrace') > 0)) notes.push('「寬限」是寬限期內只繳利息的金額，寬限期結束後月付為上面的數字');
    $('oResult').innerHTML = head
      + '<div class="v-table-wrap"><table class="v-table of-table"><thead><tr><th>出價</th><th>可貸</th><th>頭期款</th><th>服務費</th><th>其他</th><th>要準備</th><th>新青安 3.0 月付</th><th>首購月付</th>' + (hasGov ? '<th>公教房貸月付</th>' : '') + (hasUnit ? '<th>房屋單價<br><small>扣車位</small></th>' : '') + '</tr></thead>'
      + '<tbody>' + tb + '</tbody></table></div>'
      + '<p class="v-hint">點一列可以只挑那個出價產生文字</p>'
      + (notes.length ? '<ul class="rt-list of-notes">' + notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>' : '')
      + '<h3 class="rt-h3">傳給買方的文字</h3>'
      + '<textarea class="rt-talk" id="oMsg" rows="9" aria-label="給買方的試算文字">' + esc(msg(b, out)) + '</textarea>'
      + '<div class="rt-actions"><button type="button" class="btn btn-main" id="oCopy">複製文字</button>'
      + '<button type="button" class="btn btn-line" id="oLine">傳給容瑜幫你看</button></div><p class="v-hint" id="oToast" role="status"></p>';
    save();
  }

  function msg(b, out) {
    var list = picked != null ? out.filter(function (x) { return x.p === picked; }) : out;
    if (!list.length) list = out;
    var t = '【出價資金試算】\n貸款以估價 ' + w1(b.val) + ' 萬、貸 ' + w1(b.ratio) + '% 計算\n';
    list.forEach(function (x) {
      t += '\n▍出價 ' + w1(x.p) + ' 萬\n・可貸約 ' + w1(x.loan) + ' 萬\n・頭期款 ' + w1(x.down) + ' 萬＋服務費 ' + w1(x.fee) + ' 萬'
        + (x.other ? '＋其他 ' + w1(x.other) + ' 萬' : '') + '\n・要準備約 ' + w1(x.cash) + ' 萬\n'
        + (x.unit != null ? '・扣車位房屋單價約 ' + comma(x.unit, 1) + ' 萬/坪\n' : '')
        + '・月付：新青安 3.0 約 ' + comma(Math.round(x.qa)) + ' 元／首購約 ' + comma(Math.round(x.fg)) + ' 元'
        + (x.gv != null ? '／公教房貸約 ' + comma(Math.round(x.gv)) + ' 元' : '') + '\n';
    });
    return t + '\n※新青安 3.0 利率 ' + num('oQaRate') + '%、' + num('oQaYears') + ' 年；首購 ' + num('oFgRate') + '%、' + num('oFgYears')
      + ' 年' + ($('oGov').checked ? '；公教房貸（築巢優利貸）' + num('oGvRate') + '%、' + num('oGvYears') + ' 年' : '')
      + '，本息平均攤還，實際成數與利率以銀行核貸為準';
  }

  $('oResult').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-p]');
    if (tr) { var p = +tr.getAttribute('data-p'); picked = picked === p ? null : p; calc(); return; }
    if (e.target.id === 'oCopy') RT.copy($('oMsg').value, $('oToast'));
    if (e.target.id === 'oLine') RT.line($('oMsg').value, $('oToast'));
  });
  $('oResult').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('tr[data-p]')) e.target.click();
  });

  // ---- 首購利率：讀 dti/rates.json（每季排程更新）----
  fetch('../dti/rates.json?v=' + ($('oRates').getAttribute('data-v') || ''))
    .then(function (r) { return r.json(); }).then(function (d) {
      // 八大行庫全部列出（照慣用順序）；官網沒公告利率的也列，但不能選
      var EIGHT = ['臺灣銀行', '土地銀行', '合作金庫', '第一銀行', '華南銀行', '彰化銀行', '兆豐銀行', '臺灣企銀'];
      var eight = EIGHT.map(function (n) {
        var b = d.banks.filter(function (x) { return x.bank === n; })[0];
        if (!b || b.rate == null) return '<option value="" disabled>' + esc(n) + '：官網未公告，依個案核定</option>';
        return '<option value="' + b.rate + '">' + esc(n) + '（' + esc(b.plan) + '）：' + b.rate + '% 起</option>';
      }).join('');
      $('oRates').innerHTML = '<option value="">挑一家銀行帶入利率…</option>'
        + '<optgroup label="八大行庫">' + eight + '</optgroup>'
        + '<optgroup label="參考"><option value="' + d.avg.rate + '">' + esc(d.avg.label) + '（' + esc(d.avg.month) + '）：' + d.avg.rate + '%</option></optgroup>';
      $('oRatesNote').textContent = '利率資料 ' + d.updated + ' 更新，來源為各銀行官網與中央銀行';
    }).catch(function () { $('oRates').hidden = true; });
  $('oRates').addEventListener('change', function () { if (this.value) { $('oFgRate').value = this.value; calc(); } });

  if (!saved) { $('oQaRate').value = QA.rate; $('oQaYears').value = QA.years; }
  drawBanks(); calc();
})();
