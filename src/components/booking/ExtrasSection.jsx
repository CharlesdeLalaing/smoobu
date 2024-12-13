import React from "react";
import { extraCategories } from "../extraCategories";

export const ExtrasSection = ({
  selectedExtras,
  handleExtraChange,
  selectedCategory,
  setSelectedCategory,
}) => {
  return (
    <div className="flex flex-col h-[600px] overflow-hidden">
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
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
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
        if (!groups[item.type]) {
          groups[item.type] = [];
        }
        groups[item.type].push(item);
        return groups;
      },
      {}
    );

    return Object.entries(groupedBoissons).map(([type, items]) => (
      <div key={type} className="pb-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-800 capitalize">
          {type === "wine"
            ? "Vins"
            : type === "beer"
            ? "Bières"
            : type === "soft"
            ? "Boissons non alcoolisées"
            : type === "bulles"
            ? "Bulles"
            : type}
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
    return (
      <div
        key={item.id}
        className="flex items-start gap-4 p-4 transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md"
      >
        <img
          src={item.image}
          alt={item.name}
          className="object-cover w-24 h-24 rounded-lg"
        />
        <div className="flex-grow space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="text-[15px] font-medium text-gray-900">
              {item.name}
            </h3>
            <div className="bg-[#668E73] px-2 py-1 rounded text-white text-[13px] font-medium">
              {item.price}€
            </div>
          </div>
          <p className="text-[13px] text-gray-600 line-clamp-2">
            {item.description}
          </p>
          <QuantitySelector
            item={item}
            selectedExtras={selectedExtras}
            handleExtraChange={handleExtraChange}
          />
        </div>
      </div>
    );
  }
};

// QuantitySelector component remains the same
const QuantitySelector = ({ item, selectedExtras, handleExtraChange }) => {
  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const newQuantity = (selectedExtras[item.id] || 0) - 1;
            handleExtraChange(item.id, newQuantity);
          }}
          disabled={(selectedExtras[item.id] || 0) === 0}
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
          className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-opacity-90 transition-colors"
        >
          +
        </button>
      </div>

      {item.extraPersonPrice && (selectedExtras[item.id] || 0) > 0 && (
        <div className="mt-2">
          <p className="text-[14px] text-gray-600 mb-1">
            Personne supplémentaire (+{item.extraPersonPrice}€/pers)
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
              disabled={(selectedExtras[`${item.id}-extra`] || 0) === 0}
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
              className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-opacity-90 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  );
};