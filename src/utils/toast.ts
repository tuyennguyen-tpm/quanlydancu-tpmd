export const showToast = (message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success') => {
  const event = new CustomEvent('show-toast', { detail: { message, type } });
  window.dispatchEvent(event);
};
