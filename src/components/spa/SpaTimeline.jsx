// File: src/components/Admin/SpaTimeline.jsx
import React from "react";
import { format, startOfDay, isSameDay, isAfter, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  parseBookingDateTime, // Import utility for parsing times if needed
  getPropertyColor, // Import utility for styling
} from "./spaCalendarUtils"; // Import utilities (Corrected path)

/**
 * Component to render the detailed timeline view for the selected date.
 * @param {object} props
 * @param {Date} props.selectedDate - The date currently selected.
 * @param {Array<object>} props.selectedDateBookings - Scheduled bookings for the selected date (already filtered/sorted).
 * @param {object} props.spaSettings - Spa settings object (needed for timeline range and slot duration).
 * @param {(booking: object) => void} props.onScheduledBookingClick - Handler function when a booking block is clicked.
 * @param {boolean} props.actionLoading - State indicating if an action (save/delete) is in progress.
 */
const SpaTimeline = ({
  selectedDate,
  selectedDateBookings,
  spaSettings,
  onScheduledBookingClick,
  actionLoading,
}) => {
  // --- Timeline Calculation Logic (Moved here, uses props) ---
  const defaultSpaStartHourSetting = spaSettings?.startHour || 14; // Use settings from props
  const defaultSpaEndHourSetting = spaSettings?.endHour || 20; // Use settings from props

  let earliestBookingHour = 24;
  let latestBookingEndHourIndex = 0;

  // --- Declare selectedDateDay once at the top of the component for calculations ---
  // It's constant for the duration of the render based on selectedDate
  const selectedDateDay = selectedDate ? startOfDay(selectedDate) : null; // Declare here
  // --- End Correction ---

  // Exit early if selectedDate is null or invalid, though parent handles this
  if (!selectedDateDay) {
    console.warn("SpaTimeline: selectedDateDay is null or invalid.");
    return null; // Should not happen based on parent rendering condition
  }

  // Find earliest start time and latest end time (hour index) from scheduled bookings
  // Uses selectedDateBookings prop
  selectedDateBookings.forEach((booking) => {
    // selectedDateDay is now declared outside this loop, higher up.

    const startTime =
      booking.spaDateTimeObj || parseBookingDateTime(booking.spaDateTime); // Use parsed obj or re-parse
    const endTime =
      booking.spaEndDateTimeObj || parseBookingDateTime(booking.spaEndDateTime); // Use parsed obj or re-parse

    if (
      startTime &&
      !isNaN(startTime.getTime()) &&
      isSameDay(startOfDay(startTime), selectedDateDay) // Use the correctly declared variable
    ) {
      const startH = startTime.getHours();
      earliestBookingHour = Math.min(earliestBookingHour, startH);
    }

    // Calculate the hour index *covering* the end time (use ceil)
    if (endTime && !isNaN(endTime.getTime())) {
      const endTimeDay = startOfDay(endTime);
      // Calculate duration from start of selected day to end time, in hours
      const hoursDiff =
        (endTime.getTime() - selectedDateDay.getTime()) / (1000 * 60 * 60); // Use the correctly declared variable

      const endHour = endTime.getHours();
      const endMinute = endTime.getMinutes();
      const isNextDay = isAfter(endTimeDay, selectedDateDay); // Use the correctly declared variable

      let bookingEndHourIndex;
      if (isNextDay) {
        // If ends at 00:00 next day (hoursDiff=24), it ends *at* the 00:00 line, last relevant block is previous day's 23:00
        if (endHour === 0 && endMinute === 0) {
          bookingEndHourIndex = 23; // Index for 23:00 block (last hour block of the selected day)
        } else {
          // If ends at 00:MM (MM>0) or later next day, it ends in the next day's blocks.
          // hoursDiff is >= 24. floor(hoursDiff) gives the hour *on the next day*.
          bookingEndHourIndex = Math.floor(hoursDiff); // This is the hour index on the second day (24 for 00:xx, 25 for 01:xx etc.)
        }
      } else {
        // Same day. If ends at HH:00 (HH > 0), ends at the line, last relevant block is HH-1:00.
        if (endMinute === 0 && endHour > 0) {
          bookingEndHourIndex = endHour - 1;
        } else {
          // If ends at HH:MM (MM>0) or 00:MM, ends in the HH:00 block.
          bookingEndHourIndex = endHour;
        }
      }

      latestBookingEndHourIndex = Math.max(
        latestBookingEndHourIndex,
        bookingEndHourIndex
      );
    } else if (
      // Fallback if end time is missing but start time and duration/slots exist
      startTime &&
      !isNaN(startTime.getTime()) &&
      isSameDay(startOfDay(startTime), selectedDateDay) && // Use the correctly declared variable
      (booking.spaSlots?.length > 0 || booking.spaTreatmentDuration > 0)
    ) {
      const slotDurationMinutes = spaSettings?.slotDurationMinutes || 30;
      const defaultDurationMinutes =
        (booking.spaSlots?.length || 0) * slotDurationMinutes;
      const fallbackDuration =
        booking.spaTreatmentDuration &&
        typeof booking.spaTreatmentDuration === "number"
          ? booking.spaTreatmentDuration
          : 60;
      const durationMs =
        (defaultDurationMinutes > 0
          ? defaultDurationMinutes
          : fallbackDuration) * 60000;
      const assumedEndTime = new Date(startTime.getTime() + durationMs);

      const assumedHoursDiff =
        (assumedEndTime.getTime() - selectedDateDay.getTime()) /
        (1000 * 60 * 60); // Use the correctly declared variable

      // Calculate assumed end hour index using the same logic as real end time
      const assumedEndHour = assumedEndTime.getHours();
      const assumedEndMinute = assumedEndTime.getMinutes();
      const assumedEndTimeDay = startOfDay(assumedEndTime);
      const assumedIsNextDay = isAfter(assumedEndTimeDay, selectedDateDay); // Use the correctly declared variable

      let assumedBookingEndHourIndex;
      if (assumedIsNextDay) {
        if (assumedEndHour === 0 && assumedEndMinute === 0) {
          assumedBookingEndHourIndex = 23;
        } else {
          assumedBookingEndHourIndex = Math.floor(assumedHoursDiff);
        }
      } else {
        if (assumedEndMinute === 0 && assumedEndHour > 0) {
          assumedBookingEndHourIndex = assumedEndHour - 1;
        } else {
          assumedBookingEndHourIndex = assumedEndHour;
        }
      }

      latestBookingEndHourIndex = Math.max(
        latestBookingEndHourIndex,
        assumedBookingEndHourIndex
      );
    }
  });

  // Determine final timeline start hour: Use the default start hour setting, UNLESS any booking starts earlier.
  // Minimum display start hour is 6.
  const timelineStartHour = Math.max(
    6,
    earliestBookingHour === 24 // If no bookings were found with a valid start time on the selected day
      ? defaultSpaStartHourSetting // Use default start hour
      : Math.min(defaultSpaStartHourSetting, earliestBookingHour) // Otherwise, use min of default and earliest booking hour
  );

  // Determine final timeline end hour index: Use the maximum of the hour index covering the default end time
  // and the calculated latest booking end hour index. Add 1 to ensure the final hour segment is displayed.
  const defaultEndTimeStr = spaSettings?.endTime || "20:00"; // Use settings' endTime string
  // Create a Date object for the default end time on the selected date for comparison
  // This calculation is done once outside the booking loop
  const defaultEndTimeDate = parseBookingDateTime(
    format(selectedDate, "yyyy-MM-dd") + "T" + defaultEndTimeStr
  );

  let defaultLatestHourIndex = defaultSpaEndHourSetting; // Default to show hour block *up to* default end time

  if (defaultEndTimeDate && !isNaN(defaultEndTimeDate.getTime())) {
    // selectedDateDay is already declared at the top
    // Calculate hour index covering the default end time
    const defaultHoursDiff =
      (defaultEndTimeDate.getTime() - selectedDateDay.getTime()) /
      (1000 * 60 * 60);
    const defaultEndHour = defaultEndTimeDate.getHours();
    const defaultEndMinute = defaultEndTimeDate.getMinutes();
    const defaultEndTimeDay = startOfDay(defaultEndTimeDate);
    const defaultIsNextDay = isAfter(defaultEndTimeDay, selectedDateDay); // Use the correctly declared variable

    if (defaultIsNextDay) {
      // If ends at 00:00 next day (hoursDiff=24), index is 23.
      if (defaultEndHour === 0 && defaultEndMinute === 0) {
        defaultLatestHourIndex = 23;
      } else {
        // If ends at 00:MM (MM>0) or later next day, index is floor(hoursDiff)
        defaultLatestHourIndex = Math.floor(defaultHoursDiff);
      }
    } else {
      // Same day. If ends at HH:00 (HH > 0), index is HH-1.
      if (defaultEndMinute === 0 && defaultEndHour > 0) {
        defaultLatestHourIndex = defaultEndHour - 1;
      } else {
        // If ends at HH:MM (MM>0) or 00:MM, index is HH.
        defaultLatestHourIndex = defaultEndHour;
      }
    }
  }

  // The final hour index to display is the maximum of the calculated latest booking index and the default latest index.
  // We need to display up to this hour index *plus one* to show the space after the latest booking/default end.
  let finalTimelineDisplayEndHourIndex = Math.max(
    defaultLatestHourIndex,
    latestBookingEndHourIndex
  );

  // Add a safety check to ensure end index is not before start index + minimum required
  if (finalTimelineDisplayEndHourIndex < timelineStartHour) {
    console.warn(
      `SpaTimeline: Calculated end index (${finalTimelineDisplayEndHourIndex}) is before start index (${timelineStartHour}). Adjusting end index.`
    );
    // Set the end index to be at least the start index + 1, or some minimal range
    finalTimelineDisplayEndHourIndex = timelineStartHour + 1; // Ensure at least one hour block is shown
  }

  const hoursToDisplay = Array.from(
    {
      length: Math.max(
        0, // Ensure length is not negative
        finalTimelineDisplayEndHourIndex - timelineStartHour + 1
      ),
    }, // +1 to include the final hour segment
    (_, i) => i + timelineStartHour
  );

  // Fallback for very specific edge cases where calculation might yield empty hours but bookings exist
  // This fallback might be less necessary with the safety check above, but keeps the original logic.
  // Only apply if hoursToDisplay is still empty but bookings exist.
  if (hoursToDisplay.length === 0 && selectedDateBookings.length > 0) {
    console.warn(
      "Timeline hours calculation resulted in empty range but bookings exist. Falling back to default range."
    );
    const fallbackStart = spaSettings?.startHour || 14; // Use settings fallback
    const fallbackEnd = spaSettings?.endHour || 20; // Use settings fallback
    // Show hours from fallbackStart up to fallbackEnd hour (inclusive)
    const fallbackHours = Array.from(
      { length: Math.max(1, fallbackEnd - fallbackStart + 1) },
      (_, i) => i + fallbackStart
    );
    hoursToDisplay.push(...fallbackHours);
    hoursToDisplay.sort((a, b) => a - b); // Ensure sorted
  }

  // Final check before rendering
  if (hoursToDisplay.length === 0) {

    return null; // Render nothing if no hours could be calculated
  }

  console.log("Timeline Calculation Results:", {
    selectedDate: format(selectedDate, "yyyy-MM-dd"),
    spaSettings,
    earliestBookingHour,
    latestBookingEndHourIndex,
    defaultEndTimeStr,
    defaultEndTimeDate: defaultEndTimeDate
      ? format(defaultEndTimeDate, "HH:mm")
      : "Invalid",
    defaultLatestHourIndex,
    timelineStartHour,
    finalTimelineDisplayEndHourIndex,
    hoursToDisplay: hoursToDisplay.join(", "),
  });

  return (
    <div className="p-4 mt-4 bg-white border rounded">
      <h3 className="mb-4 text-lg font-semibold">
        Agenda détaillé du {format(selectedDate, "EEEE d MMMM", { locale: fr })}
      </h3>

      <div className="sticky top-0 z-10 flex bg-white border-b">
        <div className="flex-shrink-0 w-24 px-2 py-1 text-sm font-medium">
          Heure
        </div>
        <div className="flex-1 px-2 py-1 text-sm font-medium">Réservations</div>
      </div>

      <div className="divide-y">
        {hoursToDisplay.map((hour) => {
          const displayHour = hour % 24;
          const formattedHour = `${
            displayHour < 10 ? "0" + displayHour : displayHour
          }:00`;

          // Create a Date object representing the start of this timeline hour for comparison
          const currentTimelineHourDate = new Date(selectedDate);
          const dayOffset = Math.floor(hour / 24);
          currentTimelineHourDate.setDate(
            currentTimelineHourDate.getDate() + dayOffset
          );
          currentTimelineHourDate.setHours(displayHour, 0, 0, 0);

          // Find bookings whose *start time* falls exactly at the beginning of this hour
          // AND on the correct timeline date/segment.
          // Uses selectedDateBookings prop
          const bookingsStartingAtThisHour = selectedDateBookings.filter(
            (booking) => {
              const startTime =
                booking.spaDateTimeObj ||
                parseBookingDateTime(booking.spaDateTime); // Use parsed obj or re-parse

              // Ensure start time is valid and on the correct calculated timeline date before comparing
              if (
                !startTime ||
                isNaN(startTime.getTime()) ||
                !isSameDay(
                  startOfDay(startTime), // Compare start of day
                  startOfDay(currentTimelineHourDate) // Compare against the timeline hour's start of day
                )
              )
                return false;

              // Check if the hour and minute match the start of the timeline hour block
              return (
                format(startTime, "HH:mm") ===
                format(currentTimelineHourDate, "HH:mm")
              ); // Compare formatted times
            }
          );

          return (
            <div
              key={`hour-${hour}`}
              className="flex min-h-[60px] relative" // Added relative, unique key. Assumes 60px approx per hour for height calculation
            >
              <div className="flex-shrink-0 w-24 px-2 py-2 text-sm font-medium text-gray-700 border-r border-gray-200">
                {formattedHour}
              </div>
              <div className="relative flex-1 py-1">
                {/* Show bookings that start at this hour */}
                {/* Uses selectedDateBookings prop */}
                {bookingsStartingAtThisHour.map((booking, index) => {
                  const colors = getPropertyColor(booking); // Use imported utility
                  const startTime =
                    booking.spaDateTimeObj ||
                    parseBookingDateTime(booking.spaDateTime); // Use parsed obj or re-parse
                  const endTime =
                    booking.spaEndDateTimeObj ||
                    parseBookingDateTime(booking.spaEndDateTime); // Use parsed obj or re-parse

                  // Calculate height based on duration (assuming 60px per hour = 1px per minute)
                  // Ensure valid times for calculation. If end time is missing/invalid, use default duration based on slots.
                  const slotDurationMinutes =
                    spaSettings?.slotDurationMinutes || 30; // Use settings from props
                  const defaultDurationMinutes =
                    (booking.spaSlots?.length || 0) * slotDurationMinutes; // Use 0 if no slots
                  const fallbackDuration =
                    booking.spaTreatmentDuration &&
                    typeof booking.spaTreatmentDuration === "number"
                      ? booking.spaTreatmentDuration
                      : 60; // Fallback to requested duration or 1 hour

                  let durationMs =
                    startTime &&
                    endTime &&
                    !isNaN(startTime.getTime()) &&
                    !isNaN(endTime.getTime())
                      ? endTime.getTime() - startTime.getTime() // Duration in milliseconds
                      : (defaultDurationMinutes > 0
                          ? defaultDurationMinutes
                          : fallbackDuration) * 60000; // Fallback duration

                  // Handle potential negative duration if end time is before start time (e.g., invalid data)
                  if (durationMs < 0) {
                    console.warn(
                      "Negative duration calculated for booking:",
                      booking.id,
                      startTime,
                      endTime,
                      "Using fallback duration."
                    );
                    // Fallback to requested duration or 1 hour
                    durationMs = fallbackDuration * 60000;
                  }

                  const heightPx = Math.max(20, durationMs / (1000 * 60)); // 1px per minute, min 20px
                  const startMinute =
                    startTime && !isNaN(startTime.getTime())
                      ? startTime.getMinutes()
                      : 0;
                  const topOffsetPx = startMinute; // 1px per minute offset

                  // Final check: ensure start time is valid and on the correct timeline hour segment
                  if (
                    !startTime ||
                    isNaN(startTime.getTime()) ||
                    !isSameDay(
                      startOfDay(startTime),
                      startOfDay(currentTimelineHourDate)
                    ) ||
                    format(startTime, "HH") !==
                      format(currentTimelineHourDate, "HH") // Check if it starts within the hour segment
                  ) {
                    // This check is somewhat redundant due to the filter above, but left as a safeguard.
                    console.warn(
                      "Skipping timeline block render due to invalid start time or wrong hour segment (internal check):",
                      booking.id,
                      booking.spaDateTime,
                      "Expected Hour:",
                      format(currentTimelineHourDate, "HH:mm"),
                      "Actual Time:",
                      startTime ? format(startTime, "yyyy-MM-dd HH:mm") : "N/A"
                    );
                    return null; // Don't render if start time is invalid or on the wrong day/hour segment
                  }

                  return (
                    // Make the block clickable. Using a div with button-like styles.
                    <div
                      key={`booking-${booking.id}-timeline-${index}`} // Unique key
                      onClick={() => onScheduledBookingClick(booking)} // Use passed handler
                      disabled={actionLoading} // Disable click during action
                      className={`absolute left-0 right-0 border rounded p-1 overflow-hidden cursor-pointer text-xxs
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   ${colors.bg} ${colors.text} ${colors.border}`} // Use imported utility colors, added disabled styles
                      style={{
                        top: `${topOffsetPx}px`, // Position based on minutes past the hour
                        height: `${heightPx}px`, // Height based on duration in minutes
                        zIndex: 10, // Ensure it's above the dashed line
                        margin: "0 4px", // Add horizontal margin
                        // If multiple bookings start at the same minute, they will stack.
                        // For better display, you might need logic here to adjust left/width based on overlaps.
                      }}
                      title={`SPA: ${
                        booking.guestName ||
                        `${booking.firstName} ${booking.lastName}`
                      }\n${startTime ? format(startTime, "HH:mm") : "N/A"} - ${
                        endTime ? format(endTime, "HH:mm") : "N/A"
                      }`} // Tooltip
                    >
                      {/* Display start and end time within the block */}
                      <div className="font-medium leading-tight text-xxs">
                        {startTime ? format(startTime, "HH:mm") : "N/A"} -{" "}
                        {endTime ? format(endTime, "HH:mm") : "N/A"}
                      </div>
                      {/* Display guest name and property */}
                      <div className="leading-tight text-xxs">
                        {booking.guestName ||
                          `${booking.firstName} ${booking.lastName}`}
                      </div>
                      <div className="leading-tight text-xxs">
                        {booking.property}
                      </div>
                    </div>
                  );
                })}
                {/* Visual marker/line for hours */}
                {/* This line is the background for the hour slot */}
                <div className="absolute top-0 left-0 w-full h-full border-l border-gray-200 border-dashed"></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpaTimeline;
