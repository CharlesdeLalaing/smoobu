// File: src/components/BookingsReport/BookingsTable.js
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import BookingDetails from "./BookingsDetails";
import {isValid} from "date-fns";
import { formatDate, formatPrice, getPortalName } from "../../utils/formatters";
import { calculateBookingTotal } from "./BookingsDetails";

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
              <th className="w-8 px-4 py-3"></th>
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
              <th
                className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                onClick={() => handleSort("checkIn")}
              >
                Date d&apos;arrivée{" "}
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
                <React.Fragment key={`booking-${booking.id}-${index}`}>
                  <tr key={`row-${booking.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setExpandedBooking(
                            expandedBooking === booking.id ? null : booking.id
                          )
                        }
                        className="p-1 rounded hover:bg-gray-100"
                      >
                        {expandedBooking === booking.id ? (
                          <ChevronUp key={`up-${booking.id}`} size={16} />
                        ) : (
                          <ChevronDown key={`down-${booking.id}`} size={16} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900">
                      {booking.id}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {booking.guest}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(booking.checkIn)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {booking.arrivalTime || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(booking.checkOut)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {booking.property}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {booking.nights}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {getPortalName(booking.portal)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatSpaInfo(booking)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {calculateTotalPrice(booking)}
                    </td>
                  </tr>
                  {expandedBooking === booking.id && (
                    <tr key={`expanded-${booking.id}`}>
                      <td colSpan="11" className="p-0">
                        {/* Make sure booking is defined before passing it to BookingDetails */}
                        {booking && <BookingDetails booking={booking} />}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td
                  colSpan="11"
                  className="px-4 py-3 text-sm text-center text-gray-500"
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
    return "-"; // Handle case where booking object itself might be undefined or null
  }

  if (booking.spaBookingPreference === "later") {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
        À programmer
      </span>
    );
  }

  // booking.spaDateTimeObj should be a JavaScript Date object (or null)
  // after being processed by useBookingsForMonth
  if (booking.spaDateTimeObj && isValid(booking.spaDateTimeObj)) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
        {booking.spaDateTimeObj.toLocaleString("fr-BE", {
          // Using fr-BE as in your original code
          dateStyle: "short", // e.g., 05/09/2025
          timeStyle: "short", // e.g., 19:00
        })}
      </span>
    );
  } else if (booking.spaBookingPreference === "scheduled") {
    // This case means it's marked as 'scheduled' but the spaDateTimeObj is either
    // missing, null, or an invalid Date object.
    console.warn(
      `formatSpaInfo: spaDateTimeObj is invalid or missing for a "scheduled" booking. ID: ${
        booking.id || "N/A"
      }`,
      booking.spaDateTimeObj // Log the problematic value
    );
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">
        Date SPA Invalide
      </span>
    );
  }

  // Default return if no specific SPA status applies (e.g., preference is 'none' or data is incomplete)
  return "-";
};

const calculateTotalPrice = (booking) => {
  // Use the exact same calculation function as in BookingDetails
  const total = calculateBookingTotal(booking);
  return formatPrice(total);
};

export default BookingsTable;
