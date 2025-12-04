// File: src/components/BookingsReport/BookingsReportFilters.js
import React from "react";
import { Search } from "lucide-react";

const BookingsReportFilters = ({
  startMonth,
  setStartMonth,
  startYear,
  setStartYear,
  endMonth,
  setEndMonth,
  endYear,
  setEndYear,
  searchTerm,
  setSearchTerm,
}) => {
  const years = Array.from(
    { length: 4 },
    (_, i) => new Date().getFullYear() + 1 - i
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString("fr", { month: "long" }),
  }));

  return (
    <div className="p-4 mb-6 bg-white rounded-lg shadow">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
          />
        </div>

        <div className="sm:col-span-1">
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            value={startMonth}
            onChange={(e) => {
              const newMonth = parseInt(e.target.value);
              setStartMonth(newMonth);

              // If start and end months were the same before the change,
              // update the end month to match the new start month
              if (startMonth === endMonth && startYear === endYear) {
                setEndMonth(newMonth);
              }
            }}
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            value={startYear}
            onChange={(e) => {
              const newYear = parseInt(e.target.value);
              setStartYear(newYear);

              // If years were the same, keep them in sync
              if (startYear === endYear) {
                setEndYear(newYear);
              }
            }}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
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
        <div className="sm:col-span-1">
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
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
  );
};

export default BookingsReportFilters;
