import dayjs from 'dayjs';

/**
 * Date formatting functions - ELIMINATES 9+ duplicate date formats
 * Used in: OrderForm, CollectOrderForm, OrderDeliveryCard, etc.
 */
export const getCurrentDate = () => dayjs().format('YYYY-MM-DD');
export const getCurrentDateTime = () => dayjs().format('HH:mm DD/MM/YY');
export const formatDate = (date, format = 'DD/MM/YY') => dayjs(date).format(format);
export const formatDateTime = (date) => dayjs(date).format('HH:mm DD/MM/YY');

/**
 * String date manipulation - ELIMINATES repetitive .slice() operations
 * Used in: CollectOrderForm, Invoice, DepositsCard, etc.
 */
export const extractDate = (dateString) => dateString ? dayjs(dateString).format('DD/MM/YY') : '';
export const extractTime = (dateString) => dateString ? dayjs(dateString).format('HH:mm') : '';
export const formatDepositDateTime = (dateString) => {
  if (!dateString) return '';
  return dayjs(dateString).format('HH:mm DD/MM/YY');
};