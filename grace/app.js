/* 寬限期到期試算：到期後月付會跳多少、續繳／轉貸／再延長三條路比較 */
(function () {
  var $ = RT.$, num = RT.val, yuan = RT.yuan, comma = RT.comma;

  // 轉貸費用預設值（元）；使用者可在頁面上改
  var FEE = { pen: 0.8, reg: 0.1, deed: 9000, apr: 3000, ins: 3000 };

  function pick(group, v) {
    [].forEach.call(document.querySelectorAll('#' + group + ' button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-v') === String(v) ? 'true' : 'false');
    });
  }
  function picked(group, def) {
    var b = document.querySelector('#' + group + ' button[aria-pressed="true"]');
    return b ? +b.getAttribute('data-v') : def;
  }

  function totalInterest(P, r, n) { return RT.pmt(P, r, n) * n - P; }

  function calc() {
    var bal = num('gBal') * 10000;
    var rate = num('gRate');
    var years = picked('gYears', 30);
    var grace = picked('gGrace', 3);
    var left = Math.max(0, num('gLeft'));          // 寬限期還剩幾個月
    var newY = picked('gNewY', 30);
    var newR = num('gNewR');

    var box = $('gResult');
    if (bal <= 0 || rate <= 0) {
      box.innerHTML = '<div class="v-empty"><b>結果會出現在這裡</b>'
        + '<p>填貸款餘額和利率就會自動算：<br>・現在只繳息是多少<br>・到期後月付跳到多少、跳幾倍'
        + '<br>・續繳、轉貸、再延長三條路的月付與總利息<br>・轉貸要花多少錢、幾個月回本</p></div>';
      return;
    }
    if (grace >= years) { box.innerHTML = '<div class="v-empty"><b>寬限期不能大於或等於總年期</b></div>'; return; }

    var payGrace = bal * rate / 1200;                       // 寬限期間：只繳息
    var nAfter = (years - grace) * 12;
    var payAfter = RT.pmt(bal, rate, nAfter);               // 到期後：剩餘年期攤還
    var jump = payAfter - payGrace;
    var times = payAfter / payGrace;

    // 路一：續繳
    var iKeep = totalInterest(bal, rate, nAfter);

    // 路二：轉貸重拉年期
    var nNew = newY * 12;
    var payNew = RT.pmt(bal, newR, nNew);
    var iNew = totalInterest(bal, newR, nNew);
    var cost = bal * FEE.pen / 100 + bal * 1.2 * FEE.reg / 100 + FEE.deed + FEE.apr + FEE.ins;
    var save = payAfter - payNew;
    var payback = save > 0 ? cost / save : null;

    // 路三：再延長寬限期 2 年
    var canExt = years - grace - 2 > 0;
    var nExt = (years - grace - 2) * 12;
    var payExt = canExt ? RT.pmt(bal, rate, nExt) : 0;
    var iExt = canExt ? payGrace * 24 + totalInterest(bal, rate, nExt) : 0;

    var expire = left > 0
      ? '<p class="g-when">距離到期還有 <b>' + comma(left) + '</b> 個月，等於還有 '
        + comma(Math.round(left * payGrace)) + ' 元的只繳息期間。</p>'
      : '';

    var road = function (cls, tag, name, pay, note, extra) {
      return '<div class="g-road ' + cls + '"><span class="g-tag">' + tag + '</span>'
        + '<h4>' + name + '</h4><strong>' + yuan(pay) + '</strong><span class="g-unit">／月</span>'
        + '<p>' + note + '</p>' + (extra || '') + '</div>';
    };

    box.innerHTML =
      '<div class="g-jump"><div class="g-now"><span>現在（只繳息）</span><b>' + yuan(payGrace) + '</b></div>'
      + '<div class="g-arrow">→</div>'
      + '<div class="g-next"><span>到期後（開始還本金）</span><b>' + yuan(payAfter) + '</b></div></div>'
      + '<p class="g-big">每月多繳 <b>' + yuan(jump) + '</b>，變成 <b>' + times.toFixed(2) + ' 倍</b>'
      + '，一年多 ' + yuan(jump * 12) + '</p>'
      + expire
      + '<p class="v-hint">原因：寬限期本金一毛沒少，' + years + ' 年的本金要壓縮在剩下的 '
      + (years - grace) + ' 年內還完。</p>'
      + '<h3 class="g-h3">三條路，數字攤開比</h3>'
      + '<div class="g-roads">'
      + road('r1', '路一', '咬牙續繳', payAfter,
          '不用付任何費用，本金開始下降，' + (years - grace) + ' 年後清償。',
          '<small>剩餘期間總利息 ' + yuan(iKeep) + '</small>')
      + road('r2', '路二', '轉貸重拉 ' + newY + ' 年', payNew,
          save > 0 ? '每月少繳 ' + yuan(save) + '，但年期拉長、總利息會變多。'
                   : '以這個利率和年期，月付沒有比較低。',
          '<small>轉貸成本約 ' + yuan(cost) + (payback ? '，約 ' + Math.ceil(payback) + ' 個月回本' : '')
          + '<br>新約總利息 ' + yuan(iNew) + '</small>')
      + (canExt ? road('r3', '路三', '再延長寬限 2 年', payGrace,
          '前 2 年仍只繳息，第 3 年起跳到 ' + yuan(payExt) + '，是爭取時間不是省錢。',
          '<small>總利息 ' + yuan(iExt) + '（比續繳多 ' + yuan(iExt - iKeep) + '）</small>')
        : '<div class="g-road r3 off"><span class="g-tag">路三</span><h4>再延長寬限 2 年</h4>'
          + '<p>剩餘年期不夠，延長後攤還期太短，不建議。</p></div>')
      + '</div>'
      + '<div class="g-cost"><b>轉貸成本怎麼估的</b><ul>'
      + '<li>提前清償違約金 ' + FEE.pen + '%（綁約期內才有）　' + yuan(bal * FEE.pen / 100) + '</li>'
      + '<li>塗銷＋設定規費（設定金額＝貸款 1.2 倍 × ' + FEE.reg + '%）　' + yuan(bal * 1.2 * FEE.reg / 100) + '</li>'
      + '<li>代書費　' + yuan(FEE.deed) + '</li>'
      + '<li>銀行鑑價／手續費　' + yuan(FEE.apr) + '</li>'
      + '<li>火險地震險重投保（年繳）　' + yuan(FEE.ins) + '</li>'
      + '</ul><p>實際金額看你的銀行與代書報價，綁約期已過就沒有違約金。</p></div>'
      + '<button type="button" class="btn btn-line" data-rt-line="'
      + RT.esc('容瑜你好，我的寬限期快到期了：\n・貸款餘額 ' + comma(bal / 10000) + ' 萬\n・利率 ' + rate
        + '%\n・總年期 ' + years + ' 年、寬限期 ' + grace + ' 年\n・到期後月付約 ' + yuan(payAfter)
        + '\n想問我適合走哪一條路？')
      + '" data-toast="gToast">把我的數字丟給容瑜看</button>'
      + '<p class="v-note" id="gToast"></p>';
  }

  ['gBal', 'gRate', 'gLeft', 'gNewR'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('input', calc);
  });
  ['gYears', 'gGrace', 'gNewY'].forEach(function (g) {
    var box = $(g); if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      pick(g, b.getAttribute('data-v')); calc();
    });
  });
  var form = $('gForm'); if (form) form.addEventListener('submit', function (e) { e.preventDefault(); calc(); });
  calc();
})();
