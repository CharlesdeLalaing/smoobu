// File: src/components/BookingsReport/index.js
import React from "react";
import BookingsReportFilters from "./BookingReport/BookingsReportFilters";
import BookingsTable from "./BookingReport/BookingsTable";
import ActionButtons from "./BookingReport/ActionButtons";
import { useBookingsData } from "../hooks/BookingReport/useBookingsData";
import { useBookingsFilters } from "../hooks/BookingReport/useBookingsFilters";



const portalNames = {
  'Homepage': 'Website',
  'Direct booking': 'Direct booking',
  'Homepage direct': 'Website',
  'Direct': 'Direct booking',
  'Airbnb': 'Airbnb',
  'airbnb': 'Airbnb',
  'Booking.com': 'Booking.com',
  'booking.com': 'Booking.com',
  'Expedia': 'Expedia',
  'blocked': 'Blocked',
  'Blocked': 'Blocked',
  'Partenariat': 'Partenariat',
  'partenariat': 'Partenariat'
};


const BookingsReport = () => {
  const {
    reportData,
    loading,
    error,
    // Get date state from useBookingsData
    startMonth,
    setStartMonth,
    startYear,
    setStartYear,
    endMonth,
    setEndMonth,
    endYear,
    setEndYear,
    fetchFromFirebase,
    handleFetchAndSync,
    handleDeduplicate,
    handleExport,
    deduplicating,
  } = useBookingsData();

  const {
    searchTerm,
    setSearchTerm,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    filteredAndSortedData,
  } = useBookingsFilters(reportData);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Chargement...
      </div>
    );
  }

  return (
    <div className="w-full p-3 mx-auto max-w-7xl md:p-6">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold md:text-2xl">
            Rapport des Réservations Smoobu
          </h1>
        </div>

        <ActionButtons
          onExport={handleExport}
          onFetchAndSync={handleFetchAndSync}
          onDeduplicate={handleDeduplicate}
          isExportDisabled={filteredAndSortedData.length === 0}
          isDeduplicating={deduplicating}
        />
      </div>

      <BookingsReportFilters
        startMonth={startMonth}
        setStartMonth={setStartMonth}
        startYear={startYear}
        setStartYear={setStartYear}
        endMonth={endMonth}
        setEndMonth={setEndMonth}
        endYear={endYear}
        setEndYear={setEndYear}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

      {error && (
        <div className="px-4 py-3 mb-6 text-red-700 border border-red-200 rounded bg-red-50">
          {error}
        </div>
      )}

      <BookingsTable
        data={filteredAndSortedData}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={setSortField}
        onSortDirectionChange={setSortDirection}
      />
    </div>
  );
};

export default BookingsReport;
