import React, { useState, useEffect } from "react";
import { Calendar, Search, Download } from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL =
  import.meta.env.VITE_API_URL || "https://smoobu-test.onrender.com";

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

  useEffect(() => {
    if (
      endYear < startYear ||
      (endYear === startYear && endMonth < startMonth)
    ) {
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
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                >
                  Nom{" "}
                  {sortField === "name" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("count")}
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                >
                  Sélections{" "}
                  {sortField === "count" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("totalAmount")}
                  className="hidden px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm md:table-cell"
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
