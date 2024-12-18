import React from "react";
import { useTranslation } from 'react-i18next';
import { extraCategories } from "../extraCategories";

export const PriceDetails = ({
  priceDetails,
  selectedExtras,
  appliedCoupon,
}) => {
  const { t } = useTranslation();

  if (!priceDetails) {
    return <div className="text-sm text-gray-500">{t('priceDetails.notAvailable')}</div>;
  }

  // Calculate selected extras details
  const selectedExtrasDetails = Object.entries(selectedExtras || {})
    .filter(([_, quantity]) => quantity > 0)
    .map(([extraId, quantity]) => {
      const isExtraPerson = extraId.endsWith("-extra");
      const baseExtraId = isExtraPerson ? extraId.replace("-extra", "") : extraId;

      const extra = Object.values(extraCategories)
        .flatMap((category) => category.items)
        .find((item) => item.id === baseExtraId);

      if (!extra) return null;

      return {
        name: isExtraPerson
          ? `${t(extra.nameKey)} - ${t('priceDetails.additionalPerson')}`
          : t(extra.nameKey),
        quantity: quantity,
        price: isExtraPerson ? extra.extraPersonPrice : extra.price,
        total: (isExtraPerson ? extra.extraPersonPrice : extra.price) * quantity,
      };
    })
    .filter(Boolean);

  // Calculate initial total with extras
  const extrasTotal = selectedExtrasDetails.reduce((sum, extra) => sum + extra.total, 0);

  // Base price + extras before any discounts
  const subtotalBeforeDiscounts = priceDetails.originalPrice + extrasTotal;

  // Make sure discounts are treated as reductions
  const longStayDiscount = Math.abs(priceDetails.discount || 0);
  const couponDiscount = appliedCoupon ? Math.abs(appliedCoupon.discount) : 0;

  // Subtract both discounts from the subtotal
  const finalTotal = subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

  if (finalTotal === 0) {
    return (
      <div className="my-4 text-sm font-bold text-red-500">
        {t('priceDetails.roomNotAvailable')}
      </div>
    );
  }

  return (
    <div className="p-4 mt-4 rounded-lg bg-gray-50" style={{ height: "350px", overflow: "scroll" }}>
      <h3 className="mb-2 font-bold">{t('priceDetails.title')}</h3>

      {/* Base price */}
      <div className="flex items-center justify-between">
        <span>{t('priceDetails.basePrice')}</span>
        <span>{priceDetails.originalPrice.toFixed(2)} EUR</span>
      </div>

      {/* Extras */}
      {selectedExtrasDetails.map((extra, index) => (
        <div key={index} className="flex items-center justify-between text-gray-600">
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
            {t('priceDetails.longStayDiscount')} (
            {priceDetails.settings?.lengthOfStayDiscount?.discountPercentage || 0}
            %)
          </span>
          <span>-{longStayDiscount.toFixed(2)} EUR</span>
        </div>
      )}

      {/* Coupon discount */}
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between text-green-600">
          <span>{t('priceDetails.promoCode')} ({appliedCoupon.code})</span>
          <span>-{couponDiscount.toFixed(2)} EUR</span>
        </div>
      )}

      {/* Subtotal before discounts */}
      <div className="flex items-center justify-between pt-2 mt-2 text-gray-600 border-t border-gray-200">
        <span>{t('priceDetails.subtotal')}</span>
        <span>{subtotalBeforeDiscounts.toFixed(2)} EUR</span>
      </div>

      {/* Total discounts */}
      {(longStayDiscount > 0 || couponDiscount > 0) && (
        <div className="flex items-center justify-between text-green-600">
          <span>{t('priceDetails.totalDiscounts')}</span>
          <span>-{(longStayDiscount + couponDiscount).toFixed(2)} EUR</span>
        </div>
      )}

      {/* Final total */}
      <div className="flex items-center justify-between pt-2 mt-2 font-bold border-t border-gray-200">
        <span>{t('priceDetails.total')}</span>
        <span>{finalTotal.toFixed(2)} EUR</span>
      </div>

      {/* Additional information about payment */}
      <div className="mt-4 text-sm text-gray-500">
        <p>{t('priceDetails.taxesIncluded')}</p>
        {priceDetails.settings?.deposit && (
          <p className="mt-1">
            {t('priceDetails.depositRequired', {
              percentage: priceDetails.settings.deposit.percentage,
              amount: ((finalTotal * priceDetails.settings.deposit.percentage) / 100).toFixed(2)
            })}
          </p>
        )}
      </div>
    </div>
  );
};
