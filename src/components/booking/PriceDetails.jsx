import React from "react";
import { extraCategories } from "../extraCategories";

export const PriceDetails = ({
  priceDetails,
  selectedExtras,
  appliedCoupon,
}) => {
  if (!priceDetails) {
    return <div className="text-sm text-gray-500">Not available</div>;
  }

  // Calculate selected extras details
  // Calculate selected extras details
  const selectedExtrasDetails = Object.entries(selectedExtras || {})
    .filter(([_, quantity]) => quantity > 0)
    .map(([extraId, quantity]) => {
      const isExtraPerson = extraId.endsWith("-extra");
      const baseExtraId = isExtraPerson
        ? extraId.replace("-extra", "")
        : extraId;

      const extra = Object.values(extraCategories)
        .flatMap((category) => category.items)
        .find((item) => item.id === baseExtraId);

      if (!extra) return null;

      return {
        name: isExtraPerson
          ? `${extra.name} - Personne supplémentaire`
          : extra.name,
        quantity: quantity,
        price: isExtraPerson ? extra.extraPersonPrice : extra.price,
        total:
          (isExtraPerson ? extra.extraPersonPrice : extra.price) * quantity,
      };
    })
    .filter(Boolean);

  // Calculate initial total with extras
  const extrasTotal = selectedExtrasDetails.reduce(
    (sum, extra) => sum + extra.total,
    0
  );

  // Base price + extras before any discounts
  const subtotalBeforeDiscounts = priceDetails.originalPrice + extrasTotal;

  // Make sure discounts are treated as reductions
  const longStayDiscount = Math.abs(priceDetails.discount || 0);
  const couponDiscount = appliedCoupon ? Math.abs(appliedCoupon.discount) : 0;

  // Subtract both discounts from the subtotal
  const finalTotal =
    subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

  // If finalTotal is 0, display "Room not available"
  if (finalTotal === 0) {
    return (
      <div className="my-4 text-sm font-bold text-red-500">
        Cette chambre n'est malheureusement pas disponible pour les dates
        sélectionnées.
      </div>
    );
  }

  return (
    <div
      className="p-4 mt-4 rounded-lg bg-gray-50"
      style={{ height: "350px", overflow: "scroll" }}
    >
      <h3 className="mb-2 font-bold">Détail des prix:</h3>

      {/* Base price */}
      <div className="flex items-center justify-between">
        <span>Prix de base</span>
        <span>{priceDetails.originalPrice.toFixed(2)} EUR</span>
      </div>

      {/* Extras */}
      {/* Extras */}
      {selectedExtrasDetails.map((extra, index) => (
        <div
          key={index}
          className="flex items-center justify-between text-gray-600"
        >
          <span>
            {extra.name} ({extra.quantity}x)
          </span>
          <span>{extra.total.toFixed(2)} EUR</span>
        </div>
      ))}

      {/* Long stay discount */}
      {longStayDiscount > 0 && (
        <div className="flex items-center justify-between text-green-600">
          <span>
            Réduction long séjour (
            {priceDetails.settings?.lengthOfStayDiscount?.discountPercentage ||
              0}
            %)
          </span>
          <span>-{longStayDiscount.toFixed(2)} EUR</span>
        </div>
      )}

      {/* Coupon discount */}
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between text-green-600">
          <span>Code promo ({appliedCoupon.code})</span>
          <span>-{couponDiscount.toFixed(2)} EUR</span>
        </div>
      )}

      {/* Subtotal before discounts */}
      <div className="flex items-center justify-between pt-2 mt-2 text-gray-600 border-t border-gray-200">
        <span>Sous-total</span>
        <span>{subtotalBeforeDiscounts.toFixed(2)} EUR</span>
      </div>

      {/* Total discounts */}
      {(longStayDiscount > 0 || couponDiscount > 0) && (
        <div className="flex items-center justify-between text-green-600">
          <span>Total des réductions</span>
          <span>-{(longStayDiscount + couponDiscount).toFixed(2)} EUR</span>
        </div>
      )}

      {/* Final total */}
      <div className="flex items-center justify-between pt-2 mt-2 font-bold border-t border-gray-200">
        <span>Total</span>
        <span>{finalTotal.toFixed(2)} EUR</span>
      </div>

      {/* Additional information about payment */}
      <div className="mt-4 text-sm text-gray-500">
        <p>* Prix total incluant toutes les taxes et frais</p>
        {priceDetails.settings?.deposit && (
          <p className="mt-1">
            ** Acompte requis : {priceDetails.settings.deposit.percentage}% (
            {(
              (finalTotal * priceDetails.settings.deposit.percentage) /
              100
            ).toFixed(2)}{" "}
            EUR)
          </p>
        )}
      </div>
    </div>
  );
};
