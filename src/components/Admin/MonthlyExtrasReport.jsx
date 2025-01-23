import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';

const MonthlyExtrasReport = ({ apiKey, month, year }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [extrasReport, setExtrasReport] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchExtrasReport = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/extras-report', {
          params: {
            month: selectedMonth,
            year: selectedYear
          }
        });
        setExtrasReport(response.data.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchExtrasReport();
  }, [apiKey, month, year]);

  const filteredData = extrasReport.filter(extra => 
    extra.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center items-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#678D73]" />
    </div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
      Erreur : {error}
    </div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-3 md:p-4 border-b border-gray-200">
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
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600">
                Nom de l'extra
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600">
                Sélections
              </th>
              {/* <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 hidden lg:table-cell">
                Type
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 hidden md:table-cell">
                Optionnel
              </th> */}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.length > 0 ? (
              filteredData.map((extra) => (
                <tr key={extra.name} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium text-gray-900">
                    {extra.name}
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500">
                    {extra.count}
                  </td>
                  {/* <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500 hidden lg:table-cell">
                    {extra.details.calculationType === 0 && 'Par Réservation'}
                    {extra.details.calculationType === 1 && 'Par Personne'}
                    {extra.details.calculationType === 2 && 'Par Nuit'}
                    {extra.details.calculationType === 3 && 'Par Personne/Nuit'}
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-500 hidden md:table-cell">
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
                <td colSpan="4" className="px-4 md:px-6 py-4 text-center text-sm text-gray-500">
                  Aucune donnée d'extras disponible pour cette période
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthlyExtrasReport;