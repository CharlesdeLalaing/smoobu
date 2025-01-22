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
        
        // Step 1: Fetch all bookings for the specified month
        const bookingsResponse = await axios.get('https://login.smoobu.com/api/reservations', {
          headers: {
            'Api-Key': apiKey,
            'Cache-Control': 'no-cache'
          }
        });

        if (!bookingsResponse.data) {
          throw new Error('Failed to fetch bookings');
        }

        const bookingsData = bookingsResponse.data;
        
        // Filter bookings for the specified month and year
        const monthlyBookings = bookingsData.bookings.filter(booking => {
          const bookingDate = new Date(booking.arrivalDate);
          return bookingDate.getMonth() === month - 1 && 
                 bookingDate.getFullYear() === year;
        });

        // Step 2: Fetch all addons
        const addonsResponse = await axios.get('https://login.smoobu.com/api/addons', {
          headers: {
            'Api-Key': apiKey,
            'Cache-Control': 'no-cache'
          }
        });

        if (!addonsResponse.data) {
          throw new Error('Failed to fetch addons');
        }

        const addonsData = addonsResponse.data;

        // Step 3: Count the usage of each extra
        const extrasCount = {};

        // Initialize counts for all possible extras
        addonsData.addons.forEach(addon => {
          extrasCount[addon.name] = {
            count: 0,
            details: addon
          };
        });

        // Count the extras from bookings
        monthlyBookings.forEach(booking => {
          if (booking.addons) {
            booking.addons.forEach(bookingAddon => {
              if (extrasCount[bookingAddon.name]) {
                extrasCount[bookingAddon.name].count += bookingAddon.quantity || 1;
              }
            });
          }
        });

        // Convert to array for display
        const reportData = Object.entries(extrasCount).map(([name, data]) => ({
          name,
          count: data.count,
          details: data.details
        }));

        setExtrasReport(reportData);
        setLoading(false);

      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchExtrasReport();
  }, [apiKey, month, year]);

  if (loading) {
    return <div className="p-4">Loading report...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
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
            {extrasReport.map((extra) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthlyExtrasReport;