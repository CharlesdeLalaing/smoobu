import React, { useState } from "react";
import Slider from "react-slick";
import { useTranslation } from 'react-i18next';
import { roomsData } from "../hooks/roomsData";
import { isRoomAvailable } from "../hooks/roomUtils";
import { PriceDetails } from "./PriceDetails";
import { CalendarRoom } from "./CalendarRoom";

import Squirell from '../../assets/GlobalImg/squirrel.webp';
import Fox from '../../assets/GlobalImg/fox.webp';


import Calendar from "../../assets/icons8-calendar-50.png";
import Group from "../../assets/icons8-group-48.png";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export const PropertyDetails = ({
  formData,
  startDate,
  endDate,
  priceDetails,
  showPriceDetails,
  selectedExtras,
  appliedCoupon,
  onRoomSelect,
  availableDates,
  loading,
  showOnlySelected = false,
  showOnlyUnselected = false,
  hasSearched,
}) => {

  const { t } = useTranslation(); // Add this hook

  console.log("PropertyDetails render:", { 
    startDate, 
    endDate, 
    hasSearched, 
    hasAvailableDates: !!availableDates 
  });
  
  const scrollTo = () => {
    setTimeout(() => {
      const element = document.getElementById('main-container'); // Add this ID to your main container
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };


  const getUnavailableDatesMessage = (roomId) => {
    if (!availableDates || !availableDates[roomId] || !startDate || !endDate) return null;

    const unavailableDates = [];
    let currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);

    while (currentDate <= endDateTime) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayData = availableDates[roomId][dateStr];

      if (!dayData || dayData.available === 0) {
        unavailableDates.push(new Date(dateStr));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (unavailableDates.length > 0) {
      const formatDate = (date) =>
        date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

      return (
        <div className="p-3 mb-4 text-sm text-red-600 rounded-md bg-red-50">
          <span className="font-medium">{t('propertyDetails.unavailableDates')}</span>
          {unavailableDates.map(formatDate).join(", ")}
        </div>
      );
    }
    return null;
  };

  const sortRooms = (rooms) => {
    // Define the desired order of room IDs
    const customOrder = [1644643, 1946282, 1946279, 1946276, 1946270];
    
    return [...rooms].sort((a, b) => {
      // First priority: selected room
      if (a.id === formData.apartmentId) return -1;
      if (b.id === formData.apartmentId) return 1;
      
      // Second priority: custom order
      const indexA = customOrder.indexOf(a.id);
      const indexB = customOrder.indexOf(b.id);
      
      return indexA - indexB;
    });
  };

  const groupedRooms = Object.values(roomsData).reduce(
    (acc, room) => {
      if (isRoomAvailable(room.id, startDate, endDate, availableDates, hasSearched)) {
        acc.available.push(room);
      } else {
        acc.unavailable.push(room);
      }
      return acc;
    },
    { available: [], unavailable: [] }
  );

  groupedRooms.available = sortRooms(groupedRooms.available);
  groupedRooms.unavailable = sortRooms(groupedRooms.unavailable);

   // Modified filtering logic to prevent duplicate display
   const filteredAvailableRooms = (() => {
    if (showOnlySelected && formData.apartmentId) {
      const selectedRoom = [...groupedRooms.available, ...groupedRooms.unavailable]
        .find(room => room.id === formData.apartmentId);
      return selectedRoom ? [selectedRoom] : [];
    }

    if (showOnlyUnselected) {
      return groupedRooms.available.filter(room => room.id !== formData.apartmentId);
    }

    // For normal view, show only available rooms that are not selected
    return groupedRooms.available.filter(room => room.id !== formData.apartmentId);
  })();

  // Filter unavailable rooms to exclude selected room
  const filteredUnavailableRooms = groupedRooms.unavailable.filter(
    room => room.id !== formData.apartmentId
  );
  

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  };

  const RoomCard = ({ room, isAvailable }) => {

    const { t } = useTranslation(); // Add translation hook here too

    const roomPriceDetails = priceDetails && priceDetails[room.id];
    const [sliderRef, setSliderRef] = useState(null);
    const [activeTab, setActiveTab] = useState("priceDetails");
  
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
        className={`py-8 ${
          formData.apartmentId === room.id 
            ? 'border border-[#668E73] p-4 rounded ' 
            : ''
        } ${
          formData.apartmentId === room.id && showOnlySelected 
            ? 'h-fit sm:h-[calc(100vh-200px)] overflow-hidden ' 
            : 'h-fit '
        }`}
      >
        {/* {!isAvailable && getUnavailableDatesMessage(room.id)} */}

        {/* Always show unavailability message if dates are selected and room is not available */}
        {startDate && endDate && !isAvailable && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-600 font-medium">
              {t('propertyDetails.roomUnavailable.title')}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {t('propertyDetails.roomUnavailable.message')}
            </p>
          </div>
        )}
  
        {formData.apartmentId === room.id ? (
          <div className="flex flex-col h-full">
            <div className="flex justify-around border-b border-grey-300 mb-4 ">
            <button
              type="button"
              className={`py-2 px-4 ${
                activeTab === "priceDetails" ? "text-[#668E73] border-b-2 border-[#668E73]" : ""
              }`}
              onClick={() => setActiveTab("priceDetails")}
            >
              {t('propertyDetails.tabs.bookingDetails')}
            </button>
            <button
              type="button"
              className={`py-2 px-4 ${
                activeTab === "roomInfo" ? "text-[#668E73] border-b-2 border-[#668E73]" : ""
              }`}
              onClick={() => setActiveTab("roomInfo")}
            >
              {t('propertyDetails.tabs.roomInfo')}
            </button>
            </div>
  
            <div className="flex-1 overflow-y-none">
              {activeTab === "roomInfo" && (
                <div className="h-full">
                  <Slider {...sliderSettings} ref={(slider) => setSliderRef(slider)}>
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
      
                  <div className="features-container overflow-x-auto w-full mt-4 font-cormorant">
                    <div className="features-list flex">
                      {room.features.map((feature, index) => {
                        // Handle dynamic values for features like maxGuests
                        let translatedTitle = feature.value ? 
                        Array.isArray(feature.value) ?
                          t(feature.title, { value: feature.value[0], value2: feature.value[1] }) :
                          t(feature.title, { value: feature.value }) :
                        t(feature.title);

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
                                filter: "invert(100%)"
                              }}
                            />
                            <span className="text-sm mt-2 text-white whitespace-nowrap">
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
                <div className="h-full overflow-y-auto sm:overflow-visible md:overflow-y-auto relative">
                    {/* Squirrel Image */}
                  <div className="absolute top-[100px] left-[250px] sm:top-[100px] sm:left-[250px] md:top-[150px] md:left-[450px] lg:top-[120px] lg:left-[220px] xl:top-[100px] xl:left-[450px]">
                      <img 
                        src={Fox}
                        alt="Squirrel"
                        className="w-24 md:w-32 lg:w-40 h-auto"
                      />
                  </div>
                  <div className="my-5">
                  <p className="text-lg sm:text-base md:text-lg font-montserrat text-[#D3B574]">{t(room.type)}</p>
                  <h2 className="text-lg sm:text-base md:text-[25px] font-medium uppercase sm:mb-2 md:mb-10 sm:my-3 md:my-4 font-cormorant">{t(room.nameKey)}</h2>
                  </div>
                  <div className="flex items-center justify-left sm:mb-2 md:mb-4 sm:mt-2 md:mt-4 sm:my-3 md:my-4">
                    <img src={Group} alt="Profile Icon" className="w-6 h-6 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-4" />
                    <span className="text-[18px] sm:text-sm md:text-base font-light text-black">
                      {Number(formData.adults) + Number(formData.children)}{" "}
                      {Number(formData.adults) + Number(formData.children) > 1 
                        ? t('propertyDetails.guests.plural') 
                        : t('propertyDetails.guests.singular')}
                    </span>
                  </div>

                  <div className="flex items-center justify-left sm:mb-2 md:mb-10 sm:mt-2 md:mt-4 sm:my-3 md:my-4">
                    <img src={Calendar} alt="Calendar Icon" className="w-6 h-6 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-4" />
                    <div className="flex items-center text-[18px] sm:text-sm md:text-base font-light text-black">
                      {startDate && <span>{formatDate(startDate)}</span>}
                      {(startDate || endDate) && <span className="mx-2 sm:mx-1 md:mx-1.5">→</span>}
                      {endDate && <span>{formatDate(endDate)}</span>}
                    </div>
                  </div>
  
                  <PriceDetails
                    priceDetails={roomPriceDetails}
                    selectedExtras={selectedExtras}
                    appliedCoupon={appliedCoupon}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col xl:flex-row gap-10 w-[90%] mx-auto">
            <div className="w-full xl:w-2/5">
  
              <Slider {...sliderSettings} ref={(slider) => setSliderRef(slider)}>
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
  
              <div className="features-container overflow-x-auto w-full mt-4 font-cormorant">
                <div className="features-list flex">
                  {room.features.map((feature, index) => {
                    // Handle dynamic values for features like maxGuests
                    let translatedTitle = feature.value ? 
                    Array.isArray(feature.value) ?
                          t(feature.title, { value: feature.value[0], value2: feature.value[1] }) :
                          t(feature.title, { value: feature.value }) :
                        t(feature.title);

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
                            filter: "invert(100%)"
                          }}
                        />
                        <span className="text-sm mt-2 text-white whitespace-nowrap">
                          {translatedTitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
  
            <div className="w-full xl:w-3/5">  
              <CalendarRoom roomId={room.id} />
              <p className="text-gray-600 my-4 font-cormorant">{t(room.description)}</p>
              <button
                type="button"
                onClick={() => {
                  if (hasSearched && isAvailable) {
                    onRoomSelect(room.id);
                    scrollTo(10);
                  }
                }}
                disabled={!hasSearched || !isAvailable}
                className={`w-fit mt-5 py-2 px-5 rounded-full font-medium transition-colors ${
                  !hasSearched 
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : isAvailable
                      ? "bg-[#668E73] text-white hover:bg-opacity-90"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
              >
                {!hasSearched
                ? t('propertyDetails.selectDatePrompt')
                : isAvailable
                  ? t('propertyDetails.selectRoom')
                  : t('propertyDetails.unavailableForDates')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 bg-[#fbfdfb]">
      {filteredAvailableRooms.length > 0 && (
        <div>
          {!showOnlySelected && !showOnlyUnselected && (
            <h2 className="text-xl font-semibold text-[#668E73] mb-6">
              {t('rooms.availableRooms')}
            </h2>
          )}
          <div className="grid grid-cols-1 gap-20 w-[100%] mx-auto relative">
            {filteredAvailableRooms.map((room) => (
              <div key={room.id} className="space-y-4">
                {formData.apartmentId !== room.id && (
                  <div className="text-left mb-4">
                    <h4 className="font-montserrat text-xl md:text-1xl lg:text-2xl mb-4 text-[#D3B574]">
                    {t(room.type)}
                    </h4>
                    <h3 className="font-cormorant text-3xl text-gray-800 mb-2 md:text-2xl lg:text-[40px] font-light">
                    {t(room.nameKey)}
                    </h3>
                  </div>
                )}
                <RoomCard 
                  key={room.id} 
                  room={room} 
                  isAvailable={isRoomAvailable(room.id, startDate, endDate, availableDates, hasSearched)} 
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!showOnlySelected && filteredUnavailableRooms.length > 0 && (
        <div className="mt-0 py-10">
          <div className="grid grid-cols-1 gap-20 w-[100%] mx-auto relative">
            {filteredUnavailableRooms.map((room) => (
              <div key={room.id} className="space-y-4">
                <div className="text-left mb-4">
                  <h4 className="font-montserrat text-xl text-[#D3B574] md:text-xl lg:text-2xl mb-4">
                    {room.type}
                  </h4>
                  <h3 className="font-cormorant text-3xl text-gray-800 mb-2 md:text-2xl lg:text-[40px] font-light">
                    {room.name}
                  </h3>
                </div>
                <RoomCard room={room} isAvailable={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center">
          <div className="text-[#668E73]">{t('propertyDetails.loading')}</div>
        </div>
      )}
    </div>
  );
};