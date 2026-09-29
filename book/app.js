/* 線上預約：選日期時段、留需求，一鍵複製後開 LINE 送出 */
(function () {
  var $ = RT.$;
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var SLOTS = {                       // 平日與假日的可約時段
    wd: ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '19:00', '20:00'],
    we: ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
  };
  var picked = { date: null, time: null };

  function ymd(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function drawDays() {
    var box = $('bkDays');
    var now = new Date();
    var html = '';
    for (var i = 0; i < 14; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      var key = ymd(d);
      var w = d.getDay();
      html += '<button type="button" class="bk-day' + (picked.date === key ? ' on' : '')
        + (w === 0 || w === 6 ? ' we' : '') + '" data-d="' + key + '">'
        + '<span class="bk-w">' + (i === 0 ? '今天' : i === 1 ? '明天' : '週' + WEEK[w]) + '</span>'
        + '<b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b></button>';
    }
    box.innerHTML = html;
  }

  function drawTimes() {
    var box = $('bkTimes');
    if (!picked.date) { box.innerHTML = '<p class="bk-hint">先選一天，再選時段。</p>'; return; }
    var d = new Date(picked.date + 'T00:00:00');
    var w = d.getDay();
    var list = (w === 0 || w === 6) ? SLOTS.we : SLOTS.wd;
    var today = ymd(new Date()) === picked.date;
    var nowH = new Date().getHours();
    box.innerHTML = list.map(function (t) {
      var past = today && parseInt(t, 10) <= nowH;
      return '<button type="button" class="bk-time' + (picked.time === t ? ' on' : '') + '"'
        + (past ? ' disabled' : '') + ' data-t="' + t + '">' + t + '</button>';
    }).join('')
      + '<p class="bk-hint">時段是我平常方便的時間，送出後我會回覆確認。'
      + '想約表上沒有的時間，直接在備註寫，我盡量配合。</p>';
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
    $('bkPre').textContent = message();
    $('bkWhy').textContent = need ? '' : '姓名和電話填了才能送出。';
  }

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
  ['bkName', 'bkTel', 'bkNote'].forEach(function (id) { $(id).addEventListener('input', preview); });
  document.querySelectorAll('.bk-form input[type=radio], .bk-form input[type=checkbox]')
    .forEach(function (i) { i.addEventListener('change', preview); });

  $('bkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('bkGo').disabled) return;
    RT.line(message(), $('bkToast'));
  });

  drawDays(); drawTimes(); preview();
})();
