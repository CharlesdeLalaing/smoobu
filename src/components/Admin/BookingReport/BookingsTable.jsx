// File: src/components/BookingsReport/BookingsTable.js
import React, { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Info } from "lucide-react"; // Added AlertCircle for column header
import BookingDetails from "./BookingsDetails";
import { isValid } from "date-fns";
import { formatDate, formatPrice, getPortalName } from "../../utils/formatters";
import { calculateBookingTotal } from "./BookingsDetails";

// Helper function to determine if a non-alcoholic choice is needed
const needsNonAlcoholicDrinkChoice = (booking) => {
  return booking?.freeDrinkInfo?.needsNonAlcoholicChoice === true;
};

// Component for the drink choice indicator
const DrinkChoiceIndicator = ({ booking }) => {
  if (needsNonAlcoholicDrinkChoice(booking)) {
    return (
      <div className="flex items-center justify-center">
        {" "}
        {/* Center the icon */}
        <span
          className="flex items-center justify-center w-5 h-5 text-red-600 bg-red-100 rounded-full cursor-help"
          title="Choix de boisson non-alcoolisée requis"
        >
          <Info size={12} />
          <span className="sr-only">
            (Action requise: choix de boisson non-alcoolisée)
          </span>
        </span>
      </div>
    );
  }
  return <span className="text-gray-400">-</span>; // Or return null if you prefer empty space
};

const BookingsTable = ({
  data,
  sortField,
  sortDirection,
  onSort,
  onSortDirectionChange,
}) => {
  const [expandedBooking, setExpandedBooking] = useState(null);

  const handleSort = (field) => {
    if (sortField === field) {
      onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc");
    } else {
      onSort(field);
      onSortDirectionChange("desc");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-4 py-3"></th>{" "}
              {/* For expand/collapse icon */}
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                onClick={() => handleSort("id")}
              >
                ID de réservation{" "}
                {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("guest")}
              >
                Nom du client{" "}
                {sortField === "guest" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              {/* NEW COLUMN HEADER for Drink Choice */}
              <th
                className="px-4 py-3 text-xs font-semibold text-center text-gray-600 cursor-pointer" // Centered
                onClick={() => handleSort("drinkChoicePending")} // Add sorting if needed later
                title="Choix de boisson en attente"
              >
                <div className="flex items-center justify-center">
                  {" "}
                  {/* Center icon */}
                  Choix boissonns
                </div>
                {/* Optional: Add sort indicator if you implement sorting for this */}
                {/* {sortField === "drinkChoicePending" && (sortDirection === "asc" ? "↑" : "↓")} */}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("checkIn")}
              >
                Date d'arrivée{" "}
                {sortField === "checkIn" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("arrivalTime")}
              >
                Heure de check-in{" "}
                {sortField === "arrivalTime" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("checkOut")}
              >
                Date de départ{" "}
                {sortField === "checkOut" &&
                  (sortDirection === "asc" ? "↓" : "↑")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("property")}
              >
                Nom du logement{" "}
                {sortField === "property" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("nights")}
              >
                Nombre de nuits{" "}
                {sortField === "nights" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("portal")}
              >
                Portail de réservation{" "}
                {sortField === "portal" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("spaDateTime")}
              >
                SPA{" "}
                {sortField === "spaDateTime" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("price")}
              >
                Prix total{" "}
                {sortField === "price" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((booking, index) => (
                <React.Fragment key={`booking-frag-${booking.id}-${index}`}>
                  <tr
                    key={`row-${booking.id}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setExpandedBooking(
                            expandedBooking === booking.id ? null : booking.id
                          )
                        }
                        className="p-1 rounded hover:bg-gray-100"
                        aria-label={
                          expandedBooking === booking.id
                            ? "Collapse details"
                            : "Expand details"
                        }
                      >
                        {expandedBooking === booking.id ? (
                          <ChevronUp key={`up-icon-${booking.id}`} size={16} />
                        ) : (
                          <ChevronDown
                            key={`down-icon-${booking.id}`}
                            size={16}
                          />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 md:px-6">
                      {booking.id}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {booking.guest}
                    </td>
                    {/* NEW TABLE DATA CELL for Drink Choice Indicator */}
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      <DrinkChoiceIndicator booking={booking} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {formatDate(booking.checkIn)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {booking.arrivalTime || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {formatDate(booking.checkOut)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {booking.property}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {booking.nights}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {getPortalName(booking.portal)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {formatSpaInfo(booking)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6">
                      {calculateTotalPrice(booking)}
                    </td>
                  </tr>
                  {expandedBooking === booking.id && (
                    <tr key={`expanded-row-${booking.id}-${index}`}>
                      {/* Adjusted colSpan to account for the new column */}
                      <td colSpan="12" className="p-0">
                        {booking && <BookingDetails booking={booking} />}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                {/* Adjusted colSpan to account for the new column */}
                <td
                  colSpan="12"
                  className="px-4 py-3 text-sm text-center text-gray-500 md:px-6"
                >
                  Aucune réservation trouvée pour cette période
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const formatSpaInfo = (booking) => {
  if (!booking) {
    return "-";
  }

  if (booking.spaBookingPreference === "later") {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
        À programmer
      </span>
    );
  }

  if (booking.spaDateTimeObj && isValid(booking.spaDateTimeObj)) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
        {booking.spaDateTimeObj.toLocaleString("fr-BE", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </span>
    );
  } else if (
    booking.spaBookingPreference === "scheduled" &&
    (!booking.spaDateTimeObj || !isValid(booking.spaDateTimeObj))
  ) {
    console.warn(
      `formatSpaInfo: spaDateTimeObj is invalid or missing for a "scheduled" booking. ID: ${
        booking.id || "N/A"
      }`,
      booking.spaDateTimeObj
    );
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">
        Date SPA Invalide
      </span>
    );
  }

  return "-";
};

const calculateTotalPrice = (booking) => {
  if (!booking) return formatPrice(0);
  const total = calculateBookingTotal(booking);
  return formatPrice(total);
};

export default BookingsTable;
