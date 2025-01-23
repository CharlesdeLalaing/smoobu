import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MonthlyExtrasReport = ({ apiKey, month, year }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [extrasReport, setExtrasReport] = useState([]);

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

  if (loading) {
    return <div className="p-3 sm:p-4 text-sm">Chargement du rapport...</div>;
  }

  if (error) {
    return <div className="p-3 sm:p-4 text-red-500 text-sm">Erreur : {error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="hidden sm:inline">Nom de l'extra</span>
                  <span className="sm:hidden">Nom</span>
                </th>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="hidden sm:inline">Nombre de sélections</span>
                  <span className="sm:hidden">Nb.</span>
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
              {extrasReport.map((extra) => (
                <tr key={extra.name} className="hover:bg-gray-50">
                  <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                    {extra.name}
                  </td>
                  <td className="px-3 py-2 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {extra.count}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyExtrasReport;