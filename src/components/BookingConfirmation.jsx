import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from 'react-i18next';

import LocalStorageDebug from './LocalStorageDebug';

import logoBaseilles from "../assets/logoBaseilles.webp"
import "../assets/bookingConfirmation.css"

const BookingConfirmation = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const paymentIntent = searchParams.get("payment_intent");

  useEffect(() => {
    console.log('Payment Intent:', paymentIntent);
    const storedBookingData = localStorage.getItem("bookingData");
    console.log('Initial stored data:', storedBookingData);
    
    if (storedBookingData) {
      try {
        const parsedData = JSON.parse(storedBookingData);
        console.log('Parsed booking data:', parsedData);
        setBookingDetails(parsedData);
        setStatus("success");
        // Only remove after confirming the data is displayed
        if (parsedData) {
          localStorage.removeItem("bookingData");
        }
      } catch (error) {
        console.error("Error parsing booking data:", error);
        setStatus("error");
      }
    } else {
      if (paymentIntent) {
        console.log('No stored data, fetching from API...');
        fetchBookingDetails(paymentIntent);
      }
    }
  }, [paymentIntent]);

  const API_URL = "https://booking-9u8u.onrender.com/"

  const fetchBookingDetails = async (paymentIntentId) => {

    try {
      const response = await fetch(
        `${API_URL}/api/bookings/${paymentIntentId}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setBookingDetails(data);
      setStatus("success");
    } catch (error) {
      console.error("Error fetching booking details:", error);
      setStatus("error");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fr-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  if (status === "loading") {
    return (
      <div className="container">
        <div className="card">
          <h2>{t('bookingConfirmation.loading.title')}</h2>
          <p>{t('bookingConfirmation.loading.message')}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container">
        <div className="card">
          <h2>{t('bookingConfirmation.error.title')}</h2>
          <p>{t('bookingConfirmation.error.message')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
    style={{ minHeight: "100vh", minWidth: "100vw", display: "flex", alignItems: "center" }}
     className="container">
      <div className="card">
        {/* Success Header */}
        <div className="header">
        <div className="icon-container">
            <img src={logoBaseilles} alt="Logo Baseilles" className="icon" />
          </div>
          <div>
          <h1 className="title">{t('bookingConfirmation.success.title')}</h1>
            <p className="subtitle">
              {t('bookingConfirmation.success.subtitle', { email: bookingDetails?.email })}
              </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid">
          {/* Stay Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">{t('bookingConfirmation.success.sections.stayDetails.title')}</h2>
            <p>{t('bookingConfirmation.success.sections.stayDetails.checkIn', { date: formatDate(bookingDetails?.arrivalDate) })}</p>
            <p>{t('bookingConfirmation.success.sections.stayDetails.arrivalTime', { time: bookingDetails?.arrivalTime })}</p>
            <p>{t('bookingConfirmation.success.sections.stayDetails.checkOut', { date: formatDate(bookingDetails?.departureDate) })}</p>
            <p>
              {bookingDetails?.children > 0
                ? t('bookingConfirmation.success.sections.stayDetails.travelersWithChildren', {
                    adults: bookingDetails?.adults,
                    children: bookingDetails?.children
                  })
                : t('bookingConfirmation.success.sections.stayDetails.travelers', {
                    adults: bookingDetails?.adults
                  })}
            </p>
          </div>

           {/* Guest Details */}
           <div className="details-card">
            <h2 className="titleConfirmation">{t('bookingConfirmation.success.sections.guestDetails.title')}</h2>
            <p>{t('bookingConfirmation.success.sections.guestDetails.fullName', {
              firstName: bookingDetails?.firstName,
              lastName: bookingDetails?.lastName
            })}</p>
            <p>{t('bookingConfirmation.success.sections.guestDetails.email', { email: bookingDetails?.email })}</p>
            <p>{t('bookingConfirmation.success.sections.guestDetails.phone', { phone: bookingDetails?.phone || "-" })}</p>
          </div>


           {/* Price Details */}
           <div className="details-card">
            <h2 className="titleConfirmation">{t('bookingConfirmation.success.sections.priceDetails.title')}</h2>
            <p>{t('bookingConfirmation.success.sections.priceDetails.basePrice', {
              price: (bookingDetails?.priceBreakdown?.basePrice || 0).toFixed(2)
            })}</p>
            
            {/* Show extras */}
            {bookingDetails?.extras?.map((extra, index) => (
              <p key={index}>
                {extra.name} (x{extra.quantity}): {((extra.amount || 0) + (extra.extraPersonAmount || 0)).toFixed(2)}€
                {extra.extraPersonQuantity > 0 && t('bookingConfirmation.success.sections.priceDetails.extraPerson', {
                  quantity: extra.extraPersonQuantity,
                  price: extra.extraPersonAmount.toFixed(2)
                })}
              </p>
            ))}

            {/* Long stay discount if applicable */}
            {bookingDetails?.priceDetails?.discount > 0 && (
              <p className="discount-text">
                {t('bookingConfirmation.success.sections.priceDetails.longStayDiscount', {
                  percentage: bookingDetails.priceDetails.settings.lengthOfStayDiscount.discountPercentage,
                  amount: bookingDetails.priceDetails.discount.toFixed(2)
                })}
              </p>
            )}

            {/* Coupon discount if applicable */}
            {bookingDetails?.couponApplied && (
              <p className="discount-text">
                {t('bookingConfirmation.success.sections.priceDetails.promoCode', {
                  code: bookingDetails.couponApplied.code,
                  amount: bookingDetails.couponApplied.discount.toFixed(2)
                })}
              </p>
            )}

            {/* Total */}
            <div className="total-section">
              <p className="total-text">
                {t('bookingConfirmation.success.sections.priceDetails.total', {
                  price: (bookingDetails?.price || 0).toFixed(2)
                })}
              </p>
              <p>{t('bookingConfirmation.success.sections.priceDetails.termsAccepted')}</p>
            </div>
          </div>

          {/* Address */}
          <div className="details-card">
            <h2 className="titleConfirmation">{t('bookingConfirmation.success.sections.address.title')}</h2>
            <p>{bookingDetails?.street}</p>
            <p>{bookingDetails?.postalCode} {bookingDetails?.location}</p>
            <p>{bookingDetails?.country}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="actions">
          <button onClick={() => window.location.href = "/"} className="button-primary">
            {t('bookingConfirmation.success.buttons.backHome')}
          </button>
          <button onClick={() => window.print()} className="button-secondary">
            {t('bookingConfirmation.success.buttons.print')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;