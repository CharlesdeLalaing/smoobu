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
    <div className="w-full max-w-full p-2 mx-auto sm:p-4 lg:p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#678D73]" />
          <h1 className="text-xl font-bold md:text-2xl">Rapport des Réservations Smoobu 2</h1>
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

      {/* Filters Section */}
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

          {/* Date filters in a responsive grid */}
          <div className="sm:col-span-1">
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
          <div className="sm:col-span-1">
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
          <div className="sm:col-span-1">
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
          <div className="sm:col-span-1">
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

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 mb-6 text-red-700 border border-red-200 rounded bg-red-50">
          {error}
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                {/* Responsive column headers */}
                <th className="hidden lg:table-cell px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("id")}>
                  ID {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("guest")}>
                  Client {sortField === "guest" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("portal")}>
                  Portal {sortField === "portal" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("property")}>
                  Hébergement {sortField === "property" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("checkIn")}>
                  Arrivée {sortField === "checkIn" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="hidden xl:table-cell px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("arrivalTime")}>
                  Heure {sortField === "arrivalTime" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("checkOut")}>
                  Départ {sortField === "checkOut" && (sortDirection === "asc" ? "↓" : "↑")}
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("nights")}>
                  Nuits {sortField === "nights" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                    onClick={() => handleSort("price")}>
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
                      <td className="hidden lg:table-cell px-4 py-3 text-xs font-medium text-gray-900">
                        {booking.id}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {booking.guest}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500">
                        {booking.portal}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-gray-500">
                        {booking.property}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(booking.checkIn)}
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3 text-xs text-gray-500">
                        {booking.arrivalTime || '-'}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-gray-500">
                        {formatDate(booking.checkOut)}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500">
                        {booking.nights}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatPrice(booking.price)}
                      </td>
                    </tr>
                    {expandedBooking === booking.id && (
                      <tr>
                        <td colSpan="10" className="p-0">
                          <div className="p-4 bg-gray-50">
                            <div className="grid gap-6 sm:grid-cols-2">
                              {/* Client Information */}
                              <div className="space-y-2">
                                <h3 className="text-sm font-semibold">Informations client</h3>
                                <div className="grid gap-2 text-sm">
                                  <p>Hébergement: {booking.property}</p>
                                  <p>Email: {booking.email}</p>
                                  <p>Téléphone: {booking.phone}</p>
                                  <p>Adresse: {booking.address}</p>
                                  <p>Adultes: {booking.adults}</p>
                                  <p>Enfants: {booking.children}</p>
                                  <p>Portal: {booking.portal}</p>
                                  <p>Créé le: {formatDate(booking.created)}</p>
                                </div>
                                {booking.notes && (
                                  <div className="mt-4">
                                    <p className="font-semibold">Notes:</p>
                                    <p className="text-sm mt-1">{booking.notes}</p>
                                  </div>
                                )}
                              </div>

                              {/* Payment Details */}
                              <div className="space-y-2">
                                <h3 className="text-sm font-semibold">Détails de paiement</h3>
                                <div className="grid gap-2 text-sm">
                                  <p>Prix de base: {formatPrice(booking.priceDetails.basePrice)}</p>
                                  {booking.priceDetails.extrasTotal > 0 && (
                                    <p>Extras: {formatPrice(booking.priceDetails.extrasTotal)}</p>
                                  )}
                                  {booking.priceDetails.promoCode && (
                                    <p className="text-green-600">
                                      {booking.priceDetails.promoCode.name}:
                                      {formatPrice(-booking.priceDetails.promoCode.amount)}
                                    </p>
                                  )}
                                  {booking.priceDetails.discounts > 0 && (
                                    <p className="text-green-600">
                                      Réductions: -{formatPrice(booking.priceDetails.discounts)}
                                    </p>
                                  )}
                                  <p className="font-semibold mt-1">
                                    Total: {formatPrice(booking.price)}
                                  </p>
                                  {booking.commission > 0 && (
                                    <p className="text-gray-600 mt-2">
                                      Commission: {formatPrice(booking.commission)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Extras Section */}
                              {booking.extras.length > 0 && (
                                <div className="sm:col-span-2 space-y-4">
                                  <h3 className="text-sm font-semibold">Extras</h3>
                                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {booking.extras.map((extra, index) => (
                                      <div key={index} className="p-3 bg-white rounded-lg shadow-sm">
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