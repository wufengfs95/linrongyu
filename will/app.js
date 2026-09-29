/* 遺囑樣本產生器：自書遺囑抄寫樣本 ＋ 要件檢核 ＋ 特留分檢查 */
(function () {
  var $ = RT.$, num = RT.val;
  var NEWLAW = '2027-02-17';          // 民法 1223 修正施行日
  var rows = [];                      // 財產清單
  var seq = 0;

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function frac(n, d) { var g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : n + '/' + d; }
  function fw(v) { return RT.comma(Math.round(v * 10) / 10, v < 100 ? 1 : 0) + ' 萬'; }

  function family() {
    return { spouse: $('wlSpouse').value === '1', kid: num('wlKid'), par: num('wlPar'),
             sib: num('wlSib'), gp: num('wlGp') };
  }

  // 應繼分（民法 1138、1141、1144）；回傳每個「人」一筆
  function heirs(f) {
    var D = 10080, out = [];
    var order = f.kid > 0 ? 1 : f.par > 0 ? 2 : f.sib > 0 ? 3 : f.gp > 0 ? 4 : 0;
    var n = [0, f.kid, f.par, f.sib, f.gp][order] || 0;
    var label = { 1: '子女', 2: '父母', 3: '兄弟姊妹', 4: '祖父母' }[order];
    var add = function (name, each, kind) { out.push({ name: name, each: each, kind: kind, order: order }); };
    if (!f.spouse && !order) return { list: [], D: D, order: 0 };
    if (!order) { add('配偶', D, 'spouse'); return { list: out, D: D, order: 0 }; }
    if (!f.spouse) {
      for (var i = 1; i <= n; i++) add(label + (n > 1 ? i : ''), D / n, 'heir');
    } else if (order === 1) {
      var per = D / (n + 1);
      add('配偶', per, 'spouse');
      for (var j = 1; j <= n; j++) add(label + (n > 1 ? j : ''), per, 'heir');
    } else if (order === 2 || order === 3) {
      add('配偶', D / 2, 'spouse');
      for (var k = 1; k <= n; k++) add(label + (n > 1 ? k : ''), D / 2 / n, 'heir');
    } else {
      add('配偶', D * 2 / 3, 'spouse');
      for (var m = 1; m <= n; m++) add(label + (n > 1 ? m : ''), D / 3 / n, 'heir');
    }
    return { list: out, D: D, order: order };
  }

  function reserveRate(h, newLaw) {
    if (h.kind === 'spouse') return 0.5;
    if (h.order === 1 || h.order === 2) return 0.5;
    if (h.order === 3) return newLaw ? 0 : 1 / 3;
    if (h.order === 4) return 1 / 3;
    return 0;
  }

  // ---- 財產清單 ----
  function whoOptions(sel) {
    var hs = heirs(family()).list;
    return hs.map(function (h) {
      return '<option' + (h.name === sel ? ' selected' : '') + '>' + RT.esc(h.name) + '</option>';
    }).join('') + '<option value="__other"' + (sel === '__other' ? ' selected' : '') + '>其他人（自己填）</option>';
  }

  function drawRows() {
    var box = $('wlRows');
    box.innerHTML = rows.map(function (r) {
      return '<div class="wl-row" data-id="' + r.id + '">'
        + '<button type="button" class="wl-del" aria-label="刪除這一筆">✕</button>'
        + '<div class="field"><label>是什麼<span class="rt-small">門牌，或大家聽得懂的叫法</span></label>'
        + '<input type="text" class="wl-what" value="' + RT.esc(r.what) + '" placeholder="例：中壢區林森路○號○樓"></div>'
        + '<div class="row2"><div class="field"><label>給誰</label>'
        + '<select class="wl-who">' + whoOptions(r.who) + '</select>'
        + (r.who === '__other' ? '<input type="text" class="wl-other" value="' + RT.esc(r.other || '')
            + '" placeholder="寫下姓名與關係">' : '')
        + '</div>'
        + '<div class="field"><label>大約值多少（萬，可不填）</label>'
        + '<input type="number" class="wl-val" value="' + (r.val || '') + '" placeholder="填了才能檢查特留分"></div></div>'
        + '</div>';
    }).join('') || '<p class="wl-none">還沒有加任何財產。先填最重要的那幾樣就好，沒列到的統一寫在「其餘財產」。</p>';
  }

  function addRow(what) {
    rows.push({ id: ++seq, what: what || '', who: (heirs(family()).list[0] || {}).name || '', other: '', val: '' });
    drawRows(); render();
  }

  function readRows() {
    [].forEach.call(document.querySelectorAll('.wl-row'), function (el) {
      var id = +el.getAttribute('data-id');
      var r = rows.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      r.what = el.querySelector('.wl-what').value;
      r.who = el.querySelector('.wl-who').value;
      var o = el.querySelector('.wl-other');
      r.other = o ? o.value : '';
      r.val = el.querySelector('.wl-val').value;
    });
  }

  function whoName(r) { return r.who === '__other' ? (r.other || '（請填姓名）') : r.who; }
  // 樣本上要留姓名空格：抄的時候一定要寫真實姓名，不能只寫「配偶」
  function whoInWill(r) {
    return r.who === '__other' ? (r.other || '＿＿＿＿＿＿')
                               : r.who + '（姓名：＿＿＿＿＿＿）';
  }
  var CN = '〇一二三四五六七八九';
  function cn(n) {
    if (n <= 10) return n === 10 ? '十' : CN[n];
    if (n < 20) return '十' + CN[n - 10];
    return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  }

  // ---- 產生遺囑本文 ----
  function willText(f, hs, newLaw) {
    var name = $('wlName').value.trim() || '＿＿＿＿＿＿';
    var rest = $('wlRest').value;
    var exec = $('wlExec').value.trim();
    var fun = $('wlFun').value;
    var word = $('wlWord').value.trim();
    var L = [];
    L.push('遺　囑');
    L.push('');
    L.push('立遺囑人　' + name + '，為預先安排身後財產，避免家人爭議，');
    L.push('依民法第一千一百九十條規定，親筆自書本遺囑如下：');
    L.push('');
    var n = 0;
    var listed = rows.filter(function (r) { return r.what; });
    listed.forEach(function (r) {
      n++;
      L.push(cn(n) + '、本人所有之「' + r.what + '」，由 ' + whoInWill(r) + ' 單獨繼承取得。');
      L.push('');
    });
    n++;
    L.push(cn(n) + '、除前' + (listed.length ? '各' : '') + '條列舉者外，本人其餘一切財產'
      + '（含存款、保險金、動產及其他權利），'
      + (rest === 'one' ? '全部由 ' + ($('wlRestWho').value.trim() || '＿＿＿＿＿＿') + ' 繼承取得。'
                        : '由全體繼承人依民法所定應繼分共同繼承。'));
    L.push('');
    if (exec) {
      n++;
      L.push(cn(n) + '、本遺囑指定 ' + exec + ' 為遺囑執行人，處理本人遺產之管理、清償債務、稅捐申報與分割等事宜。');
      L.push('');
    }
    if (fun && fun !== 'none') {
      n++;
      L.push(cn(n) + '、本人身後事宜，願採' + fun + '，一切從簡，請家人依此辦理。');
      L.push('');
    }
    if (word) {
      L.push('　　' + word);
      L.push('');
    }
    L.push('　　　　　　　　　立遺囑人（親自簽名）：＿＿＿＿＿＿＿＿');
    L.push('');
    L.push('　　　　　　　　　身分證統一編號：＿＿＿＿＿＿＿＿＿');
    L.push('');
    L.push('　　　　　　　　　住　　址：＿＿＿＿＿＿＿＿＿＿＿＿');
    L.push('');
    L.push('　　　　　　　中華民國 ＿＿＿ 年 ＿＿ 月 ＿＿ 日');
    return L.join('\n');
  }

  function render() {
    readRows();
    var f = family();
    var died = $('wlDied').value;
    var newLaw = died >= NEWLAW;
    var H = heirs(f);
    var box = $('wlResult');

    if ($('wl16').value === '0') {
      box.innerHTML = '<div class="wl-block bad"><b>未滿 16 歲不能立遺囑</b>'
        + '<p>民法第 1186 條：無行為能力人不得為遺囑；限制行為能力人無須法定代理人之允許得為遺囑，'
        + '但未滿 16 歲者不得為遺囑。滿 16 歲之後再來立。</p></div>';
      return;
    }
    if (!H.list.length) {
      box.innerHTML = '<div class="v-empty"><b>樣本會出現在這裡</b>'
        + '<p>先填「家裡有誰」，再加上想指定的財產，就會產生：'
        + '<br>・可以照抄的自書遺囑全文<br>・寫錯就無效的要件檢核<br>・每個人最少要留多少的特留分檢查</p></div>';
      return;
    }

    // 特留分檢查
    var total = rows.reduce(function (s, r) { return s + (parseFloat(r.val) || 0); }, 0);
    var got = {};
    rows.forEach(function (r) { var k = whoName(r); got[k] = (got[k] || 0) + (parseFloat(r.val) || 0); });
    var restOne = $('wlRest').value === 'one';
    var check = '';
    if (total > 0) {
      var bad = [];
      var lines = H.list.map(function (h) {
        var rate = reserveRate(h, newLaw);
        var need = total * (h.each / H.D) * rate;
        var mine = got[h.name] || 0;
        if (!restOne) mine += 0;                       // 其餘財產依應繼分，這裡只檢查已列舉的部分
        var ok = !rate || mine >= need - 0.5;
        if (!ok) bad.push(h.name);
        return '<tr class="' + (ok ? '' : 'short') + '"><td>' + h.name + '</td>'
          + '<td>' + frac(h.each, H.D) + '</td>'
          + '<td>' + (rate ? fw(need) : '無特留分') + '</td>'
          + '<td>' + fw(mine) + '</td>'
          + '<td>' + (rate ? (ok ? '✓ 足夠' : '⚠ 少了 ' + fw(need - mine)) : '—') + '</td></tr>';
      }).join('');
      check = '<div class="wl-block"><b>特留分檢查</b>'
        + '<p>已列舉財產合計 ' + fw(total) + '。特留分是法律保障每個繼承人最少能拿到的部分，'
        + '分配低於特留分時，被侵害的人可以依民法第 1225 條主張扣減。</p>'
        + '<table class="v-table wl-table"><thead><tr><th>繼承人</th><th>應繼分</th>'
        + '<th>特留分至少</th><th>本遺囑給</th><th>檢查</th></tr></thead><tbody>' + lines + '</tbody></table>'
        + (bad.length
            ? '<p class="wl-warn">⚠ <b>' + bad.join('、') + '</b> 分到的低於特留分。'
              + '這份遺囑仍然有效，但他們可以主張扣減，實務上很容易變成訴訟。'
              + '要嘛調整分配，要嘛先把人找齊講清楚。</p>'
            : '<p class="wl-ok">✓ 每個繼承人都拿到特留分以上，不會有扣減的問題。</p>')
        + (!restOne ? '<p class="wl-note">「其餘財產依應繼分共同繼承」的部分沒有計入上表，'
            + '實際上還會再往上加。</p>' : '');
    }

    var text = willText(f, H.list, newLaw);
    box.innerHTML =
      '<div class="wl-block warn"><b>⚠ 這份是「抄寫樣本」，不是可以直接用的遺囑</b>'
      + '<p>民法第 1190 條：<b>自書遺囑者，應自書遺囑全文，記明年、月、日，並親自簽名。</b>'
      + '列印出來簽名<b>不算</b>自書遺囑，一定要一字一字<b>親手抄寫</b>在紙上。'
      + '抄的時候請把「配偶」「子女1」換成<b>真實姓名</b>，房子也要把門牌、建號寫清楚，避免日後爭議。'
      + '不想抄，就去找公證人辦公證遺囑，或找律師辦代筆遺囑。</p></div>'
      + '<div class="wl-block"><b>抄寫樣本</b>'
      + '<textarea id="wlText" class="wl-text" rows="18" readonly>' + RT.esc(text) + '</textarea>'
      + '<button type="button" class="btn btn-main" id="wlCopy">複製全文</button>'
      + '<span class="wl-toast" id="wlToast"></span></div>'
      + check
      + '<div class="wl-block"><b>自書遺囑要件檢核（寫錯就無效）</b><ul class="wl-check">'
      + '<li><b>全文親手寫</b>　從頭到尾自己寫，不能打字列印、不能請人代寫、不能用影印本。</li>'
      + '<li><b>記明年、月、日</b>　三者缺一不可，只寫「民國○年○月」會有爭議。</li>'
      + '<li><b>親自簽名</b>　要簽名，不是只蓋章。實務上建議簽名並加蓋印章。</li>'
      + '<li><b>改錯要註明</b>　有增減、塗改，要註明增減、塗改的處所及字數，並<b>另行簽名</b>。'
      + '寫錯建議整張重寫，比註明更保險。</li>'
      + '<li><b>滿 16 歲</b>　民法第 1186 條，未滿 16 歲不得為遺囑。</li>'
      + '<li><b>正本要收好</b>　自書遺囑只有一份正本，弄丟就沒了。可以交給遺囑執行人或信得過的人保管，'
      + '也可以到法院或民間公證人處辦理提存或公證。</li>'
      + '</ul></div>'
      + '<div class="wl-block"><b>不想自己抄？還有這些方式</b><ul class="wl-check">'
      + '<li><b>公證遺囑</b>（民法 1191）　指定 2 人以上見證人，在公證人前口述，由公證人筆記、宣讀、講解。'
      + '最不容易被推翻，要付公證費。</li>'
      + '<li><b>代筆遺囑</b>（民法 1194）　指定 <b>3 人以上</b>見證人，由其中一人筆記、宣讀、講解，'
      + '全體見證人與遺囑人同行簽名。遺囑人不能簽名時按指印。</li>'
      + '<li><b>誰不能當見證人</b>（民法 1198）　未成年人、受監護或輔助宣告之人、'
      + '<b>繼承人及其配偶或直系血親</b>、<b>受遺贈人及其配偶或直系血親</b>、'
      + '公證人的同居人助理人或受僱人。找家人當見證人是最常見的無效原因。</li>'
      + '</ul></div>'
      + '<button type="button" class="btn btn-line" data-rt-line="'
      + RT.esc('容瑜你好，我想先把房子的事安排好：\n・'
        + (f.spouse ? '有配偶' : '沒有配偶') + '、子女 ' + f.kid + ' 人、父母 ' + f.par
        + ' 人、兄弟姊妹 ' + f.sib + ' 人\n・想問房子要怎麼寫進遺囑、需要先做什麼')
      + '" data-toast="wlToast2">房子的部分想先問容瑜</button>'
      + '<p class="v-note" id="wlToast2"></p>';
  }

  // ---- 事件 ----
  ['wlName', 'wlKid', 'wlPar', 'wlSib', 'wlGp', 'wlExec', 'wlWord', 'wlRestWho'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('input', render);
  });
  ['wlSpouse', 'wl16', 'wlDied', 'wlFun', 'wlRest'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('change', function () {
      if (id === 'wlRest') $('wlRestWrap').hidden = this.value !== 'one';
      if (id === 'wlSpouse' || id === 'wlKid') drawRows();
      render();
    });
  });
  document.querySelectorAll('.wl-step').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = $(b.getAttribute('data-t'));
      t.value = Math.max(0, (parseInt(t.value, 10) || 0) + (+b.getAttribute('data-d')));
      drawRows(); render();
    });
  });
  var addH = $('wlAddHouse'), addO = $('wlAddOther');
  if (addH) addH.addEventListener('click', function () { addRow(''); });
  if (addO) addO.addEventListener('click', function () { addRow(''); });
  var rowsBox = $('wlRows');
  if (rowsBox) {
    rowsBox.addEventListener('input', render);
    rowsBox.addEventListener('change', function (e) {
      if (e.target.classList.contains('wl-who')) { readRows(); drawRows(); }
      render();
    });
    rowsBox.addEventListener('click', function (e) {
      var d = e.target.closest('.wl-del'); if (!d) return;
      var id = +d.closest('.wl-row').getAttribute('data-id');
      rows = rows.filter(function (x) { return x.id !== id; });
      drawRows(); render();
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'wlCopy') RT.copy($('wlText').value, $('wlToast'), '已複製，貼到手機備忘錄再照抄。');
  });
  var dd = $('wlDied');
  if (dd && !dd.value) {
    var d = new Date();
    dd.value = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  var form = $('wlForm');
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); render(); });
  drawRows();
  render();
})();
