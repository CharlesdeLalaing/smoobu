export const NavigationButtons = ({
  currentStep,
  prevStep,
  nextStep,
  isStepValid,
  loading,
  disabled = false // Add this prop
}) => {
  return (
    <div className="flex justify-between">
      {currentStep > 1 && (
        <button
          type="button"
          onClick={prevStep}
          disabled={loading || disabled}
          className={`px-4 py-2 text-[#668E73] border border-[#668E73] rounded-full
            ${(loading || disabled) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#668E73] hover:text-white'}`}
        >
          Précédent
        </button>
      )}
      <button
        type="button"
        onClick={nextStep}
        disabled={!isStepValid || loading || disabled}
        className={`px-4 py-2 text-white bg-[#668E73] rounded-full ml-auto
          ${(!isStepValid || loading || disabled) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'}`}
      >
        {currentStep === 3 ? "Confirmer" : "Suivant"}
      </button>
    </div>
  );
};