import React, { useEffect } from "react";
import { roomsData } from "../hooks/roomsData"; // Adjust the import path as needed

export const CalendarRoom = ({ roomId }) => {
  const room = roomsData[roomId];
  
  useEffect(() => {
    if (!room?.calendarData) return;

    // Dynamically load the script
    const script = document.createElement("script");
    script.src = "https://login.smoobu.com/js/Apartment/CalendarWidget.js";
    script.type = "text/javascript";
    script.async = true;

    // Append the script to the document
    document.body.appendChild(script);

    // Cleanup: Remove the script when the component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, [room]);

  if (!room?.calendarData) {
    return null;
  }

  return (
    <div
      id={`smoobuApartment${room.calendarData.id}`}
      className="calendarWidget overflow-scroll xl:overflow-hidden h-auto relative"
    >
      <div
        className="calendarContent"
        data-load-calendar-url={room.calendarData.url}
        data-verification={room.calendarData.verification}
        data-baseurl="https://login.smoobu.com"
        data-disable-css="false"
      ></div>
      <style>
        {`
          .multiCalendarWidget .logo {
            display: none !important;
          }

          @media screen and (max-width: 425px) {
            .multiCalendarWidget .fullCalendar.smallDevices:nth-of-type(1) {
              padding: 1rem 0;
            }
            .multiCalendarWidget .fullCalendar.smallDevices:nth-of-type(2) {
              display: none;
            }
          }

          .multiCalendarWidget .btn-prev.smallDevices {
            left: -20px !important;
          }

          .multiCalendarWidget .singleCalendarWidget table td {
            border: 1px solid #d1d5db !important;
            color: black;
          }

          .multiCalendarWidget .btn-next {
            right: -25px !important;
          }

          .multiCalendarWidget .btn-prev {
            left: -5px !important;
          }

          .header {
            margin-bottom: 1rem;
            justify-content: space-evenly;
          }

          #smoobuApartment${room.calendarData.id} {
            max-height: auto !important;
          }
        `}
      </style>
    </div>
  );
};