import React, { useState, useEffect } from 'react';
import { Calendar, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://booking-9u8u.onrender.com';

const ExtrasReport = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalBookings, setTotalBookings] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('count');
  const [sortDirection, setSortDirection] = useState('desc');

  const years = Array.from(
    { length: 3 },
    (_, i) => new Date().getFullYear() - i
  );
  const months = Array.from(
    { length: 12 },
    (_, i) => ({
      value: i + 1,
      label: new Date(2024, i).toLocaleString('fr', { month: 'long' })
    })
  );

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const monthStr = String(selectedMonth).padStart(2, '0');
        const response = await axios.get(`${API_URL}/api/extras-report`, {
          params: { month: monthStr, year: selectedYear }
        });
        
        if (response.data) {
          setReportData(response.data.data || []);
          setTotalBookings(response.data.totalBookings || 0);
        } else {
          throw new Error('Réponse vide du serveur');
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message);
        setReportData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedMonth, selectedYear]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedData = reportData
    .filter(extra => 
      extra.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return sortField === 'name' 
        ? multiplier * a.name.localeCompare(b.name)
        : multiplier * (a[sortField] - b[sortField]);
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">Chargement...</div>
    );
  }

  return (
    <div className="p-3 md:p-6 w-full max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#678D73]" />
          <h1 className="text-xl md:text-2xl font-bold">Rapport Mensuel des Extras</h1>
        </div>
      </div>

      {/* Filters Section */}
      <div className="mb-6 bg-white p-3 md:p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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

          {/* Month Selector */}
          <div>
            <select
              id="month"
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <select
              id="year"
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  onClick={() => handleSort('name')}
                  className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 cursor-pointer"
                >
                  Nom {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('count')}
                  className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 cursor-pointer"
                >
                  Sélections {sortField === 'count' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('totalAmount')}
                  className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 cursor-pointer hidden md:table-cell"
                >
                  Montant {sortField === 'totalAmount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                {/* <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 hidden lg:table-cell">
                  Type
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 hidden sm:table-cell">
                  Optionnel
                </th> */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((extra) => (
                  <tr key={extra.name} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium text-gray-900">
                      {extra.name}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500">
                      {extra.count}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500 hidden md:table-cell">
                      €{extra.totalAmount.toFixed(2)}
                    </td>
                    {/* <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500 hidden lg:table-cell">
                      {extra.details.calculationType === 0 && 'Par Réservation'}
                      {extra.details.calculationType === 1 && 'Par Personne'}
                      {extra.details.calculationType === 2 && 'Par Nuit'}
                      {extra.details.calculationType === 3 && 'Par Personne/Nuit'}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500 hidden sm:table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        extra.details.optional ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {extra.details.optional ? 'Oui' : 'Non'}
                      </span>
                    </td> */}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 md:px-6 py-3 md:py-4 text-center text-sm text-gray-500">
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