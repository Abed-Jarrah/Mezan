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

  return {
    clean,
    number,
    percent,
    wizardTotals,
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
