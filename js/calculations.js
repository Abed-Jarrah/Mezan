const MezanCalculations = (() => {
  const clean = value => String(value ?? '').replace(/,/g, '').replace(/[^0-9.]/g, '');
  const number = value => Math.max(0, Number(clean(value) || 0));
  const percent = (part, total) => total > 0 ? Math.round((number(part) / total) * 100) : 0;

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

  return { clean, number, percent, wizardTotals };
})();
