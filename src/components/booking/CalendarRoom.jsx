import React, { useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { roomsData } from "../hooks/roomsData";

export const CalendarRoom = ({ roomId }) => {
  const { i18n } = useTranslation(); // Get current language
  const room = roomsData[roomId];
  
  // Get calendar ID based on current language
  const getCalendarId = () => {
    const baseId = room?.calendarData?.id?.replace(/[a-z]+$/, ''); // Remove language suffix if present
    return `${baseId}${i18n.language}`; // Append current language code
  };

  // Get calendar URL based on current language
  const getCalendarUrl = () => {
    const baseUrl = "https://login.smoobu.com";
    const calendarId = room?.calendarData?.id?.replace(/[a-z]+$/, ''); // Remove language suffix
    return `${baseUrl}/${i18n.language}/cockpit/widget/single-calendar/${calendarId}`;
  };
  
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
  }, [room, i18n.language]); // Add language dependency

  if (!room?.calendarData) {
    return null;
  }

  return (
    <div
      id={`smoobuApartment${getCalendarId()}`}
      className="calendarWidget overflow-scroll xl:overflow-hidden h-auto relative"
    >
      <div
        className="calendarContent"
        data-load-calendar-url={getCalendarUrl()}
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

          #smoobuApartment${getCalendarId()} {
            max-height: auto !important;
          }
        `}
      </style>
    </div>
  );
};