import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
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

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString('fr', { month: 'long' })
  }));

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
    .filter(extra => extra.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return sortField === 'name' 
        ? multiplier * a.name.localeCompare(b.name)
        : multiplier * (a[sortField] - b[sortField]);
    });

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold">Rapport Mensuel des Extras</h1>
        </div>
        <div className="flex items-center justify-center p-4 sm:p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-full">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        <h1 className="text-xl sm:text-2xl font-bold">Rapport Mensuel des Extras</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label htmlFor="month" className="block text-sm font-medium text-gray-700">
              Mois
            </label>
            <select
              id="month"
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="year" className="block text-sm font-medium text-gray-700">
              Année
            </label>
            <select
              id="year"
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Rechercher des extras
            </label>
            <input
              type="text"
              id="search"
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              placeholder="Rechercher par nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded mb-4 sm:mb-6 text-sm">
          {error}
        </div>
      )}

      {!error && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-3 sm:p-4 border-b">
            <p className="text-xs sm:text-sm text-gray-600">
              Réservations totales pour cette période : {totalBookings}
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('name')}
                    >
                      <span className="hidden sm:inline">Nom de l'extra</span>
                      <span className="sm:hidden">Nom</span>
                      {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('count')}
                    >
                      <span className="hidden sm:inline">Nombre de sélections</span>
                      <span className="sm:hidden">Nb.</span>
                      {sortField === 'count' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hidden sm:table-cell"
                      onClick={() => handleSort('totalAmount')}
                    >
                      Montant total {sortField === 'totalAmount' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Type
                    </th>
                    <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Optionnel
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedData.length > 0 ? (
                    filteredAndSortedData.map((extra) => (
                      <tr key={extra.name} className="hover:bg-gray-50">
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {extra.name}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {extra.count}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                          €{extra.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden lg:table-cell">
                          {extra.details.calculationType === 0 && 'Par Réservation'}
                          {extra.details.calculationType === 1 && 'Par Personne'}
                          {extra.details.calculationType === 2 && 'Par Nuit'}
                          {extra.details.calculationType === 3 && 'Par Personne/Nuit'}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden md:table-cell">
                          {extra.details.optional ? 'Oui' : 'Non'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-3 py-2 sm:px-6 sm:py-4 text-center text-xs sm:text-sm text-gray-500">
                        Aucune donnée d'extras disponible pour cette période
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtrasReport;