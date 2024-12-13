import React, { useState } from "react";
import { InputField } from "./InputField";

import LongBird from '../../assets/GlobalImg/long_bird.webp';


export const InfoSupSection = ({
  formData,
  handleChange,
  appliedCoupon,
  handleApplyCoupon,
}) => {
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState(null);

const onApplyCoupon = () => {
  console.log("Button clicked");
  console.log("Coupon value:", coupon);
  console.log("handleApplyCoupon exists:", !!handleApplyCoupon);
  if (handleApplyCoupon) {
    handleApplyCoupon(coupon);
    setCouponError(null);
  }
};
  return (
    <div className="w-full mt-6 space-y-8 relative">
      {/* Notes Section */}
      <div className="col-span-full">
        <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
          Laissez un message pour le propriétaire
          <textarea
            name="notice"
            value={formData.notice}
            onChange={handleChange}
            rows="3"
            placeholder="Laissez un message pour le propriétaire"
            className="mt-1 block w-full rounded border-[#668E73] border text-[16px] placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
          />
        </label>
      </div>

      {/* Coupon Section */}
      <div className="pt-4 pb-4 mt-6 mb-6 border-t border-b border-gray-200">
        <div className="flex items-end gap-4">
          <div className="flex-grow">
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              Code promo
              <input
                type="text"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Entrez votre code promo"
                className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
              />
            </label>
            {couponError && (
              <p className="mt-1 text-sm text-red-500">{couponError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onApplyCoupon}
            className="h-12 px-6 rounded shadow-sm text-[16px] font-medium text-white bg-[#668E73] hover:bg-opacity-90 focus:outline-none"
          >
            Appliquer
          </button>
        </div>
        {appliedCoupon && (
          <div className="mt-2 text-sm text-green-600">
            Code promo {appliedCoupon.code} appliqué : -{appliedCoupon.discount}
            €
          </div>
        )}
      </div>
      <div className="absolute top-[70px] left-[220px] sm:top-[70px] sm:left-[250px] md:top-[50px] md:left-[550px] lg:top-[50px] lg:left-[300px] xl:top-[230px] xl:left-[550px]">
                      <img 
                        src={LongBird}
                        alt="Squirrel"
                        className="w-24 md:w-32 lg:w-40 h-auto"
                      />
      </div>
      {/* Special Requests Section */}
    </div>
  );
};
