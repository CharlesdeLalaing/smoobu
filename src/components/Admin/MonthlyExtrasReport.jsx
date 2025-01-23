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
    return <div className="p-4">Chargement du rapport...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Erreur : {error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nom de l'extra
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre de sélections
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Optionnel
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {extrasReport.map((extra) => (
              <tr key={extra.name} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {extra.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {extra.count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {extra.details.calculationType === 0 && 'Par Réservation'}
                  {extra.details.calculationType === 1 && 'Par Personne'}
                  {extra.details.calculationType === 2 && 'Par Nuit'}
                  {extra.details.calculationType === 3 && 'Par Personne/Nuit'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {extra.details.optional ? 'Oui' : 'Non'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthlyExtrasReport;