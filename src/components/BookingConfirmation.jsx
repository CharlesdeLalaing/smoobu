// src/pages/BookingConfirmation.js (or appropriate path)
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoBaseilles from "../assets/logoBaseilles.webp"; // Verify path to logo
import { addMinutes, format as formatFn } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale"; // Import all required locales
import "../assets/bookingConfirmation.css"; // Verify path to CSS
import { CalendarClock } from "lucide-react";

// Helper to get date-fns locale (can be moved to a shared utils file)
const getDateFnLocale = (lang = "fr") => {
  const baseLang = lang.split("-")[0]; // Use base language (e.g., "en" from "en-US")
  switch (baseLang) {
    case "fr":
      return fr;
    case "en":
      return enUS;
    case "nl":
      return nl;
    default:
      return fr; // Default to French
  }
};

const BookingConfirmation = () => {
  const { t, i18n } = useTranslation(); // Get i18n instance
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const paymentIntent = searchParams.get("payment_intent");
  const [displayPrice, setDisplayPrice] = useState(null);
  const [priceCalculated, setPriceCalculated] = useState(false);

  const currentLocale = i18n.language; // e.g., "en", "fr-BE", "nl"
  const currentDateFnsLocale = getDateFnLocale(currentLocale);

  useEffect(() => {
    const storedBookingData = localStorage.getItem("bookingData");
    if (storedBookingData) {
      try {
        const parsedData = JSON.parse(storedBookingData);
        setBookingDetails(parsedData);
        setStatus("success");
        localStorage.removeItem("bookingData");
      } catch (error) {
        console.error("Error parsing booking data from localStorage:", error);
        setStatus("error");
      }
    } else if (paymentIntent) {
      fetchBookingDetails(paymentIntent);
    } else {
      console.error(
        "Cannot display confirmation: No booking data found in localStorage or paymentIntent in URL."
      );
      setStatus("error");
    }
  }, [paymentIntent]);

  useEffect(() => {
    if (bookingDetails && !priceCalculated) {
      calculateAndSetFinalPrice(bookingDetails);
      setPriceCalculated(true);
    }
  }, [bookingDetails, priceCalculated]);

  const calculateAndSetFinalPrice = (data) => {
    if (data.price !== null && data.price !== undefined) {
      setDisplayPrice(parseFloat(data.price));
      return;
    }
    const basePrice = parseFloat(
      data.priceBreakdown?.basePrice ||
        data.basePrice ||
        data.priceDetails?.basePrice ||
        0
    );
    const guestFees = parseFloat(data.guestFees || 0);
    let extrasTotal = 0;
    if (data.extras && Array.isArray(data.extras)) {
      extrasTotal = data.extras.reduce((sum, extra) => {
        const extraAmount = parseFloat(extra.amount || 0);
        const extraPersonAmount =
          extra.extraPersonQuantity > 0
            ? parseFloat(extra.extraPersonAmount || 0)
            : 0;
        return sum + extraAmount + extraPersonAmount;
      }, 0);
    }
    const longStayDiscount = parseFloat(
      data.priceBreakdown?.longStayDiscount ||
        data.priceDetails?.longStayDiscount ||
        data.priceDetails?.discount ||
        0
    );
    const couponDiscount = parseFloat(
      data.priceBreakdown?.couponDiscount ||
        data.priceDetails?.couponDiscount ||
        data.couponApplied?.discount ||
        0
    );
    const finalPrice =
      basePrice + guestFees + extrasTotal - longStayDiscount - couponDiscount;
    setDisplayPrice(finalPrice >= 0 ? finalPrice : 0);
  };

  const fetchBookingDetails = async (paymentIntentId) => {
    let attempts = 0;
    const maxAttempts = 5;
    const retryDelay = 2000;
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

    const attemptFetch = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/bookings/${paymentIntentId}`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        );
        if (response.status === 404) {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(attemptFetch, retryDelay);
            return;
          } else {
            throw new Error(t("bookingConfirmation.error.notFound"));
          }
        }
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `${t("bookingConfirmation.error.fetchFailed")} Status: ${
              response.status
            }. Body: ${errorText}`
          );
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        setBookingDetails(data);
        setStatus("success");
      } catch (error) {
        console.error("Detailed error in fetchBookingDetails attempt:", error);
        if (attempts < maxAttempts && status !== "success") {
          attempts++;
          setTimeout(attemptFetch, retryDelay);
        } else {
          setStatus("error");
        }
      }
    };
    attemptFetch();
  };

  const getJsDate = (dateValue) => {
    if (!dateValue) return null;
    try {
      let date;
      if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
        return dateValue;
      }
      if (dateValue && typeof dateValue.toDate === "function") {
        date = dateValue.toDate();
      } else if (
        dateValue &&
        typeof dateValue === "object" &&
        dateValue._seconds !== undefined
      ) {
        date = new Date(
          dateValue._seconds * 1000 + (dateValue._nanoseconds || 0) / 1000000
        );
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) {
        console.error(
          "getJsDate resulted in an Invalid Date for input:",
          dateValue
        );
        return null; // Return null for invalid dates
      }
      return date;
    } catch (e) {
      console.error("Error converting to JS Date:", dateValue, e);
      return null;
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    const date = getJsDate(dateValue);
    if (!date) return t("errors.invalidDate", "Date invalide");
    try {
      return new Intl.DateTimeFormat(currentLocale, {
        // Use currentLocale
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch (e) {
      console.error("Error formatting date with Intl:", dateValue, e);
      // Fallback to a simpler format if Intl fails for some reason
      try {
        return formatFn(date, "d MMMM yyyy", { locale: currentDateFnsLocale });
      } catch (e2) {
        console.error(
          "Error formatting date with date-fns fallback:",
          dateValue,
          e2
        );
        return t("errors.invalidDate", "Date invalide");
      }
    }
  };

  const formatTime = (timeStringOrDate) => {
    if (!timeStringOrDate) return "-";
    const dateObj = getJsDate(timeStringOrDate); // Try to parse if it's a full date string/object
    if (dateObj) {
      try {
        return formatFn(dateObj, "HH:mm", { locale: currentDateFnsLocale });
      } catch (e) {
        console.error("Error formatting dateObj as time:", timeStringOrDate, e);
        // If it was a date object that failed, it's an issue.
        // If it was meant to be a simple time string like "14:00", it might pass through.
      }
    }
    // If it's already a simple HH:mm string, return it.
    // This is a basic check; more robust validation might be needed if various formats are expected.
    if (
      typeof timeStringOrDate === "string" &&
      /^\d{2}:\d{2}$/.test(timeStringOrDate)
    ) {
      return timeStringOrDate;
    }
    return "-"; // Fallback
  };

  const renderExtraName = (extra) => {
    if (!extra?.name)
      return t("bookingConfirmation.unknownExtra", "Extra Item");
    return extra.name.startsWith("extras.") ? t(extra.name) : extra.name;
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return "0.00";
    const numberPrice = typeof price === "string" ? parseFloat(price) : price;
    return typeof numberPrice === "number" && !isNaN(numberPrice)
      ? numberPrice.toFixed(2)
      : "0.00";
  };

  const calculateExtraGuests = () => {
    if (!bookingDetails) return 0;
    const totalGuests =
      (parseInt(bookingDetails.adults) || 0) +
      (parseInt(bookingDetails.children) || 0);
    const startingGuests =
      bookingDetails.priceDetails?.settings?.startingAtGuest || 2;
    return Math.max(0, totalGuests - startingGuests);
  };

  if (status === "loading") {
    return (
      <div
        className="container"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="card">
          <h2 className="mb-2 text-xl font-semibold">
            {t("bookingConfirmation.loading.title")}
          </h2>
          <p>{t("bookingConfirmation.loading.message")}</p>
          <div className="mt-4 spinner"></div>
        </div>
      </div>
    );
  }

  if (status === "error" || !bookingDetails) {
    return (
      <div
        className="container"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="card error-card" style={{ textAlign: "center" }}>
          <h2 className="mb-2 text-xl font-semibold text-red-600">
            {t("bookingConfirmation.error.title")}
          </h2>
          <p className="mb-4">{t("bookingConfirmation.error.message")}</p>
          <button onClick={() => navigate("/")} className="button-primary">
            {t(
              "bookingConfirmation.error.backHomeButton",
              "Retour à l'accueil"
            )}
          </button>
        </div>
      </div>
    );
  }

  const needsSpaScheduling = bookingDetails.spaBookingPreference === "later";
  const scheduledSpaTime =
    bookingDetails.spaDateTime &&
    bookingDetails.spaBookingPreference === "scheduled";
  let spaTimeDisplay = t("errors.invalidTime", "Heure invalide");

  if (scheduledSpaTime && bookingDetails) {
    const startTimeObj = getJsDate(bookingDetails.spaDateTime);
    let endTimeObj = bookingDetails.spaEndDateTime
      ? getJsDate(bookingDetails.spaEndDateTime)
      : null;

    if (startTimeObj) {
      if (!endTimeObj) {
        // Fallback to calculate end time if spaEndDateTime is not available
        let actualSlotDurationMinutes;
        if (
          bookingDetails.spaSlotDuration &&
          typeof bookingDetails.spaSlotDuration === "number" &&
          bookingDetails.spaSlotDuration > 0
        ) {
          actualSlotDurationMinutes = bookingDetails.spaSlotDuration;
        } else if (
          bookingDetails.spaInfo?.slots?.length > 0 &&
          bookingDetails.spaSettings?.slotDurationMinutes
        ) {
          // Fallback similar to email, if spaInfo and spaSettings are in bookingDetails
          actualSlotDurationMinutes =
            bookingDetails.spaInfo.slots.length *
            bookingDetails.spaSettings.slotDurationMinutes;
        } else {
          console.warn(
            `BookingConfirmation: spaEndDateTime and spaSlotDuration are missing or invalid. Falling back to a default duration (e.g., 120 minutes) or unable to determine end time accurately. Booking ID: ${
              bookingDetails?.id || bookingDetails?.smoobuId || "N/A"
            }. Consider ensuring 'spaEndDateTime' or 'spaSlotDuration' is saved in booking details.`
          );
          actualSlotDurationMinutes = 120; // Default fallback if no other info
        }
        if (actualSlotDurationMinutes > 0) {
          try {
            endTimeObj = addMinutes(startTimeObj, actualSlotDurationMinutes);
          } catch (e) {
            console.error("Error calculating fallback end time for SPA:", e);
          }
        }
      }

      try {
        const startTimeString = formatFn(startTimeObj, "HH:mm", {
          locale: currentDateFnsLocale,
        });
        const endTimeString = endTimeObj
          ? formatFn(endTimeObj, "HH:mm", { locale: currentDateFnsLocale })
          : null;

        if (startTimeString && endTimeString) {
          spaTimeDisplay = `${startTimeString} - ${endTimeString}`;
        } else if (startTimeString) {
          spaTimeDisplay = startTimeString; // Only start time if end time couldn't be determined
          console.warn(
            "SPA time display only has start time, end time could not be determined or was invalid."
          );
        }
      } catch (e) {
        console.error("Error formatting SPA times:", e);
        // spaTimeDisplay remains "Heure invalide" or its default
      }
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        minWidth: "100vw",
        display: "flex",
        alignItems: "center",
        padding: "2rem 0",
      }}
      className="container"
    >
      <div className="card">
        <div className="header">
          <div className="icon-container">
            <img
              src={logoBaseilles}
              alt="Logo Ferme de Basseilles"
              className="icon"
            />
          </div>
          <div>
            <h1 className="title">{t("bookingConfirmation.success.title")}</h1>
            <p className="subtitle">
              {t("bookingConfirmation.success.subtitle", {
                email: bookingDetails.email,
              })}
            </p>
          </div>
        </div>
        <div className="grid">
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.stayDetails.title")}
            </h2>
            <p>
              {t("bookingConfirmation.success.sections.stayDetails.checkIn", {
                date: formatDate(bookingDetails.arrivalDate),
              })}
            </p>
            <p>
              {t(
                "bookingConfirmation.success.sections.stayDetails.arrivalTime",
                { time: formatTime(bookingDetails.arrivalTime) }
              )}
            </p>
            <p>
              {t("bookingConfirmation.success.sections.stayDetails.checkOut", {
                date: formatDate(bookingDetails.departureDate),
              })}
            </p>
            <p>
              {bookingDetails.children > 0
                ? t(
                    "bookingConfirmation.success.sections.stayDetails.travelersWithChildren",
                    {
                      adults: bookingDetails.adults,
                      children: bookingDetails.children,
                    }
                  )
                : t(
                    "bookingConfirmation.success.sections.stayDetails.travelers",
                    { adults: bookingDetails.adults }
                  )}
            </p>
            {scheduledSpaTime && (
              <p className="pt-2 mt-2 text-sm border-t border-gray-200">
                <CalendarClock
                  size={14}
                  className="inline-block mr-1 text-indigo-600 align-text-bottom"
                />
                <span className="font-semibold">
                  {t(
                    "bookingConfirmation.success.sections.spaTime.scheduledTitle",
                    "Séance SPA:"
                  )}
                </span>{" "}
                {formatDate(bookingDetails.spaDateTime)}{" "}
                <span className="">{spaTimeDisplay}</span>
              </p>
            )}
          </div>

          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.guestDetails.title")}
            </h2>
            <p>
              {t("bookingConfirmation.success.sections.guestDetails.fullName", {
                firstName: bookingDetails.firstName,
                lastName: bookingDetails.lastName,
              })}
            </p>
            <p>
              {t("bookingConfirmation.success.sections.guestDetails.email", {
                email: bookingDetails.email,
              })}
            </p>
            <p>
              {t("bookingConfirmation.success.sections.guestDetails.phone", {
                phone: bookingDetails.phone || "-",
              })}
            </p>
          </div>

          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.priceDetails.title")}
            </h2>
            <p>
              {t(
                "bookingConfirmation.success.sections.priceDetails.basePrice",
                {
                  price: formatPrice(
                    bookingDetails.priceBreakdown?.basePrice ||
                      bookingDetails.basePrice ||
                      0
                  ),
                }
              )}
            </p>
            {bookingDetails.guestFees > 0 && (
              <p>
                {t(
                  "bookingConfirmation.success.sections.priceDetails.guestFees",
                  {
                    amount: formatPrice(bookingDetails.guestFees),
                    extraGuests: calculateExtraGuests(),
                  }
                )}
              </p>
            )}
            <div className="mt-1 mb-2 extras-list">
              {bookingDetails.extras?.map((extra, index) => {
                const hasExtraPerson = extra.extraPersonQuantity > 0;
                return (
                  <p key={index} className="text-sm">
                    {renderExtraName(extra)} (x{extra.quantity}):{" "}
                    {formatPrice(extra.amount)}€
                    {hasExtraPerson && (
                      <span className="text-xs text-gray-600">
                        {` (+ ${t("extras.additionalPerson", "pers. sup.")} x${
                          extra.extraPersonQuantity
                        } : ${formatPrice(extra.extraPersonAmount)}€)`}
                      </span>
                    )}
                  </p>
                );
              })}
            </div>
            {(bookingDetails.priceDetails?.discount > 0 ||
              bookingDetails.priceDetails?.longStayDiscount > 0) && (
              <p className="text-sm text-orange-600 discount-text">
                {t(
                  "bookingConfirmation.success.sections.priceDetails.longStayDiscount",
                  {
                    percentage:
                      bookingDetails.priceDetails?.settings
                        ?.lengthOfStayDiscount?.discountPercentage || "?",
                    amount: formatPrice(
                      bookingDetails.priceDetails?.discount ||
                        bookingDetails.priceDetails?.longStayDiscount ||
                        0
                    ),
                  }
                )}
              </p>
            )}
            {bookingDetails.couponApplied && (
              <p className="text-sm text-green-600 discount-text">
                {t(
                  "bookingConfirmation.success.sections.priceDetails.promoCode",
                  {
                    code: bookingDetails.couponApplied.code,
                    amount: formatPrice(
                      bookingDetails.couponApplied.discount || 0
                    ),
                  }
                )}
              </p>
            )}
            <div className="total-section">
              <p className="total-text">
                {t("bookingConfirmation.success.sections.priceDetails.total", {
                  price: formatPrice(displayPrice),
                })}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("terms.generalConditions")}: {t("terms.accepted")}
              </p>
            </div>
          </div>

          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.address.title")}
            </h2>
            <p>{bookingDetails.street || "-"}</p>
            <p>
              {bookingDetails.postalCode || "-"}{" "}
              {bookingDetails.location || "-"}
            </p>
            <p>{bookingDetails.country || "-"}</p>
          </div>

          {needsSpaScheduling && (
            <div className="details-card spa-schedule-later-card">
              <h2 className="flex items-center titleConfirmation spa-schedule-title">
                <CalendarClock size={18} className="inline-block mr-2" />
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterTitle",
                  "Programmation Séance SPA"
                )}
              </h2>
              <p className="mb-1 text-sm">
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterInstruction"
                )}
              </p>
              <p className="mb-2 text-sm font-semibold">
                <a
                  href="mailto:fermedebasseilles@gmail.com"
                  className="text-blue-600 hover:underline"
                >
                  fermedebasseilles@gmail.com
                </a>
              </p>
              <p className="text-xs text-gray-600">
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterPriority"
                )}
              </p>
            </div>
          )}
        </div>
        <div className="actions">
          <button onClick={() => navigate("/")} className="button-primary">
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
