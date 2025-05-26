// src/components/booking/PriceDetails.js
import React from "react";
import { useTranslation } from "react-i18next";
import { extraCategories } from "../extraCategories"; // Adjust path as needed

// Import ALL_DRINK_ITEMS_MAP and DRINK_OFFER_CONFIG.
// This path assumes they are exported from InfoSupSection.js or a shared constants file
// accessible from this location.
import { ALL_DRINK_ITEMS_MAP, DRINK_OFFER_CONFIG } from "./InfoSupSection"; // Adjust path if necessary

export const PriceDetails = ({
  priceDetails, // Price details from Smoobu/availability check
  selectedExtras, // Object of selected PAID extras { extraId: quantity }
  appliedCoupon, // Applied coupon object
  formData, // Full formData, contains selectedFreeDrinks, adults, children
}) => {
  const { t } = useTranslation();

  // Guard clause: If priceDetails or essential settings are missing, show a message.
  if (!priceDetails || !priceDetails.settings) {
    return (
      <div className="p-4 mt-4 text-sm text-gray-500 rounded-lg shadow bg-gray-50">
        {t(
          "priceDetails.notAvailable",
          "Les détails du prix ne sont pas disponibles pour le moment."
        )}
      </div>
    );
  }

  // --- Calculate Guest Fees ---
  const totalGuests =
    (parseInt(formData?.adults) || 0) + (parseInt(formData?.children) || 0);
  const extraGuests = Math.max(
    0,
    totalGuests - (priceDetails.settings.startingAtGuest || 2) // Default to 2 if not set
  );
  const totalGuestFees =
    extraGuests * (priceDetails.settings.extraGuestsPerNight || 0); // Default to 0 if not set

  // --- Calculate Selected PAID Extras Details ---
  const selectedPaidExtrasDetails = Object.entries(selectedExtras || {})
    .filter(([_, quantity]) => quantity > 0) // Only include extras with quantity > 0
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
        id: extraId, // Use the original extraId for a unique key for React's map
        name: isExtraPerson
          ? `${t(extra.name, extra.name)} - ${t(
              "priceDetails.additionalPerson",
              "Pers. suppl."
            )}`
          : t(extra.name, extra.name),
        quantity: quantity,
        price: isExtraPerson ? extra.extraPersonPrice : extra.price,
        total:
          (isExtraPerson ? extra.extraPersonPrice : extra.price) * quantity,
      };
    })
    .filter(Boolean); // Remove any null entries if an extra was not found

  // Calculate total for PAID extras
  const paidExtrasTotal = selectedPaidExtrasDetails.reduce(
    (sum, extra) => sum + extra.total,
    0
  );

  // --- Prepare Selected FREE Drinks for Display ---
  const selectedFreeDrinksDetails = [];
  if (
    formData?.selectedFreeDrinks &&
    ALL_DRINK_ITEMS_MAP &&
    Object.keys(ALL_DRINK_ITEMS_MAP).length > 0 &&
    DRINK_OFFER_CONFIG &&
    Object.keys(DRINK_OFFER_CONFIG).length > 0
  ) {
    Object.entries(formData.selectedFreeDrinks).forEach(
      ([offerKey, offerSpecificData]) => {
        const offerConfig = DRINK_OFFER_CONFIG[offerKey];

        if (!offerConfig || !offerSpecificData) return;

        if (offerConfig.type === "wine_choice") {
          if (offerSpecificData.chooseNonAlcoholicLater) {
            selectedFreeDrinksDetails.push({
              id: `${offerKey}-nonAlcoholicLater`,
              name: `${t(offerConfig.titleKey, offerConfig.defaultTitle)}: ${t(
                "priceDetails.nonAlcoholicChosenLater",
                "Option non-alcoolisée (à voir avec l'hôte)"
              )}`,
              quantity: 1,
              isFree: true,
            });
          } else if (offerSpecificData.selection) {
            const wineId = offerSpecificData.selection;
            const drinkItem = ALL_DRINK_ITEMS_MAP[wineId];
            if (drinkItem) {
              let resolvedDrinkName;
              if (drinkItem.nameKey) {
                // Attempt to translate using nameKey, provide drinkItem.name as a fallback if translation key not found
                resolvedDrinkName = t(
                  drinkItem.nameKey,
                  drinkItem.name || "Vin sélectionné"
                );
                // If t() returns the key itself (meaning no translation found for nameKey), and drinkItem.name exists, prefer drinkItem.name
                if (resolvedDrinkName === drinkItem.nameKey && drinkItem.name) {
                  resolvedDrinkName = drinkItem.name;
                }
              } else {
                // If no nameKey, use the direct name property, or a generic fallback
                resolvedDrinkName =
                  drinkItem.name ||
                  t("priceDetails.selectedWine", "Vin sélectionné");
              }

              selectedFreeDrinksDetails.push({
                id: `${offerKey}-${wineId}`,
                name: `${t(
                  offerConfig.titleKey,
                  offerConfig.defaultTitle
                )}: ${resolvedDrinkName}`,
                quantity: 1,
                isFree: true,
              });
            }
          }
        } else if (offerConfig.type === "soft_beer_choice") {
          Object.entries(offerSpecificData).forEach(([drinkId, quantity]) => {
            if (quantity > 0) {
              const drinkItem = ALL_DRINK_ITEMS_MAP[drinkId];
              if (drinkItem) {
                let resolvedDrinkName;
                if (drinkItem.nameKey) {
                  resolvedDrinkName = t(
                    drinkItem.nameKey,
                    drinkItem.name || "Boisson sélectionnée"
                  );
                  if (
                    resolvedDrinkName === drinkItem.nameKey &&
                    drinkItem.name
                  ) {
                    resolvedDrinkName = drinkItem.name;
                  }
                } else {
                  resolvedDrinkName =
                    drinkItem.name ||
                    t("priceDetails.selectedDrink", "Boisson sélectionnée");
                }
                selectedFreeDrinksDetails.push({
                  id: `${offerKey}-${drinkId}-${quantity}`,
                  name: `${resolvedDrinkName}`,
                  quantity: quantity,
                  isFree: true,
                });
              }
            }
          });
        }
      }
    );
  }
  // --- END: Prepare selected FREE drinks for display ---

  // --- Calculate Totals ---
  const subtotalBeforeDiscounts =
    priceDetails.originalPrice + paidExtrasTotal + totalGuestFees;
  const longStayDiscount = Math.abs(priceDetails.discount || 0);
  const couponDiscount = appliedCoupon ? Math.abs(appliedCoupon.discount) : 0;
  const finalTotal = Math.max(
    0,
    subtotalBeforeDiscounts - longStayDiscount - couponDiscount
  );

  return (
    <div className="p-4 mt-4 overflow-y-auto bg-gray-50 rounded-lg shadow-md max-h-[32rem] sm:max-h-96 md:max-h-[30rem] lg:max-h-[32rem]">
      <h3 className="pb-2 mb-3 text-lg font-semibold text-gray-800 border-b">
        {t("priceDetails.title", "Détail du Prix")}
      </h3>

      <div className="space-y-1 text-sm">
        {/* Base price */}
        <div className="flex items-center justify-between py-1">
          <span className="text-gray-700">
            {t("priceDetails.basePrice", "Prix de base du séjour")}
          </span>
          <span className="font-medium text-gray-900">
            {priceDetails.originalPrice.toFixed(2)} EUR
          </span>
        </div>

        {/* Guest fees */}
        {totalGuestFees > 0 && (
          <div className="flex items-center justify-between py-1 text-gray-600">
            <span>
              {t("priceDetails.guestFees", {
                count: extraGuests,
                fee: priceDetails.settings.extraGuestsPerNight.toFixed(2),
              })}
            </span>
            <span className="font-medium">
              +{totalGuestFees.toFixed(2)} EUR
            </span>
          </div>
        )}

        {/* PAID Extras */}
        {selectedPaidExtrasDetails.length > 0 && (
          <div className="pt-2 mt-1 border-t border-gray-200">
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {t("priceDetails.extrasTitle", "Extras")}
            </h4>
            {selectedPaidExtrasDetails.map((extra) => (
              <div
                key={extra.id}
                className="flex items-center justify-between py-1 text-gray-600"
              >
                <span>
                  {extra.name} ({extra.quantity}x)
                </span>
                <span className="font-medium">
                  +{extra.total.toFixed(2)} EUR
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Display FREE Drinks */}
        {selectedFreeDrinksDetails.length > 0 && (
          <div className="pt-2 mt-1 border-t border-gray-200">
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-green-700 uppercase">
              {t("priceDetails.freeDrinksTitle", "Boissons Incluses")}
            </h4>
            {selectedFreeDrinksDetails.map((drink) => (
              <div
                key={drink.id}
                className="flex items-center justify-between py-1 text-green-600"
              >
                <span>
                  {drink.name}
                  {drink.quantity > 1 ? ` (${drink.quantity}x)` : ""}
                </span>
                <span className="font-medium">
                  {t("priceDetails.included", "Inclus")}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Subtotal before any discounts */}
        {(paidExtrasTotal > 0 ||
          totalGuestFees > 0 ||
          selectedFreeDrinksDetails.length > 0) && (
          <div className="flex items-center justify-between pt-2 mt-2 font-semibold text-gray-700 border-t border-gray-300">
            <span>
              {t(
                "priceDetails.subtotalBeforeDiscounts",
                "Sous-total (avant remises)"
              )}
            </span>
            <span>{subtotalBeforeDiscounts.toFixed(2)} EUR</span>
          </div>
        )}

        {/* Long stay discount */}
        {longStayDiscount > 0 && (
          <div className="flex items-center justify-between py-1 text-green-600">
            <span>
              {t("priceDetails.longStayDiscount", "Remise long séjour")}
              {priceDetails.settings?.lengthOfStayDiscount
                ?.discountPercentage &&
                ` (${priceDetails.settings.lengthOfStayDiscount.discountPercentage}%)`}
            </span>
            <span className="font-medium">
              -{longStayDiscount.toFixed(2)} EUR
            </span>
          </div>
        )}

        {/* Coupon discount */}
        {couponDiscount > 0 && appliedCoupon && (
          <div className="flex items-center justify-between py-1 text-green-600">
            <span>
              {appliedCoupon.isGiftVoucher
                ? t("priceDetails.giftVoucher", "Chèque Cadeau")
                : t("priceDetails.promoCode.generic", "Code Promo")}
              {` (${appliedCoupon.code})`}
              {appliedCoupon.type === "percentage" &&
              appliedCoupon.percentageValue
                ? ` - ${appliedCoupon.percentageValue}%`
                : ""}
            </span>
            <span className="font-medium">
              -{couponDiscount.toFixed(2)} EUR
            </span>
          </div>
        )}

        {(longStayDiscount > 0 || couponDiscount > 0) && (
          <div className="flex items-center justify-between py-1 font-medium text-green-700">
            <span>{t("priceDetails.totalDiscounts", "Total Remises")}</span>
            <span>-{(longStayDiscount + couponDiscount).toFixed(2)} EUR</span>
          </div>
        )}

        {/* Final total */}
        <div className="flex items-center justify-between pt-3 mt-2 text-lg font-bold text-gray-900 border-t-2 border-gray-300">
          <span>{t("priceDetails.total", "Total à Payer")}</span>
          <span>{finalTotal.toFixed(2)} EUR</span>
        </div>
      </div>

      {/* Additional information about payment */}
      <div className="pt-3 mt-3 text-xs text-gray-500 border-t border-gray-200">
        <p>
          {t("priceDetails.taxesIncluded", "Toutes les taxes sont incluses.")}
        </p>
        {priceDetails.settings?.deposit?.percentage > 0 && (
          <p className="mt-1">
            {t("priceDetails.depositRequired", {
              percentage: priceDetails.settings.deposit.percentage,
              amount: (
                (finalTotal * priceDetails.settings.deposit.percentage) /
                100
              ).toFixed(2),
            })}
          </p>
        )}
      </div>
    </div>
  );
};
