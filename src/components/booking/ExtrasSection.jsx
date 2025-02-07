import React from "react";
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

  return (
    <div className="flex flex-col h-[300px] md:h-[500px] overflow-hidden">
      {/* Capacity Warning Message */}
      {isOverCapacity && (
        <div className="p-4 mb-4 border border-red-200 rounded-md bg-red-50">
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

      {/* Categories */}
      <div className="mb-4 shrink-0">
        <div className="flex flex-wrap gap-3">
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

      {/* Content */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto ${
          isOverCapacity ? "opacity-50 pointer-events-none" : ""
        }`}
        style={{ height: "400px", overflow: "scroll" }}
      >
        {selectedCategory === "boissons" ? (
          <div className="pb-4 space-y-6">{renderGroupedBoissons()}</div>
        ) : (
          <div className="pb-4 space-y-4">{renderRegularExtras()}</div>
        )}
      </div>
    </div>
  );

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
      <div key={type} className="pb-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-800 capitalize">
          {t(`extras.drinkTypes.${type}`)}
        </h2>
        <div className="space-y-4">
          {items.map((item) => renderExtraItem(item))}
        </div>
      </div>
    ));
  }

  function renderRegularExtras() {
    return extraCategories[selectedCategory].items.map((item) =>
      renderExtraItem(item)
    );
  }

  function renderExtraItem(item) {
    const itemName = item.name ? t(item.name) : item.name;
    const itemDescription = item.descriptionKey
      ? t(item.descriptionKey)
      : item.description;

    return (
      <div
        key={item.id}
        className="flex items-start gap-4 p-4 transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md"
      >
        <img
          src={item.image}
          alt={itemName}
          className="object-cover w-24 h-24 rounded-lg"
        />
        <div className="flex-grow space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="text-[15px] font-medium text-gray-900">
              {itemName}
            </h3>
            <div className="bg-[#668E73] px-2 py-1 rounded text-white text-[13px] font-medium">
              {item.price}€
            </div>
          </div>
          <p className="text-[13px] text-gray-600 line-clamp-3">
            {itemDescription}
          </p>
          <QuantitySelector
            item={item}
            selectedExtras={selectedExtras}
            handleExtraChange={handleExtraChange}
            disabled={isOverCapacity}
          />
        </div>
      </div>
    );
  }
};

const QuantitySelector = ({
  item,
  selectedExtras,
  handleExtraChange,
  disabled,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const newQuantity = (selectedExtras[item.id] || 0) - 1;
            handleExtraChange(item.id, newQuantity);
          }}
          disabled={disabled || (selectedExtras[item.id] || 0) === 0}
          className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:text-white transition-colors"
        >
          -
        </button>
        <span className="w-8 font-medium text-center text-gray-900">
          {selectedExtras[item.id] || 0}
        </span>
        <button
          type="button"
          onClick={() =>
            handleExtraChange(item.id, (selectedExtras[item.id] || 0) + 1)
          }
          disabled={disabled}
          className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      {item.extraPersonPrice && (selectedExtras[item.id] || 0) > 0 && (
        <div className="mt-2">
          <p className="text-[14px] text-gray-600 mb-1">
            {t("extras.additionalPerson", { price: item.extraPersonPrice })}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                handleExtraChange(
                  `${item.id}-extra`,
                  (selectedExtras[`${item.id}-extra`] || 0) - 1
                )
              }
              disabled={
                disabled || (selectedExtras[`${item.id}-extra`] || 0) === 0
              }
              className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:text-white transition-colors"
            >
              -
            </button>
            <span className="w-8 font-medium text-center text-gray-900">
              {selectedExtras[`${item.id}-extra`] || 0}
            </span>
            <button
              type="button"
              onClick={() =>
                handleExtraChange(
                  `${item.id}-extra`,
                  (selectedExtras[`${item.id}-extra`] || 0) + 1
                )
              }
              disabled={disabled}
              className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  );
};
