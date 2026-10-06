const STORAGE_KEY = 'ledger_transactions_v1';

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Health', 'Shopping', 'Entertainment', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gift', 'Investment', 'Other'];

let transactions = [];
let currentType = 'expense';
let editingId = null;
let activeFilter = 'all';

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    transactions = [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) { /* storage unavailable, fail silently */ }
}

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toFixed(2);
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function setType(type) {
  currentType = type;
  document.getElementById('btnIncome').classList.toggle('active', type === 'income');
  document.getElementById('btnExpense').classList.toggle('active', type === 'expense');
  populateCategoryOptions();
}

function populateCategoryOptions() {
  const sel = document.getElementById('categoryInput');
  const list = currentType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  sel.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderFilters() {
  const cats = Array.from(new Set(transactions.map(t => t.category))).sort();
  const row = document.getElementById('filterRow');
  const all = [{ key: 'all', label: 'All' }, { key: 'income', label: 'Income' }, { key: 'expense', label: 'Expense' }]
    .concat(cats.map(c => ({ key: 'cat:' + c, label: c })));
  row.innerHTML = all.map(f =>
    `<button data-key="${f.key}" class="${activeFilter === f.key ? 'active' : ''}">${f.label}</button>`
  ).join('');
  row.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.key;
      render();
    });
  });
}

function filteredTransactions() {
  let list = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  if (activeFilter === 'all') return list;
  if (activeFilter === 'income') return list.filter(t => t.type === 'income');
  if (activeFilter === 'expense') return list.filter(t => t.type === 'expense');
  if (activeFilter.startsWith('cat:')) return list.filter(t => t.category === activeFilter.slice(4));
  return list;
}

function renderSummary() {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  document.getElementById('totalIncome').textContent = formatMoney(income);
  document.getElementById('totalExpense').textContent = formatMoney(expense);
  const balEl = document.getElementById('totalBalance');
  balEl.textContent = formatMoney(balance);
  balEl.classList.toggle('negative', balance < 0);
}

function renderList() {
  const list = filteredTransactions();
  const container = document.getElementById('ledgerList');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty">No transactions here yet — add one above to start the ledger.</div>`;
    return;
  }
  container.innerHTML = list.map(t => `
    <div class="txn ${t.type} ${editingId === t.id ? 'editing' : ''}" data-id="${t.id}">
      <div class="date">${formatDate(t.date)}</div>
      <div class="desc">${escapeHtml(t.description)}<span class="cat">${escapeHtml(t.category)}</span></div>
      <div class="amount">${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount)}</div>
      <div></div>
      <div class="actions">
        <button data-action="edit" data-id="${t.id}">Edit</button>
        <button data-action="delete" data-id="${t.id}">Delete</button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('button[data-action]').forEach(btn => {
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'delete') {
      btn.addEventListener('click', () => deleteTransaction(id));
    } else {
      btn.addEventListener('click', () => startEdit(id));
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  renderSummary();
  renderFilters();
  renderList();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  if (editingId === id) cancelEdit();
  saveTransactions();
  render();
}

function startEdit(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('descInput').value = t.description;
  document.getElementById('amountInput').value = t.amount;
  document.getElementById('dateInput').value = t.date;
  setType(t.type);
  document.getElementById('categoryInput').value = t.category;
  document.getElementById('formTitle').textContent = 'Edit transaction';
  document.getElementById('submitBtn').textContent = 'Save changes';
  render();
  document.querySelector('.entry').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEdit() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'Add a transaction';
  document.getElementById('submitBtn').textContent = 'Add entry';
  document.getElementById('txnForm').reset();
  setType('expense');
  document.getElementById('dateInput').value = todayIso();
}

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

document.getElementById('btnIncome').addEventListener('click', () => setType('income'));
document.getElementById('btnExpense').addEventListener('click', () => setType('expense'));

document.getElementById('txnForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const description = document.getElementById('descInput').value.trim();
  const amount = parseFloat(document.getElementById('amountInput').value);
  const category = document.getElementById('categoryInput').value;
  const date = document.getElementById('dateInput').value;
  if (!description || !amount || amount <= 0 || !date) return;

  if (editingId !== null) {
    const t = transactions.find(t => t.id === editingId);
    Object.assign(t, { description, amount, category, date, type: currentType });
  } else {
    transactions.push({
      id: Date.now(),
      description, amount, category, date, type: currentType
    });
  }
  saveTransactions();
  cancelEdit();
  render();
});

// init
document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
loadTransactions();
setType('expense');
document.getElementById('dateInput').value = todayIso();
render();