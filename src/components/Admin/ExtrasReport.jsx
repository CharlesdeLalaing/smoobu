import React, { useState, useEffect } from "react";
import { Calendar, Search, Download } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL =
  import.meta.env.VITE_API_URL || "https://booking-9u8u.onrender.com";

const ExtrasReport = () => {
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalBookings, setTotalBookings] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("bookingDate");
  const [sortDirection, setSortDirection] = useState("desc");

  const years = Array.from(
    { length: 3 },
    (_, i) => new Date().getFullYear() - i
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString("fr", { month: "long" }),
  }));

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const startMonthStr = String(startMonth).padStart(2, "0");
        const endMonthStr = String(endMonth).padStart(2, "0");

        // Fetch detailed booking data including extras
        const response = await axios.get(`${API_URL}/api/bookings`, {
          params: {
            startMonth: startMonthStr,
            startYear: startYear,
            endMonth: endMonthStr,
            endYear: endYear,
          },
        });

        if (response.data) {
          // Transform the data to include all necessary information
          const transformedData = response.data.bookings.map(booking => ({
            id: booking.id,
            referenceId: booking['reference-id'],
            bookingDate: new Date(booking['created-at']).toLocaleDateString('fr'),
            arrival: new Date(booking.arrival).toLocaleDateString('fr'),
            departure: new Date(booking.departure).toLocaleDateString('fr'),
            guestName: booking['guest-name'],
            roomName: booking.apartment.name,
            bookingPortal: booking.channel.name,
            email: booking.email,
            phone: booking.phone,
            adults: booking.adults,
            children: booking.children,
            checkInTime: booking['check-in'],
            notes: booking.notice,
            basePrice: booking.price,
            numberOfNights: Math.ceil((new Date(booking.departure) - new Date(booking.arrival)) / (1000 * 60 * 60 * 24)),
            extras: booking.extras || [],
            totalExtrasAmount: (booking.extras || []).reduce((sum, extra) => sum + extra.price, 0),
            commission: booking.commission || 0,
          }));

          setReportData(transformedData);
          setTotalBookings(transformedData.length);
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

  const handleStartYearChange = (year) => {
    const newYear = parseInt(year);
    setStartYear(newYear);
    if (endYear < newYear) {
      setEndYear(newYear);
    }
  };

  const handleEndYearChange = (year) => {
    const newYear = parseInt(year);
    if (newYear >= startYear) {
      setEndYear(newYear);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleExport = () => {
    // Helper function to format currency
    const formatCurrency = (amount) => {
      return typeof amount === 'number' ? `${amount.toFixed(2)} €` : '0.00 €';
    };

    // Helper function to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    // Create the main booking data worksheet
    const bookingData = [
      // Headers
      [
        "Informations de réservation",
        "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""  // Empty cells for merging
      ],
      [
        "N° Réservation",
        "Référence externe",
        "Date de réservation",
        "Date d'arrivée",
        "Date de départ",
        "Chambre",
        "Nom du client",
        "Portal de réservation",
        "Email",
        "Téléphone",
        "Adresse",
        "Adultes",
        "Enfants",
        "Heure d'arrivée",
        "Notes",
        "Prix de base",
        "Commission",
        "Nuits réservées"
      ],
      // Data rows
      ...filteredAndSortedData.map((booking) => [
        booking.id,
        booking.referenceId,
        formatDate(booking.bookingDate),
        formatDate(booking.arrival),
        formatDate(booking.departure),
        booking.roomName,
        booking.guestName,
        booking.bookingPortal,
        booking.email,
        booking.phone,
        booking.address || '',
        booking.adults,
        booking.children,
        booking.checkInTime,
        booking.notes,
        formatCurrency(booking.basePrice),
        formatCurrency(booking.commission),
        booking.numberOfNights
      ])
    ];

    // Create a separate worksheet for extras details
    const extrasData = [
      ["Détails des extras"],
      [
        "N° Réservation",
        "Nom du client",
        "Extra",
        "Quantité",
        "Prix unitaire",
        "Prix total"
      ],
      ...filteredAndSortedData.flatMap((booking) =>
        booking.extras.length > 0
          ? booking.extras.map((extra) => [
              booking.id,
              booking.guestName,
              extra.name,
              extra.quantity || 1,
              formatCurrency(extra.price / (extra.quantity || 1)),
              formatCurrency(extra.price)
            ])
          : [[booking.id, booking.guestName, "Aucun extra", "-", "-", "-"]]
      )
    ];

    // Create summary worksheet
    const summaryData = [
      ["Résumé de la période"],
      ["Période", `${formatDate(startYear + '-' + startMonth + '-01')} au ${formatDate(endYear + '-' + endMonth + '-31')}`],
      ["Nombre total de réservations", totalBookings],
      ["Total des prix de base", formatCurrency(filteredAndSortedData.reduce((sum, booking) => sum + booking.basePrice, 0))],
      ["Total des extras", formatCurrency(filteredAndSortedData.reduce((sum, booking) => sum + booking.totalExtrasAmount, 0))],
      ["Total des commissions", formatCurrency(filteredAndSortedData.reduce((sum, booking) => sum + booking.commission, 0))],
      ["Nombre total de nuits", filteredAndSortedData.reduce((sum, booking) => sum + booking.numberOfNights, 0)]
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add worksheets
    const ws_bookings = XLSX.utils.aoa_to_sheet(bookingData);
    const ws_extras = XLSX.utils.aoa_to_sheet(extrasData);
    const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);

    // Style configurations
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "678D73" } },
      alignment: { horizontal: "center" }
    };

    // Apply styles and merged cells
    ws_bookings["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }]; // Merge first row
    ws_extras["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]; // Merge first row

    // Set column widths
    ws_bookings["!cols"] = [
      { wch: 15 }, // N° Réservation
      { wch: 15 }, // Référence externe
      { wch: 15 }, // Date de réservation
      { wch: 12 }, // Date d'arrivée
      { wch: 12 }, // Date de départ
      { wch: 20 }, // Chambre
      { wch: 25 }, // Nom du client
      { wch: 15 }, // Portal
      { wch: 30 }, // Email
      { wch: 15 }, // Téléphone
      { wch: 40 }, // Adresse
      { wch: 10 }, // Adultes
      { wch: 10 }, // Enfants
      { wch: 15 }, // Heure d'arrivée
      { wch: 40 }, // Notes
      { wch: 12 }, // Prix de base
      { wch: 12 }, // Commission
      { wch: 12 }  // Nuits réservées
    ];

    ws_extras["!cols"] = [
      { wch: 15 }, // N° Réservation
      { wch: 25 }, // Nom du client
      { wch: 30 }, // Extra
      { wch: 10 }, // Quantité
      { wch: 12 }, // Prix unitaire
      { wch: 12 }  // Prix total
    ];

    ws_summary["!cols"] = [
      { wch: 25 }, // Label
      { wch: 20 }  // Value
    ];

    // Add the worksheets to the workbook
    XLSX.utils.book_append_sheet(wb, ws_summary, "Résumé");
    XLSX.utils.book_append_sheet(wb, ws_bookings, "Réservations");
    XLSX.utils.book_append_sheet(wb, ws_extras, "Extras");

    // Generate filename with date range
    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}`;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}`;
    const fileName = `rapport-complet_${startDate}_${endDate}.xlsx`;

    // Save the file
    XLSX.writeFile(wb, fileName);
  };

  const filteredAndSortedData = reportData
    .filter((extra) =>
      extra.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      return sortField === "name"
        ? multiplier * a.name.localeCompare(b.name)
        : multiplier * (a[sortField] - b[sortField]);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Chargement...
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl p-3 mx-auto md:p-6">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#678D73]" />
          <h1 className="text-xl font-bold md:text-2xl">Rapport des Extras</h1>
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
              placeholder="Rechercher un extra..."
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
              onChange={(e) => handleStartYearChange(e.target.value)}
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
              onChange={(e) => handleEndYearChange(e.target.value)}
              disabled={endYear < startYear}
            >
              {years
                .filter((year) => year >= startYear)
                .map((year) => (
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
        <div className="p-4 border-b">
          <p className="text-sm text-gray-600">
            Réservations totales pour cette période : {totalBookings}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { field: "id", label: "N° Réservation" },
                  { field: "bookingDate", label: "Date réservation" },
                  { field: "arrival", label: "Arrivée" },
                  { field: "departure", label: "Départ" },
                  { field: "roomName", label: "Chambre" },
                  { field: "guestName", label: "Client" },
                  { field: "bookingPortal", label: "Portal" },
                  { field: "email", label: "Email" },
                  { field: "phone", label: "Téléphone" },
                  { field: "adults", label: "Adultes" },
                  { field: "children", label: "Enfants" },
                  { field: "basePrice", label: "Prix base" },
                  { field: "totalExtrasAmount", label: "Total extras" },
                  { field: "commission", label: "Commission" },
                  { field: "numberOfNights", label: "Nuits" }
                ].map(({ field, label }) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm whitespace-nowrap"
                  >
                    {label} {sortField === field && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.id}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.bookingDate}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.arrival}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.departure}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.roomName}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.guestName}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.bookingPortal}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.email}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.phone}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.adults}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.children}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">€{booking.basePrice}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">€{booking.totalExtrasAmount}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">€{booking.commission}</td>
                    <td className="px-4 py-3 text-xs md:px-6 md:text-sm">{booking.numberOfNights}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="15" className="px-4 py-3 text-sm text-center text-gray-500 md:px-6 md:py-4">
                    Aucune réservation disponible pour cette période
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

export default ExtrasReport;