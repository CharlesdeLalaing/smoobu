import { useState, useEffect } from "react";

export const useCalendarView = (roomId) => {
  // Always start with current date instead of localStorage to ensure fresh view
  const [viewMonth, setViewMonth] = useState(() => {
    // Always return current date - don't use localStorage on initial load
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

