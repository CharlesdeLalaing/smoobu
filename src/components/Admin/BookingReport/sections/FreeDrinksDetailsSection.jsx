import React from "react";

const FreeDrinksDetailsSection = ({ booking }) => {
  // Check if there's free drink information to display
  const hasFreeDrinks =
    booking?.processedFreeDrinks && booking.processedFreeDrinks.length > 0;
  const needsNonAlcoholicChoice =
    booking?.freeDrinkInfo?.needsNonAlcoholicChoice;
  const nonAlcoholicChoiceGrantors =
    booking?.freeDrinkInfo?.nonAlcoholicChoiceGrantors || [];

  if (!hasFreeDrinks && !needsNonAlcoholicChoice) {
    // Optionally, you can render nothing or a "No free drinks" message
    // For this example, we'll render nothing if there's absolutely no free drink info.
    // If you always want the section header, you'd adjust this.
    return null;
  }

  return (
    <div className="p-4 bg-white border rounded-md shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-green-700">
        Boissons Incluses
      </h2>

      {hasFreeDrinks ? (
        <ul className="space-y-1 text-xs text-green-600 list-disc list-inside">
          {booking.processedFreeDrinks.map((drink, index) => (
            <li key={drink.id || `free-drink-${index}`}>
              {drink.name} (Quantité: {drink.quantity})
              {/* You can add more details from drink object if needed, e.g., drink.paidExtraGrantor */}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">
          Aucune boisson offerte spécifiée pour cette réservation.
        </p>
      )}

      {needsNonAlcoholicChoice && (
        <div className="p-2 mt-3 text-xs text-orange-800 bg-orange-100 border border-orange-200 rounded-md">
          <p className="font-semibold">
            Choix de boisson non-alcoolisée en attente pour :
          </p>
          {nonAlcoholicChoiceGrantors.length > 0 ? (
            <ul className="ml-4 list-disc">
              {nonAlcoholicChoiceGrantors.map((grantor, idx) => (
                <li key={`na-grantor-${idx}`}>{grantor}</li>
              ))}
            </ul>
          ) : (
            <p>Une ou plusieurs offres.</p> // Fallback if grantors array is empty but flag is true
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
