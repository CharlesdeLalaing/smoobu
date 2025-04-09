import React, { useState, useEffect, memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import CustomCalendar from "./CustomCalendar";

export const CalendarRoom = memo(
  ({
    roomId,
    availableDates,
    startDate,
    endDate,
    onDateSelect,
    hasSearched,
  }) => {
    const { t } = useTranslation();
    const [displayMonth, setDisplayMonth] = useState(new Date());
    const [showNextMonth, setShowNextMonth] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Handle window resize to determine if we show two months side by side
    useEffect(() => {
      const handleResize = () => {
        setWindowWidth(window.innerWidth);
      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, []);

    // Determine if we should show two calendars side by side based on screen width
    useEffect(() => {
      setShowNextMonth(windowWidth >= 768); // Show two calendars on tablets and above
    }, [windowWidth]);

    // Calculate next month for dual calendar view
    const nextMonth = new Date(displayMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Use useCallback to memoize the onDateSelect handler
    const handleDateSelect = useCallback(
      (date, isStart, calendarRoomId) => {
        if (onDateSelect) {
          // Pass null as third parameter to avoid changing room selection when clicking calendar
          onDateSelect(date, isStart, null);
        }
      },
      [onDateSelect]
    );

    return (
      <div className="calendar-room">
        <h3 className="text-lg font-medium text-[#668E73] mb-3">
          {t("calendar.availability")}
        </h3>
        <div className="flex flex-col md:flex-row md:space-x-4">
          <div className="w-full md:w-1/2">
            <CustomCalendar
              roomId={roomId}
              availableDates={availableDates}
              startDate={startDate}
              endDate={endDate}
              onDateSelect={handleDateSelect}
              hasSearched={hasSearched}
              key={`calendar-${roomId}-primary`}
            />
          </div>
          {showNextMonth && (
            <div className="w-full mt-4 md:w-1/2 md:mt-0">
              <CustomCalendar
                roomId={roomId}
                availableDates={availableDates}
                startDate={startDate}
                endDate={endDate}
                onDateSelect={handleDateSelect}
                hasSearched={hasSearched}
                key={`calendar-${roomId}-next`}
                initialMonth={nextMonth}
              />
            </div>
          )}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>{t("calendar.instructions")}</p>
        </div>
      </div>
    );
  }
);

// Add a displayName for better debugging
CalendarRoom.displayName = "CalendarRoom";

export default CalendarRoom;
