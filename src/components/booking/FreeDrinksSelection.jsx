// src/components/booking/FreeDrinksSelection.js
import React from "react";
import { useTranslation } from "react-i18next";
import { DRINK_OFFER_CONFIG, ALL_DRINK_ITEMS_MAP } from "../extraCategories"; // Adjust path

const FreeQuantitySelector = ({
  drink,
  quantity,
  onQuantityChange,
  maxReached,
  overallDisabled,
}) => {
  const { t } = useTranslation();
  // Using item.name which is the i18n key for ALL_DRINK_ITEMS_MAP items
  const drinkDisplayNameForLabel = t(drink.name, drink.defaultName || drink.id);

  const handleDecrement = () => {
    if (overallDisabled) return;
    onQuantityChange(drink.id, Math.max(0, quantity - 1));
  };

  const handleIncrement = () => {
    if (overallDisabled) return;
    if (!maxReached) {
      onQuantityChange(drink.id, quantity + 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={overallDisabled || quantity === 0}
        aria-label={t(
          "quantitySelector.decrement", // Assuming you have a generic key for decrement
          `Decrement quantity for ${drinkDisplayNameForLabel}` // Fallback text
        )}
        className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#668E73] focus:ring-opacity-50"
      >
        -
      </button>
      <span
        className="w-8 font-medium text-center text-gray-900 tabular-nums"
        aria-live="polite"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={overallDisabled || (maxReached && quantity >= 0)}
        aria-label={t(
          "quantitySelector.increment", // Assuming you have a generic key for increment
          `Increment quantity for ${drinkDisplayNameForLabel}` // Fallback text
        )}
        className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#668E73] focus:ring-opacity-50"
      >
        +
      </button>
    </div>
  );
};

const FreeDrinksSelection = ({
  offerKey,
  currentOfferDataForDisplay,
  onFreeDrinkChange,
  disabled,
  dynamicMaxTotalForOffer,
}) => {
  const { t } = useTranslation();
  const offerConfig = DRINK_OFFER_CONFIG[offerKey];

  if (!offerConfig) {
    console.warn(
      `[FreeDrinksSelection] Offer config not found for key: ${offerKey}`
    );
    return null;
  }

  const handleWineSelection = (wineId) => {
    if (disabled) return;
    const payload = { selectedWineId: wineId };
    if (typeof onFreeDrinkChange === "function") {
      onFreeDrinkChange(payload);
    } else {
      console.error(
        "[FreeDrinksSelection] onFreeDrinkChange is NOT a function in handleWineSelection!"
      );
    }
  };

  const handleSoftBeerQuantityChange = (drinkId, newQuantity) => {
    const payload = { drinkId: drinkId, newQuantity: newQuantity };
    if (typeof onFreeDrinkChange === "function") {
      onFreeDrinkChange(payload);
    } else {
      console.error(
        "[FreeDrinksSelection] onFreeDrinkChange is NOT a function in handleSoftBeerQuantityChange!"
      );
    }
  };

  const renderWineOffer = () => {
    const selectedWineId = currentOfferDataForDisplay?.selection || null;
    return (
      <div>
        <h3
          className={`text-md font-semibold mb-3 ${
            disabled ? "text-gray-400 line-through" : "text-gray-700"
          }`}
        >
          {t(offerConfig.titleKey, offerConfig.defaultTitle)}
        </h3>
        <div
          className={`space-y-3 ${
            disabled ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {offerConfig.drinks.map((wineOption) => {
            const drinkDetails = ALL_DRINK_ITEMS_MAP[wineOption.id];
            if (!drinkDetails) {
              console.warn(
                `[FreeDrinksSelection] Drink details not found for wine ID: ${wineOption.id}`
              );
              return null;
            }
            // wineOption.nameKey is like "drinkNames.cortilBarco"
            // drinkDetails.name is also like "drinkNames.cortilBarco" from ALL_DRINK_ITEMS_MAP
            // drinkDetails.defaultName is English fallback like "Cortil Barco (rouge)"
            const wineDisplayName = t(
              wineOption.nameKey,
              drinkDetails.defaultName ||
                wineOption.defaultName ||
                wineOption.id
            );
            const wineImageAltText = t(
              drinkDetails.name,
              drinkDetails.defaultName || drinkDetails.id
            );

            return (
              <label
                key={wineOption.id}
                className={`flex items-center p-3 border rounded-lg transition-colors ${
                  disabled ? "bg-gray-100 cursor-not-allowed" : "cursor-pointer"
                } ${
                  !disabled && selectedWineId === wineOption.id
                    ? "bg-green-50 border-green-400 ring-2 ring-green-300 shadow-md"
                    : "border-gray-300 hover:border-gray-400 hover:shadow-sm"
                }`}
              >
                <input
                  type="radio"
                  name={`wine_offer_${offerKey}`}
                  value={wineOption.id}
                  checked={!disabled && selectedWineId === wineOption.id}
                  onChange={() => handleWineSelection(wineOption.id)}
                  disabled={disabled}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:ring-offset-1 focus:ring-offset-white disabled:bg-gray-200 disabled:border-gray-400"
                />
                {drinkDetails.image && (
                  <img
                    src={drinkDetails.image}
                    alt={wineImageAltText}
                    className="object-cover w-12 h-12 ml-3 mr-3 border border-gray-200 rounded-md"
                  />
                )}
                <span
                  className={`ml-3 text-sm font-medium ${
                    disabled ? "text-gray-500" : "text-gray-800"
                  }`}
                >
                  {wineDisplayName} {wineOption.subText || ""}
                </span>
                {!disabled && (
                  <span className="ml-auto text-sm font-semibold text-[#668E73]">
                    {t("extras.drinks.included", "Inclus")}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSoftBeerOffer = () => {
    const selectionsForOffer = currentOfferDataForDisplay || {};
    const totalSelectedCount = Object.values(selectionsForOffer).reduce(
      (sum, qty) => sum + Number(qty),
      0
    );

    const currentMaxForThisOffer =
      dynamicMaxTotalForOffer !== undefined
        ? dynamicMaxTotalForOffer
        : offerConfig.maxTotal || 0;

    const isOverallMaxReached = totalSelectedCount >= currentMaxForThisOffer;

    return (
      <div>
        <h3 className="mb-2 font-semibold text-gray-700 text-md">
          {t(offerConfig.titleKey, offerConfig.defaultTitle)}
          {
            offerConfig.type === "soft_beer_choice" &&
              currentMaxForThisOffer > 0 &&
              ` (${t(
                "extras.drinks.upTo",
                "up to"
              )} ${currentMaxForThisOffer} ${t(
                "extras.drinks.items",
                "items"
              )})`
          }
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          {t(
            // This part is for "Selected X of Y"
            "extras.drinks.selectedOutOf",
            `Selected {{count}} of {{max}}`,
            {
              count: totalSelectedCount,
              max: currentMaxForThisOffer,
            }
          )}
        </p>
        <div className="space-y-4">
          {["softs", "beers"].map(
            (categoryKey) =>
              offerConfig.categories[categoryKey] &&
              offerConfig.categories[categoryKey].length > 0 && (
                <div key={categoryKey} className="pt-2">
                  <h4 className="text-[15px] font-medium text-gray-600 mb-3 capitalize border-b pb-1">
                    {t(
                      `extras.drinkTypes.${
                        categoryKey === "softs" ? "soft" : "beer"
                      }`
                    )}
                  </h4>
                  <div className="space-y-3">
                    {offerConfig.categories[categoryKey].map((drinkId) => {
                      const drink = ALL_DRINK_ITEMS_MAP[drinkId];
                      if (!drink) {
                        console.warn(
                          `[FreeDrinksSelection] Drink details not found for ID: ${drinkId}`
                        );
                        return null;
                      }
                      const currentQuantity = Number(
                        selectionsForOffer[drinkId] || 0
                      );
                      // drink.name is the i18n key, e.g., "drinkNames.ritchieColaZero"
                      const itemName = t(
                        drink.name,
                        drink.defaultFrenchName || drink.defaultName || drink.id
                      );

                      return (
                        <div
                          key={drinkId}
                          className="flex items-center justify-between p-3 transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center flex-grow mr-3">
                            {drink.image && (
                              <img
                                src={drink.image}
                                alt={itemName} // Use translated name
                                className="object-cover w-12 h-12 mr-4 border border-gray-200 rounded-md"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {itemName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center flex-shrink-0 gap-4">
                            <span className="text-sm font-semibold text-[#668E73]">
                              {t("extras.drinks.included", "Inclus")}
                            </span>
                            <FreeQuantitySelector
                              drink={drink}
                              quantity={currentQuantity}
                              onQuantityChange={handleSoftBeerQuantityChange}
                              maxReached={isOverallMaxReached}
                              overallDisabled={false}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
          )}
        </div>
      </div>
    );
  };

  if (offerConfig.type === "wine_choice") return renderWineOffer();
  if (offerConfig.type === "soft_beer_choice") return renderSoftBeerOffer();

  console.warn(
    `[FreeDrinksSelection] Unknown offer type "${offerConfig.type}" for offerKey "${offerKey}"`
  );
  return null;
};

export default FreeDrinksSelection;
