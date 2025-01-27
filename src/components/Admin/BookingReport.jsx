import React, { useState, useEffect } from "react";
import { Calendar, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL = import.meta.env.VITE_API_URL || "https://booking-9u8u.onrender.com";
const SMOOBU_API_URL = "https://login.smoobu.com/api";

const BookingsReport = () => {
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("arrival");
  const [sortDirection, setSortDirection] = useState("desc");
  const [expandedBookings, setExpandedBookings] = useState(new Set());

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
    const fetchBookings = async () => {
      try {
        setLoading(true);
        setError(null);

        const startMonthStr = String(startMonth).padStart(2, "0");
        const endMonthStr = String(endMonth).padStart(2, "0");

        // Fetch bookings for the selected period
        const response = await axios.get(`${API_URL}/api/bookings`, {
          params: {
            startMonth: startMonthStr,
            startYear: startYear,
            endMonth: endMonthStr,
            endYear: endYear,
          },
          headers: {
            'Api-Key': process.env.SMOOBU_API_KEY
          }
        });

        if (response.data) {
          // Fetch extras for each booking
          const bookingsWithExtras = await Promise.all(
            response.data.map(async (booking) => {
              try {
                const extrasResponse = await axios.get(`${API_URL}/api/booking-extras/${booking.id}`);
                return {
                  ...booking,
                  extras: extrasResponse.data || []
                };
              } catch (error) {
                console.error(`Error fetching extras for booking ${booking.id}:`, error);
                return {
                  ...booking,
                  extras: []
                };
              }
            })
          );
          setBookings(bookingsWithExtras);
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [startMonth, startYear, endMonth, endYear]);

  const toggleBookingExpanded = (bookingId) => {
    const newExpanded = new Set(expandedBookings);
    if (newExpanded.has(bookingId)) {
      newExpanded.delete(bookingId);
    } else {
      newExpanded.add(bookingId);
    }
    setExpandedBookings(newExpanded);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("fr");
  };

  const handleExport = () => {
    const wsData = [
      [
        "ID",
        "Date d'arrivée",
        "Date de départ",
        "Nom du client",
        "Email",
        "Téléphone",
        "Adultes",
        "Enfants",
        "Appartement",
        "Prix",
        "Extras",
        "Total"
      ]
    ];

    filteredAndSortedData.forEach((booking) => {
      const extrasTotal = booking.extras.reduce((sum, extra) => sum + extra.totalAmount, 0);
      const extrasDetail = booking.extras.map(e => `${e.name}: €${e.totalAmount}`).join(", ");
      
      wsData.push([
        booking.id,
        formatDate(booking.arrival),
        formatDate(booking.departure),
        booking["guest-name"],
        booking.email,
        booking.phone,
        booking.adults,
        booking.children,
        booking.apartment.name,
        `€${booking.price}`,
        extrasDetail,
        `€${(parseFloat(booking.price) + extrasTotal).toFixed(2)}`
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 15 }, // Arrival
      { wch: 15 }, // Departure
      { wch: 30 }, // Guest name
      { wch: 30 }, // Email
      { wch: 20 }, // Phone
      { wch: 10 }, // Adults
      { wch: 10 }, // Children
      { wch: 30 }, // Apartment
      { wch: 15 }, // Price
      { wch: 50 }, // Extras
      { wch: 15 }  // Total
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Rapport Réservations");

    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}`;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}`;
    const fileName = `rapport-reservations_${startDate}_${endDate}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const filteredAndSortedData = bookings
    .filter((booking) =>
      booking["guest-name"].toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.apartment.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortField === "guest-name") {
        return multiplier * a["guest-name"].localeCompare(b["guest-name"]);
      }
      if (sortField === "price") {
        return multiplier * (parseFloat(a.price) - parseFloat(b.price));
      }
      return multiplier * new Date(a[sortField]) - new Date(b[sortField]);
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

      {/* Filters Section */}
      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher une réservation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            />
          </div>

          {/* Date filters */}
          <div className="flex flex-wrap gap-4">
            <select
              className="px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startMonth}
              onChange={(e) => setStartMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              className="px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <span className="self-center">à</span>

            <select
              className="px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={endMonth}
              onChange={(e) => setEndMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              className="px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
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

      {/* Bookings Table */}
      <div className="overflow-hidden bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th
                  onClick={() => handleSort("arrival")}
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:text-sm"
                >
                  Arrivée {sortField === "arrival" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("departure")}
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:text-sm"
                >
                  Départ {sortField === "departure" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("guest-name")}
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:text-sm"
                >
                  Client {sortField === "guest-name" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 md:text-sm">
                  Contact
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-center text-gray-600 md:text-sm">
                  Personnes
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 md:text-sm">
                  Appartement
                </th>
                <th
                  onClick={() => handleSort("price")}
                  className="px-4 py-3 text-xs font-semibold text-right text-gray-600 cursor-pointer md:text-sm"
                >
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
                          onClick={() => toggleBookingExpanded(booking.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedBookings.has(booking.id) ? (
                            <ChevronUp size={20} />
                          ) : (
                            <ChevronDown size={20} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs md:text-sm">
                        {formatDate(booking.arrival)}
                      </td>
                      <td className="px-4 py-3 text-xs md:text-sm">
                        {formatDate(booking.departure)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium md:text-sm">
                        {booking["guest-name"]}
                      </td>
                      <td className="px-4 py-3 text-xs md:text-sm">
                        <div className="flex flex-col">
                          <span>{booking.email}</span>
                          <span className="text-gray-500">{booking.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-center md:text-sm">
                        <div className="flex flex-col">
                          <span>{booking.adults} adultes</span>
                          {booking.children > 0 && (
                            <span className="text-gray-500">
                              {booking.children} enfants
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs md:text-sm">
                        {booking.apartment.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-right md:text-sm">
                        €{parseFloat(booking.price).toFixed(2)}
                      </td>
                    </tr>
                    {expandedBookings.has(booking.id) && (
                      <tr className="bg-gray-50">
                        <td colSpan="8" className="px-4 py-3">
                          <div className="ml-8">
                            <div className="mb-2 text-sm font-medium text-gray-700">
                              Détails supplémentaires :
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <p className="text-sm">
                                  <span className="font-medium">Check-in:</span>{" "}
                                  {booking["check-in"]}
                                </p>
                                <p className="text-sm">
                                  <span className="font-medium">Check-out:</span>{" "}
                                  {booking["check-out"]}
                                </p>
                                <p className="text-sm">
                                  <span className="font-medium">Réservé via:</span>{" "}
                                  {booking.channel.name}
                                </p>
                                <p className="text-sm">
                                  <span className="font-medium">Date de réservation:</span>{" "}
                                  {new Date(booking["created-at"]).toLocaleString("fr")}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm">
                                  <span className="font-medium">Paiement:</span>{" "}
                                  {booking["price-paid"] === "Yes" ? "Payé" : "Non payé"}
                                </p>
                                {booking.prepayment > 0 && (
                                  <p className="text-sm">
                                    <span className="font-medium">Acompte:</span>{" "}
                                    €{booking.prepayment} - 
                                    {booking["prepayment-paid"] === "Yes" ? " Payé" : " Non payé"}
                                  </p>
                                )}
                                {booking.deposit > 0 && (
                                  <p className="text-sm">
                                    <span className="font-medium">Caution:</span>{" "}
                                    €{booking.deposit} - 
                                    {booking["deposit-paid"] === "Yes" ? " Payée" : " Non payée"}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Extras Section */}
                            {booking.extras && booking.extras.length > 0 && (
                              <div className="mt-4">
                                <div className="mb-2 text-sm font-medium text-gray-700">
                                  Extras:
                                </div>
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left">Nom</th>
                                      <th className="px-4 py-2 text-right">Montant</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {booking.extras.map((extra, index) => (
                                      <tr key={index} className="border-t border-gray-200">
                                        <td className="px-4 py-2">{extra.name}</td>
                                        <td className="px-4 py-2 text-right">
                                          €{extra.totalAmount.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="border-t border-gray-200 font-medium">
                                      <td className="px-4 py-2">Total avec extras</td>
                                      <td className="px-4 py-2 text-right">
                                        €{(
                                          parseFloat(booking.price) +
                                          booking.extras.reduce(
                                            (sum, extra) => sum + extra.totalAmount,
                                            0
                                          )
                                        ).toFixed(2)}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                            
                            {booking.notice && (
                              <div className="mt-4">
                                <div className="mb-2 text-sm font-medium text-gray-700">
                                  Notes:
                                </div>
                                <p className="text-sm text-gray-600">{booking.notice}</p>
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