// File: src/components/BookingsReport/BookingsTable.js
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import BookingDetails from "./BookingsDetails";
import { formatDate, formatPrice, getPortalName } from "../../utils/formatters";

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
                      {calculateTotalPrice(booking)}
                    </td>
                  </tr>
                  {expandedBooking === booking.id && (
                    <tr key={`expanded-${booking.id}`}>
                      <td colSpan="10" className="p-0">
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
                  colSpan="10"
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

// Helper function to calculate the total price
// Helper function to calculate the total price
const calculateTotalPrice = (booking) => {
  // 1. Use stored price if available (from fetch and sync)
  if (booking.price && !isNaN(parseFloat(booking.price))) {
    return formatPrice(parseFloat(booking.price));
  }
  
  // 2. Use totalPriceWithExtras as a fallback
  if (booking.totalPriceWithExtras && !isNaN(parseFloat(booking.totalPriceWithExtras))) {
    return formatPrice(parseFloat(booking.totalPriceWithExtras));
  }
  
  // 3. Calculate from components as a last resort
  // Base room price
  const basePrice = parseFloat(booking.basePrice || booking.priceDetails?.basePrice || 0);
  
  // Add linen fee
  const linenFee = parseFloat(booking.linenFee || booking.priceDetails?.linenFee || 0);
  
  // Subtract discounts (ensure they're treated as positive values)
  const longStayDiscount = Math.abs(parseFloat(booking.priceDetails?.longStayDiscount || 0));
  const couponDiscount = Math.abs(parseFloat(booking.priceDetails?.couponDiscount || 
                               booking.priceDetails?.promoCode?.amount || 0));
  
  // Calculate room total
  const roomTotal = basePrice + linenFee - longStayDiscount - couponDiscount;
  
  // Get extras total (directly from the precomputed value)
  const extrasTotal = parseFloat(booking.priceDetails?.extrasTotal || 0);
  
  // Calculate final price
  const finalPrice = roomTotal + extrasTotal;
  
  return formatPrice(finalPrice);
};

export default BookingsTable;
