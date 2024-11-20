export const BookingSteps = ({ currentStep }) => {
  if (currentStep === 0) {
    return null; // Do not render anything if currentStep is 0
  }

  return (
    <div className="flex items-center justify-between mb-4 text-center">
      {/* Progress Bar */}
      <div className="w-3/5 h-2 bg-gray-300 rounded md:w-3/5 lg:w-4/5">
        <div
          className={`h-2 rounded ${
            currentStep === 1 ? "w-1/3" : currentStep === 2 ? "w-2/3" : "w-full"
          } bg-[#668E73]`}
        ></div>
      </div>

      {/* Step Indicator */}
      <span className="w-2/5 md:w-2/5 lg:w-1/5 ml-2 text-sm text-[#668E73]">
        Étape {currentStep} sur 3
      </span>
    </div>
  );
};
