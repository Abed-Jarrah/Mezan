const MezanCurrency = (() => {
  const arabicSymbols = {
    QAR: 'ر.ق', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', BHD: 'د.ب',
    OMR: 'ر.ع', JOD: 'د.أ', USD: '$', EUR: '€', TRY: '₺'
  };
  const englishSymbols = {
    QAR: 'QAR', SAR: 'SAR', AED: 'AED', KWD: 'KWD', BHD: 'BHD',
    OMR: 'OMR', JOD: 'JOD', USD: '$', EUR: '€', TRY: '₺'
  };
  const currencies = Object.keys(arabicSymbols);
  const format = number => Number(number || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const display = value => MezanCalculations.number(value) ? format(MezanCalculations.number(value)) : '';
  const symbol = (currency, language = 'ar') =>
    (language === 'ar' ? arabicSymbols : englishSymbols)[currency] || currency;

  return { currencies, format, display, symbol };
})();
