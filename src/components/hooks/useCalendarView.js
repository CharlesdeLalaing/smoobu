import { useState, useEffect } from "react";

export const useCalendarView = (roomId) => {
  // Get stored calendar view or use current date
  const [viewMonth, setViewMonth] = useState(() => {
    try {
      const storedView = localStorage.getItem(`calendar-view-${roomId}`);
      return storedView ? new Date(storedView) : new Date();
    } catch (e) {
      console.log("Error retrieving stored calendar view:", e);
      return new Date();
    }
  });

  // Save the view month whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(`calendar-view-${roomId}`, viewMonth.toISOString());
    } catch (e) {
      console.log("Error storing calendar view:", e);
    }
  }, [viewMonth, roomId]);

  // Calculate next month for dual calendar view
  const nextMonth = new Date(viewMonth);
  nextMonth.setMonth(viewMonth.getMonth() + 1);

  // Navigate to previous month - moves ONE month back
  const prevMonthPair = () => {
    setViewMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  // Navigate to next month - moves ONE month forward
  const nextMonthPair = () => {
    setViewMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  return {
    viewMonth,
    nextMonth,
    prevMonthPair,
    nextMonthPair,
  };
};
