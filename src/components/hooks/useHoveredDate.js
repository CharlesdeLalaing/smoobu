// hooks/useHoveredDate.js
import { useState } from "react";

export const useHoveredDate = () => {
  const [hoveredDate, setHoveredDate] = useState(null);

  const handleDateMouseEnter = (date, startDate, endDate) => {
    if (startDate && !endDate) {
      setHoveredDate(date);
    }
  };

  const handleDateMouseLeave = () => {
    setHoveredDate(null);
  };

  return {
    hoveredDate,
    handleDateMouseEnter,
    handleDateMouseLeave,
  };
};
