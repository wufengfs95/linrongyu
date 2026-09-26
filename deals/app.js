/* 成交地圖：服務範圍（中壢、平鎮）＋ 成交點位（路段層級） */
(function () {
  var D = window.DEALS || {};
  var el = document.getElementById('dealMap');
  if (!el || !window.L) return;

  var map = L.map('dealMap', {
    zoomControl: true, preferCanvas: true, scrollWheelZoom: false, minZoom: 10
  }).setView([24.95, 121.22], 13);          // 先給一個中壢的預設視野，避免還沒算好時看到整個台灣
  L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    maxZoom: 18, attribution: '圖資：國土測繪中心'
  }).addTo(map);

  // 服務範圍：把中壢、平鎮的村里界線畫成一片
  var area = L.layerGroup().addTo(map), bounds = null;
  (D.area || []).forEach(function (poly) {
    var layer = L.polygon(poly, {
      color: '#1F3A5F', weight: 1.2, opacity: .55, fillColor: '#1F3A5F', fillOpacity: .07
    }).addTo(area);
    bounds = bounds ? bounds.extend(layer.getBounds()) : layer.getBounds();
  });

  // 成交點位
  var marks = L.layerGroup().addTo(map);
  (D.deals || []).forEach(function (d) {
    var html = '<span class="dm-pin"><b>' + (d.price >= 1000
      ? (d.price / 10000).toFixed(d.price % 10000 ? 2 : 0).replace(/\.?0+$/, '') + ' 億'
      : d.price + ' 萬') + '</b></span>';
    var m = L.marker(d.pos, {
      icon: L.divIcon({ className: 'dm-icon', html: html, iconSize: [74, 30], iconAnchor: [37, 30] })
    }).addTo(marks);
    m.bindPopup('<b>' + (d.community || d.town + d.road) + '</b><br>' +
      d.ym + '　成交 ' + d.price + ' 萬<br>' + d.town + d.road + '（路段層級）');
    bounds = bounds ? bounds.extend(L.latLng(d.pos)) : L.latLngBounds(d.pos, d.pos);
  });

  var fit = function () {
    map.invalidateSize();
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  };
  fit();
  setTimeout(fit, 250);
  window.addEventListener('load', fit);
  map.on('click', function () { map.scrollWheelZoom.enable(); });
  map.on('mouseout', function () { map.scrollWheelZoom.disable(); });
})();
