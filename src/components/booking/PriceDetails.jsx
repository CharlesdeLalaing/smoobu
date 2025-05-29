// src/components/booking/PriceDetails.js
import React from "react";
import { useTranslation } from "react-i18next";
import { extraCategories } from "../extraCategories"; // Adjust path as needed

// Import ALL_DRINK_ITEMS_MAP and DRINK_OFFER_CONFIG.
import { ALL_DRINK_ITEMS_MAP, DRINK_OFFER_CONFIG } from "./InfoSupSection"; // Adjust path if necessary

// Helper to get paid extra name (used for prefixing free drink entitlements)
// This assumes paid extra items in extraCategories have their 'name' property as the translation key.
const getPaidExtraDisplayName = (paidExtraId, tFunction) => {
  if (!extraCategories) return paidExtraId;
  for (const categoryKey in extraCategories) {
    const category = extraCategories[categoryKey];
    if (category && category.items) {
      const item = category.items.find((i) => i.id === paidExtraId);
      if (item) {
        // Assumes item.name is the translation key for the paid extra's display name
        return item.name ? tFunction(item.name, paidExtraId) : paidExtraId;
      }
    }
  }
  return paidExtraId;
};

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
    totalGuests - (priceDetails.settings.startingAtGuest || 2)
  );
  const totalGuestFees =
    extraGuests * (priceDetails.settings.extraGuestsPerNight || 0);

  const selectedPaidExtrasDetails = Object.entries(selectedExtras || {})
    .filter(([_, quantity]) => quantity > 0)
    .map(([extraId, quantity]) => {
      const isExtraPerson = extraId.endsWith("-extra");
      const baseExtraId = isExtraPerson
        ? extraId.replace("-extra", "")
        : extraId;
      const extraItem = Object.values(extraCategories)
        .flatMap((cat) => cat.items)
        .find((item) => item.id === baseExtraId); // Renamed to extraItem
      if (!extraItem) return null;
      // Assume extraItem.name is the translation key for paid extras
      const extraDisplayName = extraItem.name
        ? t(extraItem.name, baseExtraId)
        : baseExtraId;
      return {
        id: extraId,
        name: isExtraPerson
          ? `${extraDisplayName} - ${t("priceDetails.additionalPerson")}`
          : extraDisplayName,
        quantity: quantity,
        price: isExtraPerson ? extraItem.extraPersonPrice : extraItem.price,
        total:
          (isExtraPerson ? extraItem.extraPersonPrice : extraItem.price) *
          quantity,
      };
    })
    .filter(Boolean);
  const paidExtrasTotal = selectedPaidExtrasDetails.reduce(
    (sum, extra) => sum + extra.total,
    0
  );
  // --- End Paid Extras ---

  // --- Prepare Selected FREE Drinks for Display (with refined name resolution) ---
  const selectedFreeDrinksDetails = [];
  if (
    formData?.selectedFreeDrinks &&
    ALL_DRINK_ITEMS_MAP &&
    Object.keys(ALL_DRINK_ITEMS_MAP).length > 0 &&
    DRINK_OFFER_CONFIG &&
    Object.keys(DRINK_OFFER_CONFIG).length > 0
  ) {
    Object.entries(formData.selectedFreeDrinks).forEach(
      ([instanceId, instanceSpecificData]) => {
        const parts = instanceId.split("-");
        if (parts.length < 2) {
          /* ... console.warn ... */ return;
        }
        const offerConfigKey = parts.pop();
        const paidExtraId = parts.join("-");
        const offerConfig = DRINK_OFFER_CONFIG[offerConfigKey];

        if (!offerConfig || !instanceSpecificData) {
          /* ... console.warn ... */ return;
        }

        const grantingPaidExtraDisplayName = getPaidExtraDisplayName(
          paidExtraId,
          t
        );

        if (offerConfig.type === "wine_choice") {
          if (instanceSpecificData.chooseNonAlcoholicLater) {
            selectedFreeDrinksDetails.push({
              id: `${instanceId}-later`,
              // Display Granting Extra Name + "Chosen Later" status
              name: `${grantingPaidExtraDisplayName}: ${t(
                "priceDetails.nonAlcoholicChosenLater",
                "Option non-alcoolisée (à voir avec l'hôte)"
              )}`,
              quantity: 1,
              isFree: true,
            });
          } else if (instanceSpecificData.selection) {
            const wineId = instanceSpecificData.selection;
            const drinkItem = ALL_DRINK_ITEMS_MAP[wineId];
            if (drinkItem) {
              let resolvedDrinkName;
              if (drinkItem.nameKey) {
                resolvedDrinkName = t(
                  drinkItem.nameKey,
                  drinkItem.name || wineId
                );
                if (
                  resolvedDrinkName === drinkItem.nameKey &&
                  drinkItem.name &&
                  !drinkItem.name.includes(".")
                )
                  resolvedDrinkName = drinkItem.name;
                else if (resolvedDrinkName === drinkItem.nameKey)
                  resolvedDrinkName = wineId;
              } else if (drinkItem.name) {
                resolvedDrinkName = t(drinkItem.name, drinkItem.name); // Handles literal names or keys
              } else {
                resolvedDrinkName = wineId;
              }

              selectedFreeDrinksDetails.push({
                id: `${instanceId}-${wineId}`,
                // === MODIFIED NAME: Granting Extra Name + Actual Wine Name ===
                name: `${grantingPaidExtraDisplayName}: ${resolvedDrinkName}`,
                quantity: 1,
                isFree: true,
              });
            }
          }
        } else if (offerConfig.type === "soft_beer_choice") {
          Object.entries(instanceSpecificData).forEach(
            ([drinkId, quantity]) => {
              if (quantity > 0) {
                const drinkItem = ALL_DRINK_ITEMS_MAP[drinkId];
                if (drinkItem) {
                  let resolvedDrinkName;
                  if (drinkItem.nameKey) {
                    resolvedDrinkName = t(
                      drinkItem.nameKey,
                      drinkItem.name || drinkId
                    );
                    if (
                      resolvedDrinkName === drinkItem.nameKey &&
                      drinkItem.name &&
                      !drinkItem.name.includes(".")
                    )
                      resolvedDrinkName = drinkItem.name;
                    else if (resolvedDrinkName === drinkItem.nameKey)
                      resolvedDrinkName = drinkId;
                  } else if (drinkItem.name) {
                    resolvedDrinkName = t(drinkItem.name, drinkItem.name);
                  } else {
                    resolvedDrinkName = drinkId;
                  }
                  selectedFreeDrinksDetails.push({
                    id: `${instanceId}-${drinkId}-${quantity}`,
                    // === MODIFIED NAME: Granting Extra Name + Actual Soft/Beer Name ===
                    name: `${grantingPaidExtraDisplayName}: ${resolvedDrinkName}`,
                    quantity: quantity,
                    isFree: true,
                  });
                }
              }
            }
          );
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
              {t("freeDrinks", "Boissons Incluses")}
            </h4>
            {selectedFreeDrinksDetails.map((drink) => (
              <div
                key={drink.id}
                className="flex items-center justify-between py-1 text-green-600"
              >
                <span>
                  {drink.name}{" "}
                  {/* This name now includes the granting extra and specific drink */}
                  {drink.quantity > 1 ? ` (${drink.quantity}x)` : ""}
                </span>
                <span className="font-medium">
                  {t("extras.drinks.included", "Inclus")}
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
                "priceDetails.subtotal",
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