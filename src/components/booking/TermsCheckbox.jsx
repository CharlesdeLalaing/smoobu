import React from "react";
import { useTranslation } from 'react-i18next';

export const TermsCheckbox = ({ checked, onChange }) => {
  const { t } = useTranslation();

  return (
    <div>
      <label className="flex items-center text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="mr-2 rounded border-[#668E73] text-[#668E73] focus:ring-[#668E73]"
          required
        />
        <span>
          {t('terms.accept')}
          <a
            href="https://fermedebasseilles.be/conditions-generales/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#668E73] underline hover:text-[#445E54]"
          >
            {t('terms.generalConditions')}
          </a>
          .
        </span>
      </label>
      {!checked && (
        <p className="mt-1 text-sm text-red-500">
          {t('terms.required')}
        </p>
      )}
    </div>
  );
};