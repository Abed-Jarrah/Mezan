const MezanCalculations = (() => {
  const clean = value => String(value ?? '').replace(/,/g, '').replace(/[^0-9.]/g, '');
  const number = value => Math.max(0, Number(clean(value) || 0));
  const percent = (part, total) => total > 0 ? Math.round((number(part) / total) * 100) : 0;
  const pad = value => String(value).padStart(2, '0');

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return dateKey(date) === value ? date : null;
  }

  function clampedDate(year, month, day) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(Math.max(1, day), lastDay));
  }

  function salaryCycle(salaryDate, today = new Date()) {
    const selected = parseDate(salaryDate);
    const salaryDay = selected ? selected.getDate() : 1;
    const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let start = clampedDate(currentDay.getFullYear(), currentDay.getMonth(), salaryDay);
    if (currentDay < start) {
      start = clampedDate(currentDay.getFullYear(), currentDay.getMonth() - 1, salaryDay);
    }
    const nextStart = clampedDate(start.getFullYear(), start.getMonth() + 1, salaryDay);
    const end = new Date(nextStart);
    end.setDate(end.getDate() - 1);
    return {
      key: dateKey(start),
      start: dateKey(start),
      end: dateKey(end),
      endExclusive: dateKey(nextStart),
      salaryDay
    };
  }

  function inCycle(value, cycle) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
      value >= cycle.start && (!cycle.endExclusive || value < cycle.endExclusive);
  }

  function cycleProgress(cycle, today = new Date()) {
    const start = parseDate(cycle.start);
    const endExclusive = parseDate(cycle.endExclusive) || new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (!start || !endExclusive) return { elapsed: 1, total: 1 };
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const total = Math.max(1, Math.round((endExclusive - start) / 86400000));
    const elapsed = Math.min(total, Math.max(1, Math.floor((day - start) / 86400000) + 1));
    return { elapsed, total };
  }

  function receiptCycle(receipts, today = new Date()) {
    const sorted = Array.isArray(receipts)
      ? receipts.filter(receipt => parseDate(receipt.date)).slice().sort((a, b) => a.date.localeCompare(b.date))
      : [];
    const latest = sorted[sorted.length - 1];
    const start = latest?.date || dateKey(today);
    return {
      key: start,
      start,
      end: dateKey(today),
      endExclusive: '',
      open: true,
      salaryDay: parseDate(start)?.getDate() || 1,
      receipt: latest || null
    };
  }

  function closedReceiptCycle(start, nextStart) {
    const startDate = parseDate(start);
    const nextDate = parseDate(nextStart);
    if (!startDate || !nextDate || nextDate <= startDate) return null;
    const end = new Date(nextDate);
    end.setDate(end.getDate() - 1);
    return {
      key: start,
      start,
      end: dateKey(end),
      endExclusive: nextStart,
      open: false,
      salaryDay: startDate.getDate()
    };
  }

  function recurringDate(day, cycle) {
    const start = parseDate(cycle.start);
    const endExclusive = parseDate(cycle.endExclusive);
    if (!start || !endExclusive) return cycle.start;
    let due = clampedDate(start.getFullYear(), start.getMonth(), Number(day) || 1);
    if (due < start) due = clampedDate(start.getFullYear(), start.getMonth() + 1, Number(day) || 1);
    if (due >= endExclusive) due = new Date(endExclusive.getTime() - 86400000);
    return dateKey(due);
  }

  function wizardTotals(wizard) {
    const income = number(wizard.salary) + number(wizard.extraIncome);
    const fixed = ['rent', 'internet', 'electricity', 'phone', 'fuel', 'fixed', 'loans']
      .reduce((sum, field) => sum + number(wizard[field]), 0);
    const saving = number(wizard.saveTarget);
    return {
      income,
      fixed,
      saving,
      available: Math.max(0, income - fixed),
      free: income - fixed - saving
    };
  }

  function cycleBalance({ salary, extraIncome, fixed, saving, expenses = [] }) {
    const income = number(salary) + number(extraIncome);
    const startAvailable = Math.max(0, income - number(fixed) - number(saving));
    const spent = expenses.reduce((sum, expense) => sum + number(expense?.amount), 0);
    return {
      income,
      startAvailable,
      spent,
      remaining: startAvailable - spent
    };
  }

  function savingsProgress(goalAmount, reports = []) {
    const goal = number(goalAmount);
    const saved = reports.reduce((sum, report) => sum + number(report?.saved), 0);
    return {
      goal,
      saved,
      remaining: Math.max(0, goal - saved),
      progress: goal > 0 ? Math.min(100, percent(saved, goal)) : 0
    };
  }

  function classifyMerchant(merchant, learned = {}) {
    const value = String(merchant || '').trim().toLowerCase();
    if (!value) return 'other';
    if (learned[value]) return learned[value];
    if (/uber|taxi|careem|كريم|أوبر|اوبر|تكسي|تاكسي|بنزين|وقود|بترول|محطة|مواصلات/.test(value)) return 'transport';
    if (/carrefour|lulu|grocery|market|restaurant|food|cafe|coffee|مطعم|مقهى|قهوة|سوبر|ماركت|تموينات|بقالة|خضار|مخبز|كارفور|لولو/.test(value)) return 'food';
    if (/ooredoo|vodafone|kahramaa|internet|phone|electric|water|فاتورة|كهرباء|ماء|هاتف|انترنت|إنترنت|أوريدو|فودافون/.test(value)) return 'bills';
    if (/cinema|netflix|game|playstation|سينما|نتفلكس|ترفيه|ألعاب|العاب/.test(value)) return 'fun';
    return 'other';
  }

  return {
    clean,
    number,
    percent,
    wizardTotals,
    cycleBalance,
    savingsProgress,
    classifyMerchant,
    dateKey,
    parseDate,
    salaryCycle,
    receiptCycle,
    closedReceiptCycle,
    inCycle,
    cycleProgress,
    recurringDate
  };
})();
