/* 買中古屋帶看前該查完的 6 件事：屋齡風險對照 */
(function () {
  var $ = RT.$;
  var THIS_ROC = new Date().getFullYear() - 1911;

  // 每一條都標明依據，數字來自官方公告而不是市場傳說
  var RISKS = [
    { k: 'rad', t: '輻射屋風險期', lo: 71, hi: 73, c: 'r1',
      d: '已發現的放射性污染建築物全部是民國 71～73 年建造，使用執照核發日期落在民國 71 年 11 月至 75 年 1 月之間。',
      go: '免費查：核安會「1 毫西弗以上輻射屋查詢系統」<a href="https://ramdar.nusc.gov.tw/" target="_blank" rel="noopener">ramdar.nusc.gov.tw</a>，或打 0800-076-678。' },
    { k: 'sea', t: '高氯離子（海砂屋）風險期', lo: 0, hi: 87, c: 'r2',
      d: '民國 83 年版 CNS 3090 允許鋼筋混凝土水溶性氯離子到 0.6 kg/m³，民國 87 年 6 月才下修到 0.3 kg/m³。也就是說民國 87 年以前蓋的房子，當年的國家標準本來就寬鬆一倍。',
      go: '要確認得做氯離子檢測（需鑽孔取樣，屋主多半不會答應）。實務上先看不動產說明書怎麼勾，再看牆面、天花板有沒有混凝土剝落、鋼筋外露。' },
    { k: 'eq', t: '耐震規範較舊', lo: 0, hi: 90, c: 'r3',
      d: '建築物耐震設計規範民國 86 年 5 月才訂定，民國 88 年 921 地震之後又陸續在 88 年底、94 年、100 年修正。民國 90 年以後取得建照的房子，適用的是修過的規範。',
      go: '看建物謄本的「建築完成日期」只能抓大概，真正要看的是建照核發日與當時適用的版本。老公寓要另外看有沒有頂樓加蓋、一樓打通。' }
  ];

  function render(y) {
    var box = $('c6Result');
    if (!y || y < 40 || y > THIS_ROC) {
      box.innerHTML = '<p class="c6-hint">輸入建物謄本上的「建築完成日期」年份（民國年），'
        + '馬上告訴你這間落在哪些風險區間、該多問什麼。</p>';
      return;
    }
    var age = THIS_ROC - y;
    var hit = RISKS.filter(function (r) { return y >= r.lo && y <= r.hi; });
    box.innerHTML = '<div class="c6-age"><b>民國 ' + y + ' 年</b>（西元 ' + (y + 1911) + '）'
      + '　屋齡約 <b>' + age + '</b> 年</div>'
      + (hit.length
          ? '<ul class="c6-hits">' + hit.map(function (r) {
              return '<li class="' + r.c + '"><b>' + r.t + '</b><p>' + r.d + '</p>'
                + '<p class="c6-go">' + r.go + '</p></li>';
            }).join('') + '</ul>'
          : '<p class="c6-ok">這個年份沒有落在上面任何一個風險區間。'
            + '不代表不用查——漏水、管委會的帳、行情比對一樣要做。</p>')
      + '<p class="c6-note">落在風險區間不等於這間有問題，只代表<b>第 3 項的不動產說明書要看得更仔細</b>，'
      + '該問的要問出答案。同一個年份也有蓋得很紮實的房子。</p>';
  }

  var inp = $('c6Year');
  if (inp) {
    inp.addEventListener('input', function () { render(parseInt(this.value, 10)); });
    var form = $('c6Form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); render(parseInt(inp.value, 10)); });
  }
  var span = $('c6Now');
  if (span) span.textContent = THIS_ROC;
  render(NaN);
})();
