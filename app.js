/* ============================================
   KDKMP PARANG — Sales Dashboard App JS
   ============================================ */

'use strict';

// ─── State ──────────────────────────────────
let DB = null;          // loaded JSON data
let currentSection = 'overview';
let currentPeriod = 'all';   // all | month | week | day
let currentPeriodValue = '';  // e.g. '2026-07' for month
let productSort = { col: 'revenue', dir: 'desc' };

// Chart instances
const charts = {};

// ─── Helpers ────────────────────────────────
const fmt = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const fmtQty = n => Math.round(n).toLocaleString('id-ID') + ' pcs';

function getWeekNumber(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

function formatDateID(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMonthID(ym) {
  const [y, m] = ym.split('-');
  const months = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
  return `${months[parseInt(m)-1]} ${y}`;
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const wn = getWeekNumber(dateStr);
  return `Minggu ${wn} – ${d.getFullYear()}`;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon start
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

// ─── Period Filtering ───────────────────────
function getFilteredDates() {
  const allDates = Object.keys(DB.sales_by_day).sort();
  if (currentPeriod === 'all') return allDates;

  if (currentPeriod === 'month') {
    return allDates.filter(d => d.startsWith(currentPeriodValue));
  }
  if (currentPeriod === 'week') {
    return allDates.filter(d => getWeekStart(d) === currentPeriodValue);
  }
  if (currentPeriod === 'day') {
    return allDates.filter(d => d === currentPeriodValue);
  }
  return allDates;
}

// Aggregate sales for a list of dates
function aggregateSales(dates) {
  // Returns: { product -> { qty, revenue, price, producer } }
  const agg = {};
  for (const date of dates) {
    const day = DB.sales_by_day[date] || {};
    for (const [prod, info] of Object.entries(day)) {
      if (!agg[prod]) {
        agg[prod] = { qty: 0, revenue: 0, price: info.price || 0, producer: info.producer || 'LAINNYA' };
      }
      agg[prod].qty += info.qty;
      agg[prod].revenue += info.revenue;
    }
  }
  return agg;
}

function totalRevenue(agg) {
  return Object.values(agg).reduce((s, v) => s + v.revenue, 0);
}
function totalQty(agg) {
  return Object.values(agg).reduce((s, v) => s + v.qty, 0);
}

// ─── Populate Period Selectors ───────────────
function buildPeriodOptions() {
  const allDates = Object.keys(DB.sales_by_day).sort();
  const sel = document.getElementById('period-select');
  sel.innerHTML = '';

  if (currentPeriod === 'month') {
    const months = [...new Set(allDates.map(d => d.slice(0, 7)))].sort();
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = formatMonthID(m);
      sel.appendChild(opt);
    });
    // Default to last month
    if (!currentPeriodValue || !months.includes(currentPeriodValue)) {
      currentPeriodValue = months[months.length - 1];
    }
    sel.value = currentPeriodValue;
  }

  if (currentPeriod === 'week') {
    const weeks = [...new Set(allDates.map(d => getWeekStart(d)))].sort();
    weeks.forEach(ws => {
      const opt = document.createElement('option');
      opt.value = ws;
      opt.textContent = getWeekLabel(ws) + ' (mulai ' + ws + ')';
      sel.appendChild(opt);
    });
    if (!currentPeriodValue || !weeks.includes(currentPeriodValue)) {
      currentPeriodValue = weeks[weeks.length - 1];
    }
    sel.value = currentPeriodValue;
  }

  if (currentPeriod === 'day') {
    allDates.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = formatDateID(d);
      sel.appendChild(opt);
    });
    if (!currentPeriodValue || !allDates.includes(currentPeriodValue)) {
      currentPeriodValue = allDates[allDates.length - 1];
    }
    sel.value = currentPeriodValue;
  }
}

function buildStockDateOptions() {
  const allDates = Object.keys(DB.stock_by_day).sort().reverse();
  const sel = document.getElementById('stock-date-select');
  sel.innerHTML = '';
  allDates.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = formatDateID(d);
    sel.appendChild(opt);
  });
  sel.value = allDates[0];
  return allDates[0];
}

// ─── Overview Section ───────────────────────
function renderOverview() {
  const dates = getFilteredDates();
  const agg = aggregateSales(dates);
  const rev = totalRevenue(agg);
  const qty = totalQty(agg);
  const activeProd = Object.keys(agg).length;
  const days = dates.length;
  const avgDay = days > 0 ? rev / days : 0;

  // KPI
  document.getElementById('kpi-revenue').textContent = fmt(rev);
  document.getElementById('kpi-revenue-sub').textContent = `${days} hari data`;
  document.getElementById('kpi-qty').textContent = fmtQty(qty);
  document.getElementById('kpi-qty-sub').textContent = `${Math.round(qty / (days || 1)).toLocaleString('id-ID')} pcs/hari`;
  document.getElementById('kpi-products').textContent = activeProd;
  document.getElementById('kpi-products-sub').textContent = `dari ${Object.keys(DB.price_map).length} produk terdaftar`;
  document.getElementById('kpi-daily').textContent = fmt(avgDay);
  document.getElementById('kpi-daily-sub').textContent = 'rata-rata pendapatan harian';

  // Trend chart
  renderTrendChart(dates);

  // Top 5
  renderTop5Chart(agg);

  // Producer pie
  renderProducerChart(agg, 'chart-producer');

  // Qty bar
  renderQtyChart(dates);
}

function renderTrendChart(dates) {
  const labels = [];
  const data = [];
  const allDates = Object.keys(DB.sales_by_day).sort();

  let displayDates = dates;
  // If too many dates, group by week
  if (dates.length > 45) {
    // Group by week
    const weekly = {};
    for (const d of dates) {
      const ws = getWeekStart(d);
      if (!weekly[ws]) weekly[ws] = 0;
      weekly[ws] += Object.values(DB.sales_by_day[d] || {}).reduce((s, v) => s + v.revenue, 0);
    }
    const sortedWeeks = Object.keys(weekly).sort();
    sortedWeeks.forEach(ws => {
      labels.push(ws);
      data.push(weekly[ws]);
    });
    document.getElementById('trend-badge').textContent = 'per Minggu';
  } else if (dates.length > 15) {
    // Show all days but with short labels
    for (const d of dates) {
      const dd = new Date(d + 'T00:00:00');
      labels.push(`${dd.getDate()}/${dd.getMonth()+1}`);
      data.push(Object.values(DB.sales_by_day[d] || {}).reduce((s, v) => s + v.revenue, 0));
    }
    document.getElementById('trend-badge').textContent = 'per Hari';
  } else {
    for (const d of dates) {
      labels.push(formatDateID(d));
      data.push(Object.values(DB.sales_by_day[d] || {}).reduce((s, v) => s + v.revenue, 0));
    }
    document.getElementById('trend-badge').textContent = 'per Hari';
  }

  if (charts.trend) charts.trend.destroy();
  const ctx = document.getElementById('chart-trend').getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(88,166,255,0.3)');
  gradient.addColorStop(1, 'rgba(88,166,255,0.0)');

  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Pendapatan',
        data,
        borderColor: '#58a6ff',
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: dates.length > 30 ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#58a6ff',
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2331',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#7d8590',
          callbacks: {
            label: ctx => ' ' + fmt(ctx.raw)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#7d8590', maxRotation: 45, font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#7d8590', font: { size: 11 },
            callback: v => 'Rp ' + (v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v >= 1e3 ? (v/1e3).toFixed(0)+'rb' : v)
          }
        }
      }
    }
  });
}

function renderTop5Chart(agg) {
  const sorted = Object.entries(agg).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const labels = sorted.map(([p]) => p.length > 22 ? p.slice(0, 22) + '…' : p);
  const data = sorted.map(([, v]) => v.revenue);

  const colors = ['#58a6ff','#3fb950','#bc8cff','#ffa657','#d29922'];

  if (charts.top5) charts.top5.destroy();
  charts.top5 = new Chart(document.getElementById('chart-top5').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: '#161b22', borderWidth: 3, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#7d8590', font: { size: 11 }, padding: 10, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: '#1c2331', borderColor: '#30363d', borderWidth: 1,
          titleColor: '#e6edf3', bodyColor: '#7d8590',
          callbacks: { label: ctx => ' ' + fmt(ctx.raw) }
        }
      }
    }
  });
}

function renderProducerChart(agg, canvasId) {
  const producerRev = {};
  for (const [, v] of Object.entries(agg)) {
    const p = v.producer || 'LAINNYA';
    producerRev[p] = (producerRev[p] || 0) + v.revenue;
  }
  const sorted = Object.entries(producerRev).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sorted.map(([p]) => p);
  const data = sorted.map(([, v]) => v);
  const palette = ['#58a6ff','#3fb950','#bc8cff','#ffa657','#d29922','#f85149','#79c0ff','#56d364'];

  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Pendapatan',
        data,
        backgroundColor: palette.map(c => c + 'bb'),
        borderColor: palette,
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2331', borderColor: '#30363d', borderWidth: 1,
          callbacks: { label: ctx => ' ' + fmt(ctx.raw) }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#7d8590', font: { size: 11 },
            callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v >= 1e3 ? (v/1e3).toFixed(0)+'rb' : v
          }
        },
        y: { grid: { display: false }, ticks: { color: '#7d8590', font: { size: 11 } } }
      }
    }
  });
}

function renderQtyChart(dates) {
  const labels = [];
  const data = [];

  if (dates.length > 45) {
    const weekly = {};
    for (const d of dates) {
      const ws = getWeekStart(d);
      if (!weekly[ws]) weekly[ws] = 0;
      weekly[ws] += Object.values(DB.sales_by_day[d] || {}).reduce((s, v) => s + v.qty, 0);
    }
    Object.keys(weekly).sort().forEach(ws => {
      labels.push(ws);
      data.push(weekly[ws]);
    });
  } else {
    for (const d of dates) {
      const dd = new Date(d + 'T00:00:00');
      labels.push(`${dd.getDate()}/${dd.getMonth()+1}`);
      data.push(Object.values(DB.sales_by_day[d] || {}).reduce((s, v) => s + v.qty, 0));
    }
  }

  if (charts.qty) charts.qty.destroy();
  const ctx = document.getElementById('chart-qty').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(63,185,80,0.4)');
  gradient.addColorStop(1, 'rgba(63,185,80,0.0)');

  charts.qty = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Qty Terjual',
        data,
        backgroundColor: gradient,
        borderColor: '#3fb950',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2331', borderColor: '#30363d', borderWidth: 1,
          callbacks: { label: ctx => ' ' + ctx.raw.toLocaleString('id-ID') + ' pcs' }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7d8590', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7d8590', font: { size: 11 } } }
      }
    }
  });
}

// ─── Products Section ────────────────────────
function renderProducts() {
  const dates = getFilteredDates();
  const agg = aggregateSales(dates);

  // Get last date for current stock
  const allDates = Object.keys(DB.stock_by_day).sort();
  const lastDate = allDates[allDates.length - 1];
  const lastStock = DB.stock_by_day[lastDate] || {};

  // Build rows
  let rows = Object.entries(agg).map(([name, v]) => ({
    name,
    producer: v.producer || 'LAINNYA',
    price: v.price || 0,
    qty: v.qty,
    revenue: v.revenue,
    lastStock: lastStock[name] || 0,
  }));

  // Add products with zero sales but in price map
  // (skip for now to keep it focused on sold items)

  // Sort
  const col = productSort.col;
  const dir = productSort.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (col === 'name' || col === 'producer') {
      return dir * a[col].localeCompare(b[col]);
    }
    return dir * (a[col] - b[col]);
  });

  // Filter
  const searchQ = document.getElementById('product-search').value.toLowerCase();
  const producerQ = document.getElementById('producer-filter').value;

  rows = rows.filter(r => {
    if (searchQ && !r.name.toLowerCase().includes(searchQ)) return false;
    if (producerQ && r.producer !== producerQ) return false;
    return true;
  });

  // Populate producer filter
  const allProducers = [...new Set(Object.entries(agg).map(([, v]) => v.producer || 'LAINNYA'))].sort();
  const pf = document.getElementById('producer-filter');
  const currentPF = pf.value;
  pf.innerHTML = '<option value="">Semua Produsen</option>';
  allProducers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    if (p === currentPF) opt.selected = true;
    pf.appendChild(opt);
  });

  const tbody = document.getElementById('product-tbody');
  const maxRev = Math.max(...rows.map(r => r.revenue), 1);

  tbody.innerHTML = rows.length === 0
    ? '<tr><td colspan="7" class="no-data">Tidak ada data untuk filter yang dipilih</td></tr>'
    : rows.map((r, i) => `
    <tr>
      <td class="text-muted">${i + 1}</td>
      <td><strong>${r.name}</strong></td>
      <td><span class="badge badge-blue">${r.producer}</span></td>
      <td class="text-accent font-mono">${r.price > 0 ? fmt(r.price) : '<span class="text-muted">-</span>'}</td>
      <td>${r.qty.toLocaleString('id-ID')} pcs</td>
      <td>
        <div class="progress-bar-wrap">
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${(r.revenue/maxRev*100).toFixed(1)}%"></div></div>
          <span class="text-green font-mono" style="min-width:80px">${fmt(r.revenue)}</span>
        </div>
      </td>
      <td>${r.lastStock > 0 ? `<span class="badge badge-green">${r.lastStock} pcs</span>` : `<span class="badge badge-gray">0</span>`}</td>
    </tr>`).join('');

  document.getElementById('product-count').textContent = `${rows.length} produk`;
}

// ─── Producers Section ───────────────────────
function renderProducers() {
  const dates = getFilteredDates();
  const agg = aggregateSales(dates);
  const totalRev = totalRevenue(agg);

  const producerData = {};
  for (const [name, v] of Object.entries(agg)) {
    const p = v.producer || 'LAINNYA';
    if (!producerData[p]) producerData[p] = { products: new Set(), qty: 0, revenue: 0 };
    producerData[p].products.add(name);
    producerData[p].qty += v.qty;
    producerData[p].revenue += v.revenue;
  }

  const sorted = Object.entries(producerData).sort((a, b) => b[1].revenue - a[1].revenue);

  // Charts
  renderProducerChart(agg, 'chart-producer2');

  // Qty chart by producer
  const labels = sorted.map(([p]) => p);
  const qtyData = sorted.map(([, v]) => v.qty);
  const palette = ['#58a6ff','#3fb950','#bc8cff','#ffa657','#d29922','#f85149','#79c0ff','#56d364'];

  if (charts['chart-producer-qty']) charts['chart-producer-qty'].destroy();
  charts['chart-producer-qty'] = new Chart(document.getElementById('chart-producer-qty').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Qty Terjual',
        data: qtyData,
        backgroundColor: palette.map(c => c + 'bb'),
        borderColor: palette,
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2331', borderColor: '#30363d', borderWidth: 1,
          callbacks: { label: ctx => ' ' + ctx.raw.toLocaleString('id-ID') + ' pcs' }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7d8590', font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { color: '#7d8590', font: { size: 11 } } }
      }
    }
  });

  // Table
  const tbody = document.getElementById('producer-tbody');
  tbody.innerHTML = sorted.map(([p, v]) => {
    const pct = totalRev > 0 ? (v.revenue / totalRev * 100).toFixed(1) : '0.0';
    return `
    <tr>
      <td><strong>${p}</strong></td>
      <td>${v.products.size}</td>
      <td>${v.qty.toLocaleString('id-ID')} pcs</td>
      <td class="text-green font-mono">${fmt(v.revenue)}</td>
      <td>
        <div class="progress-bar-wrap">
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <span style="min-width:42px">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── Stock Section ───────────────────────────
function renderStock(dateStr) {
  if (!dateStr) return;
  document.getElementById('stock-table-title').textContent = `Stok Opname – ${formatDateID(dateStr)}`;

  const stockDay = DB.stock_by_day[dateStr] || {};

  // Get previous day stock for sold calculation
  const allDates = Object.keys(DB.stock_by_day).sort();
  const idx = allDates.indexOf(dateStr);
  const prevDate = idx > 0 ? allDates[idx - 1] : null;
  const prevStock = prevDate ? (DB.stock_by_day[prevDate] || {}) : {};

  // KPIs for stock day
  let totalItems = 0, totalValue = 0, lowStockCount = 0;
  for (const [prod, qty] of Object.entries(stockDay)) {
    if (qty > 0) {
      totalItems++;
      const price = DB.price_map[prod.toUpperCase()] || 0;
      totalValue += qty * price;
      if (qty > 0 && qty <= 5) lowStockCount++;
    }
  }

  const kpiEl = document.getElementById('stock-kpis');
  kpiEl.innerHTML = `
    <div class="kpi-card kpi-revenue">
      <div class="kpi-icon">&#x1F4E6;</div>
      <div class="kpi-body">
        <div class="kpi-label">Produk Tersedia</div>
        <div class="kpi-value">${totalItems}</div>
        <div class="kpi-sub">dengan stok > 0</div>
      </div>
    </div>
    <div class="kpi-card kpi-qty">
      <div class="kpi-icon">&#x1F4B0;</div>
      <div class="kpi-body">
        <div class="kpi-label">Nilai Stok</div>
        <div class="kpi-value" style="font-size:18px">${fmt(totalValue)}</div>
        <div class="kpi-sub">estimasi nilai inventori</div>
      </div>
    </div>
    <div class="kpi-card kpi-products">
      <div class="kpi-icon">&#x26A0;</div>
      <div class="kpi-body">
        <div class="kpi-label">Stok Menipis</div>
        <div class="kpi-value text-red">${lowStockCount}</div>
        <div class="kpi-sub">produk stok &le; 5</div>
      </div>
    </div>
    <div class="kpi-card kpi-daily">
      <div class="kpi-icon">&#x1F4C5;</div>
      <div class="kpi-body">
        <div class="kpi-label">Tanggal</div>
        <div class="kpi-value" style="font-size:15px">${formatDateID(dateStr)}</div>
        <div class="kpi-sub">data stok opname</div>
      </div>
    </div>`;

  // Build table rows
  const searchQ = document.getElementById('stock-search').value.toLowerCase();
  let rows = Object.entries(stockDay)
    .filter(([p, qty]) => qty >= 0 && (p.toLowerCase().includes(searchQ) || !searchQ))
    .map(([prod, qty]) => {
      const key = prod.toUpperCase();
      const price = DB.price_map[key] || 0;
      const producer = DB.producer_map[key] || 'LAINNYA';
      const stockValue = qty * price;
      const prevQty = prevStock[prod] || 0;
      const sold = prevQty - qty;
      return { prod, producer, qty, price, stockValue, sold };
    })
    .sort((a, b) => b.stockValue - a.stockValue);

  let tvTotal = 0;
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = rows.length === 0
    ? '<tr><td colspan="7" class="no-data">Tidak ada data stok untuk tanggal ini</td></tr>'
    : rows.map((r, i) => {
        tvTotal += r.stockValue;
        const stockBadge = r.qty === 0 ? 'badge-gray' : r.qty <= 5 ? 'badge-red' : 'badge-green';
        const soldBadge = r.sold > 0 ? `<span class="text-green">-${r.sold} pcs</span>` :
                          r.sold < 0 ? `<span class="text-accent">+${Math.abs(r.sold)} pcs</span>` :
                          '<span class="text-muted">-</span>';
        return `
        <tr>
          <td class="text-muted">${i + 1}</td>
          <td><strong>${r.prod}</strong></td>
          <td><span class="badge badge-blue">${r.producer}</span></td>
          <td><span class="badge ${stockBadge}">${r.qty} pcs</span></td>
          <td class="font-mono">${r.price > 0 ? fmt(r.price) : '<span class="text-muted">-</span>'}</td>
          <td class="font-mono">${r.stockValue > 0 ? fmt(r.stockValue) : '<span class="text-muted">-</span>'}</td>
          <td>${soldBadge}</td>
        </tr>`;
      }).join('');

  document.getElementById('stock-count').textContent = `${rows.length} produk`;
  document.getElementById('stock-total-value').textContent = `Nilai total: ${fmt(tvTotal)}`;
}

// ─── Navigation ──────────────────────────────
function showSection(name) {
  currentSection = name;

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`section-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');

  const titles = { overview: 'Ringkasan Penjualan', products: 'Daftar Produk', producers: 'Analisis Produsen', stock: 'Stok Opname' };
  document.getElementById('page-title').textContent = titles[name] || name;

  // Show/hide filter group (not for stock)
  const fg = document.getElementById('filter-group');
  fg.style.display = name === 'stock' ? 'none' : 'flex';

  renderSection();
}

function renderSection() {
  if (currentSection === 'overview') renderOverview();
  if (currentSection === 'products') renderProducts();
  if (currentSection === 'producers') renderProducers();
  // stock handled separately
}

// ─── Event Listeners ─────────────────────────
function setupEvents() {
  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showSection(item.dataset.section);
    });
  });

  // Hamburger
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  document.getElementById('hamburger').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
  });

  // Period tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPeriod = tab.dataset.period;
      currentPeriodValue = '';

      const fs = document.getElementById('filter-selector');
      if (currentPeriod === 'all') {
        fs.style.display = 'none';
      } else {
        fs.style.display = 'block';
        buildPeriodOptions();
      }
      renderSection();
    });
  });

  // Period select change
  document.getElementById('period-select').addEventListener('change', e => {
    currentPeriodValue = e.target.value;
    renderSection();
  });

  // Product search
  document.getElementById('product-search').addEventListener('input', renderProducts);
  document.getElementById('producer-filter').addEventListener('change', renderProducts);

  // Product table sort
  document.querySelectorAll('#product-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (productSort.col === col) {
        productSort.dir = productSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        productSort.col = col;
        productSort.dir = 'desc';
      }
      renderProducts();
    });
  });

  // Stock date select
  const stockSel = document.getElementById('stock-date-select');
  stockSel.addEventListener('change', e => {
    renderStock(e.target.value);
  });

  // Stock search
  document.getElementById('stock-search').addEventListener('input', () => {
    renderStock(document.getElementById('stock-date-select').value);
  });
}

// ─── Storage (IndexedDB) ──────────────────────
const IDB_NAME = 'kdkmp_dashboard_db';
const IDB_STORE = 'dashboard_store';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToStorage(data) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, 'active_db');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Gagal menyimpan ke IndexedDB:', err);
    return false;
  }
}

async function loadFromStorage() {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('active_db');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal membaca dari IndexedDB:', err);
    return null;
  }
}

async function clearStorage() {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete('active_db');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Gagal menghapus IndexedDB:', err);
    return false;
  }
}

// ─── Toast & Notifications ───────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const text = document.getElementById('toast-text');
  if (!toast) return;
  icon.innerHTML = isError ? '&#x274C;' : '&#x2705;';
  text.textContent = msg;
  toast.style.borderColor = isError ? 'var(--red)' : 'var(--green)';
  toast.style.boxShadow = isError ? '0 8px 30px rgba(0,0,0,0.5), 0 0 16px rgba(248,81,73,0.3)' : '0 8px 30px rgba(0,0,0,0.5), 0 0 16px rgba(63,185,80,0.25)';
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4500);
}

function updateProgress(percent, text, logType = 'info') {
  const box = document.getElementById('import-progress-box');
  const title = document.getElementById('progress-title');
  const perc = document.getElementById('progress-percent');
  const fill = document.getElementById('progress-fill');
  const log = document.getElementById('progress-log');

  if (!box) return;
  box.style.display = 'block';
  if (title) title.textContent = text;
  if (perc) perc.textContent = percent + '%';
  if (fill) fill.style.width = percent + '%';

  if (text && log) {
    const item = document.createElement('div');
    item.className = 'log-item ' + logType;
    item.textContent = `[${new Date().toLocaleTimeString('id-ID')}] ${text}`;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }
}

function resetProgress() {
  const box = document.getElementById('import-progress-box');
  const fill = document.getElementById('progress-fill');
  const log = document.getElementById('progress-log');
  if (box) box.style.display = 'none';
  if (fill) fill.style.width = '0%';
  if (log) log.innerHTML = '';
}

// ─── Data Extraction & Parsing ───────────────
function extractSpreadsheetId(url) {
  if (!url) return null;
  url = url.trim();
  if (/^[a-zA-Z0-9-_]{20,60}$/.test(url)) return url;
  const m1 = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (m2) return m2[1];
  return null;
}

const MANUAL_DATE_OVERRIDES = {
  '4826': '2026-08-04',
  '4926': '2026-09-04',
  '24926': '2026-09-24',
  '772026': '2026-07-07',
  '21-7-2024': '2026-07-21',
};

function parseSheetDate(sheetName) {
  if (!sheetName) return null;
  const s = String(sheetName).trim();
  if (MANUAL_DATE_OVERRIDES[s]) return MANUAL_DATE_OVERRIDES[s];

  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s*$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})\s*$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  m = s.match(/^(\d{1,2})(\d{2})(\d{2})\s*$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

function parsePriceWorkbook(wbPrice) {
  const firstSheetName = wbPrice.SheetNames[0];
  const ws = wbPrice.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const priceMap = {};
  const producerMap = {};
  let currentProducer = 'LAINNYA';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    if (row[0] !== null && row[0] !== undefined && String(row[0]).trim() !== '') {
      currentProducer = String(row[0]).trim();
    }
    if (row[1] !== null && row[1] !== undefined && String(row[1]).trim() !== '') {
      const prodName = String(row[1]).trim();
      const key = prodName.toUpperCase();
      let price = row[2];
      if (typeof price === 'string') {
        price = parseFloat(price.replace(/[^0-9.-]/g, '')) || 0;
      } else if (typeof price !== 'number') {
        price = 0;
      }
      priceMap[key] = price;
      producerMap[key] = currentProducer || 'LAINNYA';
    }
  }
  return { priceMap, producerMap };
}

function parseStockWorkbook(wbStock, priceMap, producerMap, progressCb) {
  const dailyData = {};
  const dailyDataFull = {};
  const totalSheets = wbStock.SheetNames.length;

  for (let idx = 0; idx < totalSheets; idx++) {
    const sheetName = wbStock.SheetNames[idx];
    if (progressCb && idx % 10 === 0) {
      progressCb(Math.round(15 + (idx / totalSheets) * 55), `Membaca stok (${idx + 1}/${totalSheets}): sheet ${sheetName}`);
    }

    const dateStr = parseSheetDate(sheetName);
    if (!dateStr) continue;

    const ws = wbStock.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const productStock = {};
    const productFull = {};

    for (let r = 6; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row[1] === null || row[1] === undefined) continue;
      const product = String(row[1]).trim();
      if (!product || product === 'Nama Produk') continue;

      const groc = typeof row[2] === 'number' ? row[2] : (parseFloat(row[2]) || 0);
      const wh = typeof row[3] === 'number' ? row[3] : (parseFloat(row[3]) || 0);
      const total = typeof row[4] === 'number' ? row[4] : (parseFloat(row[4]) || (groc + wh));

      productStock[product] = total;
      productFull[product] = {
        groceries: groc,
        warehouse: wh,
        total: total
      };
    }

    dailyData[dateStr] = productStock;
    dailyDataFull[dateStr] = productFull;
  }

  if (progressCb) progressCb(75, 'Menghitung transaksi penjualan harian...');

  const sortedDates = Object.keys(dailyData).sort();
  const salesData = {};

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1];
    const currDate = sortedDates[i];
    const prevStock = dailyData[prevDate] || {};
    const currStock = dailyData[currDate] || {};
    const dailySales = {};

    const allProducts = new Set([...Object.keys(prevStock), ...Object.keys(currStock)]);
    for (const product of allProducts) {
      const prevQty = prevStock[product] || 0;
      const currQty = currStock[product] || 0;
      const sold = prevQty - currQty;
      if (sold > 0) {
        const key = product.toUpperCase();
        const price = priceMap[key] || 0;
        dailySales[product] = {
          qty: sold,
          price: price,
          revenue: sold * price,
          producer: producerMap[key] || 'LAINNYA'
        };
      }
    }
    salesData[currDate] = dailySales;
  }

  if (progressCb) progressCb(95, 'Menyelesaikan agregasi database...');

  return {
    price_map: priceMap,
    producer_map: producerMap,
    sales_by_day: salesData,
    stock_by_day: dailyData,
    stock_full_by_day: dailyDataFull,
    meta: {
      source: 'custom_import',
      imported_at: new Date().toLocaleString('id-ID'),
      stock_days_count: sortedDates.length,
      sales_days_count: Object.keys(salesData).length,
      date_range: sortedDates.length > 0 ? `${sortedDates[0]} s/d ${sortedDates[sortedDates.length - 1]}` : '-'
    }
  };
}

// ─── Applying & Resetting Database ───────────
async function applyNewDatabase(newDB, successMessage) {
  DB = newDB;
  await saveToStorage(newDB);

  // Rebuild period selectors
  currentPeriodValue = '';
  const fs = document.getElementById('filter-selector');
  if (currentPeriod !== 'all') {
    fs.style.display = 'block';
    buildPeriodOptions();
  } else {
    fs.style.display = 'none';
  }

  // Stock selector
  const firstStockDate = buildStockDateOptions();
  renderStock(firstStockDate);

  // Update status badges and views
  updateDataStatusBadge();
  updateStatusTabInfo();
  renderSection();

  updateProgress(100, 'Berhasil memperbarui analisis!', 'success');

  setTimeout(() => {
    closeImportModal();
    showToast(successMessage || 'Data analisis berhasil diperbarui!');
  }, 800);
}

function updateDataStatusBadge() {
  const stockDays = Object.keys(DB.stock_by_day || {}).length;
  const isCustom = DB.meta && DB.meta.source === 'custom_import';

  const pillText = document.getElementById('pill-text');
  const pill = document.getElementById('data-status-pill');
  if (pillText) {
    pillText.textContent = isCustom ? `${stockDays} Hari (Impor Baru)` : `${stockDays} Hari Data`;
  }
  if (pill) {
    pill.title = isCustom ? `Diimpor: ${DB.meta.imported_at}` : 'Data bawaan toko KDKMP PARANG';
  }

  const sub = document.getElementById('sidebar-import-sub');
  if (sub) {
    sub.textContent = isCustom ? 'Data Kustom Aktif' : 'Google Sheets & Excel';
  }

  const footer = document.getElementById('sidebar-footer-text');
  if (footer) {
    const dates = Object.keys(DB.stock_by_day || {}).sort();
    if (dates.length > 0) {
      footer.textContent = `Data: ${dates[0]} s/d ${dates[dates.length - 1]}`;
    }
  }
}

function updateStatusTabInfo() {
  const isCustom = DB.meta && DB.meta.source === 'custom_import';
  const dates = Object.keys(DB.stock_by_day || {}).sort();
  const salesDates = Object.keys(DB.sales_by_day || {}).sort();

  const src = document.getElementById('info-data-source');
  if (src) src.textContent = isCustom ? 'Impor Kustom (IndexedDB)' : 'Default (data.json bawaan)';

  const rng = document.getElementById('info-data-range');
  if (rng) rng.textContent = dates.length > 0 ? `${dates[0]} s/d ${dates[dates.length - 1]}` : '-';

  const sDays = document.getElementById('info-stock-days');
  if (sDays) sDays.textContent = `${dates.length} hari`;

  const saDays = document.getElementById('info-sales-days');
  if (saDays) saDays.textContent = `${salesDates.length} hari`;

  const lastImp = document.getElementById('info-last-imported');
  if (lastImp) lastImp.textContent = (DB.meta && DB.meta.imported_at) ? DB.meta.imported_at : 'Saat aplikasi dimuat pertama kali';
}

function openImportModal(initialTab = 'tab-link') {
  const modal = document.getElementById('import-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchModalTab(initialTab);
  updateStatusTabInfo();
}

function closeImportModal() {
  const modal = document.getElementById('import-modal');
  if (!modal) return;
  modal.style.display = 'none';
  resetProgress();
}

function switchModalTab(tabId) {
  document.querySelectorAll('.modal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  document.querySelectorAll('.modal-tab-content').forEach(p => {
    p.classList.toggle('active', p.id === 'pane-' + tabId);
  });
}

// ─── Setup Import Modal Events ───────────────
let selectedStockFile = null;
let selectedPriceFile = null;

function setupImportEvents() {
  // Modal open & close buttons
  document.getElementById('btn-open-import')?.addEventListener('click', () => openImportModal('tab-link'));
  document.getElementById('btn-open-import-header')?.addEventListener('click', () => openImportModal('tab-link'));
  document.getElementById('btn-close-modal')?.addEventListener('click', closeImportModal);

  document.getElementById('import-modal')?.addEventListener('click', e => {
    if (e.target.id === 'import-modal') closeImportModal();
  });

  // Modal tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchModalTab(tab.dataset.tab);
    });
  });

  // Open link buttons (external tab)
  document.getElementById('btn-open-stock-link')?.addEventListener('click', () => {
    const val = document.getElementById('input-link-stock')?.value.trim();
    if (val) window.open(val, '_blank');
  });
  document.getElementById('btn-open-price-link')?.addEventListener('click', () => {
    const val = document.getElementById('input-link-price')?.value.trim();
    if (val) window.open(val, '_blank');
  });

  // 1. FETCH GOOGLE SHEETS
  document.getElementById('btn-fetch-sheets')?.addEventListener('click', async () => {
    const stockUrl = document.getElementById('input-link-stock')?.value.trim();
    const priceUrl = document.getElementById('input-link-price')?.value.trim();

    if (!stockUrl && !priceUrl) {
      showToast('Harap masukkan minimal Link Spreadsheet Stok Opname!', true);
      return;
    }

    const stockId = extractSpreadsheetId(stockUrl);
    const priceId = extractSpreadsheetId(priceUrl);

    if (!stockId) {
      showToast('Link Google Sheets Stok Opname tidak valid!', true);
      return;
    }

    resetProgress();
    updateProgress(5, 'Menyiapkan permintaan Google Spreadsheet...', 'info');

    // Update download helper links in case direct CORS is restricted
    const directStockLink = document.getElementById('link-download-direct-stock');
    const directPriceLink = document.getElementById('link-download-direct-price');
    const corsHelp = document.getElementById('link-export-help');

    if (directStockLink) directStockLink.href = `https://docs.google.com/spreadsheets/d/${stockId}/export?format=xlsx`;
    if (directPriceLink && priceId) directPriceLink.href = `https://docs.google.com/spreadsheets/d/${priceId}/export?format=xlsx`;

    let priceMap = Object.assign({}, DB.price_map || {});
    let producerMap = Object.assign({}, DB.producer_map || {});

    // Step 1: Fetch Price Sheet if provided
    if (priceId) {
      updateProgress(15, 'Mengunduh data Daftar Harga dari Google Sheets...', 'info');
      try {
        const priceCsvUrl = `https://docs.google.com/spreadsheets/d/${priceId}/gviz/tq?tqx=out:csv`;
        const resp = await fetch(priceCsvUrl);
        if (!resp.ok) throw new Error('Status respon ' + resp.status);
        const csvText = await resp.text();
        const wbPrice = XLSX.read(csvText, { type: 'string' });
        const parsedPrice = parsePriceWorkbook(wbPrice);
        priceMap = parsedPrice.priceMap;
        producerMap = parsedPrice.producerMap;
        updateProgress(30, `Berhasil membaca ${Object.keys(priceMap).length} harga produk!`, 'success');
      } catch (err) {
        updateProgress(30, `Catatan: Gagal memuat daftar harga via link (${err.message}), menggunakan data harga sebelumnya.`, 'error');
      }
    }

    // Step 2: Fetch Stock Sheet
    updateProgress(40, 'Mengunduh file Stok Opname dari Google Sheets...', 'info');
    const stockExportUrl = `https://docs.google.com/spreadsheets/d/${stockId}/export?format=xlsx`;

    try {
      const resp = await fetch(stockExportUrl);
      if (!resp.ok) throw new Error('Status unduhan: ' + resp.status);
      const buffer = await resp.arrayBuffer();

      updateProgress(60, 'Mengekstrak lembar stok opname...', 'info');
      const wbStock = XLSX.read(buffer, { type: 'array' });

      updateProgress(70, `Ditemukan ${wbStock.SheetNames.length} sheet. Memproses analisis...`, 'info');
      const newDB = parseStockWorkbook(wbStock, priceMap, producerMap, (p, text) => {
        updateProgress(p, text, 'info');
      });

      await applyNewDatabase(newDB, 'Analisis dari Google Spreadsheet berhasil dimuat!');

    } catch (err) {
      // CORS or network restriction detected
      updateProgress(50, `Akses langsung dibatasi oleh kebijakan CORS Google: ${err.message}`, 'error');
      if (corsHelp) corsHelp.style.display = 'flex';
      showToast('Google membatasi akses lintas domain (CORS). Silakan gunakan tombol unduh di bawah.', true);
    }
  });

  // 2. EXCEL FILE DRAG & DROP & UPLOAD
  const dropStock = document.getElementById('dropzone-stock');
  const dropPrice = document.getElementById('dropzone-price');
  const fileStockInput = document.getElementById('file-stock');
  const filePriceInput = document.getElementById('file-price');
  const btnProcessFiles = document.getElementById('btn-process-files');

  function checkFileReady() {
    if (selectedStockFile) {
      btnProcessFiles.removeAttribute('disabled');
    } else {
      btnProcessFiles.setAttribute('disabled', 'true');
    }
  }

  // Stock Dropzone
  dropStock?.addEventListener('click', () => fileStockInput?.click());
  fileStockInput?.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      selectedStockFile = e.target.files[0];
      dropStock.classList.add('has-file');
      document.getElementById('status-file-stock').textContent = `✅ ${selectedStockFile.name} (${(selectedStockFile.size / 1024 / 1024).toFixed(1)} MB)`;
      checkFileReady();
    }
  });

  // Price Dropzone
  dropPrice?.addEventListener('click', () => filePriceInput?.click());
  filePriceInput?.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      selectedPriceFile = e.target.files[0];
      dropPrice.classList.add('has-file');
      document.getElementById('status-file-price').textContent = `✅ ${selectedPriceFile.name} (${(selectedPriceFile.size / 1024).toFixed(0)} KB)`;
      checkFileReady();
    }
  });

  // Drag and Drop Listeners
  [dropStock, dropPrice].forEach(zone => {
    if (!zone) return;
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  });

  dropStock?.addEventListener('drop', e => {
    e.preventDefault();
    dropStock.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectedStockFile = e.dataTransfer.files[0];
      dropStock.classList.add('has-file');
      document.getElementById('status-file-stock').textContent = `✅ ${selectedStockFile.name} (${(selectedStockFile.size / 1024 / 1024).toFixed(1)} MB)`;
      checkFileReady();
    }
  });

  dropPrice?.addEventListener('drop', e => {
    e.preventDefault();
    dropPrice.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectedPriceFile = e.dataTransfer.files[0];
      dropPrice.classList.add('has-file');
      document.getElementById('status-file-price').textContent = `✅ ${selectedPriceFile.name} (${(selectedPriceFile.size / 1024).toFixed(0)} KB)`;
      checkFileReady();
    }
  });

  // Process Files Button
  btnProcessFiles?.addEventListener('click', async () => {
    if (!selectedStockFile) {
      showToast('Pilih file Stok Opname (.xlsx) terlebih dahulu!', true);
      return;
    }

    resetProgress();
    updateProgress(5, 'Membaca file yang diunggah di browser...', 'info');

    let priceMap = Object.assign({}, DB.price_map || {});
    let producerMap = Object.assign({}, DB.producer_map || {});

    try {
      // Read price file if provided
      if (selectedPriceFile) {
        updateProgress(15, `Membaca file harga: ${selectedPriceFile.name}...`, 'info');
        const priceBuffer = await selectedPriceFile.arrayBuffer();
        const wbPrice = XLSX.read(priceBuffer, { type: 'array' });
        const parsedPrice = parsePriceWorkbook(wbPrice);
        priceMap = parsedPrice.priceMap;
        producerMap = parsedPrice.producerMap;
        updateProgress(25, `Berhasil membaca ${Object.keys(priceMap).length} harga produk!`, 'success');
      } else {
        updateProgress(20, 'Menggunakan daftar harga yang sudah tersimpan.', 'info');
      }

      // Read stock file
      updateProgress(35, `Membaca file stok opname: ${selectedStockFile.name}...`, 'info');
      const stockBuffer = await selectedStockFile.arrayBuffer();
      const wbStock = XLSX.read(stockBuffer, { type: 'array' });

      updateProgress(45, `Berhasil membuka ${wbStock.SheetNames.length} sheet stok opname!`, 'success');

      const newDB = parseStockWorkbook(wbStock, priceMap, producerMap, (p, text) => {
        updateProgress(p, text, 'info');
      });

      await applyNewDatabase(newDB, `Analisis selesai! ${newDB.meta.stock_days_count} hari stok diproses.`);

    } catch (err) {
      console.error(err);
      updateProgress(50, `Terjadi kesalahan saat memproses file: ${err.message}`, 'error');
      showToast('Gagal memproses file: ' + err.message, true);
    }
  });

  // 3. RESET BUTTON
  document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
    if (!confirm('Apakah Anda yakin ingin mengembalikan data ke data orisinal toko (data.json)?')) return;

    resetProgress();
    updateProgress(10, 'Mengembalikan ke data default...', 'info');

    try {
      await clearStorage();
      const resp = await fetch('data.json');
      if (!resp.ok) throw new Error('Gagal mengunduh data.json bawaan');
      const defaultDB = await resp.json();
      defaultDB.meta = {
        source: 'default_data_json',
        imported_at: 'Data Bawaan Asli',
        stock_days_count: Object.keys(defaultDB.stock_by_day || {}).length,
        sales_days_count: Object.keys(defaultDB.sales_by_day || {}).length,
        date_range: '16 Juni 2026 s/d 11 Oktober 2026'
      };

      DB = defaultDB;

      // Rebuild period selectors
      currentPeriodValue = '';
      const fs = document.getElementById('filter-selector');
      if (currentPeriod !== 'all') {
        fs.style.display = 'block';
        buildPeriodOptions();
      } else {
        fs.style.display = 'none';
      }

      const firstStockDate = buildStockDateOptions();
      renderStock(firstStockDate);

      updateDataStatusBadge();
      updateStatusTabInfo();
      renderSection();

      updateProgress(100, 'Berhasil dikembalikan ke data bawaan!', 'success');
      setTimeout(() => {
        closeImportModal();
        showToast('Data dashboard telah dikembalikan ke data orisinal!');
      }, 700);

    } catch (err) {
      showToast('Gagal mereset data: ' + err.message, true);
    }
  });
}

// ─── Init ────────────────────────────────────
async function init() {
  try {
    // 1. Cek penyimpanan IndexedDB
    const stored = await loadFromStorage();
    if (stored && stored.sales_by_day && Object.keys(stored.sales_by_day).length > 0) {
      DB = stored;
      console.log('Memuat data aktif dari penyimpanan IndexedDB browser');
    } else {
      const resp = await fetch('data.json');
      if (!resp.ok) throw new Error('Failed to load data.json');
      DB = await resp.json();
      DB.meta = {
        source: 'default_data_json',
        imported_at: 'Data Bawaan Toko',
        stock_days_count: Object.keys(DB.stock_by_day || {}).length,
        sales_days_count: Object.keys(DB.sales_by_day || {}).length,
        date_range: '16 Juni 2026 s/d 11 Oktober 2026'
      };
    }

    // Init stock date selector
    const firstStockDate = buildStockDateOptions();
    renderStock(firstStockDate);

    document.getElementById('loading').classList.add('hidden');

    setupEvents();
    setupImportEvents();
    updateDataStatusBadge();
    showSection('overview');

  } catch (err) {
    document.getElementById('loading').innerHTML =
      `<div style="color:#f85149;font-size:16px">&#x274C; Gagal memuat data:<br><code style="font-size:12px">${err.message}</code></div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
