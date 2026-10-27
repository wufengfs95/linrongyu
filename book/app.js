/* 線上預約：選日期時段、留需求，一鍵複製後開 LINE 送出 */
(function () {
  var $ = RT.$;
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var SLOTS = {                       // 平日與假日的可約時段
    wd: ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '19:00', '20:00'],
    we: ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
  };
  var picked = { date: null, time: null };
  var BUSY = null;                    // 行事曆上已經有事的時段，[[開始, 結束], ...]
  var AHEAD = 60;                     // 最多可以約到 60 天後
  var view = null;                    // 月曆現在顯示的月份

  // 'YYYY-MM-DD HH:mm' 這種格式直接字串比大小就是時間先後，不用轉 Date
  function slotEnd(date, time) {
    return date + ' ' + ('0' + (parseInt(time, 10) + 1)).slice(-2) + time.slice(2);
  }
  function taken(date, time) {
    if (!BUSY) return false;
    var s = date + ' ' + time, e = slotEnd(date, time);
    return BUSY.some(function (b) { return s < b[1] && e > b[0]; });
  }
  // 這一天還有沒有約得到的時段
  function dayOpen(date) {
    var d = new Date(date + 'T00:00:00'), w = d.getDay();
    var list = (w === 0 || w === 6) ? SLOTS.we : SLOTS.wd;
    var today = ymd(new Date()) === date, nowH = new Date().getHours();
    return list.some(function (t) {
      return !(today && parseInt(t, 10) <= nowH) && !taken(date, t);
    });
  }

  function ymd(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  // 可不可以約：今天到 60 天內都可以
  function bookable(d) {
    var t0 = midnight(new Date());
    var last = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + AHEAD);
    return d >= t0 && d <= last;
  }

  // 月曆：週一開始，排滿整個月，過去與太遠的日子點不下去
  function drawDays() {
    var t0 = midnight(new Date());
    if (!view) view = new Date(t0.getFullYear(), t0.getMonth(), 1);
    $('bkMon').textContent = view.getFullYear() + ' 年 ' + (view.getMonth() + 1) + ' 月';

    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var lead = (first.getDay() + 6) % 7;            // 週一當一週的第一天
    var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    var html = '';
    for (var i = 0; i < lead; i++) html += '<span class="bk-pad"></span>';
    for (var n = 1; n <= days; n++) {
      var d = new Date(view.getFullYear(), view.getMonth(), n);
      var key = ymd(d), w = d.getDay();
      var ok = bookable(d) && dayOpen(key);
      html += '<button type="button" class="bk-day' + (picked.date === key ? ' on' : '')
        + (w === 0 || w === 6 ? ' we' : '') + (ymd(t0) === key ? ' today' : '') + '"'
        + (ok ? '' : ' disabled') + ' data-d="' + key + '">' + n
        + (ok ? '<i class="bk-dot"></i>' : '') + '</button>';
    }
    $('bkDays').innerHTML = html;

    // 已經是這個月就不能再往回翻，超過可約範圍也不用往後翻
    var cur = new Date(t0.getFullYear(), t0.getMonth(), 1);
    var lastM = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + AHEAD);
    $('bkPrev').disabled = view <= cur;
    $('bkNext').disabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > lastM;
  }

  function moveMonth(n) {
    view = new Date(view.getFullYear(), view.getMonth() + n, 1);
    drawDays();
  }

  function drawTimes() {
    var box = $('bkTimes');
    if (!picked.date) { box.innerHTML = '<p class="bk-hint">先選一天，再選時段</p>'; return; }
    var d = new Date(picked.date + 'T00:00:00');
    var w = d.getDay();
    var list = (w === 0 || w === 6) ? SLOTS.we : SLOTS.wd;
    var today = ymd(new Date()) === picked.date;
    var nowH = new Date().getHours();
    box.innerHTML = '<p class="bk-slothd">' + (d.getMonth() + 1) + '/' + d.getDate()
      + '（週' + WEEK[w] + '）可約時段</p>'
      + list.map(function (t) {
      var past = today && parseInt(t, 10) <= nowH;
      var full = taken(picked.date, t);
      return '<button type="button" class="bk-time' + (picked.time === t ? ' on' : '')
        + (full ? ' bk-full' : '') + '"'
        + (past || full ? ' disabled' : '')
        + (full ? ' title="這個時段已經有約了"' : '') + ' data-t="' + t + '">' + t + '</button>';
      }).join('')
      + '<p class="bk-hint">' + (BUSY ? '灰掉的是我已經有約的時段，' : '')
      + '送出後我會回覆確認'
      + '想約表上沒有的時間，直接在備註寫，我盡量配合</p>';
  }

  function chipVals(name) {
    return [].slice.call(document.querySelectorAll('input[name="' + name + '"]:checked'))
      .map(function (i) { return i.value; });
  }

  function message() {
    var L = ['容瑜你好，我想預約：'];
    L.push('・時間：' + (picked.date ? picked.date + ' ' + (picked.time || '（時段待定）') : '（還沒選，再跟你約）'));
    var way = document.querySelector('input[name="bkWay"]:checked');
    L.push('・方式：' + (way ? way.value : '未指定'));
    var nm = $('bkName').value.trim(), ttl = document.querySelector('input[name="bkTitle"]:checked');
    L.push('・稱呼：' + (nm || '（未填）') + (ttl ? ' ' + ttl.value : ''));
    var tel = $('bkTel').value.trim();
    if (tel) L.push('・電話：' + tel);
    var mail = $('bkMail').value.trim();
    if (mail) L.push('・Email：' + mail);
    var lid = $('bkLid').value.trim();
    if (lid) L.push('・LINE ID：' + lid);
    var need = chipVals('bkNeed');
    if (need.length) L.push('・想聊：' + need.join('、'));
    var urg = document.querySelector('input[name="bkUrg"]:checked');
    if (urg) L.push('・急迫度：' + urg.value);
    var note = $('bkNote').value.trim();
    if (note) L.push('・備註：' + note);
    return L.join('\n');
  }

  function preview() {
    var need = $('bkName').value.trim() && $('bkTel').value.trim();
    $('bkGo').disabled = !need;
    if (!API) $('bkGo').textContent = '複製並開啟 LINE 送出';
    $('bkPre').textContent = message();
    bar(need);
  }

  // 還差什麼才能送出，寫在送出鈕下面
  function bar(ready) {
    var why;
    if (!picked.date) why = '先選一個方便的日期';
    else if (!picked.time) why = '再選一個時段';
    else if (!ready) why = '還差姓名和電話';
    else why = '';
    $('bkWhy').textContent = why;
    $('bkGo').disabled = !ready;
    $('bkGo').textContent = API ? '送出預約' : '複製並開啟 LINE 送出';
  }

  $('bkPrev').addEventListener('click', function () { moveMonth(-1); });
  $('bkNext').addEventListener('click', function () { moveMonth(1); });
  $('bkDays').addEventListener('click', function (e) {
    var b = e.target.closest('.bk-day'); if (!b) return;
    picked.date = b.getAttribute('d') || b.getAttribute('data-d');
    picked.time = null;
    drawDays(); drawTimes(); preview();
  });
  $('bkTimes').addEventListener('click', function (e) {
    var b = e.target.closest('.bk-time'); if (!b || b.disabled) return;
    picked.time = b.getAttribute('data-t');
    drawTimes(); preview();
  });
  ['bkName', 'bkTel', 'bkNote', 'bkMail', 'bkLid'].forEach(function (id) { $(id).addEventListener('input', preview); });
  document.querySelectorAll('.bk-form input[type=radio], .bk-form input[type=checkbox]')
    .forEach(function (i) { i.addEventListener('change', preview); });

  // 後端網址（Google Apps Script）。沒設定就退回原本「複製後開 LINE 貼上」的流程
  var API = ($('bkForm').getAttribute('data-api') || '').trim();

  function payload() {
    var ttl = document.querySelector('input[name="bkTitle"]:checked');
    var way = document.querySelector('input[name="bkWay"]:checked');
    var urg = document.querySelector('input[name="bkUrg"]:checked');
    return {
      date: picked.date || '', time: picked.time || '',
      way: way ? way.value : '', name: $('bkName').value.trim(),
      title: ttl ? ttl.value : '', tel: $('bkTel').value.trim(),
      mail: $('bkMail').value.trim(), lineId: $('bkLid').value.trim(),
      need: chipVals('bkNeed'), urg: urg ? urg.value : '',
      note: $('bkNote').value.trim(), hp: $('bkHp').value
    };
  }

  function fallback(why) {
    $('bkGo').hidden = true;
    $('bkLine').hidden = false;
    $('bkToast').textContent = why + '改用 LINE 傳給我，一樣會收到';
  }

  function sent() {
    $('bkGo').hidden = true;
    $('bkLine').hidden = true;
    $('bkToast').textContent = '';
    $('bkDone').hidden = false;
    $('bkDone').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function send() {
    var go = $('bkGo');
    go.disabled = true;
    $('bkToast').textContent = '送出中…';
    // 不要自己帶 Content-Type。帶了 application/json 瀏覽器會先發 OPTIONS 預檢，
    // 而 Apps Script 不處理 OPTIONS，預檢一失敗整個請求就被擋掉。
    // 不帶的話瀏覽器自動用 text/plain，屬於安全清單、不會預檢。
    fetch(API, { method: 'POST', body: JSON.stringify(payload()) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error((d && d.msg) || 'fail');
        sent();
      })
      .catch(function () {
        go.disabled = false;
        fallback('網路送出沒成功，');
      });
  }

  $('bkLine').addEventListener('click', function () {
    RT.line(message(), $('bkToast'));
  });

  $('bkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('bkGo').disabled) return;
    if (API) send(); else RT.line(message(), $('bkToast'));
  });

  // 向後端要「已經有事」的時段，拿到之後把月曆和時段重畫一次。
  // 用 <script> 取（JSONP）而不是 fetch，因為 Apps Script 的 GET 會轉址，fetch 會被 CORS 擋。
  (function loadBusy() {
    if (!API) return;
    var cb = 'bkBusy' + Math.floor(performance.now() * 1000);
    var s = document.createElement('script');
    var done = function () {
      if (s.parentNode) s.parentNode.removeChild(s);
      try { delete window[cb]; } catch (e) { window[cb] = void 0; }
    };
    window[cb] = function (d) {
      if (d && d.busy) {
        BUSY = d.busy;
        if (picked.date && !dayOpen(picked.date)) { picked.date = null; picked.time = null; }
        else if (picked.time && taken(picked.date, picked.time)) { picked.time = null; }
        drawDays(); drawTimes(); preview();
      }
      done();
    };
    s.src = API + '?busy=1&days=' + (AHEAD + 2) + '&callback=' + cb;
    s.onerror = done;
    document.head.appendChild(s);
  })();

  drawDays(); drawTimes(); preview();
})();
