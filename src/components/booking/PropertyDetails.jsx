import React, { useState } from "react";
import Slider from "react-slick";
import { roomsData } from "../hooks/roomsData";
import { isRoomAvailable } from "../hooks/roomUtils";
import { PriceDetails } from "./PriceDetails";
import { CalendarRoom } from "./CalendarRoom";

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
          <span className="font-medium">Dates non disponibles : </span>
          {unavailableDates.map(formatDate).join(", ")}
        </div>
      );
    }
    return null;
  };

  const sortRooms = (rooms) => {
    return [...rooms].sort((a, b) => (a.id === formData.apartmentId ? -1 : 1));
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

  const filteredAvailableRooms = groupedRooms.available.filter(room => {
    if (showOnlySelected) {
      return room.id === formData.apartmentId;
    }
    if (showOnlyUnselected) {
      return room.id !== formData.apartmentId;
    }
    return true;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  };

  const RoomCard = ({ room, isAvailable }) => {
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
        className={`p-6 border rounded shadow-sm ${
          isAvailable ? "border-[#668E73]" : "border-gray-300"
        } ${formData.apartmentId === room.id && showOnlySelected ? 'h-[calc(100vh-200px)] overflow-hidden' : 'h-fit'}`}
      >
        {!isAvailable && getUnavailableDatesMessage(room.id)}

        {formData.apartmentId === room.id ? (
          <div className="flex flex-col h-full" id="main-container">
            <div className="flex justify-around border-b border-gray-300 mb-4">
              <button
                type="button"
                className={`py-2 px-4 ${
                  activeTab === "priceDetails" ? "text-[#668E73] border-b-2 border-[#668E73]" : ""
                }`}
                onClick={() => setActiveTab("priceDetails")}
              >
                Détails de la réservation
              </button>
              <button
                type="button"
                className={`py-2 px-4 ${
                  activeTab === "roomInfo" ? "text-[#668E73] border-b-2 border-[#668E73]" : ""
                }`}
                onClick={() => setActiveTab("roomInfo")}
              >
                Informations sur la chambre
              </button>
              {/* <button
                type="button"
                className={`py-2 px-4 ${
                  activeTab === "calendar" ? "text-[#668E73] border-b-2 border-[#668E73]" : ""
                }`}
                onClick={() => setActiveTab("calendar")}
              >
                Calendar
              </button> */}
            </div>

            <div className="flex-1 overflow-y-none">
            {activeTab === "roomInfo" && (
              <div className="h-full">
                <div className="h-[40vh] sm:h-auto md:h-[50vh]">
                  <Slider {...sliderSettings} ref={(slider) => setSliderRef(slider)}>
                    {Object.values(room.images).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`${room.name} ${index + 1}`}
                        className="w-full h-[270px] sm:h-[270px] md:h-[300px] lg:h-[300px] xl:h-[400px] object-cover"
                      />
                    ))}
                  </Slider>

                  <div className="mt-4 sm:mt-2 md:mt-3">
                    <Slider {...thumbnailSettings}>
                      {Object.values(room.images).map((image, index) => (
                        <div key={index} className="px-2 sm:px-1 md:px-1.5">
                          <img
                            src={image}
                            alt={`${room.name} Thumbnail ${index + 1}`}
                            className="object-cover cursor-pointer h-[50px] sm:h-[50px] md:h-[60px] lg:h-[60px] xl:h-[70px] w-full"
                          />
                        </div>
                      ))}
                    </Slider>
                  </div>

                  <div className="features-container overflow-x-auto w-full mt-4 sm:mt-2 md:mt-3">
                    <div className="features-list flex sm:flex-wrap md:flex-nowrap">
                      {room.features.map((feature, index) => (
                        <div
                          key={index}
                          className="feature-item flex flex-col items-center text-center p-4 sm:p-2 md:p-3 bg-[#668E73] "
                          style={{ minWidth: "100px", flex: "0 0 auto" }}
                        >
                          <img
                            src={feature.icon}
                            alt={feature.title}
                            style={{
                              height: "30px",
                              width: "30px",
                              filter: "invert(100%)",
                            }}
                            className="sm:h-5 sm:w-5 md:h-6 md:w-6"
                          />
                          <span className="text-sm mt-2 text-white sm:text-xs md:text-sm sm:mt-1 md:mt-1.5">{feature.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              )}

              {activeTab === "priceDetails" && roomPriceDetails && (
                <div className="h-full overflow-y-auto sm:overflow-visible md:overflow-y-auto">
                  <h2 className="text-lg sm:text-base md:text-lg font-medium uppercase sm:mb-2 md:mb-10 sm:mt-2 md:mt-10 sm:my-3 md:my-4 underline">{room.name}</h2>

                  <div className="flex items-center justify-between sm:mb-2 md:mb-4 sm:mt-2 md:mt-4 sm:my-3 md:my-4">
                    <img src={Group} alt="Profile Icon" className="w-6 h-6 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                    <span className="text-[18px] sm:text-sm md:text-base font-light text-black">
                      {Number(formData.adults) + Number(formData.children)}{" "}
                      {Number(formData.adults) + Number(formData.children) > 1 ? "personnes" : "personne"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:mb-2 md:mb-10 sm:mt-2 md:mt-4 sm:my-3 md:my-4">
                    <img src={Calendar} alt="Calendar Icon" className="w-6 h-6 sm:w-4 sm:h-4 md:w-5 md:h-5" />
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
              
              {/* {activeTab === "calendar" && (
                <div className="h-full overflow-y-auto">
                  <h2 className="text-lg font-medium mb-2">Calendar</h2>
                  <CalendarRoom 
                    roomId={room.id}
                    availableDates={availableDates}
                    selectedStartDate={startDate}
                    selectedEndDate={endDate}
                  />
                </div>
              )} */}
            </div>
          </div>
        ) : (
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="w-full xl:w-2/5">
              <h2 className="text-[18px] md:text-[23px] font-normal text-black mb-2">
                {room.name}
              </h2>
  
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
  
              <div className="features-container overflow-x-auto w-full mt-4">
                <div className="features-list flex">
                  {room.features.map((feature, index) => (
                    <div
                      key={index}
                      className="feature-item flex flex-col items-center text-center p-4 bg-[#668E73]"
                      style={{ minWidth: "100px", flex: "0 0 auto" }}
                    >
                      <img
                        src={feature.icon}
                        alt={feature.title}
                        style={{
                          height: "30px",
                          width: "30px",
                          filter: "invert(100%)",
                        }}
                      />
                      <span className="text-sm mt-2 text-white">{feature.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
  
            <div className="w-full xl:w-3/5">  
              <h2 className="text-[18px] md:text-[23px] font-normal text-black mb-2">
                Disponibilités
              </h2>
              <CalendarRoom 
                roomId={room.id}
                availableDates={availableDates}
                selectedStartDate={startDate}
                selectedEndDate={endDate}
              />
              <p className="text-gray-600 mb-4">{room.description}</p>
              <button
          type="button"
          onClick={() => {
            if (isAvailable) {
              onRoomSelect(room.id);
              scrollTo(10);
            }
          }}
          disabled={!isAvailable}
          className={`w-fit mt-5 py-2 px-5 rounded-full font-medium transition-colors ${
            isAvailable
              ? formData.apartmentId === room.id
                ? "bg-[#445E54] text-white"
                : "bg-[#668E73] text-white hover:bg-opacity-90"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
          }`}
        >
          {formData.apartmentId === room.id
            ? "Sélectionnée"
            : isAvailable
            ? "Sélectionner cette chambre"
            : "Chambre non disponible"}
        </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {filteredAvailableRooms.length > 0 && (
        <div>
          {!showOnlySelected && !showOnlyUnselected && (
            <h2 className="text-xl font-semibold text-[#668E73] mb-6">
              Chambres disponibles
            </h2>
          )}
          <div className="grid grid-cols-1 gap-8">
            {filteredAvailableRooms.map((room) => (
              <RoomCard key={room.id} room={room} isAvailable={true} />
            ))}
          </div>
        </div>
      )}

      {!showOnlySelected && groupedRooms.unavailable.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-6 text-xl font-semibold text-gray-500">
            Chambres non disponibles
          </h2>
          <div className="grid grid-cols-1 gap-8 w-[90%] mx-auto">
            {groupedRooms.unavailable.map((room) => (
              <RoomCard key={room.id} room={room} isAvailable={false} />
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center">
          <div className="text-[#668E73]">Chargement...</div>
        </div>
      )}
    </div>
  );
};