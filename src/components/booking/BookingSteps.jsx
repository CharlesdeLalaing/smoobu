import React from "react";
import { useTranslation } from "react-i18next";

export const BookingSteps = ({
  currentStep,
  formData,
  selectedRoom,
  setCurrentStep,
}) => {
  const { t } = useTranslation();

  // Calculate total guests and check capacity
  const totalGuests =
    (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0);
  const isOverCapacity = selectedRoom && totalGuests > selectedRoom.maxGuests;

  // Determine the step label using translations
  const stepLabel =
    currentStep === 1
      ? t("booking.steps.extras")
      : currentStep === 2
      ? t("booking.steps.notes")
      : t("booking.steps.contact");

  // If over capacity, force back to step 1
  React.useEffect(() => {
    if (isOverCapacity && currentStep > 1) {
      setCurrentStep(1);
    }
  }, [isOverCapacity, currentStep, setCurrentStep]);

  return (
    <div className="flex items-center justify-between mb-4 text-center">
      {/* Progress bar */}
      <div className="w-3/5 h-2 bg-gray-300 rounded md:w-3/5 lg:w-4/5">
        <div
          className={`h-2 rounded ${
            currentStep === 1 ? "w-1/3" : currentStep === 2 ? "w-2/3" : "w-full"
          } ${isOverCapacity ? "bg-red-400" : "bg-[#668E73]"}`}
        ></div>
      </div>
      {/* Step label */}
      <span
        className={`w-2/5 md:w-2/5 lg:w-1/5 ml-2 text-md font-semibold ${
          isOverCapacity ? "text-red-600" : "text-[#668E73]"
        }`}
      >
        {stepLabel}
      </span>
    </div>
  );
};
