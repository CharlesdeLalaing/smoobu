import React from "react";
import DatePicker from "react-datepicker";
import { Listbox } from "@headlessui/react";
import { GuestSelect } from "./GuestSelect";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { adultes, childrenOptions } from "../utils/constants";

import Bird from '../../assets/GlobalImg/bird.webp';

export const SearchSection = ({
  formData,
  handleChange,
  startDate,
  endDate,
  handleDateSelect,
  handleCheckAvailability,
  dateError,
  resetAvailability
}) => {
  const handleSearch = (e) => {
    e.preventDefault(); // Prevent form refresh
    handleCheckAvailability();
  };

  const handleDateChange = (date, isStart) => {
    resetAvailability(); // Reset availability when dates change
    handleDateSelect(date, isStart);
  };


  return (
    <div
      className="w-4/5 md:w-full lg:w-4/5 m-auto text-center font-montserrat relative"
      style={{ backgroundColor: "#668E73", padding: "60px 20px" }}
    >
    {/* Squirrel Image */}
    <div className="absolute top-[65px] left-[-30px] sm:top-[70px] sm:left-[-30px] md:top-8 md:left-[-20px] lg:top-4 lg:left-[-50px]">
        <img 
          src={Bird}
          alt="Squirrel"
          className="w-24 md:w-32 lg:w-40 h-auto"
        />
      </div>
      {/* Title */}
      <h1 className="mb-8 text-[25px] sm:text-[30px] md:font-3xl font-light text-white font-cormorant">
        Sélectionnez vos dates
      </h1>

      {/* Search Form */}
      <div className="p-6 mx-auto bg-[#fbfdfb] rounded-lg shadow">
        <div className="grid items-end grid-cols-1 gap-4 md:grid-cols-5">
          {/* Arrival */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              Arrivée
            </label>
            <DatePicker
              selected={startDate}
              onChange={(date) => handleDateChange(date, true)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              minDate={new Date().setHours(24, 0, 0, 0)} // This forces tomorrow as minimum
              locale="fr"
              dateFormat="dd/MM/yyyy"
              placeholderText="Sélectionnez une date"
              className="mt-1 block w-full rounded bg-[#fbfdfb] border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black h-12 p-2"
              filterDate={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date > today;
              }}
              isClearable={true}
            />
          </div>

          {/* Departure */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              Départ
            </label>
            <DatePicker
              selected={endDate}
              onChange={(date) => handleDateChange(date, false)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate || new Date()}
              dateFormat="dd/MM/yyyy"
              placeholderText="Sélectionnez une date"
              className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2"
              isClearable={true}
              disabled={!startDate}
            />
          </div>

          {/* Adults */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              Adultes
            </label>
            {/* <select
              name="adults"
              value={formData.adults}
              onChange={handleChange}
              className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select> */}
            <Listbox
              value={formData.adults}
              onChange={(value) => handleChange({ target: { name: "adults", value } })}
            >
              <div className="relative">
                <Listbox.Button
                  id="adults"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2"
                >
                  <span className="flex items-center">
                    <span className="block ml-3 truncate">{formData.adults || "Select a number"}</span>
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon aria-hidden="true" className="text-gray-400 size-5" />
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

          {/* Children */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              Enfants
            </label>
            {/* <select
              name="children"
              value={formData.children}
              onChange={handleChange}
              className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select> */}
            <Listbox
              value={formData.children}
              onChange={(value) => handleChange({ target: { name: "children", value } })}
            >
              <div className="relative">
                <Listbox.Button
                  id="adults"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                >
                  <span className="flex items-center">
                    <span className="block ml-3 truncate">{formData.children || "0"}</span>
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon aria-hidden="true" className="text-gray-400 size-5" />
                  </span>
                </Listbox.Button>

                <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
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

          {/* Search Button */}
          <div className="md:col-span-1">
            <button
              onClick={handleCheckAvailability}
              type="button"
              className="w-full p-2 h-12 bg-[#668E73] text-white rounded hover:bg-[#557963] transition-colors"
            >
              Rechercher
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RoomNavigation = ({ rooms, onRoomSelect }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 my-8 pb-[60px] font-montserrat" id="main-container">
      {rooms.map((room) => (
        <button
          key={room.id}
          type="button"
          onClick={() => onRoomSelect(room.id)}
          className="px-6 py-4 mb-6 text-white transition-all rounded-full bg-[#ffffff30] hover:bg-white hover:text-[#668E73] border border-[#668E73]"
        >
          {room.name}
        </button>
      ))}
    </div>
  );
};