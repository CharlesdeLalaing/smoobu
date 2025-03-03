export const calculatePriceWithSettings = (
  rates,
  startDate,
  endDate,
  numberOfGuests,
  numberOfChildren,
  settings
) => {
  let totalPrice = 0;
  let numberOfNights = 0;
  const currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);

  // Calculate base room price
  while (currentDate <= endDateTime) {
    const dateStr = currentDate.toISOString().split("T")[0];
    if (dateStr !== endDateTime.toISOString().split("T")[0]) {
      const dayRate = rates[dateStr];
      if (dayRate && dayRate.available === 1) {
        totalPrice += dayRate.price;
        numberOfNights++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate long stay discount only on the base room price
  let discount = 0;
  if (numberOfNights >= settings.lengthOfStayDiscount.minNights) {
    discount =
      (totalPrice * settings.lengthOfStayDiscount.discountPercentage) / 100;
  }

  // Calculate flat guest fees (not per night)
  const totalGuests = numberOfGuests + numberOfChildren;
  const extraGuests = Math.max(0, totalGuests - settings.startingAtGuest);
  const guestFees = extraGuests * settings.extraGuestsPerNight; // Now treated as a flat fee

  // Build price elements array
  const priceElements = [
    {
      type: "basePrice",
      name: "Prix de base",
      amount: totalPrice,
      currencyCode: "EUR",
    },
  ];

  if (guestFees > 0) {
    priceElements.push({
      type: "addon",
      name: "Frais de personnes supplémentaires",
      amount: guestFees,
      currencyCode: "EUR",
    });
  }

  if (settings.cleaningFee > 0) {
    priceElements.push({
      type: "cleaningFee",
      name: "Frais de nettoyage",
      amount: settings.cleaningFee,
      currencyCode: "EUR",
    });
  }

  if (discount > 0) {
    priceElements.push({
      type: "longStayDiscount",
      name: `Réduction long séjour (${settings.lengthOfStayDiscount.discountPercentage}%)`,
      amount: -discount,
      currencyCode: "EUR",
    });
  }

  // Calculate final price including flat guest fees
  const subtotal = totalPrice + guestFees + settings.cleaningFee;
  const finalPrice = subtotal - discount;

  return {
    originalPrice: totalPrice,
    guestFees, // Added this to make it explicit in the return
    cleaningFee: settings.cleaningFee,
    discount,
    finalPrice,
    numberOfNights,
    priceElements,
    settings,
  };
};
