export const formatEuro = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

export const formatEuroKm = (value: number) => `${formatEuro(value)} / km`;
