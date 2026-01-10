import { formatPrice } from "../../../utils/formatters";
import {
  getCleanExtrasFromPriceElements,
  mergeAndSortExtras,
} from "../utils/extrasUtils";

const ExtrasDetailsSection = ({ booking }) => {
  // Get portal name
  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isBookingCom = portalName === "Booking.com";

  // Only exclude "Personne supplémentaire" from priceElements when there's a DUPLICATE
  // in the extras array. A duplicate exists when the extras array has a standalone
  // "Personne supplémentaire" entry (not just embedded extraPersonAmount).
  const extrasArray = booking.extras || [];
  const hasStandalonePersonExtraInExtras = extrasArray.some(
    (extra) => extra.name && extra.name.includes("Personne supplémentaire")
  );

  // Only exclude if there's already a standalone person extra in extras array (duplicate)
  const excludePersonExtras = hasStandalonePersonExtraInExtras;

  // Process and organize extras
  let displayExtras = [];

  // If we have price elements, use those for a consistent display
  if (booking.priceDetails?.priceElements?.length > 0) {
    const priceElements = booking.priceDetails.priceElements;

    displayExtras = getCleanExtrasFromPriceElements(priceElements, portalName, { excludePersonExtras });

    // For Booking.com, remove TVA and taxe de séjour from extras
    if (isBookingCom) {
      displayExtras = displayExtras.filter(
        (extra) =>
          !extra.name.includes("TVA") &&
          !extra.name.toLowerCase().includes("taxe de séjour")
      );
    }
  }
  // Otherwise fall back to the extras array
  else if (booking.extras?.length > 0) {
    displayExtras = [...booking.extras];

    // For web app bookings, we need to expand extras that have hasExtraPerson: true
    // into separate display items for the extra person
    // BUT only if we're NOT already using priceElements (to avoid duplication)
    const expandedExtras = [];

    displayExtras.forEach((extra) => {
      // Add the main extra
      expandedExtras.push(extra);

      // If this extra has extra person data, add it as a separate item
      if (extra.hasExtraPerson && extra.extraPersonAmount > 0) {
        const extraPersonItem = {
          name: `${extra.name} - Personne supplémentaire`,
          amount: extra.extraPersonAmount,
          quantity: extra.extraPersonQuantity || 1,
          id: `${extra.id}-person`,
          type: "addon",
          currencyCode: extra.currencyCode || "EUR",
        };
        expandedExtras.push(extraPersonItem);
      }
    });

    displayExtras = expandedExtras;

    // For Booking.com, filter out TVA from extras
    if (isBookingCom) {
      displayExtras = displayExtras.filter(
        (extra) =>
          !extra.name.includes("TVA") &&
          !extra.name.toLowerCase().includes("taxe de séjour")
      );
    }
  }

  // Merge duplicate extras and sort them
  const mergedAndSortedExtras = mergeAndSortExtras(displayExtras);

  // Calculate total
  const extrasTotal = mergedAndSortedExtras.reduce(
    (sum, extra) => sum + parseFloat(extra.amount || 0),
    0
  );

  // Check if we have any extras to display
  const hasExtras = mergedAndSortedExtras.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Détails Extras</h3>
      <div className="space-y-2">
        {hasExtras ? (
          <div className="text-sm">
            <span className="block mb-2 font-medium">Extras sélectionnés:</span>
            <ul className="space-y-2">
              {mergedAndSortedExtras.map((extra, index) => {
                // Check if this is a person extra
                const isPersonExtra = extra.name.includes(
                  "Personne supplémentaire"
                );

                return (
                  <li
                    key={`extra-item-${index}`}
                    className={
                      isPersonExtra
                        ? "ml-4 text-indigo-700 break-words"
                        : "break-words"
                    }
                  >
                    • {extra.name}{" "}
                    {extra.quantity > 1 && `(${extra.quantity}x)`}:{" "}
                    {formatPrice(extra.amount)}
                  </li>
                );
              })}
            </ul>

            <div className="pt-2 mt-4 border-t border-gray-200">
              <span className="font-medium">Total Extras:</span>
              <span className="block">{formatPrice(extrasTotal)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucun extra sélectionné</p>
        )}
      </div>
    </div>
  );
};

export default ExtrasDetailsSection;
