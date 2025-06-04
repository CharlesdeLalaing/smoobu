// src/components/booking/ExtrasSection.js
import React, { useState, useRef, useLayoutEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { extraCategories } from "../extraCategories";

export const ExtrasSection = ({
  selectedExtras,
  handleExtraChange,
  selectedCategory,
  setSelectedCategory,
  formData,
  selectedRoom,
}) => {
  const { t } = useTranslation();
  const totalGuests =
    (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0);
  const isOverCapacity = selectedRoom && totalGuests > selectedRoom.maxGuests;

  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  const toggleDescription = (itemId) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // NO specific height calculations needed within ExtrasSection itself anymore.
  // Its parent ("PARENT E" in BookingForm.js) will provide the scrollable height.

  return (
    // ExtrasSection Root: A simple flex column. IT DOES NOT SCROLL.
    // It will grow as tall as its content (sticky tabs + extras list).
    // Its parent (PARENT E in BookingForm.js) will handle the scrolling.
    <div className="flex flex-col">
      {isOverCapacity && (
        <div className="p-4 mb-4 border border-red-200 rounded-md bg-red-50 shrink-0">
          <p className="font-medium text-red-600">
            {t("propertyDetails.capacityExceeded.title")}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {t("propertyDetails.capacityExceeded.message", {
              maxGuests: selectedRoom.maxGuests,
              selectedGuests: totalGuests,
            })}
          </p>
        </div>
      )}

      {/* Sticky Category Tabs: Sticks to the top of its nearest scrolling ancestor (PARENT E) */}
      <div className="sticky top-0 z-10 pt-4 pb-4 mb-1 shadow-sm bg-opacity-95 bg-gray-50 backdrop-blur-sm shrink-0">
        {/* Using bg-gray-50 for sticky tabs; change to bg-white or your preference */}
        <div className="flex flex-wrap gap-3 px-1">
          {Object.entries(extraCategories).map(([key, category]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedCategory(key)}
              className={`px-4 py-2 rounded-lg transition-all text-[14px] font-bolder ${
                selectedCategory === key
                  ? "bg-[#668E73] text-white"
                  : "bg-[#668E73] bg-opacity-10 text-[#668E73] hover:bg-opacity-20"
              }`}
              disabled={isOverCapacity}
            >
              {t(category.nameKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Actual Extras List Area: This div simply contains the items. It does NOT scroll itself. */}
      <div
        className={`px-1 pb-4 ${
          // No flex-1, no min-h-0, no overflow here
          isOverCapacity ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {selectedCategory === "boissons" ? (
          <div className="space-y-4">{renderGroupedBoissons()}</div>
        ) : (
          <div className="space-y-4">{renderRegularExtras()}</div>
        )}
      </div>
    </div> // End of ExtrasSection root
  );

  // renderGroupedBoissons, renderRegularExtras, ExtraItemDisplay, QuantitySelector
  // remain the same as in the previous "best solution" with the ref-based "Read more" button.
  // Make sure ExtraItemDisplay and QuantitySelector are defined below or imported.

  function renderGroupedBoissons() {
    const groupedBoissons = extraCategories.boissons.items.reduce(
      (groups, item) => {
        const type = item.typeKey.split(".").pop();
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(item);
        return groups;
      },
      {}
    );

    return Object.entries(groupedBoissons).map(([type, items]) => (
      <div key={type} className="pb-2">
        <h2 className="mb-3 text-xl font-semibold text-gray-800 capitalize">
          {t(`extras.drinkTypes.${type}`)}
        </h2>
        <div className="space-y-4">
          {items.map((item) => (
            <ExtraItemDisplay item={item} key={item.id} />
          ))}
        </div>
      </div>
    ));
  }

  function renderRegularExtras() {
    return extraCategories[selectedCategory].items.map((item) => (
      <ExtraItemDisplay item={item} key={item.id} />
    ));
  }

  function ExtraItemDisplay({ item }) {
    const itemName = item.name ? t(item.name) : item.name;
    const itemDescription = item.descriptionKey
      ? t(item.descriptionKey)
      : item.description;

    const isGloballyExpanded = !!expandedDescriptions[item.id];
    const pRef = useRef(null);
    const [isVisuallyClamped, setIsVisuallyClamped] = useState(false);

    const checkClamping = useCallback(() => {
      if (pRef.current) {
        const visuallyClamped =
          pRef.current.scrollHeight > pRef.current.clientHeight;
        setIsVisuallyClamped(visuallyClamped);
      } else {
        setIsVisuallyClamped(false);
      }
    }, []);

    useLayoutEffect(() => {
      checkClamping();
      let timeoutId;
      const handleResize = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => checkClamping(), 150);
      };
      window.addEventListener("resize", handleResize);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("resize", handleResize);
      };
    }, [checkClamping, itemDescription, isGloballyExpanded]);

    const showButton =
      isGloballyExpanded || (!isGloballyExpanded && isVisuallyClamped);

    return (
      <div className="flex flex-col gap-3 p-3 transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md">
        <div className="flex items-start w-full gap-3">
          <img
            src={item.image}
            alt={itemName}
            className="object-cover w-20 h-20 rounded-lg shrink-0 md:w-24 md:h-24"
          />
          <div className="flex-grow min-w-0 space-y-1.5">
            <div className="flex items-start justify-between">
              <h3 className="text-[14px] md:text-[15px] font-medium text-gray-900">
                {itemName}
              </h3>
              <div className="bg-[#668E73] px-2 py-0.5 md:py-1 rounded text-white text-[12px] md:text-[13px] font-medium whitespace-nowrap ml-2">
                {item.price}€
              </div>
            </div>
            <div className="text-[12px] md:text-[13px] text-gray-600">
              <p
                ref={pRef}
                className={!isGloballyExpanded ? "line-clamp-3" : ""}
              >
                {itemDescription}
              </p>
              {showButton && (
                <button
                  type="button"
                  onClick={() => toggleDescription(item.id)}
                  className="mt-1 text-xs font-medium text-[#668E73] hover:underline md:text-sm"
                >
                  {isGloballyExpanded
                    ? t("extras.readLess", "Lire moins")
                    : t("extras.readMore", "Lire la suite")}
                </button>
              )}
            </div>
            <QuantitySelector
              item={item}
              selectedExtras={selectedExtras}
              handleExtraChange={handleExtraChange}
              disabled={isOverCapacity}
            />
          </div>
        </div>
      </div>
    );
  }
}; // End of ExtrasSection

const QuantitySelector = ({
  item,
  selectedExtras,
  handleExtraChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const currentSelectedExtras = selectedExtras || {};
  const itemIdExtra = `${item.id}-extra`;

  return (
    <>
      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={() => {
            const newQuantity = (currentSelectedExtras[item.id] || 0) - 1;
            handleExtraChange(item.id, newQuantity);
          }}
          disabled={disabled || (currentSelectedExtras[item.id] || 0) === 0}
          className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:text-white transition-colors"
        >
          -
        </button>
        <span className="font-medium text-center text-gray-900 w-7 md:w-8">
          {currentSelectedExtras[item.id] || 0}
        </span>
        <button
          type="button"
          onClick={() =>
            handleExtraChange(
              item.id,
              (currentSelectedExtras[item.id] || 0) + 1
            )
          }
          disabled={disabled}
          className="w-7 h-7 md:w-8 md:h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      {item.extraPersonPrice > 0 &&
        (currentSelectedExtras[item.id] || 0) > 0 && (
          <div className="mt-1.5 md:mt-2">
            <p className="text-[12px] md:text-[14px] text-gray-600 mb-0.5 md:mb-1">
              {t("extras.additionalPerson", { price: item.extraPersonPrice })}
            </p>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                type="button"
                onClick={() =>
                  handleExtraChange(
                    itemIdExtra,
                    (currentSelectedExtras[itemIdExtra] || 0) - 1
                  )
                }
                disabled={
                  disabled || (currentSelectedExtras[itemIdExtra] || 0) === 0
                }
                className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:text-white transition-colors"
              >
                -
              </button>
              <span className="font-medium text-center text-gray-900 w-7 md:w-8">
                {currentSelectedExtras[itemIdExtra] || 0}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleExtraChange(
                    itemIdExtra,
                    (currentSelectedExtras[itemIdExtra] || 0) + 1
                  )
                }
                disabled={disabled}
                className="w-7 h-7 md:w-8 md:h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>
        )}
    </>
  );
};
