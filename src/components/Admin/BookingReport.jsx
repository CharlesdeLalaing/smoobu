import React, { useState, useEffect } from "react";
import { Calendar, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL = import.meta.env.VITE_API_URL || "https://booking-9u8u.onrender.com";

const BookingsReport = () => {
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("checkIn");
  const [sortDirection, setSortDirection] = useState("desc");
  const [expandedBooking, setExpandedBooking] = useState(null);

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString("fr", { month: "long" }),
  }));

  useEffect(() => {
    if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
      setEndYear(startYear);
      setEndMonth(startMonth);
    }
  }, [startYear, startMonth, endYear, endMonth]);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const startMonthStr = String(startMonth).padStart(2, "0");
        const endMonthStr = String(endMonth).padStart(2, "0");

        const response = await axios.get(`${API_URL}/api/bookings-report`, {
          params: {
            startMonth: startMonthStr,
            startYear: startYear,
            endMonth: endMonthStr,
            endYear: endYear,
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
  }, [startMonth, startYear, endMonth, endYear]);

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
        "Portal",
        "Créé le",
        "Email",
        "Téléphone",
        "Adresse",
        "Adultes",
        "Enfants",
        "Arrivée",
        "Départ",
        "Notes",
        "Prix",
        "Commission",
        "Payé",
        "Acompte",
        "Acompte payé",
        "Nuits",
        "Statut",
        "Extras"
      ],
      ...filteredAndSortedData.map((booking) => [
        booking.id,
        booking.guest,
        booking.portal,
        formatDate(booking.created),
        booking.email,
        booking.phone,
        booking.address,
        booking.adults,
        booking.children,
        formatDate(booking.checkIn),
        formatDate(booking.checkOut),
        booking.notes,
        booking.price,
        booking.commission,
        // booking.paid ? "Oui" : "Non",
        // booking.prepayment,
        // booking.prepaymentPaid ? "Oui" : "Non",
        booking.nights,
        booking.status,
        booking.extras.map(e => `${e.name} (${e.quantity}x)`).join(", ")
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [
      { wch: 10 }, // ID
      { wch: 25 }, // Client
      { wch: 15 }, // Portal
      { wch: 15 }, // Created
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 30 }, // Address
      { wch: 10 }, // Adults
      { wch: 10 }, // Children
      { wch: 12 }, // Check-in
      { wch: 12 }, // Check-out
      { wch: 30 }, // Notes
      { wch: 12 }, // Price
      { wch: 12 }, // Commission
      { wch: 8 },  // Paid
      { wch: 12 }, // Prepayment
      { wch: 15 }, // Prepayment paid
      { wch: 8 },  // Nights
      { wch: 12 }, // Status
      { wch: 50 }  // Extras
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Rapport Réservations");

    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}`;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}`;
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
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#678D73]" />
          <h1 className="text-xl font-bold md:text-2xl">Rapport des Réservations</h1>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#4a6553] transition-colors"
          disabled={filteredAndSortedData.length === 0}
        >
          <Download size={20} />
          Exporter
        </button>
      </div>

      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
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

          <div className="flex-1 min-w-[150px]">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startMonth}
              onChange={(e) => setStartMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={endMonth}
              onChange={(e) => setEndMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-red-700 border border-red-200 rounded bg-red-50">
          {error}
        </div>
      )}

      <div className="overflow-hidden bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th onClick={() => handleSort("id")} 
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  ID {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("guest")} 
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Client {sortField === "guest" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("portal")} 
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Portal {sortField === "portal" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("property")}
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Hébergement {sortField === "property" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("checkIn")}
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Arrivée {sortField === "checkIn" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("arrivalTime")}  // Add this column
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Heure {sortField === "arrivalTime" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("checkOut")}
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Départ {sortField === "checkOut" && (sortDirection === "asc" ? "↓" : "↑")}
                </th>
                <th onClick={() => handleSort("nights")}
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Nuits {sortField === "nights" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("price")}
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer">
                  Prix {sortField === "price" && (sortDirection === "asc" ? "↑" : "↓")}
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
                        {booking.portal} 
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {booking.property}
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
                        {booking.nights}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatPrice(booking.price)}
                      </td>
                    </tr>
                      {expandedBooking === booking.id && (
                        <tr>
                          <td colSpan="9" className="px-4 py-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h3 className="font-semibold mb-2">Informations client</h3>
                                <p className="text-sm">Hébergement: {booking.property}</p>
                                <p className="text-sm">Email: {booking.email}</p>
                                <p className="text-sm">Téléphone: {booking.phone}</p>
                                <p className="text-sm">Adresse: {booking.address}</p>
                                <p className="text-sm">Adultes: {booking.adults}</p>
                                <p className="text-sm">Enfants: {booking.children}</p>
                                <p className="text-sm">Portal: {booking.portal}</p>
                                <p className="text-sm">Créé le: {formatDate(booking.created)}</p>
                                {booking.notes && (
                                  <p className="text-sm mt-2">Notes: {booking.notes}</p>
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold mb-2">Détails de paiement</h3>
                                <p className="text-sm">Prix de base: {formatPrice(booking.priceDetails.basePrice)}</p>
                                {booking.priceDetails.extrasTotal > 0 && (
                                  <p className="text-sm">Extras: {formatPrice(booking.priceDetails.extrasTotal)}</p>
                                )}
                                {booking.priceDetails.promoCode && (
                                  <p className="text-sm text-green-600">
                                    {booking.priceDetails.promoCode.name}: 
                                    {formatPrice(-booking.priceDetails.promoCode.amount)}
                                  </p>
                                )}
                                {booking.priceDetails.discounts > 0 && (
                                  <p className="text-sm text-green-600">
                                    Réductions: -{formatPrice(booking.priceDetails.discounts)}
                                  </p>
                                )}
                                <p className="text-sm font-semibold mt-1">
                                  Total: {formatPrice(booking.price)}
                                </p>
                                {booking.commission > 0 && (
                                  <p className="text-sm text-gray-600 mt-2">
                                    Commission: {formatPrice(booking.commission)}
                                  </p>
                                )}
                              </div>
                              {booking.extras.length > 0 && (
                                <div className="md:col-span-2">
                                  <h3 className="font-semibold mb-2">Extras</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {booking.extras.map((extra, index) => (
                                      <div key={index} className="bg-white p-3 rounded-lg shadow-sm">
                                        <p className="text-sm font-medium">{extra.name}</p>
                                        <p className="text-sm text-gray-500">
                                          Quantité: {extra.quantity} • Prix: {formatPrice(extra.amount)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-4 py-3 text-sm text-center text-gray-500">
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