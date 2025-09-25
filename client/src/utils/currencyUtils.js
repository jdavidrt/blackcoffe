export const formatCurrency = (amount, includeDecimals = false) => {
  const numAmount = parseFloat(amount) || 0;
  if (includeDecimals) {
    return `$${numAmount.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${numAmount.toLocaleString('es-CO')}`;
};

export const parseCurrencyInput = (value) => {
  const cleaned = value.toString().replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
};