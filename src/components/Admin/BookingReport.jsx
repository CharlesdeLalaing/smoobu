import React, { useState, useEffect } from "react";
import { Calendar, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL = import.meta.env.VITE_API_URL || "https://booking-9u8u.onrender.com";

const portalNames = {
  'Homepage': 'Website',
  'Direct booking': 'Direct booking',
  'Homepage direct': 'Website',
  'Direct': 'Direct booking',
  'Airbnb': 'Airbnb',
  'airbnb': 'Airbnb',
  'Booking.com': 'Booking.com',
  'booking.com': 'Booking.com',
  'Expedia': 'Expedia',
  'blocked': 'Blocked',
  'Blocked': 'Blocked',
  'Partenariat': 'Partenariat',
  'partenariat': 'Partenariat'
};

const BookingsReport = () => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("checkIn");
  const [sortDirection, setSortDirection] = useState("desc");
  const [expandedBooking, setExpandedBooking] = useState(null);

  const getPortalName = (portal) => {
    return portalNames[portal] || portal || 'Unknown';
  };

  useEffect(() => {
    if (new Date(endDate) < new Date(startDate)) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`${API_URL}/api/bookings-report`, {
          params: {
            startDate,
            endDate
          },
        });

        if (response.data) {
          setReportData(response.data.data || []);
        } else {
          throw new Error("Réponse vide du serveur");
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message);
        setReportData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [startDate, endDate]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("fr-FR");
  };

  const formatPrice = (price) => {
    return `€${Number(price).toFixed(2)}`;
  };

  const handleExport = () => {
    const wsData = [
      [
        "ID",
        "Client",
        "Création",
        "Portail",
        "Email",
        "Téléphone",
        "Adresse",
        "Adulte",
        "Enfant",
        "Arrivée",
        "Check-in",
        "Départ",
        "Nombre de nuits",
        "Prix de base",
        "Nom coupon",
        "Valeur coupon",
        "Frais de linge",
        "Promotion long séjour",
        "Commission",
        "Liste des extras",
        "Total des extras",
        "Prix total"
      ],
      ...filteredAndSortedData.map((booking) => [
        booking.id,
        booking.guest,
        formatDate(booking.created),
        booking.portal,
        booking.email || '',
        booking.phone || '',
        booking.address || '',
        booking.adults,
        booking.children,
        formatDate(booking.checkIn),
        booking.arrivalTime || '',
        formatDate(booking.checkOut),
        booking.nights,
        booking.priceDetails.basePrice,
        booking.priceDetails.promoCode?.name || '',
        booking.priceDetails.promoCode?.amount || '',
        booking.priceDetails.linenFee || '',
        booking.priceDetails.longStayDiscount || '',
        booking.commission || '',
        booking.extras.map(e => `${e.name} (${e.quantity}x)`).join(", "),
        booking.extras.reduce((sum, extra) => sum + extra.amount, 0),
        booking.price
      ]),
    ];
  
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
  
    const colWidths = [
      { wch: 15 }, // ID de réservation
      { wch: 25 }, // Client
      { wch: 20 }, // Création de la réservation
      { wch: 20 }, // Portail de réservation
      { wch: 30 }, // Email du client
      { wch: 20 }, // Téléphone du client
      { wch: 35 }, // Adresse du client
      { wch: 15 }, // Nombre d'adulte
      { wch: 15 }, // Nombre d'enfant
      { wch: 15 }, // Arrivée
      { wch: 15 }, // Check-in
      { wch: 15 }, // Départ
      { wch: 15 }, // Nombre de nuits
      { wch: 15 }, // Prix de base
      { wch: 20 }, // Nom du coupon
      { wch: 15 }, // Valeur du coupon
      { wch: 15 }, // Frais de linge
      { wch: 20 }, // Promotion de long séjour
      { wch: 15 }, // Commission
      { wch: 50 }, // Liste des extras
      { wch: 15 }, // Total des extras
      { wch: 15 }  // Prix total de la chambre
    ];
    
    ws["!cols"] = colWidths;
  
    XLSX.utils.book_append_sheet(wb, ws, "Rapport Réservations");
  
    const fileName = `rapport-reservations_${startDate}_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filteredAndSortedData = reportData
    .filter((booking) =>
      Object.values(booking).some(
        (value) =>
          value &&
          value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (["checkIn", "checkOut", "created"].includes(sortField)) {
        return multiplier * (new Date(a[sortField]) - new Date(b[sortField]));
      }
      return multiplier * (String(a[sortField]).localeCompare(String(b[sortField])));
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Chargement...
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl p-3 mx-auto md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#678D73]" />
          <h1 className="text-xl font-bold md:text-2xl">Rapport des Réservations Smoobu</h1>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#4a6553] transition-colors w-full sm:w-auto"
          disabled={filteredAndSortedData.length === 0}
        >
          <Download size={20} />
          Exporter
        </button>
      </div>

      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-red-700 border border-red-200 rounded bg-red-50">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                    onClick={() => handleSort("id")}>
                  ID de réservation {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("guest")}>
                  Nom du client {sortField === "guest" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("checkIn")}>
                  Date d'arrivée {sortField === "checkIn" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("arrivalTime")}>
                  Heure de check-in {sortField === "arrivalTime" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("checkOut")}>
                  Date de départ {sortField === "checkOut" && (sortDirection === "asc" ? "↓" : "↑")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("property")}>
                  Nom du logement {sortField === "property" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("nights")}>
                  Nombre de nuits {sortField === "nights" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("portal")}>
                  Portail de réservation {sortField === "portal" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("price")}>
                  Prix total {sortField === "price" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((booking) => (
                  <React.Fragment key={booking.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedBooking === booking.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                        {booking.arrivalTime || '-'}
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
                        {formatPrice(booking.price)}
                      </td>
                    </tr>
                    {expandedBooking === booking.id && (
                      <tr>
                        <td colSpan="10" className="p-0">
                          <div className="p-4 bg-gray-50">
                            <div className="w-[95%] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              {/* Column 1: Information Client */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">Information Client</h3>
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    <span className="font-medium block">Nom:</span>
                                    <span className="break-words">{booking.guest}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium block">Mail:</span>
                                    <span className="break-words">{booking.email}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium block">Téléphone:</span>
                                    <span className="break-words">{booking.phone}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium block">Adresse:</span>
                                    <span className="break-words">{booking.address}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Column 2: Information Reservation */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">Information Réservation</h3>
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    <span className="font-medium block">Logement:</span>
                                    <span className="break-words">{booking.property}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium block">Adultes:</span>
                                    {booking.adults}
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium block">Enfants:</span>
                                    {booking.children}
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium block">Création:</span>
                                    {formatDate(booking.created)}
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium block">Portail:</span>
                                    {getPortalName(booking.portal)}
                                  </div>
                                </div>
                              </div>

                              {/* Column 3: Détails de Prix */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">Détails de Prix</h3>
                                <div className="space-y-2">
                                  <p className="text-sm">
                                    <span className="font-medium block">Prix de base:</span>
                                    {formatPrice(booking.priceDetails.basePrice)}
                                  </p>
                                  
                                  {booking.priceDetails.linenFee > 0 && (
                                    <p className="text-sm">
                                      <span className="font-medium block">Frais de linge:</span>
                                      {formatPrice(booking.priceDetails.linenFee)}
                                    </p>
                                  )}
                                  
                                  {booking.priceDetails.longStayDiscount < 0 && (
                                    <p className="text-sm text-red-600">
                                      <span className="font-medium block">Réduction long séjour:</span>
                                      {formatPrice(booking.priceDetails.longStayDiscount)}
                                    </p>
                                  )}

                                  {booking.priceDetails.promoCode && (
                                    <p className="text-sm text-green-600">
                                      {booking.priceDetails.promoCode.name}: 
                                      {formatPrice(-booking.priceDetails.promoCode.amount)}
                                    </p>
                                  )}

                                  {booking.commission > 0 && (
                                    <p className="text-sm">
                                      <span className="font-medium block">Commission:</span>
                                      {formatPrice(booking.commission)}
                                    </p>
                                  )}
                                  
                                  <div className="mt-4 pt-2 border-t border-gray-200">
                                    <span className="font-medium block text-sm">Total chambre:</span>
                                    <span className="text-sm">
                                      {formatPrice(booking.priceDetails.basePrice + 
                                        (booking.priceDetails.linenFee || 0) + 
                                        (booking.priceDetails.longStayDiscount || 0) +
                                        (booking.priceDetails.promoCode?.amount || 0))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Column 4: Détails Extras */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">Détails Extras</h3>
                                <div className="space-y-2">
                                  {booking.extras.length > 0 && (
                                    <div className="text-sm">
                                      <span className="font-medium block mb-2">Extras sélectionnés:</span>
                                      <ul className="space-y-2">
                                        {booking.extras.map((extra, index) => {
                                          const unitPrice = extra.amount / extra.quantity;
                                          
                                          return (
                                            <li key={index} className="break-words">
                                              • {extra.name} ({extra.quantity}x)
                                              <span className="block ml-3 text-gray-600">
                                                {formatPrice(unitPrice)} / unité
                                              </span>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      <div className="mt-4 pt-2 border-t border-gray-200">
                                        <span className="font-medium">Total Extras:</span>
                                        <span className="block">
                                          {formatPrice(booking.extras.reduce((sum, extra) => sum + extra.amount, 0))}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="px-4 py-3 text-sm text-center text-gray-500">
                    Aucune réservation trouvée pour cette période
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BookingsReport;