/**
 * Mall constants and utilities - ELIMINATES 6+ duplicate mall selection patterns
 * Used in: OrderForm, ClientsPage, DeliveredPage, etc.
 */
export const MALLS = {
  UNILAGO: 'Unilago',
  ALTA_TECNOLOGIA: 'Alta Tecnología',
  OTROS: 'Otros',
  CLIENTE_FRECUENTE: 'Cliente Frecuente'
};

/**
 * Get mall button styling
 */
export const getMallButtonStyle = (currentMall, targetMall) => ({
  backgroundColor: currentMall === targetMall ? '#A6C4F0' : '#F3F1F1',
});

/**
 * Get mall-specific card styling
 */
export const getMallCardStyle = (mall) => {
  const baseClasses = 'flex flex-col rounded-md m-2 text-black';
  const mallColors = {
    [MALLS.UNILAGO]: 'bg-amber-300',
    [MALLS.ALTA_TECNOLOGIA]: 'bg-teal-500',
    [MALLS.OTROS]: 'bg-stone-500',
  };

  return `${baseClasses} ${mallColors[mall] || 'bg-stone-100'}`;
};