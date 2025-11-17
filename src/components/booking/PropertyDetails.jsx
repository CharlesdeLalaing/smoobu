import React, { useState, useCallback, useEffect } from "react";
import Slider from "react-slick";
import { useTranslation } from "react-i18next";
import { roomsData } from "../hooks/roomsData";
import { isRoomAvailable } from "../hooks/roomUtils";
import { PriceDetails } from "./PriceDetails";
import { CalendarRoom } from "./CustomRoom";
import { GuestSelect } from "./GuestSelect";
import { adultes, childrenOptions } from "../utils/constants";

import Fox from "../../assets/GlobalImg/fox.webp";

import Calendar from "../../assets/icons8-calendar-50.png";
import Group from "../../assets/icons8-group-48.png";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export const PropertyDetails = ({
  formData,
  startDate,
  endDate,
  priceDetails,
  selectedExtras,
  appliedCoupon,
  onRoomSelect,
  availableDates,
  loading,
  showOnlySelected = false,
  showOnlyUnselected = false,
  hasSearched,
  handleDateSelect,
  roomRefs,
  viewingRoomId,
  onGuestChange,
}) => {
  const { t } = useTranslation();
  const totalGuests =
    (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0);

  const scrollToContainer = useCallback(() => {
    setTimeout(() => {
      // Use a more specific selector or ref instead of getElementById
      const element = document.querySelector(
        '[data-scroll-target="main-container"]'
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, []);

  const sortRooms = (rooms) => {
    const customOrder = [2565753, 1946282, 1644643, 1946279, 1946276, 1946270];

    return [...rooms].sort((a, b) => {
      if (a.id === formData.apartmentId) return -1;
      if (b.id === formData.apartmentId) return 1;

      const indexA = customOrder.indexOf(a.id);
      const indexB = customOrder.indexOf(b.id);

      return indexA - indexB;
    });
  };

  // Use a single consistent array of rooms instead of splitting by availability
  const allRooms = Object.values(roomsData);
  const sortedRooms = sortRooms(allRooms);

  // Filter rooms based on selection criteria, not availability
  const filteredRooms = sortedRooms.filter((room) => {
    if (showOnlySelected && formData.apartmentId) {
      return room.id === formData.apartmentId;
    }

    if (showOnlyUnselected) {
      // Show room if it's being viewed but not actually selected/booked
      if (
        viewingRoomId &&
        room.id === viewingRoomId &&
        room.id !== formData.apartmentId
      ) {
        return true;
      }
      // Don't show selected rooms in unselected section
      return room.id !== formData.apartmentId;
    }

    return true;
  });

  const groupedRooms = Object.values(roomsData).reduce(
    (acc, room) => {
      // First check if room can accommodate the group size
      const canAccommodateGuests = totalGuests <= room.maxGuests;

      // Then check availability
      if (!canAccommodateGuests) {
        acc.unavailable.push({
          ...room,
          unavailableReason: "capacity",
        });
      } else if (
        isRoomAvailable(
          room.id,
          startDate,
          endDate,
          availableDates,
          hasSearched
        )
      ) {
        acc.available.push(room);
      } else {
        acc.unavailable.push({
          ...room,
          unavailableReason: "dates",
        });
      }
      return acc;
    },
    { available: [], unavailable: [] }
  );

  groupedRooms.available = sortRooms(groupedRooms.available);
  groupedRooms.unavailable = sortRooms(groupedRooms.unavailable);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  };

  const RoomCard = ({ room, isAvailable }) => {
    const [sliderRef, setSliderRef] = useState(null);
    const [activeTab, setActiveTab] = useState("priceDetails");
    const roomPriceDetails = priceDetails && priceDetails[room.id];
    const isOverCapacity = totalGuests > room.maxGuests;

    // SOLUTION: Use localStorage to remember calendar view for each room
    const getRoomCalendarKey = (roomId) => `room-calendar-view-${roomId}`;

    // Initialize with saved view or default to current date
    const [roomCalendarViewMonth, setRoomCalendarViewMonth] = useState(() => {
      try {
        const savedView = localStorage.getItem(getRoomCalendarKey(room.id));
        return savedView ? new Date(savedView) : new Date();
      } catch (e) {
        console.error("Error retrieving calendar view:", e);
        return new Date();
      }
    });

    // Save the view whenever it changes
    useEffect(() => {
      try {
        localStorage.setItem(
          getRoomCalendarKey(room.id),
          roomCalendarViewMonth.toISOString()
        );
      } catch (e) {
        console.error("Error saving calendar view:", e);
      }
    }, [roomCalendarViewMonth, room.id]);

    // Handler for calendar view changes
    const handleRoomCalendarViewChange = useCallback((newViewMonth) => {
      setRoomCalendarViewMonth(newViewMonth);
    }, []);

    // Use useCallback to prevent recreation of this function on every render
    const handleCalendarDateSelect = useCallback(
      (date, isStart) => {
        if (handleDateSelect) {
          // Pass the date and isStart flag but NOT the view month
          // This prevents interference with the parent's view state
          handleDateSelect(date, isStart);
        }
      },
      [handleDateSelect]
    );

    const getCapacityMessage = () => {
      if (isOverCapacity) {
        return (
          <div className="p-4 mb-4 border border-red-200 rounded-md bg-red-50">
            <p className="font-medium text-red-600">
              {t("propertyDetails.capacityExceeded.title")}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {t("propertyDetails.capacityExceeded.message", {
                maxGuests: room.maxGuests,
                selectedGuests: totalGuests,
              })}
            </p>
          </div>
        );
      }
      return null;
    };

    const getGuestFeeInfo = () => {
      if (!roomPriceDetails?.settings) return null;

      const settings = roomPriceDetails.settings;
      const extraGuests = Math.max(0, totalGuests - settings.startingAtGuest);

      if (extraGuests > 0) {
        return (
          <div className="mt-2 text-sm text-gray-600">
            {t("propertyDetails.extraGuestFee", {
              count: extraGuests,
              fee: settings.extraGuestsPerNight,
              threshold: settings.startingAtGuest,
            })}
          </div>
        );
      }
      return null;
    };

    const sliderSettings = {
      dots: false,
      infinite: true,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
      asNavFor: sliderRef,
    };

    const thumbnailSettings = {
      slidesToShow: 3,
      slidesToScroll: 1,
      focusOnSelect: true,
      infinite: false,
      asNavFor: sliderRef,
    };

    return (
      <div
        id={`room-${room.id}`}
        ref={(el) => {
          if (roomRefs && roomRefs.current) {
            roomRefs.current[room.id] = el;
          }
        }}
        className={`py-8 ${
          formData.apartmentId === room.id
            ? "border border-[#668E73] p-4 rounded "
            : viewingRoomId === room.id
            ? "border border-gray-300 p-4 rounded "
            : ""
        } ${
          formData.apartmentId === room.id && showOnlySelected
            ? "h-fit sm:h-[calc(100vh-100px)] overflow-y-auto "
            : "h-fit "
        }`}
      >
        {getCapacityMessage()}

        {startDate &&
          endDate &&
          !isAvailable &&
          room.unavailableReason === "dates" && (
            <div className="p-4 mb-4 border border-red-200 rounded-md bg-red-50">
              <p className="font-medium text-red-600">
                {t("propertyDetails.roomUnavailable.title")}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {t("propertyDetails.roomUnavailable.message")}
              </p>
            </div>
          )}

        {formData.apartmentId === room.id ? (
          <div className="flex flex-col h-full">
            <div className="flex justify-around mb-4 border-b border-grey-300">
              <button
                type="button"
                className={`py-2 px-4 ${
                  activeTab === "priceDetails"
                    ? "text-[#668E73] border-b-2 border-[#668E73]"
                    : ""
                }`}
                onClick={() => setActiveTab("priceDetails")}
              >
                {t("propertyDetails.tabs.bookingDetails")}
              </button>
              <button
                type="button"
                className={`py-2 px-4 ${
                  activeTab === "roomInfo"
                    ? "text-[#668E73] border-b-2 border-[#668E73]"
                    : ""
                }`}
                onClick={() => setActiveTab("roomInfo")}
              >
                {t("propertyDetails.tabs.roomInfo")}
              </button>
            </div>

            <div className="flex-1 overflow-y-none">
              {activeTab === "roomInfo" && (
                <div className="flex flex-col h-full">
                  <Slider
                    {...sliderSettings}
                    ref={(slider) => setSliderRef(slider)}
                  >
                    {Object.values(room.images).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`${room.name} ${index + 1}`}
                        className="w-full h-[450px] sm:h-[350px] md:h-[350px] lg:h-[350px] xl:h-[350px] object-cover"
                      />
                    ))}
                  </Slider>

                  <div className="mt-4">
                    <Slider {...thumbnailSettings}>
                      {Object.values(room.images).map((image, index) => (
                        <div key={index} className="px-2">
                          <img
                            src={image}
                            alt={`${room.name} Thumbnail ${index + 1}`}
                            className="object-cover cursor-pointer h-[50px] w-full"
                          />
                        </div>
                      ))}
                    </Slider>
                  </div>

                  <div className="w-full mt-4 overflow-x-auto features-container font-cormorant">
                    <div className="flex w-full features-list">
                      {room.features.map((feature, index) => {
                        let translatedTitle = feature.value
                          ? Array.isArray(feature.value)
                            ? t(feature.title, {
                                value: feature.value[0],
                                value2: feature.value[1],
                              })
                            : t(feature.title, { value: feature.value })
                          : t(feature.title);

                        return (
                          <div
                            key={index}
                            className="feature-item flex flex-col items-center justify-center text-center p-3 bg-[#668E73] min-w-auto"
                          >
                            <img
                              src={feature.icon}
                              alt={translatedTitle}
                              className="w-6 h-6"
                              style={{
                                filter: "invert(100%)",
                              }}
                            />
                            <span className="mt-2 text-sm text-white whitespace-nowrap">
                              {translatedTitle}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "priceDetails" && roomPriceDetails && (
                <div className="relative h-full overflow-y-auto sm:overflow-visible md:overflow-y-auto">
                  <div className="absolute top-[20px] left-[250px] sm:top-[20px] sm:left-[250px] md:top-[40px] md:left-[450px] lg:top-[30px] lg:left-[220px] xl:top-[40px] xl:left-[450px]">
                    <img
                      src={Fox}
                      alt="Squirrel"
                      className="w-24 h-auto md:w-32 lg:w-40"
                    />
                  </div>
                  <div className="my-5">
                    <p className="text-lg sm:text-base md:text-lg font-montserrat text-[#D3B574]">
                      {t(room.type)}
                    </p>
                    <h2 className="text-lg sm:text-base md:text-[25px] font-medium uppercase sm:mb-2 md:mb-10 sm:my-3 md:my-4 font-cormorant">
                      {t(room.nameKey)}
                    </h2>
                  </div>
                  {showOnlySelected && onGuestChange ? (
                    <div className="mb-8 sm:mb-4 md:mb-4 mt-2 sm:mt-2 md:mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <GuestSelect
                          label={t("search.adults")}
                          name="adults"
                          value={formData.adults}
                          options={adultes}
                          onChange={onGuestChange}
                        />
                        <GuestSelect
                          label={t("search.children")}
                          name="children"
                          value={formData.children}
                          options={childrenOptions}
                          onChange={onGuestChange}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-left sm:mb-2 md:mb-4 sm:mt-2 md:mt-4 sm:my-3 md:my-4">
                      <img
                        src={Group}
                        alt="Profile Icon"
                        className="w-6 h-6 mr-4 sm:w-4 sm:h-4 md:w-5 md:h-5"
                      />
                      <span className="text-[18px] sm:text-sm md:text-base font-light text-black">
                        {totalGuests}{" "}
                        {totalGuests > 1
                          ? t("propertyDetails.guests.plural")
                          : t("propertyDetails.guests.singular")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-left sm:mb-2 md:mb-10 sm:mt-2 md:mt-4 sm:my-3 md:my-4">
                    <img
                      src={Calendar}
                      alt="Calendar Icon"
                      className="w-6 h-6 mr-4 sm:w-4 sm:h-4 md:w-5 md:h-5"
                    />
                    <div className="flex items-center text-[18px] sm:text-sm md:text-base font-light text-black">
                      {startDate && <span>{formatDate(startDate)}</span>}
                      {(startDate || endDate) && (
                        <span className="mx-2 sm:mx-1 md:mx-1.5">→</span>
                      )}
                      {endDate && <span>{formatDate(endDate)}</span>}
                    </div>
                  </div>

                  {getGuestFeeInfo()}

                  <PriceDetails
                    priceDetails={roomPriceDetails}
                    selectedExtras={selectedExtras}
                    appliedCoupon={appliedCoupon}
                    formData={formData}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col xl:flex-row gap-10 w-[94%] mx-auto">
            <div className="w-full xl:w-2/5">
              <Slider
                {...sliderSettings}
                ref={(slider) => setSliderRef(slider)}
              >
                {Object.values(room.images).map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt={`${room.name} ${index + 1}`}
                    className="w-full h-[400px] object-cover"
                  />
                ))}
              </Slider>

              <div className="mt-4">
                <Slider {...thumbnailSettings}>
                  {Object.values(room.images).map((image, index) => (
                    <div key={index} className="px-2">
                      <img
                        src={image}
                        alt={`${room.name} Thumbnail ${index + 1}`}
                        className="object-cover cursor-pointer h-[57px] w-full"
                      />
                    </div>
                  ))}
                </Slider>
              </div>

              <div className="w-full mt-4 overflow-x-auto features-container font-cormorant">
                <div className="flex w-full features-list">
                  {room.features.map((feature, index) => {
                    let translatedTitle = feature.value
                      ? Array.isArray(feature.value)
                        ? t(feature.title, {
                            value: feature.value[0],
                            value2: feature.value[1],
                          })
                        : t(feature.title, { value: feature.value })
                      : t(feature.title);

                    return (
                      <div
                        key={index}
                        className="feature-item flex flex-col items-center justify-center text-center p-3 bg-[#668E73] min-w-[auto]"
                      >
                        <img
                          src={feature.icon}
                          alt={translatedTitle}
                          className="w-6 h-6"
                          style={{
                            filter: "invert(100%)",
                          }}
                        />
                        <span className="mt-2 text-sm text-white whitespace-nowrap">
                          {translatedTitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="w-full xl:w-3/5">
              {/* Update CalendarRoom with view state props */}
              <CalendarRoom
                roomId={String(room.id)}
                availableDates={availableDates}
                startDate={startDate}
                endDate={endDate}
                onDateSelect={handleCalendarDateSelect}
                hasSearched={hasSearched}
                controlledViewMonth={roomCalendarViewMonth}
                onViewMonthChange={handleRoomCalendarViewChange}
              />

              <p className="my-4 text-gray-600 font-cormorant">
                {t(room.description)}
              </p>
              {getGuestFeeInfo()}
              <button
                type="button"
                onClick={() => {
                  if (hasSearched && isAvailable && !isOverCapacity) {
                    onRoomSelect(room.id);
                    scrollTo(10);
                  }
                }}
                disabled={!hasSearched || !isAvailable || isOverCapacity}
                className={`w-fit mt-5 py-2 px-5 rounded-full font-medium transition-colors ${
                  !hasSearched
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : isAvailable && !isOverCapacity
                    ? "bg-[#668E73] text-white hover:bg-opacity-90"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
              >
                {!hasSearched
                  ? t("propertyDetails.selectDatePrompt")
                  : isOverCapacity
                  ? t("propertyDetails.capacityExceeded.title")
                  : isAvailable
                  ? t("propertyDetails.selectRoom")
                  : t("propertyDetails.unavailableForDates")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 bg-[#fbfdfb]">
      {filteredRooms.length > 0 && (
        <div>
          {!showOnlySelected && !showOnlyUnselected && (
            <h2 className="text-xl font-semibold text-[#668E73] mb-6">
              {t("rooms.allRooms")}
            </h2>
          )}
          <div className="grid grid-cols-1 gap-20 w-[100%] mx-auto relative">
            {filteredRooms.map((room) => {
              // Check availability here
              const isRoomAvailableForDates = isRoomAvailable(
                room.id,
                startDate,
                endDate,
                availableDates,
                hasSearched
              );

              // Check capacity
              const totalGuests =
                (parseInt(formData.adults) || 0) +
                (parseInt(formData.children) || 0);
              const canAccommodateGuests = totalGuests <= room.maxGuests;

              const isAvailable =
                canAccommodateGuests && isRoomAvailableForDates;

              // Set unavailable reason if needed
              let unavailableReason = null;
              if (!canAccommodateGuests) {
                unavailableReason = "capacity";
              } else if (!isRoomAvailableForDates) {
                unavailableReason = "dates";
              }

              // Add the unavailable reason to the room object
              const roomWithAvailability = {
                ...room,
                unavailableReason,
              };

              return (
                <div key={room.id} className="space-y-4">
                  {formData.apartmentId !== room.id && (
                    <div className="mb-4 text-left">
                      <h4 className="font-montserrat text-xl md:text-1xl lg:text-2xl mb-4 text-[#D3B574]">
                        {t(room.type)}
                      </h4>
                      <h3 className="font-cormorant text-3xl text-gray-800 mb-2 md:text-2xl lg:text-[40px] font-light">
                        {t(room.nameKey)}
                      </h3>
                    </div>
                  )}
                  <RoomCard
                    room={roomWithAvailability}
                    isAvailable={isAvailable}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center">
          <div className="text-[#668E73]">{t("propertyDetails.loading")}</div>
        </div>
      )}
    </div>
  );
};
