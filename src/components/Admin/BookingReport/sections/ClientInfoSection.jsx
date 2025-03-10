import React from "react";

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

export default ClientInfoSection;