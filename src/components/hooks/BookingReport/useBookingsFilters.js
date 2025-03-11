// File: src/hooks/useBookingsFilters.js
import { useState, useMemo } from "react";

export const useBookingsFilters = (reportData) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("checkIn");
  const [sortDirection, setSortDirection] = useState("desc");

  // Filter and sort the data
  const filteredAndSortedData = useMemo(() => {
    return reportData
      .filter((booking) =>
        Object.values(booking).some(
          (value) =>
            value &&
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
      .sort((a, b) => {
        const multiplier = sortDirection === "asc" ? 1 : -1;
        if (["checkIn", "checkOut", "created"].includes(sortField)) {
          return multiplier * (new Date(a[sortField]) - new Date(b[sortField]));
        }
        return (
          multiplier * String(a[sortField]).localeCompare(String(b[sortField]))
        );
      });
  }, [reportData, searchTerm, sortField, sortDirection]);

  return {
    searchTerm,
    setSearchTerm,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    filteredAndSortedData,
  };
};
