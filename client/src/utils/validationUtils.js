export const validatePositiveNumber = (value, fieldName = 'valor') => {
  const numValue = parseFloat(value);
  if (value !== "" && numValue < 0) {
    return `Por favor, ingrese un ${fieldName} positivo.`;
  }
  return null;
};

export const validateMaxAmount = (value, maxAmount, fieldName = 'valor') => {
  const numValue = parseFloat(value);
  if (value !== "" && numValue > maxAmount) {
    return `El ${fieldName} ingresado no puede ser mayor a ${maxAmount}.`;
  }
  return null;
};