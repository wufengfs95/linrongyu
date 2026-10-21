/* 豪宅稅 —— 計算邏輯原封不動沿用舊計算機（calculator/index.html），只換掉版面。
   稅務算式沒有重寫，避免改出錯誤。 */
const FIXED = {
  run: 0.1,              // 代書費（潤筆）
  reg: 0.2,              // 實價登錄費
  clr: 0.6,              // 塗銷費＋稅籍資料
  escrowRate: 0.0003,    // 履保萬分之三
  serviceRate: 0.04,     // 服務費 4%
};

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
let lxSvc = 'p4'; // 'p4'=4% | 'manual'=手動

function setLxSvc(mode) {
  lxSvc = mode;
  document.getElementById('lxSvcSeg').querySelectorAll('button').forEach((b, i) => {
    var on = ['p4','manual'][i] === mode;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.getElementById('lxSvcManualWrap').style.display = mode === 'manual' ? 'block' : 'none';
  calcLuxury();
}

// 解析權利範圍：支援 "1/2"、"7/1000"、"1"、"0.5"
function parseShare(str) {
  if (!str) return { ok: false, val: 0 };
  const s = String(str).trim();
  if (s === '') return { ok: false, val: 0 };
  if (s.includes('/')) {
    const p = s.split('/');
    const a = parseFloat(p[0]), b = parseFloat(p[1]);
    if (isNaN(a) || isNaN(b) || b === 0) return { ok: false, val: 0 };
    return { ok: true, val: a / b };
  }
  const n = parseFloat(s);
  if (isNaN(n)) return { ok: false, val: 0 };
  return { ok: true, val: n };
}

// 房地比（回傳 {ok, ratio, landVal(元)}）
function lxRatio() {
  const landArea = v('lx_landArea');
  const landUnit = v('lx_landUnit');
  const share = parseShare(document.getElementById('lx_landShare').value);
  const houseVal = v('lx_houseVal');
  const landVal = landArea * landUnit * share.val; // 元
  if (houseVal <= 0 || landVal <= 0) return { ok: false, ratio: 0, landVal };
  return { ok: true, ratio: houseVal / (houseVal + landVal), landVal };
}

function calcLuxury() {
  const price = v('lx_price'); // 萬
  const rr = lxRatio();

  // 土地公告現值說明
  const landInfo = document.getElementById('lx_landInfo');
  if (rr.landVal > 0) {
    landInfo.innerHTML = `土地公告現值 = <b>${fmt(v('lx_landArea'))}</b> m² × <b>${fmt0(v('lx_landUnit'))}</b> 元 × 權利範圍 = <b style="color:var(--gold-deep)">${fmt0(rr.landVal)}</b> 元`;
  } else {
    landInfo.textContent = '土地公告現值 = 面積 × 每m²現值 × 權利範圍';
  }

  // 房地比說明
  const ratioInfo = document.getElementById('lx_ratioInfo');
  if (rr.ok) {
    ratioInfo.innerHTML = `房地比 = 房屋 <b>${fmt0(v('lx_houseVal'))}</b> ÷（房屋 + 土地 <b>${fmt0(rr.landVal)}</b>）= <b style="color:var(--gold-deep)">${(rr.ratio*100).toFixed(2)}%</b>`;
  } else {
    ratioInfo.textContent = '房地比 = 房屋評定現值 ÷（房屋評定現值 + 土地公告現值）';
  }

  // 服務費
  const service = lxSvc === 'manual' ? v('lx_svcManual') : price * 0.04;
  const svcInfo = document.getElementById('lx_svcInfo');
  if (lxSvc === 'p4') {
    svcInfo.innerHTML = price > 0
      ? `服務費 = 出售價 <b>${fmt(price)}</b> 萬 × 4% = <b style="color:var(--gold-deep)">${fmt(service)}</b> 萬`
      : '服務費 = 出售價格 × 4%';
  } else {
    svcInfo.innerHTML = `服務費 = 手動輸入 <b style="color:var(--gold-deep)">${fmt(service)}</b> 萬`;
  }

  // 價格或房地比不齊 → 清結果
  const clearIds = ['lx_r_tax','lx_r_net','lx_d_price','lx_d_tax','lx_d_svc','lx_d_landTax','lx_d_run','lx_d_reg','lx_d_esc','lx_d_clr','lx_d_sum'];
  if (price <= 0 || !rr.ok) {
    clearIds.forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('lx_r_ratio').textContent = rr.ok ? (rr.ratio*100).toFixed(2) : '—';
    return;
  }

  const luxTax = price * rr.ratio * 0.20; // 萬
  const landTax = v('lx_landTax');
  const run = FIXED.run, reg = FIXED.reg, clr = FIXED.clr;
  const escrow = price * FIXED.escrowRate; // 履保 售價×萬分之三
  const sumDeduct = luxTax + service + landTax + run + reg + escrow + clr;
  const net = price - sumDeduct;

  document.getElementById('lx_r_ratio').textContent = (rr.ratio*100).toFixed(2);
  document.getElementById('lx_r_tax').textContent = fmt(luxTax);
  document.getElementById('lx_r_net').textContent = fmt(net);

  document.getElementById('lx_d_price').textContent = fmt(price);
  document.getElementById('lx_d_tax').textContent = fmt(luxTax);
  document.getElementById('lx_d_svc').textContent = fmt(service);
  document.getElementById('lx_d_svc_label').textContent = lxSvc === 'p4' ? '服務費（售價 × 4%）' : '服務費（手動輸入）';
  document.getElementById('lx_d_landTax').textContent = fmt(landTax);
  document.getElementById('lx_d_run').textContent = fmt(run);
  document.getElementById('lx_d_reg').textContent = fmt(reg);
  document.getElementById('lx_d_esc').textContent = fmt(escrow);
  document.getElementById('lx_d_clr').textContent = fmt(clr);
  document.getElementById('lx_d_sum').textContent = fmt(sumDeduct);
}

// 反推：net = X − X·R·0.2 − 服務費 − 土增 − 潤筆 − 實登 − X·履保率 − 塗銷
function reverseLuxury() {
  const out = document.getElementById('lx_reverseOut');
  const target = v('lx_targetNet');
  if (target <= 0) { out.style.display = 'none'; return; }
  const rr = lxRatio();
  out.style.display = 'block';
  if (!rr.ok) {
    document.getElementById('lx_rv_total').textContent = '—';
    document.getElementById('lx_rv_note').textContent = '⚠ 請先填土地公告現值三格與房屋評定現值（算房地比）';
    return;
  }
  const landTax = v('lx_landTax');
  const e = FIXED.escrowRate;
  const fixedSum = FIXED.run + FIXED.reg + FIXED.clr; // 潤筆+實登+塗銷（固定）
  const k = rr.ratio * 0.20; // 豪宅稅係數
  let X, note = '';
  if (lxSvc === 'manual') {
    const F = v('lx_svcManual');
    X = (target + landTax + F + fixedSum) / (1 - k - e);
    note = `＊房地比 ${(rr.ratio*100).toFixed(2)}%、服務費固定 ${fmt(F)} 萬`;
  } else {
    const denom = 1 - k - 0.04 - e;
    if (denom <= 0) {
      document.getElementById('lx_rv_total').textContent = '無解';
      document.getElementById('lx_rv_note').textContent = '參數異常（房地比過高）';
      return;
    }
    X = (target + landTax + fixedSum) / denom;
    note = `＊房地比 ${(rr.ratio*100).toFixed(2)}%、服務費 4%`;
  }
  document.getElementById('lx_rv_total').textContent = fmt(X);
  document.getElementById('lx_rv_note').textContent = note;
}

function resetLuxury() {
  if (!confirm('清空豪宅稅所有輸入？')) return;
  ['lx_price','lx_landArea','lx_landUnit','lx_landShare','lx_houseVal','lx_svcManual','lx_landTax','lx_targetNet'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('lx_reverseOut').style.display = 'none';
  setLxSvc('p4');
  calcLuxury();
}

// 初始化豪宅稅
calcLuxury();

// ------- 列印給客戶：把目前算好的數字填進「客戶列印版」再叫出列印 -------

calcLuxury();   // 進頁面先算一次，把明細的預設值填上
