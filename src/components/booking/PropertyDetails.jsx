// components/booking/PropertyDetails.jsx
import React from 'react';
import { PriceDetails } from "./PriceDetails";

export const PropertyDetails = ({
 formData,
 startDate,
 endDate,
 priceDetails,
 showPriceDetails,
 selectedExtras,
 appliedCoupon
}) => {
 const formatDate = (date) => {
   const d = new Date(date);
   const day = d.getDate();
   const month = d.getMonth() + 1;
   const year = d.getFullYear().toString().slice(-2);
   return `${day}.${month}.${year}`;
 };

 return (
   <div className="w-full p-4 text-left border border-[#668E73] rounded md:w-1/3">
     <img
       src="https://images.unsplash.com/photo-1720293315632-37efe958d5ec"
       alt="Property"
       className="w-[100%] h-[250px] object-cover rounded-[0.3em] my-4"
     />
     <h2 className="text-[18px] md:text-[23px] font-normal text-black">
       Le dôme des libellules
     </h2>

     <div className="flex items-center justify-between mt-4">
       <img src="/icons/group.png" alt="Profile Icon" className="w-6 h-6" />
       <span className="text-[16px] font-light text-black">
         {Number(formData.adults) + Number(formData.children)}{" "}
         {Number(formData.adults) + Number(formData.children) > 1
           ? "personnes"
           : "personne"}
       </span>
     </div>

     <div className="flex items-center justify-between mt-2 mb-5">
       <img src="/icons/calendar.png" alt="Calendar Icon" className="w-6 h-6" />
       <div className="flex items-center text-[16px] font-light text-black">
         {startDate && <span>{formatDate(startDate)}</span>}
         {(startDate || endDate) && <span className="mx-2 text-black">→</span>}
         {endDate && <span>{formatDate(endDate)}</span>}
       </div>
     </div>

     <hr />
     {showPriceDetails && (
       <PriceDetails
         priceDetails={priceDetails}
         selectedExtras={selectedExtras}
         appliedCoupon={appliedCoupon}
       />
     )}
   </div>
 );
};