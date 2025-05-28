import React from "react";
import { formatDate, getPortalName } from "../../../utils/formatters";

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
        {formatDate(booking.createdDateObj)}
      </div>
      <div className="text-sm">
        <span className="block font-medium">Portail:</span>
        {getPortalName(booking.portal)}
      </div>
    </div>
  </div>
);

export default BookingInfoSection;