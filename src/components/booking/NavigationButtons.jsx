export const NavigationButtons = ({
  currentStep,
  prevStep,
  nextStep,
  isStepValid,
  loading,
}) => (
  <div className="flex justify-between mt-6">
    {currentStep > 1 && (
      <button
        type="button"
        onClick={prevStep}
        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
      >
        Précédent
      </button>
    )}
    {currentStep < 3 && (
      <button
        type="button"
        onClick={nextStep}
        className="px-4 py-2 bg-[#668E73] text-white rounded hover:bg-opacity-90"
      >
        Suivant
      </button>
    )}
    {currentStep === 3 && (
      <button
        type="submit"
        disabled={!isStepValid()}
        className={`px-4 py-2 ${
          isStepValid()
            ? "bg-[#668E73] hover:bg-opacity-90"
            : "bg-gray-300 cursor-not-allowed"
        } text-white rounded`}
      >
        {loading ? "En cours..." : "Passer au paiement"}
      </button>
    )}
  </div>
);
