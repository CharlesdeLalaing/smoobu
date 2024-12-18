import { useTranslation } from 'react-i18next';

export const NavigationButtons = ({
  currentStep,
  prevStep,
  nextStep,
  isStepValid,
  loading,
  disabled = false,
  isSelectedRoomAvailable
}) => {
  const { t } = useTranslation();

  // Check if isSelectedRoomAvailable is defined and is a function
  const checkAvailability = () => {
    return typeof isSelectedRoomAvailable === 'function' ? isSelectedRoomAvailable() : true;
  };

  const baseButtonStyles = "px-4 py-2 rounded-full";
  const prevButtonStyles = `${baseButtonStyles} text-[#668E73] border border-[#668E73]
    ${(loading || disabled || !checkAvailability()) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#668E73] hover:text-white'}`;
  const nextButtonStyles = `${baseButtonStyles} text-white bg-[#668E73] ml-auto
    ${(!isStepValid || loading || disabled || !checkAvailability()) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'}`;

  return (
    <div className="flex justify-between">
      {currentStep > 1 && (
        <button
          type="button"
          onClick={prevStep}
          disabled={loading || disabled || !checkAvailability()}
          className={prevButtonStyles}
        >
          {t('navigation.buttons.previous')}
        </button>
      )}
      <button
        type={currentStep === 3 ? "submit" : "button"}
        onClick={currentStep === 3 ? undefined : nextStep}
        disabled={!isStepValid || loading || disabled || !checkAvailability()}
        className={nextButtonStyles}
      >
        {currentStep === 3 ? t('navigation.buttons.confirm') : t('navigation.buttons.next')}
      </button>
    </div>
  );
};

export default NavigationButtons;