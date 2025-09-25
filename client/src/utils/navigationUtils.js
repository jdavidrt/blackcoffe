export const delayedReload = (delay = 2000) => {
  setTimeout(() => {
    window.location.reload();
  }, delay);
};

export const delayedNavigate = (navigate, path, delay = 1000) => {
  setTimeout(() => {
    navigate(path);
  }, delay);
};