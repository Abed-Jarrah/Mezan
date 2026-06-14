const MezanStorage = (() => {
  const KEY = 'mezan_plan_v3';
  const LANGUAGES = new Set(['ar', 'en']);
  const CURRENCIES = new Set(['QAR', 'SAR', 'AED', 'KWD', 'BHD', 'OMR', 'JOD', 'USD', 'EUR', 'TRY']);
  const EXPENSE_KINDS = new Set(['regular', 'recurring', 'exceptional', 'giving']);
  const CATEGORY_ALIASES = {
    auto: 'auto',
    'تلقائي': 'auto',
    food: 'food',
    'طعام وتسوق': 'food',
    'Food & Shopping': 'food',
    transport: 'transport',
    'مواصلات': 'transport',
    Transport: 'transport',
    bills: 'bills',
    'فواتير': 'bills',
    Bills: 'bills',
    fun: 'fun',
    'ترفيه': 'fun',
    Entertainment: 'fun',
    other: 'other',
    'أخرى': 'other',
    Other: 'other'
  };

  const number = value => {
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const text = (value, maxLength = 120) =>
    typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';

  const categoryBudgets = source => ({
    food: number(source?.food),
    transport: number(source?.transport),
    bills: number(source?.bills),
    fun: number(source?.fun),
    other: number(source?.other)
  });

  function defaults(settings = {}) {
    return {
      profile: null,
      expenses: [],
      categoryBudgets: categoryBudgets(),
      recurringPayments: [],
      salaryReceipts: [],
      cycleReports: [],
      settings: {
        lang: LANGUAGES.has(settings.lang) ? settings.lang : 'ar',
        currency: CURRENCIES.has(settings.currency) ? settings.currency : 'QAR'
      }
    };
  }

  function normalizeProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
    const numericFields = [
      'salary', 'extraIncome', 'rent', 'internet', 'electricity', 'phone',
      'fuel', 'fixed', 'loans', 'saveTarget', 'goalAmount', 'goalMonths'
    ];
    const normalized = {};
    numericFields.forEach(field => {
      normalized[field] = number(profile[field]);
    });
    normalized.rentPaid = profile.rentPaid === 'yes' ? 'yes' : 'no';
    normalized.goalType = profile.goalType === 'specific' ? 'specific' : 'general';
    normalized.goalName = text(profile.goalName, 80);
    normalized.salaryDate = date(profile.salaryDate) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
    return normalized;
  }

  function normalizeExpense(expense, index) {
    if (!expense || typeof expense !== 'object' || Array.isArray(expense)) return null;
    const amount = number(expense.amount);
    if (!amount) return null;
    const expenseDate = date(expense.date);
    if (!expenseDate) return null;
    return {
      id: Number.isSafeInteger(expense.id) ? expense.id : Date.now() + index,
      amount,
      merchant: text(expense.merchant, 100) || 'Expense',
      category: CATEGORY_ALIASES[expense.category] || 'other',
      date: expenseDate,
      kind: EXPENSE_KINDS.has(expense.kind) ? expense.kind : 'regular',
      subtype: text(expense.subtype, 40),
      recurringId: Number.isSafeInteger(expense.recurringId) ? expense.recurringId : null,
      cycleKey: date(expense.cycleKey)
    };
  }

  function normalizeRecurring(payment, index) {
    if (!payment || typeof payment !== 'object' || Array.isArray(payment)) return null;
    const amount = number(payment.amount);
    const name = text(payment.name, 80);
    if (!amount || !name) return null;
    return {
      id: Number.isSafeInteger(payment.id) ? payment.id : Date.now() + index,
      name,
      amount,
      category: CATEGORY_ALIASES[payment.category] || 'other',
      day: Math.min(31, Math.max(1, Math.round(number(payment.day) || 1))),
      active: payment.active !== false
    };
  }

  function normalizeReceipt(receipt, index) {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return null;
    const receiptDate = date(receipt.date);
    const amount = number(receipt.amount);
    if (!receiptDate || !amount) return null;
    return {
      id: Number.isSafeInteger(receipt.id) ? receipt.id : Date.now() + index,
      date: receiptDate,
      amount
    };
  }

  function normalizeBreakdown(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const key = text(item.key, 40);
    const amount = number(item.amount);
    return key && amount ? { key, amount } : null;
  }

  function normalizeReport(report, index) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
    const start = date(report.start);
    const end = date(report.end);
    if (!start || !end) return null;
    return {
      id: Number.isSafeInteger(report.id) ? report.id : Date.now() + index,
      start,
      end,
      days: Math.max(1, Math.round(number(report.days) || 1)),
      salary: number(report.salary),
      spent: number(report.spent),
      saved: number(report.saved),
      savedPct: Math.min(100, number(report.savedPct)),
      topKey: text(report.topKey, 40) || 'other',
      topAmount: number(report.topAmount),
      breakdown: Array.isArray(report.breakdown)
        ? report.breakdown.map(normalizeBreakdown).filter(Boolean).slice(0, 30)
        : [],
      expenses: Array.isArray(report.expenses)
        ? report.expenses.map(normalizeExpense).filter(Boolean).slice(0, 1000)
        : []
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Invalid Mezan backup');
    }
    const base = defaults(raw.settings || {});
    base.profile = normalizeProfile(raw.profile);
    base.expenses = Array.isArray(raw.expenses)
      ? raw.expenses.map(normalizeExpense).filter(Boolean).slice(0, 5000)
      : [];
    base.categoryBudgets = categoryBudgets(raw.categoryBudgets);
    base.recurringPayments = Array.isArray(raw.recurringPayments)
      ? raw.recurringPayments.map(normalizeRecurring).filter(Boolean).slice(0, 200)
      : [];
    base.salaryReceipts = Array.isArray(raw.salaryReceipts)
      ? raw.salaryReceipts.map(normalizeReceipt).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)).slice(-200)
      : [];
    if (!base.salaryReceipts.length && base.profile) {
      base.salaryReceipts.push({
        id: Date.now(),
        date: base.profile.salaryDate,
        amount: base.profile.salary
      });
    }
    base.cycleReports = Array.isArray(raw.cycleReports)
      ? raw.cycleReports.map(normalizeReport).filter(Boolean).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 200)
      : [];
    return base;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : defaults();
    } catch {
      return defaults();
    }
  }

  function save(state) {
    const normalized = normalize(state);
    localStorage.setItem(KEY, JSON.stringify(normalized));
    return normalized;
  }

  function parseBackup(json) {
    return normalize(JSON.parse(json));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { KEY, defaults, load, save, parseBackup, clear, normalize };
})();
