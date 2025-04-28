import { formatDate } from "../../utils/dateUtils";
import { isDateCheckinOnly, isRoomAvailable } from "../../hooks/roomUtils";

export class AvailabilityService {
  constructor(roomId, availableDates) {
    this.roomId = roomId;
    this.availableDates = availableDates || {};
  }

  getAvailabilityData() {
    return this.availableDates;
  }

  getPriceForDate(date) {
    if (!this.roomId || !date) return null; // Basic validation

    const availabilityData = this.getAvailabilityData();
    if (!availabilityData || !availabilityData[this.roomId]) return null;

    const dateStr = formatDate(date);
    const roomData = availabilityData[this.roomId];

    // Check if data exists for this date and has a price property
    if (
      roomData &&
      roomData[dateStr] &&
      typeof roomData[dateStr].price === "number"
    ) {
      return roomData[dateStr].price;
    }

    return null; // Return null if no price found
  }

  isSmoobuCheckoutDay(date) {
    if (!this.roomId) return false;

    const availabilityData = this.getAvailabilityData();
    if (!availabilityData || !availabilityData[this.roomId]) return false;

    const dateStr = formatDate(date);
    const roomData = availabilityData[this.roomId];

    // Don't process dates we have no data for
    if (!(dateStr in roomData)) return false;

    // Create a date for the previous day
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDateStr = formatDate(prevDay);

    // Check if the PREVIOUS day has the checkoutOnly flag
    // If so, THIS day should be displayed as a checkout day
    return roomData[prevDateStr] && roomData[prevDateStr].checkoutOnly === true;
  }

  isDateAvailable(date, startDate, endDate) {
    // Check if we have the necessary data
    const availabilityData = this.getAvailabilityData();
    if (!this.roomId || !availabilityData || !availabilityData[this.roomId]) {
      return true; // Default to available when no data
    }

    const dateStr = formatDate(date);
    const roomData = availabilityData[this.roomId];

    // If we don't have data for this specific date, consider it available
    if (!(dateStr in roomData)) {
      return true;
    }

    // IMPORTANT: If this date is being selected as a checkout date (end date),
    // we should consider it available
    if (startDate && !endDate) {
      // We are selecting an end date (checkout day)
      // If this date is right after the start date, consider it available for checkout
      const dayAfterStart = new Date(startDate);
      dayAfterStart.setDate(dayAfterStart.getDate() + 1);
      if (formatDate(dayAfterStart) === dateStr) {
        return true;
      }
    }

    // IMPORTANT: Checkout days should be considered available
    if (this.isSmoobuCheckoutDay(date)) {
      return true;
    }

    // Check if explicitly unavailable
    if (
      roomData[dateStr] &&
      roomData[dateStr].available !== undefined &&
      roomData[dateStr].available === 0
    ) {
      return false;
    }

    // Default to available
    return true;
  }

  isDatePartiallyAvailable(date) {
    return (
      this.isSmoobuCheckoutDay(date) ||
      isDateCheckinOnly(date, this.roomId, this.getAvailabilityData())
    );
  }

  isDateInRange(date, startDate, endDate) {
    if (!startDate || !endDate) return false;

    // Extract just the date parts (year, month, day)
    const current = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const start = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const end = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );

    // Compare using getTime() for accurate results
    return (
      current.getTime() > start.getTime() && current.getTime() < end.getTime()
    );
  }

  isDateInHoveredRange(date, startDate, hoveredDate, endDate) {
    if (!startDate || !hoveredDate || endDate) return false;

    const currentTime = date.getTime();
    const startTime = new Date(startDate).getTime();
    const hoverTime = hoveredDate.getTime();

    return (
      (currentTime > startTime && currentTime <= hoverTime) ||
      (currentTime < startTime && currentTime >= hoverTime)
    );
  }

  isDateClickable(date, startDate, endDate, hasSearched) {
    // Calculate tomorrow (today + 1 day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Don't allow selecting today or dates in the past
    // Only allow selecting tomorrow and future dates
    if (date < tomorrow) {
      return false;
    }

    // During initial render or before search, allow all future dates
    if (!hasSearched) {
      return true;
    }

    // For selecting a start date (or first date in a new selection)
    if (!startDate || (startDate && endDate)) {
      // Checkout-only dates cannot be used as start dates
      if (this.isSmoobuCheckoutDay(date)) {
        return false;
      }
      return this.isDateAvailable(date, startDate, endDate);
    }

    // For selecting an end date
    if (startDate && !endDate) {
      // If selecting a date before current start, handle as new start date
      if (date < startDate) {
        // Checkout-only dates cannot be used as start dates
        if (this.isSmoobuCheckoutDay(date)) {
          return false;
        }
        return this.isDateAvailable(date, startDate, endDate);
      }

      // If it's the day immediately after the start date, always allow it
      const dayAfterStart = new Date(startDate);
      dayAfterStart.setDate(dayAfterStart.getDate() + 1);
      if (formatDate(date) === formatDate(dayAfterStart)) {
        return true;
      }

      // For other dates, check if the range (excluding the end date) is available
      return isRoomAvailable(
        this.roomId,
        startDate,
        date,
        this.getAvailabilityData(),
        hasSearched
      );
    }

    return this.isDateAvailable(date, startDate, endDate);
  }
}
