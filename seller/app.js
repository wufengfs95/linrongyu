/* 賣方實拿速算 —— 計算邏輯原封不動沿用舊計算機（calculator/index.html），只換掉版面。
   稅務算式沒有重寫，避免改出錯誤。 */
const FIXED = {
  run: 0.1,      // 代書費（潤筆）
  reg: 0.2,      // 實價登錄費
  clr: 0.6,      // 塗銷費 + 稅籍資料
  escrowRate: 0.0003,  // 履保萬分之三
  serviceRate: 0.04,   // 服務費 4%
};

let selfUse = false;
let lastEditedPrice = null; // 'total' | 'unit'，記錄最後動的欄位
let svcMode = 'p4'; // 'p4'=4% | 'manual'=手動
let moveMode = 'same'; // 'same'=同服務費 | 'manual'=手動 | 'cap3'=3%上限30萬

function setSvcMode(mode) {
  svcMode = mode;
  const seg = document.getElementById('svcSeg');
  seg.querySelectorAll('button').forEach((b, i) => {
    var on = ['p4','manual'][i] === mode;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.getElementById('svcManualWrap').style.display = mode === 'manual' ? 'block' : 'none';
  recalc();
}

function setMoveMode(mode) {
  moveMode = mode;
  const seg = document.getElementById('moveSeg');
  seg.querySelectorAll('button').forEach((b, i) => {
    var on = ['same','manual','cap3'][i] === mode;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.getElementById('moveManualWrap').style.display = mode === 'manual' ? 'block' : 'none';
  recalc();
}

// A. 服務費（影響實拿，回傳萬）
function calcServiceFee(total) {
  if (svcMode === 'manual') {
    return v('svcManual');
  } else {
    return total * 0.04;
  }
}

// B. 可認列移轉費用（影響稅基，回傳萬）
function calcMoveFee(total, serviceFee) {
  if (moveMode === 'manual') {
    return v('moveManual');
  } else if (moveMode === 'cap3') {
    return Math.min(total * 0.03, 30);
  } else {
    // same：同服務費
    return serviceFee;
  }
}

// ------- 輔助：取值 -------
function v(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const n = parseFloat(el.value);
  return isNaN(n) ? 0 : n;
}
function fmt(n, d=2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('zh-TW', { maximumFractionDigits: d, minimumFractionDigits: d });
}
function fmt0(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}

// ------- 持有期間 → 稅率 -------
function rocToDate(y, m, d) {
  // 民國年 → Date 物件
  if (!y || !m || !d) return null;
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ad = y + 1911;
  const dt = new Date(ad, m - 1, d);
  // 檢查是否為有效日期（例如 2/30 會被自動修正，要擋掉）
  if (dt.getFullYear() !== ad || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function getHoldInfo() {
  const pY = parseInt(document.getElementById('prevY').value);
  const pM = parseInt(document.getElementById('prevM').value);
  const pD = parseInt(document.getElementById('prevD').value);
  const cY = parseInt(document.getElementById('currY').value);
  const cM = parseInt(document.getElementById('currM').value);
  const cD = parseInt(document.getElementById('currD').value);

  const d1 = rocToDate(pY, pM, pD);
  const d2 = rocToDate(cY, cM, cD);
  if (!d1 || !d2) return null;
  if (d2 < d1) return { error: '本次日期早於前次移轉日' };

  const ms = d2 - d1;
  const years = ms / (365.25 * 24 * 3600 * 1000);
  let rate, label;
  if (selfUse && years >= 6) {
    rate = 0.10;
    label = '自用滿6年（10% + 400萬免稅）';
  } else if (years < 2) {
    rate = 0.45; label = '2年內（45%）';
  } else if (years < 5) {
    rate = 0.35; label = '2-5年（35%）';
  } else if (years < 10) {
    rate = 0.20; label = '5-10年（20%）';
  } else {
    rate = 0.15; label = '10年以上（15%）';
  }
  return { years, rate, label, prevROC: `${pY}/${pM}/${pD}`, currROC: `${cY}/${cM}/${cD}` };
}

// ------- 房屋單價計算（含車位拆算） -------
function getHouseInfo() {
  const total = v('totalArea');
  const parkA = v('parkArea');
  const parkP = v('parkPrice');
  const houseArea = total - parkA;
  return { total, parkA, parkP, houseArea };
}

// ------- 雙向連動：總價輸入 -------
function onSellTotalInput() {
  lastEditedPrice = 'total';
  const { houseArea, parkP } = getHouseInfo();
  const total = v('sellTotal');
  const unitInput = document.getElementById('sellUnit');
  if (houseArea > 0 && total > 0) {
    const housePrice = total - parkP;
    const unit = housePrice / houseArea;
    unitInput.value = unit.toFixed(2);
    unitInput.classList.add('linked');
    document.getElementById('sellTotal').classList.remove('linked');
  } else {
    unitInput.value = '';
    unitInput.classList.remove('linked');
  }
  recalc();
}

// ------- 雙向連動：單價輸入 -------
function onSellUnitInput() {
  lastEditedPrice = 'unit';
  const { houseArea, parkP } = getHouseInfo();
  const unit = v('sellUnit');
  const totalInput = document.getElementById('sellTotal');
  if (houseArea > 0 && unit > 0) {
    const housePrice = unit * houseArea;
    const total = housePrice + parkP;
    totalInput.value = total.toFixed(2);
    totalInput.classList.add('linked');
    document.getElementById('sellUnit').classList.remove('linked');
  } else {
    totalInput.value = '';
    totalInput.classList.remove('linked');
  }
  recalc();
}

// ------- 自用滿6年切換 -------
function toggleSelfUse() {
  selfUse = document.getElementById('selfUseChk').checked;
  recalc();
}

// ------- 主計算 -------
function recalc() {
  const { houseArea, parkP } = getHouseInfo();
  const total = v('sellTotal');

  // 房屋單價區資訊
  const unitInfo = document.getElementById('unitInfo');
  if (houseArea > 0 && total > 0) {
    const housePrice = total - parkP;
    const unit = housePrice / houseArea;
    unitInfo.innerHTML = `房屋價格 <b>${fmt(housePrice)}</b> 萬 ÷ 房屋坪數 <b>${fmt(houseArea)}</b> 坪 = 單價 <b style="color:var(--gold-deep)">${fmt(unit)}</b> 萬/坪`;
  } else {
    unitInfo.textContent = '輸入後自動顯示「房屋價格 / 房屋坪數」';
  }

  // 持有期間
  const holdInfo = document.getElementById('holdInfo');
  const hold = getHoldInfo();
  if (!hold) {
    holdInfo.textContent = '請填寫兩個日期 → 自動判定持有期間與稅率';
  } else if (hold.error) {
    holdInfo.innerHTML = `<span style="color:var(--danger)">⚠ ${hold.error}</span>`;
  } else {
    holdInfo.innerHTML = `✓ 民國 ${hold.prevROC} → ${hold.currROC}，持有 <b>${hold.years.toFixed(2)}</b> 年 → 適用 <b style="color:var(--gold-deep)">${hold.label}</b>`;
  }

  // 沒有總價就清空結果
  if (total <= 0) {
    setResult(null);
    return;
  }

  // 各項費用
  const run = FIXED.run;
  const reg = FIXED.reg;
  const clr = FIXED.clr;
  const escrow = total * FIXED.escrowRate;
  const service = calcServiceFee(total);       // A：影響實拿
  const moveFee = calcMoveFee(total, service); // B：影響稅基

  // 更新服務費說明文字（A）
  const svcInfo = document.getElementById('svcInfo');
  if (svcMode === 'p4') {
    svcInfo.innerHTML = total > 0
      ? `服務費 = 成交總價 <b>${fmt(total)}</b> 萬 × 4% = <b style="color:var(--gold-deep)">${fmt(service)}</b> 萬`
      : '服務費 = 成交總價 × 4%';
  } else {
    svcInfo.innerHTML = `服務費 = 手動輸入 <b style="color:var(--gold-deep)">${fmt(service)}</b> 萬`;
  }

  // 更新可認列移轉費用說明文字（B）
  const moveInfo = document.getElementById('moveInfo');
  if (moveMode === 'same') {
    moveInfo.innerHTML = `可認列移轉費用 = 同服務費 <b style="color:var(--gold-deep)">${fmt(moveFee)}</b> 萬`;
  } else if (moveMode === 'cap3') {
    const raw = total * 0.03;
    moveInfo.innerHTML = total > 0
      ? `可認列 = 成交總價 <b>${fmt(total)}</b> 萬 × 3% = ${fmt(raw)} 萬 → 取 <b style="color:var(--gold-deep)">${fmt(moveFee)}</b> 萬${raw > 30 ? '（已達 30 萬上限）' : '（未達上限）'}`
      : '可認列 = 成交總價 × 3%（上限 30 萬）';
  } else {
    moveInfo.innerHTML = `可認列移轉費用 = 手動輸入 <b style="color:var(--gold-deep)">${fmt(moveFee)}</b> 萬`;
  }

  // 房地合一稅
  const buyPrice = v('buyPrice');
  const buyCost = v('buyCost');
  const landGain = v('landGain'); // 土地漲價總數額（依土增稅單）
  let houseTax = 0;
  if (hold && !hold.error && buyPrice > 0) {
    let base = total - buyPrice - buyCost - moveFee - landGain; // 稅基（萬）：扣可認列移轉費用(B)與土地漲價總數額
    if (selfUse && hold.years >= 6) {
      base = Math.max(0, base - 400); // 免稅額 400 萬
    }
    base = Math.max(0, base);
    houseTax = base * hold.rate;
  }

  const landTax = v('landTax');
  const loan = v('loan');

  const sumDeduct = run + reg + escrow + service + clr + landTax + houseTax + loan;
  const net = total - sumDeduct;

  // 房屋單價（給結果區）
  const housePrice = total - parkP;
  const unitR = houseArea > 0 ? housePrice / houseArea : null;

  // 寫入結果
  setResult({
    unitR, houseTax, net,
    escrow, service, landTax, houseTaxVal: houseTax, loan, sumDeduct,
    total, buyPrice, buyCost, moveFee, landGain,
    selfDeduct: (selfUse && hold && hold.years >= 6) ? 400 : 0,
    holdRate: hold ? hold.rate : null,
    hasHoldData: !!(hold && !hold.error && buyPrice > 0)
  });
}

function setResult(r) {
  if (!r) {
    ['r_unit','r_tax','r_net','d_esc','d_svc','d_land','d_houseTax','d_loan','d_sum'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    document.getElementById('formulaBlock').style.display = 'none';
    return;
  }
  document.getElementById('r_unit').textContent = r.unitR === null ? '—' : fmt(r.unitR);
  document.getElementById('r_tax').textContent = fmt(r.houseTax);
  document.getElementById('r_net').textContent = fmt(r.net);
  document.getElementById('d_esc').textContent = fmt(r.escrow);
  document.getElementById('d_svc').textContent = fmt(r.service);
  const svcLabelMap = { p4: '服務費（成交價 × 4%）', manual: '服務費（手動輸入）' };
  const dl = document.getElementById('d_svc_label');
  if (dl) dl.textContent = svcLabelMap[svcMode];
  document.getElementById('d_land').textContent = fmt(r.landTax);
  document.getElementById('d_houseTax').textContent = fmt(r.houseTaxVal);
  document.getElementById('d_loan').textContent = fmt(r.loan);
  document.getElementById('d_sum').textContent = fmt(r.sumDeduct);

  // 計算公式區塊
  const fb = document.getElementById('formulaBlock');
  fb.style.display = 'block';
  document.getElementById('f_sell2').textContent = fmt(r.total);
  document.getElementById('f_deduct').textContent = fmt(r.sumDeduct);
  document.getElementById('f_net2').textContent = fmt(r.net);

  const taxItem = document.getElementById('formulaTaxItem');
  if (r.hasHoldData) {
    taxItem.style.display = 'block';
    document.getElementById('f_sell').textContent = fmt(r.total);
    document.getElementById('f_buy').textContent = fmt(r.buyPrice);
    document.getElementById('f_buyCost').textContent = fmt(r.buyCost);
    document.getElementById('f_move').textContent = fmt(r.moveFee);
    document.getElementById('f_landPart').innerHTML = r.landGain > 0 ? ` &minus; 土地漲價總數額 <span class="fv">${fmt(r.landGain)}</span> 萬` : '';
    document.getElementById('f_selfPart').textContent = r.selfDeduct > 0 ? ' − 自用扣抵 400 萬' : '';
    document.getElementById('f_rate').textContent = (r.holdRate * 100).toFixed(0);
    document.getElementById('f_taxResult').textContent = fmt(r.houseTaxVal);
  } else {
    taxItem.style.display = 'none';
  }
}

// ------- 反推實拿 -------
// 給定 net，反推應掛總價 X
// 邏輯：net = X − run − reg − clr − X*0.0003 − X*0.04 − landTax − houseTax(X) − loan
// 房地合一稅 houseTax(X) = max(0, (X − buyPrice − buyCost − X*0.04) [−400 if 自用]) × rate
// 整理：令 net 為已知，X 為未知
// 設 s = serviceRate = 0.04, e = escrowRate = 0.0003, r = 持有稅率
// X − X*e − X*s − run − reg − clr − landTax − loan − houseTax = net
// houseTax = (X − buyPrice − buyCost − X*s − 自用扣抵) * r
//          = X(1−s)*r − (buyPrice+buyCost+自用扣抵)*r
// 但要先判斷稅基是否 >0，這邊先假設正稅基（一般談價情境），算完再 sanity check
//
// 整理係數：
// 主式：X*(1 − e − s) − run − reg − clr − landTax − loan − [X(1−s)*r − Cr] = net
// 其中 Cr = (buyPrice + buyCost + 移轉費用固定額 + 自用扣抵 + 土地漲價總數額)*r
// → X*(1 − e − s) − X*(1−s)*r = net + run + reg + clr + landTax + loan − Cr
// → X * [(1 − e − s) − (1−s)*r] = RHS
// → X = RHS / [(1 − e − s) − (1−s)*r]
function reverseCalc() {
  const out = document.getElementById('reverseOut');
  const target = v('targetNet');
  if (target <= 0) {
    out.style.display = 'none';
    return;
  }
  const hold = getHoldInfo();
  if (!hold || hold.error) {
    out.style.display = 'block';
    document.getElementById('rv_total').textContent = '—';
    document.getElementById('rv_unit').textContent = '—';
    document.getElementById('rv_note').textContent = '⚠ 請先填寫前次移轉與本次交易日期';
    return;
  }
  const { houseArea, parkP } = getHouseInfo();
  const r = hold.rate;
  const e = FIXED.escrowRate;
  // === A 服務費（影響實拿）===
  // p4 → X*0.04（比例）；manual → 固定金額 svcFixed
  let sA, svcFixed = 0;
  if (svcMode === 'manual') {
    sA = 0; svcFixed = v('svcManual');
  } else {
    sA = 0.04;
  }
  // === B 可認列移轉費用（影響稅基）===
  // same → 等於 A；manual → moveFixed；cap3 → X*0.03（忽略30萬上限的反推極端情況）
  let sB, moveFixed = 0;
  if (moveMode === 'manual') {
    sB = 0; moveFixed = v('moveManual');
  } else if (moveMode === 'cap3') {
    sB = 0.03;
  } else {
    // same：B 等於 A
    sB = sA; moveFixed = svcFixed;
  }
  const buyPrice = v('buyPrice');
  const buyCost = v('buyCost');
  const landTax = v('landTax');
  const loan = v('loan');
  const run = FIXED.run, reg = FIXED.reg, clr = FIXED.clr;
  const selfDeduct = (selfUse && hold.years >= 6) ? 400 : 0;
  const landGain = v('landGain');

  // 假設稅基為正
  const Cr = (buyPrice + buyCost + moveFixed + selfDeduct + landGain) * r;
  const RHS = target + run + reg + clr + landTax + loan + svcFixed - Cr;
  const denom = (1 - e - sA) - (1 - sB) * r;

  if (Math.abs(denom) < 1e-9) {
    document.getElementById('rv_total').textContent = '無解';
    document.getElementById('rv_unit').textContent = '—';
    document.getElementById('rv_note').textContent = '參數異常';
    out.style.display = 'block';
    return;
  }
  let X = RHS / denom;

  // 驗算稅基（用 B 的移轉費用），若 <= 0 則房地合一稅 = 0，用簡化式重算
  let base = X - buyPrice - buyCost - (X * sB + moveFixed) - selfDeduct - landGain;
  let note = '';
  if (base <= 0) {
    // 房地合一稅 = 0，重算（實拿只扣 A 服務費）
    X = (target + run + reg + clr + landTax + loan + svcFixed) / (1 - e - sA);
    note = '＊本情境房地合一稅基 ≤ 0，無需繳房地合一稅';
  }

  // 推回單價
  const housePrice = X - parkP;
  const unit = houseArea > 0 ? housePrice / houseArea : null;

  document.getElementById('rv_total').textContent = fmt(X);
  document.getElementById('rv_unit').textContent = unit === null ? '—（請先填坪數）' : fmt(unit);
  document.getElementById('rv_note').textContent = note;
  out.style.display = 'block';
}

// ------- 全部清除 -------
function resetAll() {
  if (!confirm('清空所有輸入？')) return;
  ['totalArea','parkArea','parkPrice','sellTotal','sellUnit','buyPrice','buyCost','landTax','landGain','loan','targetNet'].forEach(id => {
    document.getElementById(id).value = '';
  });
  ['prevY','prevM','prevD','currY','currM','currD'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.querySelectorAll('input.linked').forEach(el => el.classList.remove('linked'));
  selfUse = false;
  document.getElementById('selfUseSwitch').classList.remove('on');
  document.getElementById('reverseOut').style.display = 'none';
  document.getElementById('svcManual').value = '';
  document.getElementById('moveManual').value = '';
  setSvcMode('p4');
  setMoveMode('same');
  // 本次預計交易日期復原成今天（前次移轉日期維持清空）
  setCurrDateToday();
  recalc();
}

// 把「本次預計交易日期」設成今天
function setCurrDateToday() {
  const today = new Date();
  document.getElementById('currY').value = today.getFullYear() - 1911;
  document.getElementById('currM').value = today.getMonth() + 1;
  onDateChange('curr');
  document.getElementById('currD').value = today.getDate();
}

// 初始化：今天填入「本次預計交易日期」
// 產生年/月/日下拉選項
function populateSelects() {
  const todayROC = new Date().getFullYear() - 1911;
  // 年份：民國 80 ~ 今年 ROC + 1
  for (const id of ['prevY', 'currY']) {
    const sel = document.getElementById(id);
    for (let y = todayROC + 1; y >= 80; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y + ' 年';
      sel.appendChild(opt);
    }
  }
  // 月份
  for (const id of ['prevM', 'currM']) {
    const sel = document.getElementById(id);
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m + ' 月';
      sel.appendChild(opt);
    }
  }
  // 日（先預設 31 天，之後依年月動態調整）
  for (const id of ['prevD', 'currD']) {
    rebuildDays(id, 31);
  }
}

function rebuildDays(id, maxDay) {
  const sel = document.getElementById(id);
  const prev = sel.value;
  sel.innerHTML = '<option value="">日</option>';
  for (let d = 1; d <= maxDay; d++) {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d + ' 日';
    if (String(d) === prev) opt.selected = true;
    sel.appendChild(opt);
  }
}

function daysInMonth(rocY, m) {
  if (!rocY || !m) return 31;
  const ad = parseInt(rocY) + 1911;
  return new Date(ad, m, 0).getDate();
}

// 年或月改變時，重建日的選項數量
function onDateChange(prefix) {
  const y = document.getElementById(prefix + 'Y').value;
  const m = document.getElementById(prefix + 'M').value;
  if (y && m) {
    rebuildDays(prefix + 'D', daysInMonth(y, m));
  }
  recalc();
}

// 擋掉滑鼠滾輪改數值：滑鼠在數字欄位上滾動時，只捲動頁面、不改數字
document.addEventListener('wheel', function(e) {
  const el = e.target;
  if (el && el.tagName === 'INPUT' && el.type === 'number' && document.activeElement === el) {
    el.blur();
  }
}, { passive: true });

(function init() {
  populateSelects();
  // 預設本次日期為今天
  const today = new Date();
  document.getElementById('currY').value = today.getFullYear() - 1911;
  document.getElementById('currM').value = today.getMonth() + 1;
  onDateChange('curr'); // 觸發日的重建
  document.getElementById('currD').value = today.getDate();
  recalc();
})();

/* =========================================================
   Tab 切換 + 其他六個 tab 的計算
   ========================================================= */

function printForClient() {
  const txt = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : '—'; };
  const val = id => { const e = document.getElementById(id); return (e && e.value !== '') ? e.value : '—'; };

  if (txt('r_net') === '—') {
    alert('請先輸入「想賣的總價」，才能產生給客戶的試算表。');
    return;
  }

  // logo（沿用上方標題的 logo）
  const srcLogo = document.querySelector('.brand img, .logo img, header img');
  const prLogo = document.getElementById('pr_logo');
  if (prLogo) {
    if (srcLogo && srcLogo.src) prLogo.src = srcLogo.src;
    else prLogo.style.display = 'none';
  }

  // 製表日期
  const d = new Date();
  document.getElementById('pr_date').textContent =
    d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');

  // 主數字 + 三張卡
  document.getElementById('pr_net').textContent   = txt('r_net');
  document.getElementById('pr_total').textContent = val('sellTotal');
  document.getElementById('pr_unit').textContent  = txt('r_unit');
  document.getElementById('pr_tax').textContent   = txt('r_tax');

  // 物件資訊
  document.getElementById('pr_area').textContent      = val('totalArea');
  document.getElementById('pr_parkArea').textContent  = val('parkArea');
  document.getElementById('pr_parkPrice').textContent = val('parkPrice');

  // 費用明細
  document.getElementById('pr_run').textContent       = txt('d_run');
  document.getElementById('pr_reg').textContent       = txt('d_reg');
  document.getElementById('pr_esc').textContent       = txt('d_esc');
  document.getElementById('pr_svc_label').textContent = txt('d_svc_label');
  document.getElementById('pr_svc').textContent       = txt('d_svc');
  document.getElementById('pr_clr').textContent       = txt('d_clr');
  document.getElementById('pr_land').textContent      = txt('d_land');
  document.getElementById('pr_htax').textContent      = txt('d_houseTax');
  document.getElementById('pr_loan').textContent      = txt('d_loan');
  document.getElementById('pr_sum').textContent       = txt('d_sum');

  // 計算公式（沿用畫面上算好的公式數值）
  const taxShown = document.getElementById('formulaTaxItem').style.display !== 'none';
  document.getElementById('pr_formula_tax').style.display = taxShown ? 'block' : 'none';
  if (taxShown) {
    document.getElementById('pf_sell').textContent    = txt('f_sell');
    document.getElementById('pf_buy').textContent     = txt('f_buy');
    document.getElementById('pf_buyCost').textContent = txt('f_buyCost');
    document.getElementById('pf_move').textContent    = txt('f_move');
    const landTxt = txt('f_landPart');
    document.getElementById('pf_land').textContent = landTxt && landTxt !== '—' ? ' ' + landTxt : '';
    const selfTxt = txt('f_selfPart');
    document.getElementById('pf_self').textContent = selfTxt && selfTxt !== '—' ? ' ' + selfTxt : '';
    document.getElementById('pf_rate').textContent    = txt('f_rate');
    document.getElementById('pf_tax').textContent     = txt('f_taxResult');
  }
  document.getElementById('pf_sell2').textContent  = txt('f_sell2');
  document.getElementById('pf_deduct').textContent = txt('f_deduct');
  document.getElementById('pf_net').textContent    = txt('f_net2');

  window.print();
}


// 初始化（照舊版 HTML 最下面那段 inline script）
(function init() {
  populateSelects();
  var today = new Date();
  document.getElementById('currY').value = today.getFullYear() - 1911;
  document.getElementById('currM').value = today.getMonth() + 1;
  onDateChange('curr');                       // 觸發「日」的重建
  document.getElementById('currD').value = today.getDate();
  recalc();
})();
