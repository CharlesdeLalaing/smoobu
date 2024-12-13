import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from 'lucide-react';

const SearchForm = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [formData, setFormData] = useState({
    adults: 1,
    children: 0
  });

  const handleDateChange = (date, isStart) => {
    if (isStart) {
      setStartDate(date);
      if (endDate && date > endDate) {
        setEndDate(null);
      }
    } else {
      setEndDate(date);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckAvailability = () => {
    // Add your availability check logic here
    console.log('Checking availability:', { startDate, endDate, ...formData });
  };

  return (
    <div className="p-6 mx-auto bg-[#fbfdfb] rounded-lg shadow">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Arrival */}
        <div className="w-full">
          <label className="block mb-1 text-sm font-medium text-gray-600">
            Arrivée
          </label>
          <DatePicker
            selected={startDate}
            onChange={(date) => handleDateChange(date, true)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            minDate={new Date().setHours(24, 0, 0, 0)}
            locale="fr"
            dateFormat="dd/MM/yyyy"
            placeholderText="Sélectionnez une date"
            className="w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2 pl-5"
            filterDate={(date) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return date > today;
            }}
            isClearable={true}
          />
        </div>

        {/* Departure */}
        <div className="w-full">
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
            className="w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2 pl-5"
            isClearable={true}
            disabled={!startDate}
          />
        </div>

        {/* Adults */}
        <div className="w-full">
          <label className="block mb-1 text-sm font-medium text-gray-600">
            Adultes
          </label>
          <Listbox
            value={formData.adults}
            onChange={(value) =>
              handleChange({ target: { name: "adults", value } })
            }
          >
            <div className="relative">
              <Listbox.Button className="w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2">
                <span className="flex items-center">
                  <span className="block ml-3 truncate">
                    {formData.adults || "Select a number"}
                  </span>
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronUpDownIcon className="text-gray-400 size-5" />
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
                      <CheckIcon className="size-5" />
                    </span>
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Children */}
        <div className="w-full">
          <label className="block mb-1 text-sm font-medium text-gray-600">
            Enfants
          </label>
          <Listbox
            value={formData.children}
            onChange={(value) =>
              handleChange({ target: { name: "children", value } })
            }
          >
            <div className="relative">
              <Listbox.Button className="w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-[#fbfdfb] h-12 p-2">
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
                      <CheckIcon className="size-5" />
                    </span>
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Search Button */}
        <div className="w-full">
          <label className="block mb-1 text-sm font-medium text-transparent">
            .
          </label>
          <button
            onClick={handleCheckAvailability}
            type="button"
            className="w-full h-12 bg-[#668E73] text-white rounded hover:bg-[#557963] transition-colors"
          >
            Rechercher
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchForm;