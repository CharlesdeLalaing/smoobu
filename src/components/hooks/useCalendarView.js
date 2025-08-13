import { useState, useEffect } from "react";

export const useCalendarView = (roomId) => {
  // Start with saved view month if available, otherwise current date
  const [viewMonth, setViewMonth] = useState(() => {
    try {
      // Try to restore the view month from sessionStorage
      const savedViewMonth = sessionStorage.getItem(`calendar-view-${roomId}`);
      if (savedViewMonth) {
        const savedDate = new Date(savedViewMonth);
        // Validate the saved date is reasonable (not too old or in invalid format)
        if (
          !isNaN(savedDate.getTime()) &&
          savedDate.getFullYear() >= new Date().getFullYear() - 1
        ) {
          return savedDate;
        }
      }
    } catch (e) {
      console.log("Error restoring calendar view:", e);
    }
    // Fallback to current date if no valid saved view exists
    return new Date();
  });

  // Save the view month whenever it changes (only for session, cleared on page refresh)
  useEffect(() => {
    try {
      // Use sessionStorage instead of localStorage so it resets on page refresh
      sessionStorage.setItem(
        `calendar-view-${roomId}`,
        viewMonth.toISOString()
      );
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
