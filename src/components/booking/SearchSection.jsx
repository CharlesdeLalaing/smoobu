// SearchSection.jsx
import React, { useMemo } from "react";  // Add useMemo
import DatePicker from "react-datepicker";
import { Listbox } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import "./datepicker-custom.css";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import Bird from "../../assets/GlobalImg/bird.webp";

// Add this helper function at the top
const getMaxGuestsFromSettings = (discountSettings) => {
  // Get the maximum capacity from all rooms
  return Math.max(...Object.values(discountSettings).map(room => room.maxGuests));
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
  discountSettings,  // Add this prop
}) => {
  const { t } = useTranslation();

  // Calculate max guests using useMemo to prevent unnecessary recalculations
  const maxGuests = useMemo(() => getMaxGuestsFromSettings(discountSettings), [discountSettings]);
  
  // Calculate current guests
  const currentAdults = parseInt(formData.adults) || 0;
  const currentChildren = parseInt(formData.children) || 0;
  const totalGuests = currentAdults + currentChildren;

  // Generate options arrays
  const adultOptions = useMemo(() => {
    const options = [];
    const maxAdults = Math.min(maxGuests - currentChildren, 8); // Maximum 8 adults
    for (let i = 1; i <= maxAdults; i++) {
      options.push(i);
    }
    return options;
  }, [maxGuests, currentChildren]);

  const childrenOptions = useMemo(() => {
    const options = [0];
    const maxChildren = Math.min(maxGuests - currentAdults, 8); // Maximum 8 children
    for (let i = 1; i <= maxChildren; i++) {
      options.push(i);
    }
    return options;
  }, [maxGuests, currentAdults]);

  const handleGuestChange = (value, type) => {
    const otherType = type === 'adults' ? 'children' : 'adults';
    const otherValue = parseInt(formData[otherType]) || 0;
    
    // Calculate new total
    const newTotal = parseInt(value) + otherValue;
    
    if (newTotal > maxGuests) {
      // Adjust other value to not exceed max
      const adjustedOtherValue = Math.max(0, maxGuests - parseInt(value));
      handleChange({ target: { name: otherType, value: adjustedOtherValue } });
    }
    
    // Update selected value
    handleChange({ target: { name: type, value } });
    resetAvailability();
  };

  return (
    <div className="relative w-4/5 mx-auto text-center md:w-full lg:w-4/5 font-montserrat bg-[#668E73] px-0 py-[60px] md:px-5">
      {/* Bird image */}
      <div className="absolute top-[65px] left-[-50px] sm:top-[70px] sm:left-[-30px] xs:left-[-50px] md:top-8 md:left-[-20px] lg:top-4 lg:left-[-50px]">
        <img src={Bird} alt="Bird" className="w-24 h-auto md:w-32 lg:w-40" />
      </div>

      <h1 className="mb-8 text-[25px] sm:text-[30px] md:font-3xl font-light text-white font-cormorant">
        {t("search.title")}
      </h1>

      <div className="p-6 mx-auto bg-[#fbfdfb] rounded-lg shadow">
        <div className="grid items-end grid-cols-1 gap-4 md:grid-cols-5">
          {/* Date pickers remain the same */}
          
          {/* Adults Selection */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              {t("search.adults")}
            </label>
            <Listbox
              value={formData.adults}
              onChange={(value) => handleGuestChange(value, 'adults')}
            >
              <div className="relative">
                <Listbox.Button className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2">
                  <span className="flex items-center">
                    <span className="block ml-3 truncate">
                      {formData.adults || t("search.select")}
                    </span>
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon className="text-gray-400 size-5" />
                  </span>
                </Listbox.Button>

                <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-[#fbfdfb] rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
                  {adultOptions.map((num) => (
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
                        <CheckIcon className="size-5" />
                      </span>
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>

          {/* Children Selection */}
          <div className="md:col-span-1">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              {t("search.children")}
            </label>
            <Listbox
              value={formData.children}
              onChange={(value) => handleGuestChange(value, 'children')}
            >
              <div className="relative">
                <Listbox.Button className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2">
                  <span className="flex items-center">
                    <span className="block ml-3 truncate">
                      {formData.children || "0"}
                    </span>
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon className="text-gray-400 size-5" />
                  </span>
                </Listbox.Button>

                <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-[#fbfdfb] rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
                  {childrenOptions.map((num) => (
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
                        <CheckIcon className="size-5" />
                      </span>
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>

            {totalGuests > maxGuests && (
              <p className="mt-1 text-sm text-red-600">
                {t("search.maxGuestsExceeded", { max: maxGuests })}
              </p>
            )}
          </div>

          {/* Search button */}
          <div className="md:col-span-1">
            <button
              onClick={handleCheckAvailability}
              type="button"
              disabled={totalGuests > maxGuests}
              className="w-full p-2 h-12 bg-[#668E73] text-white rounded hover:bg-[#557963] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {t("search.search")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};