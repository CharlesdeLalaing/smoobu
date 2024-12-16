export const NavigationButtons = ({
  currentStep,
  prevStep,
  nextStep,
  isStepValid,
  loading,
  disabled  // Add this new prop
}) => {
  const handleNext = () => {
    nextStep();
    // Only scroll on mobile devices (screen width less than 640px - Tailwind's sm breakpoint)
    if (window.innerWidth < 640) {
      const element = document.getElementById('extra_top');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="flex justify-between mt-6">
      {currentStep > 1 && (
        <button
          type="button"
          onClick={prevStep}
          disabled={disabled}  // Add this
          className={`px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Précédent
        </button>
      )}
      {currentStep < 3 && (
        <button
          type="button"
          onClick={handleNext}
          disabled={disabled}  // Add this
          className={`px-4 py-2 bg-[#668E73] text-white rounded hover:bg-opacity-90 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Suivant
        </button>
      )}
      {currentStep === 3 && (
        <button
          type="submit"
          disabled={!isStepValid() || disabled}  // Add disabled here too
          className={`px-4 py-2 ${
            isStepValid() && !disabled
              ? "bg-[#668E73] hover:bg-opacity-90"
              : "bg-gray-300 cursor-not-allowed"
          } text-white rounded ${
            disabled ? 'opacity-50' : ''
          }`}
        >
          {loading ? "En cours..." : "Passer au paiement"}
        </button>
      )}
    </div>
  );
};