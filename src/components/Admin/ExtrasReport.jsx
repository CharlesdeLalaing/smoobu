import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import axios from 'axios';

const ExtrasReport = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState([]); // Initialize as empty array
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);

  // Generate array of recent years (current year and 2 years back)
  const years = Array.from(
    { length: 3 },
    (_, i) => new Date().getFullYear() - i
  );

  // Array of months for the dropdown
  const months = Array.from(
    { length: 12 },
    (_, i) => ({
      value: i + 1,
      label: new Date(2024, i).toLocaleString('default', { month: 'long' })
    })
  );

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3000/api/extras-report', {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      setReportData(response.data.data || []); // Ensure we set an empty array if no data
      setError(null);
    } catch (err) {
      setError(err.message);
      setReportData([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear]);

  // Render loading state
  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-3xl font-bold">Extras Monthly Report</h1>
        </div>
        <div className="text-center py-4">Loading...</div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-3xl font-bold">Extras Monthly Report</h1>
        </div>
        <div className="text-red-500 py-4">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-6 h-6 text-blue-600" />
        <h1 className="text-3xl font-bold">Extras Monthly Report</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label 
              htmlFor="month" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Month
            </label>
            <select
              id="month"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          <div>
            <label 
              htmlFor="year" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Year
            </label>
            <select
              id="year"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      <div className="bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Extra Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Times Selected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Optional
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.isArray(reportData) && reportData.length > 0 ? (
                reportData.map((extra) => (
                  <tr key={extra.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {extra.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {extra.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {extra.details.calculationType === 0 && 'Per Booking'}
                      {extra.details.calculationType === 1 && 'Per Person'}
                      {extra.details.calculationType === 2 && 'Per Night'}
                      {extra.details.calculationType === 3 && 'Per Person/Night'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {extra.details.optional ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                    No extras data available for this period
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