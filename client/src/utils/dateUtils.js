import dayjs from 'dayjs';

/**
 * Date formatting functions - ELIMINATES 9+ duplicate date formats
 * Used in: OrderForm, CollectOrderForm, OrderDeliveryCard, etc.
 */
export const getCurrentDate = () => dayjs().format('YYYY-MM-DD');
export const getCurrentDateTime = () => dayjs().format('HH:mm DD/MM/YY');
export const formatDate = (date, format = 'YYYY-MM-DD') => dayjs(date).format(format);
export const formatDateTime = (date) => dayjs(date).format('HH:mm DD/MM/YY');

/**
 * String date manipulation - ELIMINATES repetitive .slice() operations
 * Used in: CollectOrderForm, Invoice, DepositsCard, etc.
 */
export const extractDate = (dateString) => dateString ? dateString.slice(0, 10) : '';
export const extractTime = (dateString) => dateString ? dateString.slice(11, 16) : '';
export const formatDepositDateTime = (dateString) => {
  if (!dateString) return '';
  return dateString.slice(11, 16) + ' ' + dateString.slice(2, 10);
};