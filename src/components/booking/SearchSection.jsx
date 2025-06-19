// src/components/booking/SearchSection.jsx

import React from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { Listbox } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import "./datepicker-custom.css";
import { GuestSelect } from "./GuestSelect";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { adultes, childrenOptions } from "../utils/constants";
import Bird from "../../assets/GlobalImg/bird.webp";
import {
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
} from "@heroicons/react/20/solid";
import { isRoomAvailable } from "../hooks/roomUtils";

import { fr as frLocale } from "date-fns/locale/fr";
import { enUS as enUSLocale } from "date-fns/locale/en-US";
import { nl as nlLocale } from "date-fns/locale/nl";

try {
  registerLocale("fr", frLocale);
  registerLocale("en-US", enUSLocale);
  registerLocale("nl", nlLocale);
} catch (error) {
  console.warn(
    "react-datepicker locales might have been already registered:",
    error
  );
}

const getDatePickerLocaleObjectInternal = (langString) => {
  if (typeof langString !== "string") {
    return frLocale;
  }
  const baseLang = langString.split("-")[0].toLowerCase();
  switch (baseLang) {
    case "fr":
      return frLocale;
    case "en":
      return enUSLocale;
    case "nl":
      return nlLocale;
    default:
      return frLocale;
  }
};

export const SearchSection = ({
  formData,
  handleChange,
  startDate,
  endDate,
  handleDateSelect,
  handleCheckAvailability,
  dateError,
  resetAvailability,
  availableDates,
  hasSearched,
  calendarViewMonth,
  onCalendarViewChange,
}) => {
  const { t, i18n } = useTranslation();

  const handleSearch = (e) => {
    e.preventDefault();
    handleCheckAvailability();
  };

  const datePickerLocaleObject = React.useMemo(() => {
    const lang = i18n.language;
    return getDatePickerLocaleObjectInternal(lang);
  }, [i18n.language]);

  const handleDateChange = (date, isStart) => {
    handleDateSelect(date, isStart, null);
  };

  const getNextDay = (date) => {
    if (!date) return null;
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  };

  // --- MODIFICATION START ---
  // Create a 'tomorrow' variable to use as the minimum date.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); // Normalize to the start of the day
  // --- MODIFICATION END ---

  return (
    <div className="relative w-4/5 mx-auto text-center md:w-full lg:w-4/5 font-montserrat bg-[#668E73] px-0 py-[60px] md:px-5">
      <div className="absolute top-[65px] left-[-50px] sm:top-[70px] sm:left-[-30px] xs:left-[-50px] md:top-8 md:left-[-20px] lg:top-4 lg:left-[-50px]">
        <img
          src={Bird}
          alt="Squirrel"
          className="w-24 h-auto md:w-32 lg:w-40"
        />
      </div>
      <h1 className="mb-8 text-[25px] sm:text-[30px] md:font-3xl font-light text-white font-cormorant">
        {t("search.title")}
      </h1>

      <div className="p-6 mx-auto bg-[#fbfdfb] rounded-lg shadow">
        <div className="grid items-end grid-cols-1 gap-4 md:grid-cols-4">
          {/* Arrival */}
          <div className="w-full md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              {t("search.arrival")}
            </label>
            <DatePicker
              selected={startDate}
              onChange={(date) => handleDateChange(date, true)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              // --- MODIFICATION ---
              // The minimum selectable date is now tomorrow.
              minDate={tomorrow}
              maxDate={endDate}
              locale={datePickerLocaleObject}
              dateFormat="dd/MM/yyyy"
              placeholderText={t("search.selectDate")}
              className="w-full rounded border-[#668E73] border text-base placeholder:text-base md:text-[16px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2 pl-5"
              isClearable={true}
            />
          </div>

          {/* Departure */}
          <div className="w-full md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              {t("search.departure")}
            </label>
            <DatePicker
              selected={endDate}
              onChange={(date) => handleDateChange(date, false)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={getNextDay(startDate)}
              dateFormat="dd/MM/yyyy"
              placeholderText={t("search.selectDate")}
              className="w-full rounded border-[#668E73] border text-base placeholder:text-base md:text-[16px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2 pl-5"
              isClearable={true}
              disabled={!startDate}
            />
          </div>

          {/* Adults (original working code) */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              {t("search.adults")}
            </label>
            <Listbox
              value={formData.adults}
              onChange={(value) =>
                handleChange({ target: { name: "adults", value } })
              }
            >
              <div className="relative">
                <Listbox.Button
                  id="adults"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2"
                >
                  <span className="flex items-center">
                    <span className="block ml-3 truncate">
                      {formData.adults || "Select a number"}
                    </span>
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon
                      aria-hidden="true"
                      className="text-gray-400 size-5"
                    />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-[#fbfdfb] rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <Listbox.Option
                      key={num}
                      value={num}
                      className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-[#668E73] data-[focus]:text-white"
                    >
                      <div className="flex items-center">
                        <span className="ml-3 block truncate font-normal group-data-[selected]:font-semibold">
                          {num}
                        </span>
                      </div>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#668E73] group-data-[focus]:text-white [.group:not([data-selected])_&]:hidden">
                        <CheckIcon aria-hidden="true" className="size-5" />
                      </span>
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>

          {/* Children (original working code) */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              {t("search.children")}
            </label>
            <Listbox
              value={formData.children}
              onChange={(value) =>
                handleChange({ target: { name: "children", value } })
              }
            >
              <div className="relative">
                <Listbox.Button
                  id="adults" // Note: This ID is duplicated but reflects your original working code
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                >
                  <span className="flex items-center">
                    <span className="block ml-3 truncate">
                      {formData.children || "0"}
                    </span>
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon
                      aria-hidden="true"
                      className="text-gray-400 size-5"
                    />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <Listbox.Option
                      key={num}
                      value={num}
                      className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-[#668E73] data-[focus]:text-white"
                    >
                      <div className="flex items-center">
                        <span className="ml-3 block truncate font-normal group-data-[selected]:font-semibold">
                          {num}
                        </span>
                      </div>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#668E73] group-data-[focus]:text-white [.group:not([data-selected])_&]:hidden">
                        <CheckIcon aria-hidden="true" className="size-5" />
                      </span>
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>
        </div>
      </div>
    </div>
  );
};

// The RoomNavigation component is correct and does not need changes.
export const RoomNavigation = ({
  rooms,
  onRoomSelect,
  startDate,
  endDate,
  availableDates = {},
  hasSearched = false,
  selectedRoomId = null,
  formData = {},
}) => {
  const { t } = useTranslation();
  const totalGuests =
    (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0);
  const orderedRoomIds = [
    "2565753",
    "1946282",
    "1644643",
    "1946279",
    "1946276",
    "1946270",
  ];
  const roomIdToRoom = rooms.reduce((acc, room) => {
    acc[room.id] = room;
    return acc;
  }, {});
  const checkRoomCapacity = (room) => {
    if (!totalGuests) return true;
    return totalGuests <= room.maxGuests;
  };
  const getRoomAvailabilityStatus = (room) => {
    const hasCapacity = checkRoomCapacity(room);
    if (!hasCapacity) return "capacity";
    if (!hasSearched || !startDate || !endDate) return "unknown";
    if (
      isRoomAvailable(room.id, startDate, endDate, availableDates, hasSearched)
    )
      return "available";
    if (availableDates[room.id]) return "partial";
    return "unavailable";
  };
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-4 my-4 sm:my-8 pb-[40px] sm:pb-[60px] font-montserrat">
      {orderedRoomIds
        .filter((id) => roomIdToRoom[id])
        .map((id) => {
          const room = roomIdToRoom[id];
          const availabilityStatus = getRoomAvailabilityStatus(room);
          const isSelected = selectedRoomId === room.id;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onRoomSelect(room.id)}
              className={`relative px-3 sm:px-6 py-2 sm:py-4 mb-4 sm:mb-6 text-sm sm:text-base transition-all rounded-full border ${
                isSelected ? "border-2" : "border"
              } border-[#668E73] ${
                availabilityStatus === "unknown"
                  ? "bg-[#ffffff30] hover:bg-white hover:text-[#668E73] text-white"
                  : availabilityStatus === "available"
                  ? "bg-[#ffffff30] hover:bg-white hover:text-[#668E73] text-white"
                  : availabilityStatus === "partial"
                  ? "bg-[#f1d6aa] hover:bg-[#e9c88b] text-[#8b6d34] hover:text-[#6b542a]"
                  : availabilityStatus === "capacity"
                  ? "bg-[#f3e1e1] hover:bg-[#efd4d4] text-[#9c5151] hover:text-[#7e4141]"
                  : "bg-[#f3f4f6] text-gray-500 hover:bg-gray-200"
              } ${isSelected ? "ring-2 ring-[#668E73] ring-opacity-50" : ""}`}
              title={
                !hasSearched
                  ? t("room.selectDates")
                  : availabilityStatus === "available"
                  ? t("room.available")
                  : availabilityStatus === "partial"
                  ? t("room.partiallyAvailable")
                  : availabilityStatus === "capacity"
                  ? t("room.capacityExceeded", {
                      max: room.maxGuests,
                      current: totalGuests,
                    })
                  : t("room.unavailable")
              }
            >
              <div className="flex items-center">
                {hasSearched && availabilityStatus !== "unknown" && (
                  <>
                    {availabilityStatus === "available" ? (
                      <CheckCircleIcon className="w-5 h-5 mr-2 text-green-500" />
                    ) : availabilityStatus === "capacity" ? (
                      <UserIcon className="w-5 h-5 mr-2 text-red-500" />
                    ) : (
                      <XCircleIcon
                        className={`w-5 h-5 mr-2 ${
                          availabilityStatus === "partial"
                            ? "text-amber-600"
                            : "text-red-500"
                        }`}
                      />
                    )}
                  </>
                )}
                {t(room.nameKey)}
                {room.maxGuests && totalGuests > 0 && (
                  <span className="ml-2 text-xs">
                    ({room.maxGuests} {t("search.maxGuestsShort")})
                  </span>
                )}
                {isSelected && (
                  <span className="ml-2 text-xs font-bold">•</span>
                )}
              </div>
            </button>
          );
        })}
      <p id="main-container"></p>
    </div>
  );
};
