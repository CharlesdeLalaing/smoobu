import { useTranslation } from 'react-i18next';

export const NavigationButtons = ({
  currentStep,
  prevStep,
  nextStep,
  isStepValid,
  loading,
  disabled = false
}) => {
  const { t } = useTranslation();

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
      <button
        type="button"
        onClick={nextStep}
        disabled={!isStepValid || loading || disabled}
        className={`px-4 py-2 text-white bg-[#668E73] rounded-full ml-auto
          ${(!isStepValid || loading || disabled) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'}`}
      >
        {currentStep === 3 ? t('navigation.buttons.confirm') : t('navigation.buttons.next')}
      </button>
    </div>
  );
};