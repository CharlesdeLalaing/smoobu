import React from "react";
import { useTranslation } from 'react-i18next';
import { useTranslation } from 'react-i18next';
import { InputField } from "./InputField";
import { TimeSelect } from "./TimeSelect";
import { TermsCheckbox } from "./TermsCheckbox";

export const ContactSection = ({ formData, handleChange, setFormData }) => {

  const { t } = useTranslation();
  

  return (
    <div className="w-full mt-6 space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InputField
          label={t('contact.fields.firstName.label')}
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          placeholder={t('contact.fields.firstName.placeholder')}
          required
        />

        <InputField
          label={t('contact.fields.lastName.label')}
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          placeholder={t('contact.fields.lastName.placeholder')}
          required
        />

        <InputField
          label={t('contact.fields.email.label')}
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder={t('contact.fields.email.placeholder')}
          required
        />

        <InputField
          label={t('contact.fields.phone.label')}
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          placeholder={t('contact.fields.phone.placeholder')}
        />

        <InputField
          label={t('contact.fields.street.label')}
          name="street"
          value={formData.street}
          onChange={handleChange}
          placeholder={t('contact.fields.street.placeholder')}
        />

        <InputField
          label={t('contact.fields.postalCode.label')}
          name="postalCode"
          type="number"
          value={formData.postalCode}
          onChange={handleChange}
          placeholder={t('contact.fields.postalCode.placeholder')}
        />

        <InputField
          label={t('contact.fields.city.label')}
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder={t('contact.fields.city.placeholder')}
        />

        <InputField
          label={t('contact.fields.country.label')}
          name="country"
          value={formData.country}
          onChange={handleChange}
          placeholder={t('contact.fields.country.placeholder')}
        />

        <TimeSelect
          label={t('contact.fields.checkIn.label')}
          name="arrivalTime"
          value={formData.arrivalTime}
          onChange={handleChange}
        />
      </div>

      <div className="grid grid-cols-1">
        <TermsCheckbox
          checked={formData.conditions}
          onChange={(e) =>
            setFormData((prevData) => ({
              ...prevData,
              conditions: e.target.checked,
            }))
          }
        />
      </div>
    </div>
  );
};
