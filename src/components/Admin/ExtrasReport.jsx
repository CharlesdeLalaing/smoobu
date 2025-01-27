import React, { useState, useEffect } from 'react';
import { Calendar, Search, Download, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const API_URL = import.meta.env.VITE_API_URL || 'https://booking-9u8u.onrender.com';

const CombinedReport = () => {
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('bookingDate');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedRows, setExpandedRows] = useState(new Set());

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString('fr', { month: 'long' }),
  }));

  useEffect(() => {
    const fetchCombinedData = async () => {
      try {
        setLoading(true);
        setError(null);

        const startMonthStr = String(startMonth).padStart(2, '0');
        const endMonthStr = String(endMonth).padStart(2, '0');

        // Fetch both booking data and extras data
        const [csvBuffer, extrasResponse] = await Promise.all([
          window.fs.readFile('BookingList20250127.csv'),
          axios.get(`${API_URL}/api/extras-report`, {
            params: {
              startMonth: startMonthStr,
              startYear: startYear,
              endMonth: endMonthStr,
              endYear: endYear,
            },
          })
        ]);

        // Convert buffer to text
        const csvContent = new TextDecoder().decode(csvBuffer);

        // Parse CSV data
        const parsedBookings = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        }).data;

        // Combine booking data with extras
        const combinedData = parsedBookings.map(booking => ({
          ...booking,
          extras: extrasResponse.data.data.filter(extra => extra.bookingId === booking.id) || []
        }));

        setReportData(combinedData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchCombinedData();
  }, [startMonth, startYear, endMonth, endYear]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleRowExpansion = (bookingId) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(bookingId)) {
      newExpandedRows.delete(bookingId);
    } else {
      newExpandedRows.add(bookingId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleExport = () => {
    const flattenedData = reportData.flatMap(booking => {
      const baseBooking = {
        'Date de réservation': booking.bookingDate,
        'Nom du client': booking.clientName,
        'Email': booking.email,
        'Téléphone': booking.phone,
        'Montant total': booking.totalAmount,
        'Status': booking.status
      };

      if (booking.extras && booking.extras.length > 0) {
        return booking.extras.map(extra => ({
          ...baseBooking,
          'Extra': extra.name,
          'Prix extra': extra.amount,
          'Quantité': extra.quantity
        }));
      }
      return [baseBooking];
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(flattenedData);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Date
      { wch: 30 }, // Client Name
      { wch: 35 }, // Email
      { wch: 15 }, // Phone
      { wch: 15 }, // Total Amount
      { wch: 15 }, // Status
      { wch: 30 }, // Extra
      { wch: 15 }, // Extra Price
      { wch: 10 }  // Quantity
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Rapport Complet');
    
    const fileName = `rapport-complet_${startYear}-${String(startMonth).padStart(2, '0')}_${endYear}-${String(endMonth).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filteredAndSortedData = reportData
    .filter(booking => 
      booking.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'bookingDate') {
        return multiplier * (new Date(a[sortField]) - new Date(b[sortField]));
      }
      return multiplier * (a[sortField] > b[sortField] ? 1 : -1);
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
          <h1 className="text-xl font-bold md:text-2xl">Rapport Complet des Réservations</h1>
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

      {/* Search and Filter Controls */}
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
          <div className="flex gap-4 flex-wrap">
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

            <span className="text-gray-500">à</span>

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

      {/* Data Table */}
      <div className="overflow-hidden bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th
                  onClick={() => handleSort('bookingDate')}
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                >
                  Date {sortField === 'bookingDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-600 md:px-6 md:text-sm">
                  Client
                </th>
                <th className="hidden px-4 py-3 text-xs font-semibold text-left text-gray-600 md:px-6 md:text-sm md:table-cell">
                  Email
                </th>
                <th className="hidden px-4 py-3 text-xs font-semibold text-left text-gray-600 md:px-6 md:text-sm md:table-cell">
                  Téléphone
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-right text-gray-600 md:px-6 md:text-sm">
                  Montant
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-center text-gray-600 md:px-6 md:text-sm">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedData.map((booking) => (
                <React.Fragment key={booking.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRowExpansion(booking.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {expandedRows.has(booking.id) ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 md:px-6 md:text-sm">
                      {new Date(booking.bookingDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 md:px-6 md:text-sm">
                      {booking.clientName}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 md:px-6 md:text-sm md:table-cell">
                      {booking.email}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 md:px-6 md:text-sm md:table-cell">
                      {booking.phone}
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-gray-500 md:px-6 md:text-sm">
                      €{booking.totalAmount?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-center text-gray-500 md:px-6 md:text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                  {expandedRows.has(booking.id) && (
                    <tr>
                      <td colSpan="7" className="px-4 py-2 bg-gray-50">
                        <div className="ml-8">
                          <h4 className="mb-2 text-sm font-medium text-gray-900">Extras:</h4>
                          {booking.extras && booking.extras.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                              {booking.extras.map((extra, index) => (
                                <div key={index} className="p-3 bg-white rounded-lg shadow-sm">
                                  <div className="text-sm font-medium text-gray-900">{extra.name}</div>
                                  <div className="text-sm text-gray-500">
                                    Quantité: {extra.quantity}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Prix: €{extra.amount?.toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Aucun extra pour cette réservation</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredAndSortedData.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-3 text-sm text-center text-gray-500 md:px-6 md:py-4">
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

export default CombinedReport;