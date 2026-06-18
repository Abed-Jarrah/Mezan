const MezanStorage = (() => {
  const KEY = 'mezan_plan_v5';
  const LEGACY_KEYS = ['mezan_plan_v4', 'mezan_plan_v3', 'mezan_plan_v2'];
  const SCHEMA_VERSION = 5;
  const LANGUAGES = new Set(['ar', 'en']);
  const CURRENCIES = new Set(['QAR', 'SAR', 'AED', 'KWD', 'BHD', 'OMR', 'JOD', 'USD', 'EUR', 'TRY']);
  const EXPENSE_KINDS = new Set(['regular', 'recurring', 'exceptional', 'giving']);
  const EXPENSE_SUBTYPES = new Set(['parents', 'family', 'charity', 'gift', 'emergency', 'exceptional']);
  const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const SALARY_HISTORY_YEARS = 3;
  const REPORT_KEYS = new Set([
    'rent', 'internet', 'electricity', 'phone', 'fuel', 'fixed', 'loans',
    'food', 'transport', 'bills', 'fun', 'other', 'exceptional', 'giving'
  ]);
  const REPORT_KEY_ALIASES = { billsCat: 'bills', commitments: 'fixed', exceptionalTotal: 'exceptional' };
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

  const date = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return '';
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return parsed.getFullYear() === Number(match[1]) &&
      parsed.getMonth() === Number(match[2]) - 1 &&
      parsed.getDate() === Number(match[3]) ? value : '';
  };

  const todayKey = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const minSalaryDate = () => {
    const min = new Date();
    min.setFullYear(min.getFullYear() - SALARY_HISTORY_YEARS);
    return `${min.getFullYear()}-${String(min.getMonth() + 1).padStart(2, '0')}-${String(min.getDate()).padStart(2, '0')}`;
  };

  const pastOrTodayDate = value => {
    const normalized = date(value);
    return normalized && normalized >= minSalaryDate() && normalized <= todayKey() ? normalized : '';
  };

  const generateChatUserId = () =>
    globalThis.crypto?.randomUUID
      ? crypto.randomUUID()
      : `mzn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  const category = value => {
    const key = text(value, 40);
    return CATEGORY_ALIASES[key] || CATEGORY_ALIASES[key.toLowerCase()] || 'other';
  };

  let fallbackIdCounter = 0;
  const fallbackId = index => Date.now() * 1000 + (++fallbackIdCounter * 10) + (index % 10);

  const categoryBudgets = source => ({
    food: number(source?.food),
    transport: number(source?.transport),
    bills: number(source?.bills),
    fun: number(source?.fun),
    other: number(source?.other)
  });

  function defaults(settings = {}) {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: null,
      expenses: [],
      categoryBudgets: categoryBudgets(),
      recurringPayments: [],
      salaryReceipts: [],
      cycleReports: [],
      merchantCategories: {},
      budgetAlerts: {},
      settings: {
        lang: LANGUAGES.has(settings.lang) ? settings.lang : 'ar',
        currency: CURRENCIES.has(settings.currency) ? settings.currency : 'QAR',
        lastBackupAt: date(settings.lastBackupAt),
        chatUserId: text(settings.chatUserId, 64) || generateChatUserId(),
        displayName: text(settings.displayName, 60)
      }
    };
  }

  function merchantCategories(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    return Object.entries(source).slice(0, 500).reduce((result, [merchant, category]) => {
      const key = text(merchant.toLowerCase(), 100);
      if (key && !BLOCKED_KEYS.has(key)) result[key] = category === 'auto' ? 'other' : CATEGORY_ALIASES[category] ||
        CATEGORY_ALIASES[String(category || '').toLowerCase()] || 'other';
      return result;
    }, Object.create(null));
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
    normalized.salaryDate = pastOrTodayDate(profile.salaryDate) || todayKey();
    return normalized;
  }

  function normalizePlanSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    return {
      extraIncome: number(snapshot.extraIncome),
      rent: number(snapshot.rent),
      internet: number(snapshot.internet),
      electricity: number(snapshot.electricity),
      phone: number(snapshot.phone),
      fuel: number(snapshot.fuel),
      fixed: number(snapshot.fixed),
      loans: number(snapshot.loans),
      saveTarget: number(snapshot.saveTarget)
    };
  }

  function normalizeExpense(expense, index) {
    if (!expense || typeof expense !== 'object' || Array.isArray(expense)) return null;
    const amount = number(expense.amount);
    if (!amount) return null;
    const expenseDate = date(expense.date);
    if (!expenseDate) return null;
    return {
      id: Number.isSafeInteger(expense.id) ? expense.id : fallbackId(index),
      amount,
      merchant: text(expense.merchant, 100),
      category: category(expense.category),
      date: expenseDate,
      kind: EXPENSE_KINDS.has(expense.kind) ? expense.kind : 'regular',
      subtype: EXPENSE_SUBTYPES.has(expense.subtype) ? expense.subtype : '',
      recurringId: Number.isSafeInteger(expense.recurringId) ? expense.recurringId : null,
      cycleKey: /^\d{4}-\d{2}$/.test(expense.cycleKey || '') ? expense.cycleKey : ''
    };
  }

  function normalizeRecurring(payment, index) {
    if (!payment || typeof payment !== 'object' || Array.isArray(payment)) return null;
    const amount = number(payment.amount);
    const name = text(payment.name, 80);
    if (!amount || !name) return null;
    return {
      id: Number.isSafeInteger(payment.id) ? payment.id : fallbackId(index),
      name,
      amount,
      category: category(payment.category),
      day: Math.min(31, Math.max(1, Math.round(number(payment.day) || 1))),
      active: payment.active !== false
    };
  }

  function normalizeReceipt(receipt, index) {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return null;
    const receiptDate = pastOrTodayDate(receipt.date);
    const amount = number(receipt.amount);
    if (!receiptDate || !amount) return null;
    return {
      id: Number.isSafeInteger(receipt.id) ? receipt.id : fallbackId(index),
      date: receiptDate,
      amount,
      planSnapshot: normalizePlanSnapshot(receipt.planSnapshot)
    };
  }

  function normalizeBreakdown(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const normalizedKey = REPORT_KEY_ALIASES[item.key] || item.key;
    const key = REPORT_KEYS.has(normalizedKey) ? normalizedKey : 'other';
    const amount = number(item.amount);
    return key && amount ? { key, amount } : null;
  }

  function normalizeReport(report, index) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
    const start = date(report.start);
    const end = date(report.end);
    if (!start || !end) return null;
    return {
      id: Number.isSafeInteger(report.id) ? report.id : fallbackId(index),
      start,
      end,
      days: Math.max(1, Math.round(number(report.days) || 1)),
      salary: number(report.salary),
      spent: number(report.spent),
      saved: number(report.saved),
      savedPct: Math.min(100, number(report.savedPct)),
      topKey: REPORT_KEYS.has(REPORT_KEY_ALIASES[report.topKey] || report.topKey)
        ? REPORT_KEY_ALIASES[report.topKey] || report.topKey
        : 'other',
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
    base.schemaVersion = SCHEMA_VERSION;
    base.profile = normalizeProfile(raw.profile);
    base.expenses = Array.isArray(raw.expenses)
      ? raw.expenses.map(normalizeExpense).filter(Boolean).slice(0, 5000)
      : [];
    base.categoryBudgets = categoryBudgets(raw.categoryBudgets);
    base.recurringPayments = Array.isArray(raw.recurringPayments)
      ? raw.recurringPayments.map(normalizeRecurring).filter(Boolean).slice(0, 200)
      : [];
    base.merchantCategories = merchantCategories(raw.merchantCategories);
    base.budgetAlerts = raw.budgetAlerts && typeof raw.budgetAlerts === 'object' && !Array.isArray(raw.budgetAlerts)
      ? Object.fromEntries(Object.entries(raw.budgetAlerts).filter(([key, value]) =>
        /^[0-9]{4}-[0-9]{2}-[0-9]{2}:(food|transport|bills|fun|other):(80|100)$/.test(key) && value === true
      ).slice(-100))
      : {};
    base.salaryReceipts = Array.isArray(raw.salaryReceipts)
      ? raw.salaryReceipts.map(normalizeReceipt).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)).slice(-200)
      : [];
    if (!base.salaryReceipts.length && base.profile) {
      base.salaryReceipts.push({
        id: fallbackId(0),
        date: base.profile.salaryDate,
        amount: base.profile.salary,
        planSnapshot: normalizePlanSnapshot(base.profile)
      });
    }
    base.cycleReports = Array.isArray(raw.cycleReports)
      ? raw.cycleReports.map(normalizeReport).filter(Boolean).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 200)
      : [];
    return base;
  }

  function load() {
    try {
      const current = localStorage.getItem(KEY);
      if (current) return normalize(JSON.parse(current));
      for (const legacyKey of LEGACY_KEYS) {
        const legacy = localStorage.getItem(legacyKey);
        if (!legacy) continue;
        const migrated = normalize(JSON.parse(legacy));
        localStorage.setItem(KEY, JSON.stringify(migrated));
        return migrated;
      }
      return defaults();
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
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  }

  return { KEY, SCHEMA_VERSION, defaults, load, save, parseBackup, clear, normalize };
})();
