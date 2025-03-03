export function extractPricingInfo(priceElements) {
  // Base price elements - look for either "base" type or "Prix de base" name
  const basePriceElement = priceElements.find(
    (el) =>
      el.type === "base" ||
      (el.name || "").toLowerCase().includes("prix de base") ||
      (el.name || "").toLowerCase().includes("base price")
  );

  const basePrice = basePriceElement
    ? parseFloat(basePriceElement.amount) || 0
    : 0;

  // Find discounts
  const longStayElement = priceElements.find(
    (el) => el.name && el.name.toLowerCase().includes("réduction long séjour")
  );
  const longStayDiscount = longStayElement
    ? Math.abs(parseFloat(longStayElement.amount) || 0)
    : 0;

  const couponElement = priceElements.find(
    (el) => el.name && el.name.toLowerCase().includes("code promo")
  );
  const couponDiscount = couponElement
    ? Math.abs(parseFloat(couponElement.amount) || 0)
    : 0;

  // Create promoCode object if coupon exists
  let promoCode = null;
  if (couponElement && couponElement.name) {
    const couponMatch = couponElement.name.match(/POTES|[A-Z0-9]+/i);
    const couponName = couponMatch ? couponMatch[0] : "CODE";

    promoCode = {
      code: couponName,
      name: couponName,
      amount: couponDiscount,
      type: "fixed",
      percentageValue: null,
    };
  }

  return {
    basePrice,
    longStayDiscount,
    couponDiscount,
    promoCode,
    discountElements: {
      longStay: longStayElement,
      coupon: couponElement,
    },
  };
}
