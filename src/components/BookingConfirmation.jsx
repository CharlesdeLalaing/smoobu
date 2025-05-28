// src/pages/BookingConfirmation.js
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoBaseilles from "../assets/logoBaseilles.webp"; // Verify path
import { addMinutes, format as formatFn } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale"; // Import all required locales
import "../assets/bookingConfirmation.css"; // Verify path
import {
  CalendarClock,
  ShoppingBagIcon,
  GiftIcon,
  InfoIcon,
  Wine
} from "lucide-react"; // Icons

// Helper to get date-fns locale
const getDateFnLocale = (lang = "fr") => {
  const baseLang = lang.split("-")[0];
  switch (baseLang) {
    case "fr":
      return fr;
    case "en":
      return enUS;
    case "nl":
      return nl;
    default:
      return fr;
  }
};

// Robust date conversion utility
const getJsDate = (dateValue) => {
  if (!dateValue) return null;
  try {
    let date;
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return dateValue;
    }
    // Handle Firestore Timestamp objects (from client SDK or Admin SDK-like structure)
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
      // Handle ISO strings or other parsable date strings
      date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) {
      // console.warn("getJsDate: Resulted in Invalid Date for input:", dateValue);
      return null;
    }
    return date;
  } catch (e) {
    // console.error("getJsDate: Error converting to JS Date:", dateValue, e);
    return null;
  }
};

const BookingConfirmation = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const paymentIntentIdFromUrl = searchParams.get("payment_intent"); // Renamed for clarity
  const [displayPrice, setDisplayPrice] = useState(null);
  const [priceCalculated, setPriceCalculated] = useState(false);

  const currentLocale = i18n.language;
  const currentDateFnsLocale = getDateFnLocale(currentLocale);

  useEffect(() => {
    const storedBookingData = localStorage.getItem("bookingData");
    if (storedBookingData) {
      try {
        const parsedData = JSON.parse(storedBookingData);
        // console.log("BookingConfirmation: Loaded data from localStorage: ", parsedData);
        setBookingDetails(parsedData);
        setStatus("success");
        localStorage.removeItem("bookingData"); // Crucial to remove after use
      } catch (error) {
        console.error("Error parsing booking data from localStorage:", error);
        // If localStorage fails, try fetching if paymentIntentIdFromUrl exists
        if (paymentIntentIdFromUrl) {
          // console.log(`BookingConfirmation: localStorage parse failed, attempting to fetch for PI: ${paymentIntentIdFromUrl}`);
          fetchBookingDetails(paymentIntentIdFromUrl);
        } else {
          setStatus("error");
        }
      }
    } else if (paymentIntentIdFromUrl) {
      // console.log(`BookingConfirmation: No localStorage data, attempting to fetch for PI: ${paymentIntentIdFromUrl}`);
      fetchBookingDetails(paymentIntentIdFromUrl);
    } else {
      console.error(
        "Cannot display confirmation: No booking data found in localStorage or paymentIntent in URL."
      );
      setStatus("error");
    }
  }, [paymentIntentIdFromUrl]); // Dependency is the PI from URL

  useEffect(() => {
    if (bookingDetails && !priceCalculated) {
      calculateAndSetFinalPrice(bookingDetails);
      setPriceCalculated(true);
    }
  }, [bookingDetails, priceCalculated]);

  const calculateAndSetFinalPrice = (data) => {
    if (!data) return;
    if (
      data.price !== null &&
      data.price !== undefined &&
      !isNaN(parseFloat(data.price))
    ) {
      setDisplayPrice(parseFloat(data.price));
      return;
    }
    // Fallback calculation if data.price is not directly usable
    const basePrice = parseFloat(
      data.priceBreakdown?.roomBasePrice ||
        data.basePrice ||
        data.priceDetailsSnapshot?.originalPrice ||
        0
    );
    const guestFees = parseFloat(
      data.priceBreakdown?.calculatedGuestFees || data.guestFees || 0
    );
    let extrasTotal = 0;
    if (data.extras && Array.isArray(data.extras)) {
      extrasTotal = data.extras.reduce((sum, extra) => {
        const extraAmount = parseFloat(extra.amount || 0);
        const extraPersonAmount =
          extra.extraPersonQuantity > 0 && extra.extraPersonAmount !== undefined
            ? parseFloat(extra.extraPersonAmount)
            : 0;
        return sum + extraAmount + extraPersonAmount;
      }, 0);
    }
    const longStayDiscount = parseFloat(
      data.priceBreakdown?.appliedLongStayDiscount ||
        data.priceDetailsSnapshot?.discount ||
        0
    );
    const couponDiscount = parseFloat(
      data.priceBreakdown?.appliedCouponDiscount ||
        data.couponApplied?.discount ||
        0
    );
    const finalPrice =
      basePrice + guestFees + extrasTotal - longStayDiscount - couponDiscount;
    setDisplayPrice(finalPrice >= 0 ? finalPrice : 0);
  };

  const fetchBookingDetails = async (paymentIntentId) => {
    let attempts = 0;
    const maxAttempts = 7; // Increased attempts slightly
    const retryDelay = 3000; // Increased retry delay
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

    const attemptFetch = async () => {
      // console.log(`BookingConfirmation: Attempting to fetch for PI: ${paymentIntentId} (Attempt: ${attempts + 1})`);
      try {
        const response = await fetch(
          `${API_URL}/api/bookings/${paymentIntentId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (response.status === 404) {
          attempts++;
          if (attempts < maxAttempts) {
            // console.log(`BookingConfirmation: Booking not found (attempt ${attempts}), retrying...`);
            setTimeout(attemptFetch, retryDelay);
            return;
          } else {
            console.error(
              `BookingConfirmation: Booking not found after ${maxAttempts} attempts for PI: ${paymentIntentId}`
            );
            throw new Error(
              t(
                "bookingConfirmation.error.notFound",
                "Détails de la réservation non trouvés. Veuillez vérifier votre e-mail ou nous contacter."
              )
            );
          }
        }
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `BookingConfirmation: Fetch failed - Status ${response.status}, Body: ${errorText}`
          );
          throw new Error(
            `${t(
              "bookingConfirmation.error.fetchFailed",
              "Échec de la récupération des détails de la réservation."
            )} Statut: ${response.status}.`
          );
        }
        const data = await response.json();
        if (data.error) {
          console.error("BookingConfirmation: API returned error:", data.error);
          throw new Error(data.error);
        }
        // console.log("BookingConfirmation: Successfully fetched booking details from API:", data);
        setBookingDetails(data);
        setStatus("success");
      } catch (error) {
        console.error(
          "BookingConfirmation: Detailed error in fetchBookingDetails attempt:",
          error
        );
        if (
          attempts < maxAttempts - 1 &&
          error.message.includes(t("bookingConfirmation.error.notFound"))
        ) {
          // If it's a 404 and we haven't exhausted retries, the retry is handled by the 404 block.
          // This 'else' path is more for other types of errors or final failure.
        } else {
          setStatus("error"); // Set to error on final attempt or non-404 error
        }
      }
    };
    attemptFetch();
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    const date = getJsDate(dateValue);
    if (!date) return t("errors.invalidDate", "Date invalide");
    try {
      return new Intl.DateTimeFormat(currentLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch (e) {
      try {
        return formatFn(date, "d MMMM yyyy", { locale: currentDateFnsLocale });
      } catch (e2) {
        return t("errors.invalidDate", "Date invalide");
      }
    }
  };

  const formatTime = (timeStringOrDate) => {
    if (!timeStringOrDate) return "-";
    const dateObj = getJsDate(timeStringOrDate);
    if (dateObj) {
      try {
        return formatFn(dateObj, "HH:mm", { locale: currentDateFnsLocale });
      } catch (e) {
        /* console.error("Error formatting dateObj as time:", timeStringOrDate, e); */
      }
    }
    if (
      typeof timeStringOrDate === "string" &&
      /^\d{2}:\d{2}$/.test(timeStringOrDate)
    ) {
      return timeStringOrDate;
    }
    return "-";
  };

  const renderExtraName = (extra) => {
    if (!extra?.name) return t("bookingConfirmation.unknownExtra", "Extra");
    // Assuming extra.name is already translated if it was a key, by prepareBookingDocument
    return extra.name;
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined || isNaN(parseFloat(price)))
      return "0.00";
    const numberPrice = parseFloat(price);
    return numberPrice.toFixed(2);
  };

  const calculateExtraGuests = () => {
    if (!bookingDetails) return 0;
    const totalGuests =
      (parseInt(bookingDetails.adults) || 0) +
      (parseInt(bookingDetails.children) || 0);
    const startingGuests =
      bookingDetails.priceBreakdown?.settings?.startingAtGuest || // From prepareBookingDocument
      bookingDetails.priceDetailsSnapshot?.settings?.startingAtGuest || // From frontend state
      2; // Default
    return Math.max(0, totalGuests - Number(startingGuests));
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
          <p className="mb-4">
            {t(
              "bookingConfirmation.error.message",
              "Une erreur est survenue lors de la récupération des détails de votre réservation. Veuillez vérifier votre e-mail de confirmation ou nous contacter directement."
            )}
          </p>
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

  // SPA Time Display Logic
  const needsSpaScheduling = bookingDetails.spaBookingPreference === "later";
  const scheduledSpaTime =
    bookingDetails.spaDateTime &&
    bookingDetails.spaBookingPreference === "scheduled";
  let spaTimeDisplay = t("errors.invalidTime", "Heure invalide");

  if (scheduledSpaTime) {
    const spaDateTimeFromDetails =
      bookingDetails.spaDateTime || bookingDetails.spaInfo?.scheduledDateTime;
    const spaEndDateTimeFromDetails =
      bookingDetails.spaEndDateTime || bookingDetails.spaInfo?.endDateTime;

    const startTimeObj = getJsDate(spaDateTimeFromDetails);
    let endTimeObj = spaEndDateTimeFromDetails
      ? getJsDate(spaEndDateTimeFromDetails)
      : null;

    if (startTimeObj) {
      if (!endTimeObj) {
        let actualSlotDurationMinutes = 120; // Default duration
        const spaSettingsForDuration =
          bookingDetails.spaSettings ||
          bookingDetails.priceDetailsSnapshot?.spaSettings;

        if (
          bookingDetails.spaSlotDuration &&
          typeof bookingDetails.spaSlotDuration === "number" &&
          bookingDetails.spaSlotDuration > 0
        ) {
          actualSlotDurationMinutes = bookingDetails.spaSlotDuration;
        } else if (
          bookingDetails.spaInfo?.slots?.length > 0 &&
          spaSettingsForDuration?.slotDurationMinutes
        ) {
          actualSlotDurationMinutes =
            bookingDetails.spaInfo.slots.length *
            spaSettingsForDuration.slotDurationMinutes;
        }
        if (actualSlotDurationMinutes > 0) {
          try {
            endTimeObj = addMinutes(startTimeObj, actualSlotDurationMinutes);
          } catch (e) {
            console.error("Error calculating SPA end time from duration:", e);
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
          spaTimeDisplay = `${startTimeString} (Durée non spécifiée)`;
        }
      } catch (e) {
        console.error("Error formatting SPA times for display:", e);
      }
    }
  }

  // Free Drinks "Choose Later" Logic
  const needsNonAlcoholicChoice =
    bookingDetails.freeDrinkInfo?.needsNonAlcoholicChoice === true;
  const nonAlcoholicChoiceGrantors =
    bookingDetails.freeDrinkInfo?.nonAlcoholicChoiceGrantors || [];

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
          {/* Stay Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.stayDetails.title")}
            </h2>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.stayDetails.checkIn_label",
                  "Arrivée:"
                )}
              </strong>{" "}
              {formatDate(bookingDetails.arrivalDate)}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.stayDetails.arrivalTime_label",
                  "Heure d'arrivée:"
                )}
              </strong>{" "}
              {formatTime(bookingDetails.arrivalTime)}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.stayDetails.checkOut_label",
                  "Départ:"
                )}
              </strong>{" "}
              {formatDate(bookingDetails.departureDate)}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.stayDetails.travelers_label",
                  "Voyageurs:"
                )}
              </strong>{" "}
              {bookingDetails.adults}{" "}
              {t("bookingConfirmation.adults", "adulte(s)")}
              {bookingDetails.children > 0
                ? `, ${bookingDetails.children} ${t(
                    "bookingConfirmation.children",
                    "enfant(s)"
                  )}`
                : ""}
            </p>
            {scheduledSpaTime && (
              <p className="pt-2 mt-2 text-sm border-t border-gray-200">
                <CalendarClock
                  size={14}
                  className="inline-block mr-1 align-text-bottom text-brandColor"
                />
                <span className="font-semibold">
                  {t(
                    "bookingConfirmation.success.sections.spaTime.scheduledTitle",
                    "Séance SPA:"
                  )}
                </span>{" "}
                {formatDate(
                  bookingDetails.spaDateTime ||
                    bookingDetails.spaInfo?.scheduledDateTime
                )}{" "}
                <span className="font-medium">{spaTimeDisplay}</span>
              </p>
            )}
          </div>

          {/* Guest Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.guestDetails.title")}
            </h2>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.guestDetails.fullName_label",
                  "Nom complet:"
                )}
              </strong>{" "}
              {bookingDetails.guestName ||
                `${bookingDetails.firstName} ${bookingDetails.lastName}`}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.guestDetails.email_label",
                  "Email:"
                )}
              </strong>{" "}
              {bookingDetails.email}
            </p>
            {bookingDetails.phone && (
              <p>
                <strong className="font-medium">
                  {t(
                    "bookingConfirmation.success.sections.guestDetails.phone_label",
                    "Téléphone:"
                  )}
                </strong>{" "}
                {bookingDetails.phone}
              </p>
            )}
          </div>

          {/* Price Details - Including Paid Extras AND Free Drinks */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.priceDetails.title")}
            </h2>
            <p className="text-sm item-line">
              <span>
                {t(
                  "bookingConfirmation.success.sections.priceDetails.basePrice_label",
                  "Prix de base du séjour "
                )}
              </span>
              <span className="price-value">
                {formatPrice(
                  bookingDetails.priceBreakdown?.roomBasePrice ||
                    bookingDetails.basePrice ||
                    0
                )}
                €
              </span>
            </p>
            {Number(
              bookingDetails.priceBreakdown?.calculatedGuestFees ||
                bookingDetails.guestFees ||
                0
            ) > 0 && (
              <p className="text-sm item-line">
                <span>
                  {t(
                    "bookingConfirmation.success.sections.priceDetails.guestFees_label",
                    `Frais pour ${calculateExtraGuests()} pers. suppl.`
                  )}
                </span>
                <span className="price-value">
                  {formatPrice(
                    bookingDetails.priceBreakdown?.calculatedGuestFees ||
                      bookingDetails.guestFees
                  )}
                  €
                </span>
              </p>
            )}

            {/* Paid Extras */}
            {bookingDetails.extras?.length > 0 && (
              <div className="mt-3 sub-section">
                <h3 className="flex items-center mb-2 text-base font-semibold text-gray-800">
                  <ShoppingBagIcon
                    size={18}
                    className="inline-block mr-2 text-brandColor"
                  />
                  {t(
                    "bookingConfirmation.success.sections.paidExtras.title",
                    "Extras Payants"
                  )}
                </h3>
                {bookingDetails.extras.map((extra, index) => {
                  const hasExtraPerson =
                    extra.extraPersonQuantity > 0 &&
                    parseFloat(extra.extraPersonAmount || 0) > 0;
                  return (
                    <div
                      key={`paid-extra-${index}-${extra.id || index}`}
                      className="mb-1"
                    >
                      <p className="text-sm item-line">
                        <span>
                          {renderExtraName(extra)} (x{extra.quantity || 1})
                        </span>
                        <span className="price-value">
                          {formatPrice(extra.amount)}€
                        </span>
                      </p>
                      {hasExtraPerson && (
                        <p className="block text-xs text-gray-600 pl-7 sub-item-line">
                          {" "}
                          {/* Increased pl for more indent */}
                          {`↳ ${t("extras.additionalPerson", "pers. sup.")} x${
                            extra.extraPersonQuantity
                          } : ${formatPrice(extra.extraPersonAmount)}€`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Free Drinks */}
            {bookingDetails.processedFreeDrinks &&
              bookingDetails.processedFreeDrinks.length > 0 && (
                <div className="mt-3 sub-section">
                  <h3 className="flex items-center mb-2 text-base font-semibold text-green-700">
                    <GiftIcon
                      size={18}
                      className="inline-block mr-2 text-green-600"
                    />
                    {t(
                      "bookingConfirmation.success.sections.freeDrinks.title",
                      "Boissons Offertes"
                    )}
                  </h3>
                  {bookingDetails.processedFreeDrinks.map((drink, index) => (
                    <p
                      key={drink.id || `free-drink-${index}-${drink.name}`}
                      className="text-sm item-line text-green-600 mb-0.5"
                    >
                      <span>
                        {drink.name} (x{drink.quantity})
                      </span>
                    </p>
                  ))}
                </div>
              )}

            {/* Discounts */}
            {parseFloat(
              bookingDetails.priceBreakdown?.appliedLongStayDiscount || 0
            ) > 0 && (
              <p className="mt-3 text-sm text-orange-600 discount-text item-line">
                <span>
                  {t(
                    "bookingConfirmation.success.sections.priceDetails.longStayDiscount_label",
                    "Réduction long séjour"
                  )}
                  {bookingDetails.priceDetailsSnapshot?.settings
                    ?.lengthOfStayDiscount?.discountPercentage ||
                  bookingDetails.priceBreakdown?.settings?.lengthOfStayDiscount
                    ?.discountPercentage
                    ? ` (${
                        bookingDetails.priceDetailsSnapshot?.settings
                          .lengthOfStayDiscount.discountPercentage ||
                        bookingDetails.priceBreakdown.settings
                          .lengthOfStayDiscount.discountPercentage
                      }%)`
                    : ""}
                </span>
                <span className="price-value">
                  -
                  {formatPrice(
                    bookingDetails.priceBreakdown?.appliedLongStayDiscount
                  )}
                  €
                </span>
              </p>
            )}
            {bookingDetails.couponApplied &&
              parseFloat(bookingDetails.couponApplied.discount || 0) > 0 && (
                <p className="mt-1 text-sm text-green-600 discount-text item-line">
                  <span>
                    {t(
                      "bookingConfirmation.success.sections.priceDetails.promoCode_label",
                      `Code Promo (${bookingDetails.couponApplied.code})`
                    )}
                    {bookingDetails.couponApplied.type === "percentage"
                      ? ` (${bookingDetails.couponApplied.percentageValue}%)`
                      : ""}
                  </span>
                  <span className="price-value">
                    -{formatPrice(bookingDetails.couponApplied.discount)}€
                  </span>
                </p>
              )}

            {/* Total */}
            <div className="mt-4 total-section">
              <p className="total-text item-line">
                <span>
                  {t(
                    "bookingConfirmation.success.sections.priceDetails.total_label",
                  )}
                </span>
                <span className="price-value">
                  {formatPrice(displayPrice)}€
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("terms.generalConditions")}: {t("terms.accepted")}
              </p>
            </div>
          </div>

          {/* Address */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.address.title")}
            </h2>
            <p>
              {bookingDetails.street ||
                t("bookingConfirmation.notProvided", "Non fourni")}
            </p>
            <p>
              {bookingDetails.postalCode || ""} {bookingDetails.location || ""}
            </p>
            <p>{bookingDetails.country || ""}</p>
          </div>

          {/* SPA Schedule Later Section */}
          {needsSpaScheduling && (
            <div className="details-card spa-schedule-later-card">
              <h2 className="flex items-center titleConfirmation spa-schedule-title">
                <CalendarClock
                  size={18}
                  className="inline-block mr-2 text-brandColor"
                />
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterTitle"
                )}
              </h2>
              <p className="mb-1 text-sm">
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterInstruction"
                )}
              </p>
              <p className="mb-1 text-sm font-semibold text-green-600 contact-line">
                <a
                  href={`mailto:${t(
                    "emailDefaults.spaContactEmail",
                    "fermedebasseilles@gmail.com"
                  )}`}
                  className="text-brandColor hover:underline"
                >
                  {t(
                    "emailDefaults.spaContactEmail",
                    "fermedebasseilles@gmail.com"
                  )}
                </a>
              </p>
              <p className="text-xs text-gray-600">
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterPriority"
                )}
              </p>
            </div>
          )}

          {/* Non-Alcoholic Drink Choice Later Section */}
          {needsNonAlcoholicChoice && nonAlcoholicChoiceGrantors.length > 0 && (
            <div className="details-card non-alcoholic-choice-later-card">
              <h2 className="flex items-center titleConfirmation non-alcoholic-title">
                <Wine
                  size={18}
                  className="inline-block mr-2 text-orange-500"
                />
                {t(
                  "bookingConfirmation.success.sections.nonAlcoholicChoice.title"
                )}
              </h2>
              {nonAlcoholicChoiceGrantors.map((grantor, index) => {
                // 1. Get the translated template string
                const instructionTemplate = t(
                  "bookingConfirmation.success.sections.nonAlcoholicChoice.instructionFor"
                );

                // 2. Split the template by our placeholder
                const parts = instructionTemplate.split("__GRANTOR_NAME__");

                return (
                  <p key={`na-instr-${index}`} className="mb-1 text-sm">
                    {/* 3. Reconstruct with the bolded grantor */}
                    {parts[0]} {/* Text before placeholder */}
                    <strong>{grantor}</strong> {/* The bolded grantor name */}
                    {parts[1]} {/* Text after placeholder (if any) */}
                  </p>
                );
              })}
              <p className="mb-1 text-sm font-semibold text-green-600 contact-line">
                <a
                  href={`mailto:${t(
                    "emailDefaults.spaContactEmail",
                    "fermedebasseilles@gmail.com"
                  )}?subject=${encodeURIComponent(
                    t(
                      "bookingConfirmation.emailSubjects.nonAlcoholicChoice",
                      "Choix boisson non-alcoolisée - Réservation"
                    ) + ` ${bookingDetails.smoobuId || bookingDetails.id || ""}`
                  )}&body=${encodeURIComponent(
                    t(
                      "bookingConfirmation.emailBodies.nonAlcoholicChoice",
                      `Bonjour,\n\nConcernant ma réservation (Réf: ${
                        bookingDetails.smoobuId || bookingDetails.id || ""
                      }), pour l'offre ${nonAlcoholicChoiceGrantors.join(
                        " et "
                      )}, je souhaiterais préciser mon choix de boisson non-alcoolisée.\n\nMerci,\n${
                        bookingDetails.firstName
                      } ${bookingDetails.lastName}`,
                      {
                        bookingId:
                          bookingDetails.smoobuId || bookingDetails.id || "",
                        grantors: nonAlcoholicChoiceGrantors.join(" et "),
                        guestName: `${bookingDetails.firstName} ${bookingDetails.lastName}`,
                      }
                    )
                  )}`}
                  className="text-brandColor hover:underline"
                >
                  {t(
                    "emailDefaults.spaContactEmail",
                    "fermedebasseilles@gmail.com"
                  )}
                </a>

              </p>
              <p className="text-xs text-gray-600">
                {t(
                  "bookingConfirmation.success.sections.nonAlcoholicChoice.contactPrompt"
                )}
              </p>
            </div>
          )}
        </div>{" "}
        {/* End of grid */}
        <div className="actions">
          <button onClick={() => navigate("/")} className="button-primary">
            {t("bookingConfirmation.success.buttons.backHome")}
          </button>
          <button onClick={() => window.print()} className="button-secondary">
            {t("bookingConfirmation.success.buttons.print")}
          </button>
        </div>
      </div>{" "}
      {/* End of card */}
    </div> /* End of container */
  );
};

export default BookingConfirmation;
