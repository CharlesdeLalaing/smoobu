// src/components/booking/FreeDrinksSelection.js
import React from "react";
import { useTranslation } from "react-i18next";

// Import from where DRINK_OFFER_CONFIG and ALL_DRINK_ITEMS_MAP are truly located/exported
// This path assumes InfoSupSection.js (where they might be defined and exported)
// is in the same directory or a path relative to this file.
// If they are in a global constants file, adjust the path accordingly.
import { DRINK_OFFER_CONFIG, ALL_DRINK_ITEMS_MAP } from "./InfoSupSection";

const FreeQuantitySelector = ({
  drink,
  quantity,
  onQuantityChange,
  maxReached,
  overallDisabled,
}) => {
  const { t } = useTranslation(); // t function if needed for aria-labels or tooltips

  const handleDecrement = () => {
    if (overallDisabled) return;
    onQuantityChange(drink.id, Math.max(0, quantity - 1));
  };

  const handleIncrement = () => {
    if (overallDisabled) return;
    // Only increment if maxReached (overall limit for the offer) is false
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
          "quantitySelector.decrement",
          `Decrement quantity for ${drink.name}`
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
        // Disable if overall component is disabled OR if the max for this offer group is reached
        disabled={overallDisabled || (maxReached && quantity >= 0)} // If maxReached, disable increment. The 'quantity >=0' is to ensure it's still disabled if max is 0.
        aria-label={t(
          "quantitySelector.increment",
          `Increment quantity for ${drink.name}`
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
  currentOfferDataForDisplay, // For wine: { selection: 'id', chooseNonAlcoholicLater: boolean }
  // For soft/beer: { drinkId: quantity } or undefined/null if not yet interacted
  onFreeDrinkChange,
  disabled, // True if the wine selection part (radio buttons) should be disabled
}) => {
  const { t } = useTranslation();

  // Get the configuration for the specific offer being rendered
  const offerConfig = DRINK_OFFER_CONFIG[offerKey];

  // If no configuration is found for this offer key, render nothing or an error.
  if (!offerConfig) {
    console.warn(
      `FreeDrinksSelection: No configuration found for offerKey "${offerKey}"`
    );
    return null;
  }
  if (!ALL_DRINK_ITEMS_MAP) {
    console.warn(
      `FreeDrinksSelection: ALL_DRINK_ITEMS_MAP is not available for offerKey "${offerKey}"`
    );
    return null;
  }

  const handleWineSelection = (wineId) => {
    if (disabled) return; // Prevent action if the wine selection part is disabled by the parent
    onFreeDrinkChange(offerKey, { selectedWineId: wineId });
  };

  const handleSoftBeerQuantityChange = (drinkId, newQuantity) => {
    // The 'disabled' prop is primarily for the wine selection checkboxes/radios.
    // Soft/beer quantity selection typically isn't disabled by the "choose non-alcoholic later" wine option.
    onFreeDrinkChange(offerKey, { drinkId: drinkId, newQuantity: newQuantity });
  };

  const renderWineOffer = () => {
    // currentOfferDataForDisplay for wine is expected to be { selection: 'wineId' or null, chooseNonAlcoholicLater: boolean }
    const selectedWineId = currentOfferDataForDisplay?.selection || null;
    // The 'disabled' prop passed from InfoSupSection controls the UI state here

    return (
      <div>
        <h3
          className={`text-md font-semibold mb-3 ${
            disabled ? "text-gray-400 line-through" : "text-gray-700"
          }`}
        >
          {t(offerConfig.titleKey, offerConfig.defaultTitle)}
        </h3>
        {/* Apply opacity and pointer-events-none if the section is disabled */}
        <div
          className={`space-y-3 ${
            disabled ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {offerConfig.drinks.map((wineOption) => {
            const drinkDetails = ALL_DRINK_ITEMS_MAP[wineOption.id];
            if (!drinkDetails) {
              console.warn(
                `Wine option with ID ${wineOption.id} not found in ALL_DRINK_ITEMS_MAP.`
              );
              return null;
            }
            return (
              <label
                key={wineOption.id}
                className={`flex items-center p-3 border rounded-lg transition-colors 
                            ${
                              disabled
                                ? "bg-gray-100 cursor-not-allowed"
                                : "cursor-pointer"
                            } 
                            ${
                              !disabled && selectedWineId === wineOption.id
                                ? "bg-green-50 border-green-400 ring-2 ring-green-300 shadow-md"
                                : "border-gray-300 hover:border-gray-400 hover:shadow-sm"
                            }`}
              >
                <input
                  type="radio"
                  name={`wine_offer_${offerKey}`} // Ensures only one radio in this group can be selected
                  value={wineOption.id}
                  checked={!disabled && selectedWineId === wineOption.id} // Only visually checked if not disabled
                  onChange={() => handleWineSelection(wineOption.id)}
                  disabled={disabled}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:ring-offset-1 focus:ring-offset-white disabled:bg-gray-200 disabled:border-gray-400"
                />
                {drinkDetails.image && (
                  <img
                    src={drinkDetails.image}
                    alt={t(drinkDetails.name, drinkDetails.name)}
                    className="object-cover w-12 h-12 ml-3 mr-3 border border-gray-200 rounded-md"
                  />
                )}
                <span
                  className={`ml-3 text-sm font-medium ${
                    disabled ? "text-gray-500" : "text-gray-800"
                  }`}
                >
                  {/* Use drinkDetails.name if nameKey isn't present or translation fails */}
                  {t(
                    wineOption.nameKey,
                    drinkDetails.name || wineOption.defaultName
                  )}{" "}
                  {wineOption.subText || ""}
                </span>
                {/* Optionally hide "Inclus" text or change it if disabled */}
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
    // currentOfferDataForDisplay for soft/beers is an object like { drinkId: quantity } or undefined
    const selectionsForOffer = currentOfferDataForDisplay || {};
    const totalSelectedCount = Object.values(selectionsForOffer).reduce(
      (sum, qty) => sum + qty,
      0
    );

    // This determines if the "+" button should be generally disabled for NEW increments in this offer group
    const isOverallMaxReached = totalSelectedCount >= offerConfig.maxTotal;

    return (
      <div>
        <h3 className="mb-2 font-semibold text-gray-700 text-md">
          {t(offerConfig.titleKey, offerConfig.defaultTitle)}
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          {t("extras.drinks.selectedOutOf", {
            count: totalSelectedCount,
            max: offerConfig.maxTotal,
          })}
        </p>
        <div className="space-y-4">
          {["softs", "beers"].map(
            (
              categoryKey // Iterate through defined categories in offerConfig
            ) =>
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
                          `Drink with ID ${drinkId} in category ${categoryKey} not found in ALL_DRINK_ITEMS_MAP.`
                        );
                        return null;
                      }
                      const currentQuantity = selectionsForOffer[drinkId] || 0;
                      const itemName = drink.nameKey
                        ? t(drink.nameKey, drink.name)
                        : drink.name;

                      return (
                        <div
                          key={drinkId}
                          className="flex items-center justify-between p-3 transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center flex-grow mr-3">
                            {drink.image && (
                              <img
                                src={drink.image}
                                alt={itemName}
                                className="object-cover w-12 h-12 mr-4 border border-gray-200 rounded-md"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {itemName}
                              </p>
                              {/* Optional: Description
                                        {drink.descriptionKey && <p className="text-xs text-gray-500">{t(drink.descriptionKey)}</p>}
                                        */}
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
                              maxReached={isOverallMaxReached} // Pass the overall status for this offer type
                              overallDisabled={false} // Soft/beer section is generally not disabled by a wine-specific checkbox
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

  // Determine which UI to render based on the offer type
  if (offerConfig.type === "wine_choice") {
    return renderWineOffer();
  } else if (offerConfig.type === "soft_beer_choice") {
    return renderSoftBeerOffer();
  }

  // Fallback if offer type is unknown
  console.warn(
    `FreeDrinksSelection: Unknown offer type "${offerConfig.type}" for offerKey "${offerKey}"`
  );
  return null;
};

export default FreeDrinksSelection;
