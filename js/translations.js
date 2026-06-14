const MezanTranslations = (() => {
  function get(dictionary, language, key) {
    return (dictionary[language] || dictionary.ar)[key] || dictionary.ar[key] || key;
  }

  const direction = language => language === 'ar' ? 'rtl' : 'ltr';

  return { get, direction };
})();
