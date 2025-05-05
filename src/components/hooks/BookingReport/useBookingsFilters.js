import { useState, useMemo } from "react";

export const useBookingsFilters = (reportData) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("checkIn");
  const [sortDirection, setSortDirection] = useState("desc");
  // Add SPA filter state
  const [spaFilter, setSpaFilter] = useState("all"); // 'all', 'scheduled', 'to_schedule', 'none'

  // Filter and sort the data
  const filteredAndSortedData = useMemo(() => {
    return reportData
      .filter((booking) => {
        // Apply text search filter
        const matchesSearch = Object.values(booking).some(
          (value) =>
            value &&
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Apply SPA filter
        let matchesSpaFilter = true;
        if (spaFilter !== "all") {
          if (spaFilter === "scheduled" && !booking.spaDateTime) {
            matchesSpaFilter = false;
          } else if (
            spaFilter === "to_schedule" &&
            booking.spaBookingPreference !== "later"
          ) {
            matchesSpaFilter = false;
          } else if (
            spaFilter === "none" &&
            (booking.spaDateTime || booking.spaBookingPreference === "later")
          ) {
            matchesSpaFilter = false;
          }
        }

        // Return true only if both filters pass
        return matchesSearch && matchesSpaFilter;
      })
      .sort((a, b) => {
        const multiplier = sortDirection === "asc" ? 1 : -1;

        // Handle special case for spaDateTime sorting
        if (sortField === "spaDateTime") {
          // Sort by SPA status first: scheduled, then to_schedule, then none
          if (a.spaDateTime && !b.spaDateTime) return -1 * multiplier;
          if (!a.spaDateTime && b.spaDateTime) return 1 * multiplier;
          if (a.spaBookingPreference === "later" && !b.spaBookingPreference)
            return -1 * multiplier;
          if (!a.spaBookingPreference && b.spaBookingPreference === "later")
            return 1 * multiplier;

          // If both have spaDateTime, sort by the actual date
          if (a.spaDateTime && b.spaDateTime) {
            const dateA = a.spaDateTime.seconds
              ? new Date(a.spaDateTime.seconds * 1000)
              : new Date(a.spaDateTime);
            const dateB = b.spaDateTime.seconds
              ? new Date(b.spaDateTime.seconds * 1000)
              : new Date(b.spaDateTime);
            return multiplier * (dateA - dateB);
          }

          // Otherwise maintain existing order
          return 0;
        }

        // Normal case for other fields
        if (["checkIn", "checkOut", "created"].includes(sortField)) {
          return multiplier * (new Date(a[sortField]) - new Date(b[sortField]));
        }
        return (
          multiplier * String(a[sortField]).localeCompare(String(b[sortField]))
        );
      });
  }, [reportData, searchTerm, sortField, sortDirection, spaFilter]);

  return {
    searchTerm,
    setSearchTerm,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    // Add SPA filter to returned values
    spaFilter,
    setSpaFilter,
    filteredAndSortedData,
  };
};
