import React from "react";
import { extraCategoriesRaw } from "../../../extraCategoriesData";

const getExtraDefinitionByI18nKey = (i18nKeyToFind) => {
  if (!i18nKeyToFind || !extraCategoriesRaw) return null;
  for (const categoryKey in extraCategoriesRaw) {
    const category = extraCategoriesRaw[categoryKey];
    // Check category title itself if applicable
    // if (category.nameKey === i18nKeyToFind) { /* return { nameKey: category.nameKey, defaultFrenchName: "..."} */ }

    if (category.items && Array.isArray(category.items)) {
      const item = category.items.find((it) => it.name === i18nKeyToFind); // 'name' in extraCategoriesRaw items is the i18n key
      if (item) return item;
    }
  }
  // Add more lookups if keys can come from other places (e.g., a flat list of drink names not in categories)
  return null;
};

const FreeDrinksDetailsSection = ({ booking }) => {
  const hasFreeDrinks =
    booking?.processedFreeDrinks && booking.processedFreeDrinks.length > 0;
  const needsNonAlcoholicChoice =
    booking?.freeDrinkInfo?.needsNonAlcoholicChoice;

  // booking.freeDrinkInfo.nonAlcoholicChoiceGrantors contains i18n keys
  const nonAlcoholicChoiceGrantorKeys =
    booking?.freeDrinkInfo?.nonAlcoholicChoiceGrantors || [];

  if (!hasFreeDrinks && !needsNonAlcoholicChoice) {
    return null;
  }

  return (
    <div className="p-4 bg-white border rounded-md shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-green-700">
        Boissons Incluses{" "}
        {/* Or use an i18n key if this title needs to change */}
      </h2>

      {hasFreeDrinks ? (
        <ul className="space-y-1 text-xs text-green-600 list-disc list-inside">
          {booking.processedFreeDrinks.map((drink, index) => (
            <li key={drink.id || `free-drink-${index}`}>
              {drink.name} (Quantité: {drink.quantity}){" "}
              {/* drink.name is already French */}
            </li>
          ))}
        </ul>
      ) : (
        !needsNonAlcoholicChoice && ( // Only show this if there's also no non-alcoholic choice pending
          <p className="text-xs text-gray-500">
            Aucune boisson offerte spécifiée pour cette réservation.
          </p>
        )
      )}

      {needsNonAlcoholicChoice && (
        <div className="p-2 mt-3 text-xs text-orange-800 bg-orange-100 border border-orange-200 rounded-md">
          <p className="font-semibold">
            Choix de boisson non-alcoolisée en attente pour :
          </p>
          {nonAlcoholicChoiceGrantorKeys.length > 0 ? (
            <ul className="ml-4 list-disc">
              {nonAlcoholicChoiceGrantorKeys.map((grantorKey, idx) => {
                // Translate the grantorKey to French
                let translatedGrantorName = grantorKey; // Fallback to the key itself

                // Attempt translation using extraCategoriesRaw
                const definition = getExtraDefinitionByI18nKey(grantorKey);
                if (definition && definition.defaultFrenchName) {
                  translatedGrantorName = definition.defaultFrenchName;
                } else if (definition && definition.defaultName) {
                  // Fallback to default English name if French not found
                  translatedGrantorName = definition.defaultName;
                }
                // else: if you had extrasFrenchNames directly:
                // if (extrasFrenchNames && extrasFrenchNames[grantorKey]) {
                //   translatedGrantorName = extrasFrenchNames[grantorKey];
                // }

                return (
                  <li key={`na-grantor-${idx}`}>{translatedGrantorName}</li>
                );
              })}
            </ul>
          ) : (
            <p>Une ou plusieurs offres.</p>
          )}
          <p className="mt-1">
            Veuillez vérifier les communications avec le client.
          </p>
        </div>
      )}
    </div>
  );
};

export default FreeDrinksDetailsSection;