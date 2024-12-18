import React from "react";
import { Listbox } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

const timeSlots = [
  { id: 1, hour: "17:00" },
  { id: 2, hour: "17:30" },
  { id: 3, hour: "18:00" },
  { id: 4, hour: "18:30" },
  { id: 5, hour: "19:00" },
  { id: 6, hour: "19:30" },
  { id: 7, hour: "20:00" },
  { id: 8, hour: "20:30" },
  { id: 9, hour: "21:00" },
  { id: 10, hour: "21:30" },
  { id: 11, hour: "22:00" },
];

export const TimeSelect = ({ label, name, value, onChange }) => {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
      >
        {label}
      </label>
      <Listbox
        value={value}
        onChange={(value) => onChange({ target: { name, value: value.hour } })}
      >
        <div className="relative">
          <Listbox.Button
            id={name}
            className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
          >
            <span className="flex items-center">
              <span className="block ml-3 truncate">
                {value || "Heure d'arrivée"}
              </span>
            </span>
            <span className="absolute inset-y-0 right-0 flex items-center pr-2 ml-3 pointer-events-none">
              <ChevronUpDownIcon className="text-gray-400 size-5" />
            </span>
          </Listbox.Button>

          <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
            {timeSlots.map((timeSlot) => (
              <Listbox.Option
                key={timeSlot.id}
                value={timeSlot}
                className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-[#668E73] data-[focus]:text-white"
              >
                <div className="flex items-center">
                  <span className="ml-3 block truncate font-normal group-data-[selected]:font-semibold">
                    {timeSlot.hour}
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
  );
};