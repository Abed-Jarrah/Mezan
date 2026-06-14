const MezanCurrency = (() => {
  const symbols = {
    QAR: 'ر.ق', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', BHD: 'د.ب',
    OMR: 'ر.ع', JOD: 'د.أ', USD: '$', EUR: '€', TRY: '₺'
  };
  const currencies = Object.keys(symbols);
  const format = number => Number(number || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const display = value => MezanCalculations.number(value) ? format(MezanCalculations.number(value)) : '';

  return { symbols, currencies, format, display };
})();
