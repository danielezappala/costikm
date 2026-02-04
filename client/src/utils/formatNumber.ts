export const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    value
  );
