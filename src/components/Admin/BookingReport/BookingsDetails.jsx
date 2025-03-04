// File: src/components/BookingsReport/BookingDetails.js
import React from "react";
import { formatDate, formatPrice, getPortalName } from "../../utils/formatters";

const BookingDetails = ({ booking }) => {
  // Guard clause to handle undefined booking
  if (!booking) {
    return (
      <div className="p-4 bg-gray-50">
        <div className="text-center text-gray-500">
          Détails de réservation non disponibles
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50">
      <div className="w-[95%] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Column 1: Information Client */}
        <ClientInfoSection booking={booking} />

        {/* Column 2: Booking Information */}
        <BookingInfoSection booking={booking} />

        {/* Column 3: Price Details */}
        <PriceDetailsSection booking={booking} />

        {/* Column 4: Extras Details */}
        <ExtrasDetailsSection booking={booking} />
      </div>
    </div>
  );
};

const ClientInfoSection = ({ booking }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-gray-900">Information Client</h3>
    <div className="space-y-2">
      <div className="text-sm">
        <span className="block font-medium">Nom:</span>
        <span className="break-words">{booking.guest}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Mail:</span>
        <span className="break-words">{booking.email}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Téléphone:</span>
        <span className="break-words">{booking.phone}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Adresse:</span>
        <span className="break-words">{booking.address}</span>
      </div>
    </div>
  </div>
);

const BookingInfoSection = ({ booking }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-gray-900">
      Information Réservation
    </h3>
    <div className="space-y-2">
      <div className="text-sm">
        <span className="block font-medium">Logement:</span>
        <span className="break-words">{booking.property}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Adultes:</span>
        {booking.adults}
      </div>
      <div className="text-sm">
        <span className="block font-medium">Enfants:</span>
        {booking.children}
      </div>
      <div className="text-sm">
        <span className="block font-medium">Création:</span>
        {formatDate(booking.created)}
      </div>
      <div className="text-sm">
        <span className="block font-medium">Portail:</span>
        {getPortalName(booking.portal)}
      </div>
    </div>
  </div>
);

const PriceDetailsSection = ({ booking }) => {
  // Get base price directly from booking data
  const basePrice = booking.priceDetails?.basePrice || 0;

  // Get linen fee
  const linenFee = booking.priceDetails?.linenFee || 0;

  // Get long stay discount
  const longStayDiscount = booking.priceDetails?.longStayDiscount || 0;

  // Get coupon discount
  const couponDiscount = booking.priceDetails?.promoCode?.amount || 0;

  // Get commission
  const commission = booking.priceDetails?.commission || 0;

  // Calculate total room price correctly
  const totalRoomPrice =
    basePrice + linenFee - longStayDiscount - couponDiscount;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Détails de Prix</h3>
      <div className="space-y-2">
        {/* Base Price */}
        <p className="text-sm">
          <span className="block font-medium">Prix de base:</span>
          {formatPrice(basePrice)}
        </p>

        {/* Linen Fee (if applicable) */}
        {linenFee > 0 && (
          <p className="text-sm">
            <span className="block font-medium">Frais de linge:</span>
            {formatPrice(linenFee)}
          </p>
        )}

        {/* Long Stay Discount (if applicable) */}
        {longStayDiscount > 0 && (
          <p className="text-sm text-red-600">
            <span className="block font-medium">Réduction long séjour:</span>
            {formatPrice(-longStayDiscount)}
          </p>
        )}

        {/* Coupon Discount (if applicable) */}
        {booking.priceDetails?.promoCode && couponDiscount > 0 && (
          <p className="text-sm text-green-600">
            <span className="block font-medium">
              {booking.priceDetails.promoCode.name}:
            </span>
            {formatPrice(-couponDiscount)}
          </p>
        )}

        {/* Total Room Price */}
        <div className="pt-2 mt-4 border-t border-gray-200">
          <span className="block text-sm font-medium">Total chambre:</span>
          <span className="text-sm">{formatPrice(totalRoomPrice)}</span>
        </div>

        {/* Commission (Displayed but NOT added to total) */}
        {commission > 0 && (
          <p className="text-sm text-gray-600">
            <span className="block font-medium">Commission:</span>
            {formatPrice(commission)}
          </p>
        )}
      </div>
    </div>
  );
};

const ExtrasDetailsSection = ({ booking }) => {
  // Get guest fees (extra guests charge)
  const extraGuestFees = booking.guestFees || booking._debug?.guestFees || 0;

  // Calculate extra guests count for display
  const extraGuestsCount = Math.max(
    0,
    parseInt(booking.adults) +
      parseInt(booking.children) -
      (booking.priceDetails?.settings?.startingAtGuest || 2)
  );

  // Check if we have any extras to display
  const hasExtras =
    (booking.extras && booking.extras.length > 0) || extraGuestFees > 0;

  // Calculate extras total including extra person amounts
  const extrasTotal =
    booking.extras?.reduce((sum, extra) => {
      const baseAmount = parseFloat(extra.amount || 0);
      const extraPersonAmount =
        extra.extraPersonQuantity > 0
          ? parseFloat(extra.extraPersonAmount) ||
            parseFloat(extra.extraPersonPrice) *
              parseInt(extra.extraPersonQuantity)
          : 0;
      return sum + baseAmount + extraPersonAmount;
    }, 0) || 0;

  // Add guest fees
  const totalWithFees = extrasTotal + (extraGuestFees || 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Détails Extras</h3>
      <div className="space-y-2">
        {hasExtras ? (
          <div className="text-sm">
            <span className="block mb-2 font-medium">Extras sélectionnés:</span>
            <ul className="space-y-2">
              {/* Show extra guest fees as the first item if applicable */}
              {extraGuestFees > 0 && (
                <li className="break-words">
                  • Frais supplémentaires ({extraGuestsCount} personne
                  {extraGuestsCount > 1 ? "s" : ""}):{" "}
                  {formatPrice(extraGuestFees)}
                </li>
              )}

              {/* Then show regular extras */}
              {booking.extras?.map((extra, index) => {
                // Access hasExtraPerson directly from the extra object
                const hasExtraPerson =
                  extra.hasExtraPerson ||
                  extra.extraPersonQuantity > 0 ||
                  extra.extraPersonPrice > 0 ||
                  extra.extraPersonAmount > 0;

                return (
                  <li
                    key={`${booking.id}-extra-${index}`}
                    className="break-words"
                  >
                    • {extra.name}{" "}
                    {extra.quantity > 1 && `(${extra.quantity}x)`}:{" "}
                    {formatPrice(extra.amount)}
                    {/* Always try to show extra person details if they might exist */}
                    {hasExtraPerson && (
                      <span className="ml-1 text-indigo-700">
                        <br />
                        <span className="ml-4">
                          ({extra.extraPersonName || "Personne supplémentaire"}
                          {parseInt(extra.extraPersonQuantity) > 1
                            ? ` (x${extra.extraPersonQuantity})`
                            : ""}{" "}
                          :{" "}
                          {formatPrice(
                            extra.extraPersonAmount ||
                              extra.extraPersonPrice * extra.extraPersonQuantity
                          )}
                          )
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="pt-2 mt-4 border-t border-gray-200">
              <span className="font-medium">Total Extras:</span>
              <span className="block">{formatPrice(totalWithFees)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucun extra sélectionné</p>
        )}
      </div>
    </div>
  );
};

export default BookingDetails;
