import { useTranslation } from 'react-i18next';

export const NavigationButtons = ({
  currentStep,
  prevStep,
  nextStep,
  isStepValid,
  loading,
  disabled
}) => {

  const { t } = useTranslation();


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
    <div className="flex justify-between">
      {currentStep > 1 && (
        <button
          type="button"
          onClick={prevStep}
          disabled={loading || disabled}
          className={`px-4 py-2 text-[#668E73] border border-[#668E73] rounded-full
            ${(loading || disabled) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#668E73] hover:text-white'}`}
        >
          {t('navigation.buttons.previous')}
        </button>
      )}
      {currentStep < 3 && (
        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 bg-[#668E73] text-white rounded hover:bg-opacity-90"
        >
          {t('navigation.buttons.next')}
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
          {loading ? t('paymentForm.processing') : t('navigation.buttons.confirm')}
        </button>
      )}
    </div>
  );
};
