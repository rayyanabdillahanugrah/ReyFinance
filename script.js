'use strict';
const PIE_COLORS = [
  '#2D9864', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#A3E635',
  '#6366F1', '#FB923C', '#34D399', '#F472B6', '#60A5FA'
];

const CATEGORY_ICONS = {
  'Gaji': '💰', 'Freelance': '💻', 'Investasi': '📈',
  'Bisnis': '🏢', 'Hadiah': '🎁', 'Lainnya Masuk': '➕',
  'Makanan': '🍽️', 'Transport': '🚗', 'Belanja': '🛍️',
  'Tagihan': '📄', 'Kesehatan': '💊', 'Hiburan': '🎬',
  'Pendidikan': '📚', 'Hunian': '🏠', 'Asuransi': '🛡️',
  'Tabungan': '🏦', 'Lainnya Keluar': '💸'
};

let transactions = [];
let currentPage = 'dashboard';
let currentType = 'pemasukan';
let barChartInstance = null;
let pieChartInstance = null;
let confirmCallback = null;

document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  setPageDate();
  loadApiSettings();
  navigateTo('dashboard');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('txDate').value = today;
});

function loadFromStorage() {
  try {
    const stored = localStorage.getItem('reyfinance_transactions');
    transactions = stored ? JSON.parse(stored) : [];
  } catch {
    transactions = [];
  }
}

function saveToStorage() {
  localStorage.setItem('reyfinance_transactions', JSON.stringify(transactions));
}

function loadApiSettings() {
  const key = localStorage.getItem('reyfinance_api_key') || '';
  const model = localStorage.getItem('reyfinance_ai_model') || 'gpt-4o';
  document.getElementById('apiKeyInput').value = key;
  document.getElementById('aiModelSelect').value = model;
}

function saveApiSettings() {
  const key = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('aiModelSelect').value;

  if (!key) {
    showSettingsStatus('API Key tidak boleh kosong.', 'error');
    return;
  }

  if (!key.startsWith('sk-')) {
    showSettingsStatus('Format API Key tidak valid. Harus dimulai dengan "sk-".', 'error');
    return;
  }

  localStorage.setItem('reyfinance_api_key', key);
  localStorage.setItem('reyfinance_ai_model', model);
  showSettingsStatus('✓ Pengaturan berhasil disimpan!', 'success');
  showToast('API Key tersimpan!', 'success');
}

function showSettingsStatus(msg, type) {
  const el = document.getElementById('settingsStatus');
  el.textContent = msg;
  el.className = `settings-status settings-status--${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}


function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'transaksi': 'Transaksi',
    'ai-advisor': 'AI Advisor',
    'api-settings': 'Pengaturan API'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  if (page === 'dashboard') renderDashboard();
  if (page === 'transaksi') renderTransactionTable();

  closeSidebar();
}

function setPageDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('pageSubtitle').textContent = now.toLocaleDateString('id-ID', options);
}


function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}


function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  resetModalForm();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  resetModalForm();
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function resetModalForm() {
  document.getElementById('txName').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txCategory').value = '';
  document.getElementById('txTax').value = '0';
  document.getElementById('txFee').value = '0';
  document.getElementById('txNote').value = '';
  setTransactionType('pemasukan');
  calculateTotal();
}

function setTransactionType(type) {
  currentType = type;
  const incomeBtn  = document.getElementById('typeIncome');
  const expenseBtn = document.getElementById('typeExpense');

  if (type === 'pemasukan') {
    incomeBtn.classList.add('active');
    incomeBtn.classList.remove('expense-active');
    expenseBtn.classList.remove('active');
  } else {
    expenseBtn.classList.add('active', 'expense-active');
    incomeBtn.classList.remove('active');
  }
}

function calculateTotal() {
  const amount = parseFloat(document.getElementById('txAmount').value) || 0;
  const taxPct  = parseFloat(document.getElementById('txTax').value)    || 0;
  const fee     = parseFloat(document.getElementById('txFee').value)    || 0;

  const taxAmt = amount * (taxPct / 100);
  const total  = amount + taxAmt + fee;

  document.getElementById('previewAmount').textContent = formatRupiah(amount);
  document.getElementById('previewTax').textContent    = `+ ${formatRupiah(taxAmt)}`;
  document.getElementById('previewFee').textContent    = `+ ${formatRupiah(fee)}`;
  document.getElementById('previewTotal').textContent  = formatRupiah(total);
}

function saveTransaction() {
  const name     = document.getElementById('txName').value.trim();
  const amount   = parseFloat(document.getElementById('txAmount').value) || 0;
  const date     = document.getElementById('txDate').value;
  const category = document.getElementById('txCategory').value;
  const taxPct   = parseFloat(document.getElementById('txTax').value)    || 0;
  const fee      = parseFloat(document.getElementById('txFee').value)    || 0;
  const note     = document.getElementById('txNote').value.trim();

  if (!name)     { showToast('Nama transaksi wajib diisi.', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Nominal harus lebih dari 0.', 'error'); return; }
  if (!date)     { showToast('Tanggal wajib diisi.', 'error'); return; }
  if (!category) { showToast('Pilih kategori transaksi.', 'error'); return; }

  const taxAmt = amount * (taxPct / 100);
  const total  = amount + taxAmt + fee;

  const tx = {
    id:       Date.now().toString(),
    name,
    type:     currentType,
    amount,
    category,
    taxPct,
    taxAmt,
    fee,
    total,
    date,
    note,
    createdAt: new Date().toISOString()
  };

  transactions.unshift(tx);
  saveToStorage();
  closeModal();
  showToast(`Transaksi "${name}" berhasil disimpan!`, 'success');

  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'transaksi') renderTransactionTable();
}


function openConfirm(title, message, onConfirm, confirmText = 'Hapus', isDanger = true) {
  document.getElementById('confirmTitle').textContent   = title;
  document.getElementById('confirmMessage').textContent = message;
  const btn = document.getElementById('confirmActionBtn');
  btn.textContent = confirmText;
  btn.className = isDanger ? 'btn-danger' : 'btn-primary';
  confirmCallback = onConfirm;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  confirmCallback = null;
}

document.getElementById('confirmActionBtn').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

document.getElementById('confirmOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('confirmOverlay')) closeConfirm();
});


function deleteTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  openConfirm(
    'Hapus Transaksi',
    `Hapus transaksi "${tx.name}"? Tindakan ini tidak dapat dibatalkan.`,
    () => {
      transactions = transactions.filter(t => t.id !== id);
      saveToStorage();
      showToast('Transaksi berhasil dihapus.', 'info');
      if (currentPage === 'dashboard') renderDashboard();
      if (currentPage === 'transaksi') renderTransactionTable();
    }
  );
}

function confirmResetAll() {
  if (transactions.length === 0) {
    showToast('Tidak ada transaksi untuk direset.', 'info');
    return;
  }
  openConfirm(
    'Reset Semua Transaksi',
    `Hapus semua ${transactions.length} transaksi? Tindakan ini tidak dapat dibatalkan.`,
    () => {
      transactions = [];
      saveToStorage();
      showToast('Semua transaksi telah dihapus.', 'info');
      if (currentPage === 'dashboard') renderDashboard();
      if (currentPage === 'transaksi') renderTransactionTable();
    }
  );
}


function renderDashboard() {
  const incomeList   = transactions.filter(t => t.type === 'pemasukan');
  const expenseList  = transactions.filter(t => t.type === 'pengeluaran');
  const totalIncome  = incomeList.reduce((s, t) => s + t.total, 0);
  const totalExpense = expenseList.reduce((s, t) => s + t.total, 0);
  const netBalance   = totalIncome - totalExpense;
  const savingRate   = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;
  const clampedRate  = Math.max(0, Math.min(100, savingRate));

  const saldoEl = document.getElementById('statSaldo');
  saldoEl.textContent = formatRupiah(Math.abs(netBalance));
  saldoEl.className = 'stat-value ' + (netBalance >= 0 ? 'stat-value--green' : 'stat-value--red');

  const saldoSubEl = document.getElementById('statSaldoSub');
  if (transactions.length === 0) {
    saldoSubEl.textContent = 'Belum ada transaksi';
  } else {
    saldoSubEl.innerHTML = netBalance >= 0
      ? `<span style="color:var(--green)">▲ Surplus ${formatRupiah(netBalance)}</span>`
      : `<span style="color:var(--red)">▼ Defisit ${formatRupiah(Math.abs(netBalance))}</span>`;
  }

  document.getElementById('statIncome').textContent = formatRupiah(totalIncome);
  document.getElementById('statIncomeSub').textContent = `${incomeList.length} transaksi`;

  document.getElementById('statExpense').textContent = formatRupiah(totalExpense);
  document.getElementById('statExpenseSub').textContent = `${expenseList.length} transaksi`;

  document.getElementById('statSavingRate').textContent = `${clampedRate.toFixed(1)}%`;
  document.getElementById('statProgressFill').style.width = `${clampedRate}%`;
  document.getElementById('statSavingDesc').textContent =
    totalIncome > 0 ? `Dari total pemasukan ${formatRupiah(totalIncome)}` : 'Dari total pemasukan';

  renderBarChart();
  renderPieChart();

  renderRecentTransactions();
}


function renderBarChart() {
  const canvas = document.getElementById('barChart');
  const emptyEl = document.getElementById('barChartEmpty');

  if (transactions.length === 0) {
    canvas.style.display = 'none';
    emptyEl.style.display = 'flex';
    if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.style.display = 'none';

  const monthlyData = {};
  transactions.forEach(tx => {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 };
    if (tx.type === 'pemasukan') monthlyData[key].income  += tx.total;
    else                         monthlyData[key].expense += tx.total;
  });

  const sortedKeys = Object.keys(monthlyData).sort();
  const labels     = sortedKeys.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m-1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  });
  const incomeData  = sortedKeys.map(k => monthlyData[k].income);
  const expenseData = sortedKeys.map(k => monthlyData[k].expense);

  if (barChartInstance) barChartInstance.destroy();

  barChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          backgroundColor: 'rgba(22, 163, 74, 0.75)',
          borderColor: 'rgba(22, 163, 74, 1)',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          backgroundColor: 'rgba(220, 38, 38, 0.65)',
          borderColor: 'rgba(220, 38, 38, 1)',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#181A20',
          titleColor: 'rgba(255,255,255,0.7)',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#9CA3AF' }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { family: 'Plus Jakarta Sans', size: 11 },
            color: '#9CA3AF',
            callback: v => formatRupiahShort(v)
          }
        }
      }
    }
  });
}

function renderPieChart() {
  const canvas = document.getElementById('pieChart');
  const emptyEl = document.getElementById('pieChartEmpty');
  const legendEl = document.getElementById('pieLegend');

  const expenses = transactions.filter(t => t.type === 'pengeluaran');

  if (expenses.length === 0) {
    canvas.style.display = 'none';
    emptyEl.style.display = 'flex';
    legendEl.innerHTML = '';
    if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.style.display = 'none';

  const catMap = {};
  expenses.forEach(tx => {
    catMap[tx.category] = (catMap[tx.category] || 0) + tx.total;
  });

  const labels = Object.keys(catMap);
  const data   = labels.map(k => catMap[k]);
  const colors = labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);

  if (pieChartInstance) pieChartInstance.destroy();

  pieChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverBorderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#181A20',
          titleColor: 'rgba(255,255,255,0.7)',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => {
              const pct = (ctx.raw / data.reduce((a,b)=>a+b,0)*100).toFixed(1);
              return ` ${formatRupiah(ctx.raw)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  legendEl.innerHTML = labels.map((label, i) => `
    <div class="pie-legend-item">
      <div class="pie-legend-dot" style="background:${colors[i]}"></div>
      <span>${label}</span>
    </div>
  `).join('');
}

function renderRecentTransactions() {
  const container = document.getElementById('recentTransactionsList');
  const recent = transactions.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.25"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <p>Belum ada transaksi. Mulai catat keuanganmu!</p>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(tx => {
    const isIncome = tx.type === 'pemasukan';
    const icon = CATEGORY_ICONS[tx.category] || (isIncome ? '💰' : '💸');
    const dateStr = new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <div class="tx-item">
        <div class="tx-icon ${isIncome ? 'tx-icon--in' : 'tx-icon--out'}">${icon}</div>
        <div class="tx-info">
          <div class="tx-name">${escapeHtml(tx.name)}</div>
          <div class="tx-meta">${tx.category} · ${dateStr}</div>
        </div>
        <div class="tx-amount ${isIncome ? 'tx-amount--in' : 'tx-amount--out'}">
          ${isIncome ? '+' : '-'}${formatRupiah(tx.total)}
        </div>
      </div>`;
  }).join('');
}


let filteredTransactions = [];

function renderTransactionTable() {
  filterTransactions();
  updateCategoryFilter();
}

function updateCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  const current = sel.value;
  const cats = [...new Set(transactions.map(t => t.category))].sort();
  sel.innerHTML = `<option value="">Semua Kategori</option>` +
    cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
}

function filterTransactions() {
  const query    = document.getElementById('searchInput').value.toLowerCase();
  const typeF    = document.getElementById('filterType').value;
  const catF     = document.getElementById('filterCategory').value;

  filteredTransactions = transactions.filter(tx => {
    const matchName = tx.name.toLowerCase().includes(query) || tx.category.toLowerCase().includes(query);
    const matchType = !typeF || tx.type === typeF;
    const matchCat  = !catF  || tx.category === catF;
    return matchName && matchType && matchCat;
  });

  renderTableRows();
}

function renderTableRows() {
  const tbody = document.getElementById('transactionTableBody');
  const emptyEl = document.getElementById('transactionEmpty');
  const tableWrapper = document.getElementById('transactionTableWrapper');

  if (filteredTransactions.length === 0) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  tbody.innerHTML = filteredTransactions.map(tx => {
    const isIncome = tx.type === 'pemasukan';
    const dateStr  = new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <tr>
        <td>${dateStr}</td>
        <td>
          <div style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(tx.name)}</div>
          ${tx.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(tx.note)}</div>` : ''}
        </td>
        <td><span class="td-category">${tx.category}</span></td>
        <td>
          <span class="td-type-badge ${isIncome ? 'td-type-badge--in' : 'td-type-badge--out'}">
            ${isIncome ? '▲ Pemasukan' : '▼ Pengeluaran'}
          </span>
        </td>
        <td>${formatRupiah(tx.amount)}</td>
        <td>${tx.taxPct > 0 ? `${tx.taxPct}% (${formatRupiah(tx.taxAmt)})` : '—'}</td>
        <td>${tx.fee > 0 ? formatRupiah(tx.fee) : '—'}</td>
        <td class="${isIncome ? 'td-amount--in' : 'td-amount--out'}">
          ${isIncome ? '+' : '-'}${formatRupiah(tx.total)}
        </td>
        <td>
          <button class="btn-delete-row" onclick="deleteTransaction('${tx.id}')" title="Hapus">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}


async function runAIAnalysis() {
  const apiKey = localStorage.getItem('reyfinance_api_key') || '';
  const model  = localStorage.getItem('reyfinance_ai_model') || 'gpt-4o';

  if (!apiKey) {
    showToast('Harap konfigurasi API Key OpenAI terlebih dahulu.', 'error');
    navigateTo('api-settings');
    return;
  }

  if (transactions.length === 0) {
    showToast('Tambahkan beberapa transaksi sebelum melakukan analisis.', 'info');
    return;
  }

  document.getElementById('aiLoading').style.display = 'flex';
  document.getElementById('aiResultContainer').style.display = 'none';
  document.getElementById('aiError').style.display = 'none';
  document.getElementById('analyzeBtn').disabled = true;

  try {
    const prompt = buildAIPrompt();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `Anda adalah seorang Financial Advisor profesional senior dengan pengalaman lebih dari 15 tahun. 
Nama Anda adalah "ReyAdvisor". Anda berbicara dalam Bahasa Indonesia dengan nada formal namun mudah dipahami.
Berikan analisis keuangan yang SPESIFIK, KONTEKSTUAL, dan BERBASIS DATA — bukan nasihat generik.
Gunakan angka nyata dari data yang diberikan. Format output dalam JSON terstruktur.`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw  = data.choices[0].message.content;

    const parsed = parseAIResponse(raw);
    displayAIResult(parsed);

  } catch (err) {
    document.getElementById('aiLoading').style.display = 'none';
    document.getElementById('aiError').style.display = 'flex';
    document.getElementById('aiErrorMsg').textContent = `Error: ${err.message}`;
    console.error('AI Error:', err);
  } finally {
    document.getElementById('analyzeBtn').disabled = false;
    document.getElementById('aiLoading').style.display = 'none';
  }
}

function buildAIPrompt() {
  const incomeList   = transactions.filter(t => t.type === 'pemasukan');
  const expenseList  = transactions.filter(t => t.type === 'pengeluaran');
  const totalIncome  = incomeList.reduce((s, t) => s + t.total, 0);
  const totalExpense = expenseList.reduce((s, t) => s + t.total, 0);
  const netBalance   = totalIncome - totalExpense;
  const savingRate   = totalIncome > 0 ? (netBalance / totalIncome * 100).toFixed(2) : 0;

  const catBreakdown = {};
  expenseList.forEach(tx => {
    catBreakdown[tx.category] = (catBreakdown[tx.category] || 0) + tx.total;
  });

  const catSummary = Object.entries(catBreakdown)
    .sort(([,a],[,b]) => b - a)
    .map(([cat, amt]) => `  - ${cat}: Rp ${amt.toLocaleString('id-ID')} (${(amt/totalExpense*100).toFixed(1)}%)`)
    .join('\n');

  const monthlyMap = {};
  transactions.forEach(tx => {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 };
    if (tx.type === 'pemasukan') monthlyMap[key].income  += tx.total;
    else                         monthlyMap[key].expense += tx.total;
  });

  const monthlySummary = Object.entries(monthlyMap)
    .sort()
    .map(([k, v]) => `  - ${k}: Pemasukan Rp ${v.income.toLocaleString('id-ID')}, Pengeluaran Rp ${v.expense.toLocaleString('id-ID')}`)
    .join('\n');

  const recentTx = transactions.slice(0, 10).map(tx =>
    `  - [${tx.date}] ${tx.type === 'pemasukan' ? 'MASUK' : 'KELUAR'} ${tx.category}: ${tx.name} = Rp ${tx.total.toLocaleString('id-ID')}`
  ).join('\n');

  return `Analisis data keuangan personal berikut dan berikan saran yang sangat spesifik:

=== DATA KEUANGAN ===
Total Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
Total Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}
Saldo Bersih: Rp ${netBalance.toLocaleString('id-ID')}
Rasio Tabungan: ${savingRate}%
Jumlah Transaksi Pemasukan: ${incomeList.length}
Jumlah Transaksi Pengeluaran: ${expenseList.length}

=== BREAKDOWN PENGELUARAN PER KATEGORI ===
${catSummary || '(Tidak ada pengeluaran)'}

=== DATA BULANAN ===
${monthlySummary || '(Data tidak cukup)'}

=== 10 TRANSAKSI TERAKHIR ===
${recentTx}

Berikan analisis dalam format JSON PERSIS seperti berikut (TANPA markdown, TANPA backtick, hanya JSON murni):
{
  "overview": {
    "summary": "Ringkasan kondisi keuangan dalam 2-3 kalimat spesifik dengan angka nyata",
    "findings": ["temuan 1 dengan angka spesifik", "temuan 2", "temuan 3", "temuan 4"],
    "health_score": "Sehat/Cukup/Perlu Perhatian/Kritis",
    "health_reason": "Alasan singkat skor kesehatan keuangan"
  },
  "short_term": {
    "title": "Rekomendasi Jangka Pendek (Harian/Mingguan)",
    "reduce": ["hal yang harus dikurangi dengan angka spesifik", "..."],
    "maintain": ["hal yang harus dipertahankan", "..."],
    "avoid": ["hal yang harus dihindari", "..."],
    "action": ["langkah konkret minggu ini", "..."]
  },
  "mid_term": {
    "title": "Strategi Jangka Menengah (Bulanan)",
    "targets": ["target keuangan spesifik bulan ini", "..."],
    "budget_recommendation": "Rekomendasi alokasi budget dengan persentase dan angka",
    "savings_goal": "Target tabungan bulanan yang realistis",
    "tips": ["tips praktis 1", "tips praktis 2", "tips praktis 3"]
  },
  "long_term": {
    "title": "Perencanaan Jangka Panjang (Keuangan Masa Depan)",
    "investment_advice": ["saran investasi berdasarkan kondisi keuangan saat ini", "..."],
    "emergency_fund": "Status dan saran dana darurat",
    "financial_goals": ["tujuan keuangan jangka panjang yang realistis", "..."],
    "risk_warnings": ["peringatan risiko finansial yang harus diwaspadai", "..."]
  }
}`;
}

function parseAIResponse(raw) {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return {
      overview: {
        summary: raw.substring(0, 300),
        findings: ['Lihat detail di bawah.'],
        health_score: 'Tidak tersedia',
        health_reason: ''
      },
      short_term:  { reduce: [], maintain: [], avoid: [], action: [raw] },
      mid_term:    { targets: [], budget_recommendation: '', savings_goal: '', tips: [] },
      long_term:   { investment_advice: [], emergency_fund: '', financial_goals: [], risk_warnings: [] }
    };
  }
}

function displayAIResult(data) {
  const { overview, short_term, mid_term, long_term } = data;

  const scoreColor = {
    'Sehat': 'var(--green)', 'Cukup': 'var(--amber)',
    'Perlu Perhatian': 'var(--amber)', 'Kritis': 'var(--red)'
  }[overview.health_score] || 'var(--text-secondary)';

  document.getElementById('aiOverviewContent').innerHTML = `
    <div style="margin-bottom:14px">
      <span style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;background:${scoreColor}20;color:${scoreColor}">
        🏥 Skor Kesehatan: ${overview.health_score}
      </span>
      ${overview.health_reason ? `<span style="font-size:12px;color:var(--text-muted);margin-left:8px">${overview.health_reason}</span>` : ''}
    </div>
    <p style="margin-bottom:14px;color:var(--text-secondary)">${overview.summary}</p>
    <ul>${(overview.findings || []).map(f => `<li>${f}</li>`).join('')}</ul>`;

  document.getElementById('aiShortContent').innerHTML = buildSectionHTML({
    'Harus Dikurangi': { items: short_term.reduce, icon: '🔻', color: 'var(--red)' },
    'Dipertahankan':   { items: short_term.maintain, icon: '✅', color: 'var(--green)' },
    'Harus Dihindari': { items: short_term.avoid, icon: '⛔', color: 'var(--amber)' },
    'Langkah Konkret': { items: short_term.action, icon: '⚡', color: 'var(--blue)' }
  });

  document.getElementById('aiMidContent').innerHTML = `
    ${mid_term.budget_recommendation ? `
      <div style="background:var(--bg);border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:13px">
        <strong>💼 Alokasi Budget:</strong><br/><span style="color:var(--text-secondary)">${mid_term.budget_recommendation}</span>
      </div>` : ''}
    ${mid_term.savings_goal ? `
      <div style="background:var(--green-light);border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:13px">
        <strong style="color:var(--green)">🎯 Target Tabungan:</strong><br/><span style="color:var(--green)">${mid_term.savings_goal}</span>
      </div>` : ''}
    ${buildListHTML('📅 Target Bulanan', mid_term.targets)}
    ${buildListHTML('💡 Tips Praktis', mid_term.tips)}`;

  document.getElementById('aiLongContent').innerHTML = `
    ${mid_term.emergency_fund || long_term.emergency_fund ? `
      <div style="background:var(--blue-light);border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:13px">
        <strong style="color:var(--blue)">🛡️ Dana Darurat:</strong><br/><span style="color:var(--blue)">${long_term.emergency_fund || ''}</span>
      </div>` : ''}
    ${buildListHTML('📊 Saran Investasi', long_term.investment_advice)}
    ${buildListHTML('🚀 Tujuan Keuangan', long_term.financial_goals)}
    ${(long_term.risk_warnings && long_term.risk_warnings.length > 0) ? `
      <div style="background:var(--red-light);border-radius:8px;padding:14px;margin-top:10px">
        <div style="color:var(--red);font-weight:700;font-size:13px;margin-bottom:8px">⚠️ Peringatan Risiko</div>
        <ul>${long_term.risk_warnings.map(w => `<li style="color:var(--red)">${w}</li>`).join('')}</ul>
      </div>` : ''}`;

  const now = new Date();
  document.getElementById('aiTimestamp').textContent = `Dianalisis pada ${now.toLocaleDateString('id-ID')} pukul ${now.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}`;

  document.getElementById('aiResultContainer').style.display = 'block';
}

function buildSectionHTML(sections) {
  return Object.entries(sections)
    .filter(([, v]) => v.items && v.items.length > 0)
    .map(([title, { items, icon, color }]) => `
      <div style="margin-bottom:16px">
        <div style="font-weight:700;font-size:12px;color:${color};margin-bottom:8px;letter-spacing:0.04em">
          ${icon} ${title.toUpperCase()}
        </div>
        <ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>`)
    .join('');
}

function buildListHTML(title, items) {
  if (!items || items.length === 0) return '';
  return `
    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:12.5px;color:var(--text-primary);margin-bottom:8px">${title}</div>
      <ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>`;
}


function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}


function formatRupiah(amount) {
  if (isNaN(amount)) return 'Rp 0';
  return 'Rp ' + Math.abs(amount).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function formatRupiahShort(value) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000)     return `Rp ${(value / 1_000_000).toFixed(1)}Jt`;
  if (value >= 1_000)         return `Rp ${(value / 1_000).toFixed(0)}K`;
  return `Rp ${value}`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}
