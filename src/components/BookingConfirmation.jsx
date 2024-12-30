import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoBaseilles from "../assets/logoBaseilles.webp";
import "../assets/bookingConfirmation.css";

const BookingConfirmation = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const paymentIntent = searchParams.get("payment_intent");

  useEffect(() => {
    // console.log("Payment Intent:", paymentIntent);
    const storedBookingData = localStorage.getItem("bookingData");
    // console.log("Initial stored data:", storedBookingData);

    if (storedBookingData) {
      try {
        const parsedData = JSON.parse(storedBookingData);
        // console.log("Parsed booking data:", parsedData);
        console.log("Parsed booking data:", parsedData);
        console.log("Coupon info:", parsedData.couponApplied);
        console.log("Price breakdown:", parsedData.priceBreakdown);
        setBookingDetails(parsedData);
        setStatus("success");
        if (parsedData) {
          localStorage.removeItem("bookingData");
        }
      } catch (error) {
        console.error("Error parsing booking data:", error);
        setStatus("error");
      }
    } else {
      if (paymentIntent) {
        fetchBookingDetails(paymentIntent);
      }
    }
  }, [paymentIntent]);

  const API_URL = "https://booking-9u8u.onrender.com";

  // const fetchBookingDetails = async (paymentIntentId) => {
  //   try {
  //     const response = await fetch(
  //       `${API_URL}/api/bookings/${paymentIntentId}`
  //     );
  //     const data = await response.json();
  //     if (data.error) throw new Error(data.error);
  //     setBookingDetails(data);
  //     setStatus("success");
  //   } catch (error) {
  //     console.error("Error fetching booking details:", error);
  //     setStatus("error");
  //   }
  // };

  const fetchBookingDetails = async (paymentIntentId) => {
    try {
      console.log("Starting to fetch booking details");
      console.log("API URL:", `${API_URL}/api/bookings/${paymentIntentId}`);
      
      const response = await fetch(
        `${API_URL}/api/bookings/${paymentIntentId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
      });
      
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);
  
      if (data.error) {
        console.error("API returned error:", data.error);
        throw new Error(data.error);
      }
      
      setBookingDetails(data);
      setStatus("success");
    } catch (error) {
      console.error("Detailed error in fetchBookingDetails:", error);
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

  // Update the renderExtraName function in BookingConfirmation.js
  const renderExtraName = (extra) => {
    // Handle both direct translation keys and nested translation keys
    if (extra.name) {
      // If it's a translation key (starts with 'extras.')
      if (typeof extra.name === 'string' && extra.name.startsWith('extras.')) {
        return t(extra.name);
      }
      // For direct names (like drinks)
      return extra.name;
    }
    return '';
  };

  // const formatPrice = (price) => {
  //   return typeof price === "number" ? price.toFixed(2) : "0.00";
  // };
  {/* Update the formatPrice function to handle string values */}
  const formatPrice = (price) => {
    const numberPrice = typeof price === "string" ? parseFloat(price) : price;
    return typeof numberPrice === "number" ? numberPrice.toFixed(2) : "0.00";
  };

  if (status === "loading") {
    return (
      <div className="container">
        <div className="card">
          <h2>{t("bookingConfirmation.loading.title")}</h2>
          <p>{t("bookingConfirmation.loading.message")}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container">
        <div className="card">
          <h2>{t("bookingConfirmation.error.title")}</h2>
          <p>{t("bookingConfirmation.error.message")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        minWidth: "100vw",
        display: "flex",
        alignItems: "center",
      }}
      className="container"
    >
      <div className="card">
        {/* Success Header */}
        <div className="header">
          <div className="icon-container">
            <img src={logoBaseilles} alt="Logo Baseilles" className="icon" />
          </div>
          <div>
            <h1 className="title">{t("bookingConfirmation.success.title")}</h1>
            <p className="subtitle">
              {t("bookingConfirmation.success.subtitle", {
                email: bookingDetails?.email,
              })}
            </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid">
          {/* Stay Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.stayDetails.title")}
            </h2>
            <p>
              {t("bookingConfirmation.success.sections.stayDetails.checkIn", {
                date: formatDate(bookingDetails?.arrivalDate),
              })}
            </p>
            <p>
              {t(
                "bookingConfirmation.success.sections.stayDetails.arrivalTime",
                {
                  time: bookingDetails?.arrivalTime,
                }
              )}
            </p>
            <p>
              {t("bookingConfirmation.success.sections.stayDetails.checkOut", {
                date: formatDate(bookingDetails?.departureDate),
              })}
            </p>
            <p>
              {bookingDetails?.children > 0
                ? t(
                    "bookingConfirmation.success.sections.stayDetails.travelersWithChildren",
                    {
                      adults: bookingDetails.adults,
                      children: bookingDetails.children,
                    }
                  )
                : t(
                    "bookingConfirmation.success.sections.stayDetails.travelers",
                    {
                      adults: bookingDetails.adults,
                    }
                  )}
            </p>
          </div>

          {/* Guest Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.guestDetails.title")}
            </h2>
            <p>
              {t("bookingConfirmation.success.sections.guestDetails.fullName", {
                firstName: bookingDetails?.firstName,
                lastName: bookingDetails?.lastName,
              })}
            </p>
            <p>
              {t("bookingConfirmation.success.sections.guestDetails.email", {
                email: bookingDetails?.email,
              })}
            </p>
            <p>
              {t("bookingConfirmation.success.sections.guestDetails.phone", {
                phone: bookingDetails?.phone || "-",
              })}
            </p>
          </div>

          {/* Price Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.priceDetails.title")}
            </h2>
            <p>
              {t(
                "bookingConfirmation.success.sections.priceDetails.basePrice",
                {
                  price: formatPrice(bookingDetails?.priceBreakdown?.basePrice),
                }
              )}
            </p>

            {/* For the extras, we use the translation keys from extras section */}
            {/* {bookingDetails?.extras?.map((extra, index) => (
              <p key={index}>
                {renderExtraName(extra)} (x{extra.quantity}):{" "}
                {formatPrice(
                  (extra.amount || 0) + (extra.extraPersonAmount || 0)
                )}
                €
                {extra.extraPersonQuantity > 0 && (
                  <span className="text-sm text-gray-600">
                    {` (${t("extras.additionalPerson")}: ${
                      extra.extraPersonQuantity
                    })`}
                  </span>
                )}
              </p>
            ))} */}

            {bookingDetails?.extras?.map((extra, index) => {
              const hasExtraPerson = extra.extraPersonQuantity > 0;
              
              return (
                <p key={index}>
                  {renderExtraName(extra)} (x{extra.quantity}): {formatPrice(extra.amount)}€
                  {hasExtraPerson && (
                    <span className="text-sm text-gray-600">
                      {` (${t("extras.additionalPerson")} (x${extra.extraPersonQuantity}) : ${formatPrice(extra.extraPersonAmount)}€)`}
                    </span>
                  )}
                </p>
              );
            })}

            {/* Long stay discount */}
            {bookingDetails?.priceDetails?.discount > 0 && (
              <p className="discount-text">
                {t(
                  "bookingConfirmation.success.sections.priceDetails.longStayDiscount",
                  {
                    percentage:
                      bookingDetails.priceDetails.settings.lengthOfStayDiscount
                        .discountPercentage,
                    amount: formatPrice(bookingDetails.priceDetails.discount),
                  }
                )}
              </p>
            )}

            {/* Promo code */}
            {/* {bookingDetails?.couponApplied && (
              <p className="discount-text">
                {t(
                  "bookingConfirmation.success.sections.priceDetails.promoCode",
                  {
                    code: bookingDetails.couponApplied.code,
                    amount: formatPrice(bookingDetails.couponApplied.discount),
                  }
                )}
              </p>
            )} */}
            {/* Promo code */}
            {/* {bookingDetails?.couponApplied && (
              <p className="discount-text" style={{ color: '#22c55e' }}>
                {bookingDetails.couponApplied.type === 'percentage' 
                  ? t("bookingConfirmation.success.sections.priceDetails.promoCode", {
                      code: bookingDetails.couponApplied.code,
                      amount: formatPrice(Number(bookingDetails.priceBreakdown.couponDiscount))
                    })
                  : t("bookingConfirmation.success.sections.priceDetails.promoCode", {
                      code: bookingDetails.couponApplied.code,
                      amount: formatPrice(Number(bookingDetails.priceBreakdown.couponDiscount))
                    })
                }
              </p>
            )} */}
            {bookingDetails?.couponApplied && (
              <p className="discount-text" style={{ color: '#22c55e' }}>
                {bookingDetails.couponApplied.type === 'percentage' 
                  ? t("bookingConfirmation.success.sections.priceDetails.promoCodePercentage", {
                      code: bookingDetails.couponApplied.code,
                      percentage: bookingDetails.couponApplied.originalDiscount,
                      amount: formatPrice(bookingDetails.priceBreakdown.couponDiscount)
                    })
                  : t("bookingConfirmation.success.sections.priceDetails.promoCodeFixed", {
                      code: bookingDetails.couponApplied.code,
                      amount: formatPrice(bookingDetails.priceBreakdown.couponDiscount)
                    })
                }
              </p>
            )}
            

            {/* Total */}
            <div className="total-section">
              <p className="total-text">
                {t("bookingConfirmation.success.sections.priceDetails.total", {
                  price: formatPrice(bookingDetails?.price),
                })}
              </p>
              <p>
                {t("terms.generalConditions")}: {t("terms.accepted")}
              </p>
            </div>
          </div>

          {/* Address */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.address.title")}
            </h2>
            <p>{bookingDetails?.street}</p>
            <p>
              {bookingDetails?.postalCode} {bookingDetails?.location}
            </p>
            <p>{bookingDetails?.country}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="actions">
          <button
            onClick={() => (window.location.href = "/")}
            className="button-primary"
          >
            {t("bookingConfirmation.success.buttons.backHome")}
          </button>
          <button onClick={() => window.print()} className="button-secondary">
            {t("bookingConfirmation.success.buttons.print")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
