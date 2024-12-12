export const calculateTotalNights = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const calculateBasePrice = (pricePerNight, numberOfNights) => {
  return pricePerNight * numberOfNights;
};

export const calculateExtrasTotal = (selectedExtrasArray) => {
  return selectedExtrasArray.reduce(
    (sum, extra) => sum + extra.amount + (extra.extraPersonAmount || 0),
    0
  );
};

export const calculateDiscounts = (subtotal, discounts) => {
  return discounts.reduce((total, discount) => {
    if (discount.type === "percentage") {
      return total + (subtotal * discount.value) / 100;
    }
    return total + discount.value;
  }, 0);
};

export const calculateFinalPrice = ({
  basePrice,
  extrasTotal,
  discounts,
  taxes = 0,
  fees = 0,
}) => {
  const subtotal = basePrice + extrasTotal;
  const totalDiscounts = calculateDiscounts(subtotal, discounts);
  return subtotal - totalDiscounts + taxes + fees;
};

export const formatPrice = (amount, currency = "EUR") => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const calculateDeposit = (total, depositPercentage) => {
  return (total * depositPercentage) / 100;
};
