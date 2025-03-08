// import React, { useState } from "react";
// import { useTranslation } from 'react-i18next';
// import { InputField } from "./InputField";
// import LongBird from '../../assets/GlobalImg/long_bird.webp';

// export const InfoSupSection = ({
//   formData,
//   handleChange,
//   appliedCoupon,
//   handleApplyCoupon,
// }) => {
//   const { t } = useTranslation();
//   const [coupon, setCoupon] = useState("");
//   const [couponError, setCouponError] = useState(null);

//   const onApplyCoupon = async () => {
//     // Don't allow applying if there's already a coupon
//     if (appliedCoupon) {
//       return;
//     }

//     if (!coupon) {
//       setCouponError(t('booking.coupon.errors.enterCode'));
//       return;
//     }

//     try {
//       if (handleApplyCoupon) {
//         const result = await handleApplyCoupon(coupon);
        
//         if (result?.error) {
//           switch (result.error) {
//             case 'inactive':
//               setCouponError(t('booking.coupon.errors.inactive'));
//               break;
//             case 'expired':
//               setCouponError(t('booking.coupon.errors.expired'));
//               break;
//             case 'used':
//               setCouponError(t('booking.coupon.errors.alreadyUsed'));
//               break;
//             case 'not_found':
//               setCouponError(t('booking.coupon.errors.notFound'));
//               break;
//             case 'invalid_dates':
//               setCouponError(result.message || t('booking.coupon.errors.invalid'));
//               break;
//             default:
//               setCouponError(t('booking.coupon.errors.invalid'));
//           }
//         } else {
//           setCouponError(null);
//           // Clear the input field after successful application
//           setCoupon("");
//         }
//       }
//     } catch (error) {
//       setCouponError(t('booking.coupon.errors.invalid'));
//     }
//   };

//   return (
//     <div className="w-full mt-6 space-y-8 relative">
//       {/* Notes Section */}
//       <div className="col-span-full">
//         <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
//           {t('extras.infoSup.ownerMessage.label')}
//           <textarea
//             name="notice"
//             value={formData.notice}
//             onChange={handleChange}
//             rows="3"
//             placeholder={t('extras.infoSup.ownerMessage.placeholder')}
//             className="mt-1 block w-full rounded border-[#668E73] border text-[16px] placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
//           />
//         </label>
//       </div>

//       {/* Coupon Section */}
//       <div className="pt-4 pb-4 mt-6 mb-6 border-t border-b border-gray-200">
//         <div className="flex items-center gap-4">
//           <div className="flex-grow">
//             <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
//               {t('extras.infoSup.promoCode.label')}
//               <input
//                 type="text"
//                 value={coupon}
//                 onChange={(e) => {
//                   setCoupon(e.target.value);
//                   setCouponError(null);
//                 }}
//                 disabled={appliedCoupon !== null}
//                 placeholder={t('extras.infoSup.promoCode.placeholder')}
//                 className={`mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 ${
//                   couponError ? 'border-red-500' : ''
//                 } ${appliedCoupon ? 'bg-gray-100' : ''}`}
//               />
//             </label>
//             {couponError && (
//               <p className="mt-1 text-sm text-red-500">{couponError}</p>
//             )}
//           </div>
//           <button
//             type="button"
//             onClick={onApplyCoupon}
//             disabled={appliedCoupon !== null}
//             className={`h-12 px-6 rounded shadow-sm text-[16px] font-medium text-white ${
//               appliedCoupon 
//                 ? 'bg-gray-400 cursor-not-allowed' 
//                 : 'bg-[#668E73] hover:bg-opacity-90'
//             } focus:outline-none`}
//           >
//             {t('extras.infoSup.promoCode.button')}
//           </button>
//         </div>
//         {appliedCoupon && !couponError && (
//           <div className="mt-2">
//             <p className="text-sm text-green-600">
//               {t('extras.infoSup.promoCode.appliedStart')} {appliedCoupon.code} 
//               {appliedCoupon.type === 'percentage' 
//                 ? ` (${appliedCoupon.percentageValue}%) `
//                 : ' '}
//               {t('extras.infoSup.promoCode.appliedEnd')}: -{appliedCoupon.discount} {t('extras.infoSup.promoCode.appliedCurrency')}
//             </p>
//             <p className="mt-4 text-sm text-gray-500">{t('booking.coupon.minusZero')}</p>
//           </div>
//         )}
//       </div>
//       <div className="absolute top-[70px] left-[220px] sm:top-[70px] sm:left-[250px] md:top-[50px] md:left-[550px] lg:top-[50px] lg:left-[300px] xl:top-[230px] xl:left-[550px]">
//         <img 
//           src={LongBird}
//           alt="Long Bird"
//           className="w-24 md:w-32 lg:w-40 h-auto"
//         />
//       </div>
//     </div>
//   );
// };

// export default InfoSupSection;


import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import { InputField } from "./InputField";
import LongBird from '../../assets/GlobalImg/long_bird.webp';

export const InfoSupSection = ({
  formData,
  handleChange,
  appliedCoupon,
  handleApplyCoupon,
}) => {
  const { t } = useTranslation();
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState(null);

  const onApplyCoupon = async () => {
    // Don't allow applying if there's already a coupon
    if (appliedCoupon) {
      return;
    }

    if (!coupon) {
      setCouponError(t('booking.coupon.errors.enterCode'));
      return;
    }

    try {
      if (handleApplyCoupon) {
        const result = await handleApplyCoupon(coupon, formData.arrivalDate, formData.departureDate);
        
        if (result?.error) {
          switch (result.error) {
            case 'inactive':
              setCouponError(t('booking.coupon.errors.inactive'));
              break;
            case 'expired':
              setCouponError(t('booking.coupon.errors.expired'));
              break;
            case 'used':
              setCouponError(t('booking.coupon.errors.alreadyUsed'));
              break;
            case 'not_found':
              setCouponError(t('booking.coupon.errors.notFound'));
              break;
            case 'invalid_dates':
              setCouponError(result.message || t('booking.coupon.errors.invalid'));
              break;
            default:
              setCouponError(t('booking.coupon.errors.invalid'));
          }
        } else {
          setCouponError(null);
          // Clear the input field after successful application
          setCoupon("");
        }
      }
    } catch (error) {
      setCouponError(t('booking.coupon.errors.invalid'));
    }
  };

  return (
    <div className="w-full mt-6 space-y-8 relative">
      {/* Notes Section */}
      <div className="col-span-full">
        <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
          {t('extras.infoSup.ownerMessage.label')}
          <textarea
            name="notice"
            value={formData.notice}
            onChange={handleChange}
            rows="3"
            placeholder={t('extras.infoSup.ownerMessage.placeholder')}
            className="mt-1 block w-full rounded border-[#668E73] border text-[16px] placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
          />
        </label>
      </div>

      {/* Coupon Section */}
      <div className="pt-4 pb-4 mt-6 mb-6 border-t border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-grow">
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              {t('extras.infoSup.promoCode.label')}
              <input
                type="text"
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value);
                  setCouponError(null);
                }}
                disabled={appliedCoupon !== null}
                placeholder={t('extras.infoSup.promoCode.placeholder')}
                className={`mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 ${
                  couponError ? 'border-red-500' : ''
                } ${appliedCoupon ? 'bg-gray-100' : ''}`}
              />
            </label>
            {couponError && (
              <p className="mt-1 text-sm text-red-500">{couponError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onApplyCoupon}
            disabled={appliedCoupon !== null}
            className={`h-12 px-6 rounded shadow-sm text-[16px] font-medium text-white ${
              appliedCoupon 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-[#668E73] hover:bg-opacity-90'
            } focus:outline-none`}
          >
            {t('extras.infoSup.promoCode.button')}
          </button>
        </div>
        {appliedCoupon && !couponError && (
          <div className="mt-2">
            <p className="text-sm text-green-600">
              {t('extras.infoSup.promoCode.appliedStart')} {appliedCoupon.code} 
              {appliedCoupon.type === 'percentage' 
                ? ` (${appliedCoupon.percentageValue}%) `
                : ' '}
              {t('extras.infoSup.promoCode.appliedEnd')}: -{appliedCoupon.discount} {t('extras.infoSup.promoCode.appliedCurrency')}
            </p>
            <p className="mt-4 text-sm text-gray-500">{t('booking.coupon.minusZero')}</p>
          </div>
        )}
      </div>
      <div className="absolute top-[70px] left-[220px] sm:top-[70px] sm:left-[250px] md:top-[50px] md:left-[550px] lg:top-[50px] lg:left-[300px] xl:top-[230px] xl:left-[550px]">
        <img 
          src={LongBird}
          alt="Long Bird"
          className="w-24 md:w-32 lg:w-40 h-auto"
        />
      </div>
    </div>
  );
};

export default InfoSupSection;