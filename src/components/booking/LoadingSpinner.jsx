import React from "react";
import { useTranslation } from 'react-i18next';

export const LoadingSpinner = () => {
  const { t } = useTranslation();
  
  return (
    <div className="flex items-center justify-center p-4 mb-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#668E73]"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 rounded-full bg-[#668E73] opacity-75"></div>
        </div>
      </div>
      <span className="ml-3 text-[#668E73] font-medium">{t('propertyDetails.loading')}</span>
    </div>
  );
};