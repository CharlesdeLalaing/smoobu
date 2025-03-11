import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Search, Download } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
  const [sortField, setSortField] = useState("count");
  const [sortDirection, setSortDirection] = useState("desc");

  const years = Array.from(
    { length: 3 },
    (_, i) => new Date().getFullYear() - i
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString("fr", { month: "long" }),
  }));

  // Ensure end date is not before start date
  useEffect(() => {
    if (
      endYear < startYear ||
      (endYear === startYear && endMonth < startMonth)
    ) {
      setEndYear(startYear);
      setEndMonth(startMonth);
    }
  }, [startYear, startMonth, endYear, endMonth]);

  // Create a memoized fetchReport function using useCallback
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const startMonthStr = String(startMonth).padStart(2, "0");
      const endMonthStr = String(endMonth).padStart(2, "0");

      const response = await axios.get(`${API_URL}/api/extras-report`, {
        params: {
          startMonth: startMonthStr,
          startYear: startYear,
          endMonth: endMonthStr,
          endYear: endYear,
        },
      });

      if (response.data) {
        setReportData(response.data.data || []);
        setTotalBookings(response.data.totalBookings || 0);
      } else {
        throw new Error("Réponse vide du serveur");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [startMonth, startYear, endMonth, endYear]);

  // Call fetchReport when date parameters change
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleStartYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setStartYear(newYear);
    if (endYear < newYear) {
      setEndYear(newYear);
    }
  };

  const handleEndYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    if (newYear >= startYear) {
      setEndYear(newYear);
    }
  };

  const handleStartMonthChange = (e) => {
    setStartMonth(parseInt(e.target.value));
  };

  const handleEndMonthChange = (e) => {
    setEndMonth(parseInt(e.target.value));
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
    // Create worksheet data
    const wsData = [
      // Headers
      ["Nom", "Nombre de sélections", "Montant total (€)"],
      // Data rows
      ...filteredAndSortedData.map((extra) => [
        extra.name,
        extra.count,
        Number(extra.totalAmount.toFixed(2)),
      ]),
    ];

    // Add total row
    const totalAmount = filteredAndSortedData.reduce(
      (sum, extra) => sum + extra.totalAmount,
      0
    );
    wsData.push(["Total", "", totalAmount.toFixed(2)]);

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
    ws["!cols"] = colWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Rapport Extras");

    // Generate filename with date range
    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}`;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}`;
    const fileName = `rapport-extras_${startDate}_${endDate}.xlsx`;

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
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-t-[#678D73] rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-3 mx-auto max-w-7xl md:p-6">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#678D73]" />
          <h1 className="text-xl font-bold md:text-2xl">Rapport des Extras</h1>
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
              placeholder="Rechercher un extra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            />
          </div>

          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startMonth}
              onChange={handleStartMonthChange}
              aria-label="Mois de début"
            >
              {months.map((month) => (
                <option key={`start-${month.value}`} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startYear}
              onChange={handleStartYearChange}
              aria-label="Année de début"
            >
              {years.map((year) => (
                <option key={`start-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={endMonth}
              onChange={handleEndMonthChange}
              aria-label="Mois de fin"
            >
              {months.map((month) => (
                <option key={`end-${month.value}`} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={endYear}
              onChange={handleEndYearChange}
              aria-label="Année de fin"
            >
              {years.map((year) => (
                <option key={`end-${year}`} value={year}>
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

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <p className="text-sm text-gray-600">
            Réservations totales pour cette période : {totalBookings}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                  onClick={() => handleSort("name")}
                >
                  Nom{" "}
                  {sortField === "name" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                  onClick={() => handleSort("count")}
                >
                  Sélections{" "}
                  {sortField === "count" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="hidden px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm md:table-cell"
                  onClick={() => handleSort("totalAmount")}
                >
                  Montant{" "}
                  {sortField === "totalAmount" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((extra) => (
                  <tr key={extra.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 md:px-6 md:py-4 md:text-sm">
                      {extra.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 md:px-6 md:py-4 md:text-sm">
                      {extra.count}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 md:px-6 md:py-4 md:text-sm md:table-cell">
                      €{extra.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="3"
                    className="px-4 py-3 text-sm text-center text-gray-500 md:px-6 md:py-4"
                  >
                    Aucune donnée d'extras disponible pour cette période
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
