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
  Wine, // Assuming you meant to use InfoIcon or similar for non-alcoholic, Wine for general drinks
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
    if (dateValue && typeof dateValue.toDate === "function") {
      // Firestore Timestamp (client SDK)
      date = dateValue.toDate();
    } else if (
      dateValue &&
      typeof dateValue === "object" &&
      dateValue._seconds !== undefined
    ) {
      // Firestore Timestamp (raw object, e.g. from Admin SDK or JSON)
      date = new Date(
        dateValue._seconds * 1000 + (dateValue._nanoseconds || 0) / 1000000
      );
    } else {
      // ISO strings or other parsable date strings
      date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch (e) {
    return null;
  }
};

const BookingConfirmation = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const paymentIntentIdFromUrl = searchParams.get("payment_intent");
  const [displayPrice, setDisplayPrice] = useState(null);
  const [priceCalculated, setPriceCalculated] = useState(false);

  const currentLocale = i18n.language;
  const currentDateFnsLocale = getDateFnLocale(currentLocale);

  // Effect to load booking details (from localStorage or API)
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
        if (paymentIntentIdFromUrl) {
          fetchBookingDetails(paymentIntentIdFromUrl);
        } else {
          setStatus("error");
        }
      }
    } else if (paymentIntentIdFromUrl) {
      fetchBookingDetails(paymentIntentIdFromUrl);
    } else {
      console.error("Cannot display confirmation: No booking data found.");
      setStatus("error");
    }
  }, [paymentIntentIdFromUrl]); // Only run when paymentIntentIdFromUrl changes

  // Effect to calculate final price once bookingDetails are available
  useEffect(() => {
    if (bookingDetails && !priceCalculated) {
      calculateAndSetFinalPrice(bookingDetails);
      setPriceCalculated(true);
    }
  }, [bookingDetails, priceCalculated]);

  // Effect to set i18next language based on bookingDetails.language
  useEffect(() => {
    if (bookingDetails?.language && i18n.language !== bookingDetails.language) {
      i18n.changeLanguage(bookingDetails.language);
    }
  }, [bookingDetails, i18n]);

  const calculateAndSetFinalPrice = (data) => {
    if (!data) return;
    // Prefer finalPayableAmount from priceBreakdown if available (most accurate)
    if (
      data.priceBreakdown?.finalPayableAmount !== undefined &&
      !isNaN(parseFloat(data.priceBreakdown.finalPayableAmount))
    ) {
      setDisplayPrice(parseFloat(data.priceBreakdown.finalPayableAmount));
      return;
    }
    if (
      data.price !== null &&
      data.price !== undefined &&
      !isNaN(parseFloat(data.price))
    ) {
      setDisplayPrice(parseFloat(data.price));
      return;
    }
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
    const maxAttempts = 7;
    const retryDelay = 3000;
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const attemptFetch = async () => {
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
            setTimeout(attemptFetch, retryDelay);
            return;
          } else {
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
          throw new Error(
            `${t(
              "bookingConfirmation.error.fetchFailed",
              "Échec de la récupération des détails de la réservation."
            )} Statut: ${response.status}.`
          );
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
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
          // Retry is handled by the 404 block
        } else {
          setStatus("error");
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
      } catch (e) {}
    }
    if (
      typeof timeStringOrDate === "string" &&
      /^\d{2}:\d{2}$/.test(timeStringOrDate)
    )
      return timeStringOrDate;
    return "-";
  };

  // renderExtraName will now use nameKeyForClient for translation
  const renderPaidExtraName = (extra) => {
    // 'extra.name' is the French fallback, 'extra.nameKeyForClient' is the primary i18n key
    // 'extra.originalClientName' could be another fallback if keys are totally missing
    return t(
      extra.nameKeyForClient,
      extra.name ||
        extra.originalClientName ||
        t("bookingConfirmation.unknownExtra", "Extra")
    );
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined || isNaN(parseFloat(price)))
      return "0.00";
    return parseFloat(price).toFixed(2);
  };

  const calculateExtraGuests = () => {
    if (!bookingDetails) return 0;
    const totalGuests =
      (parseInt(bookingDetails.adults) || 0) +
      (parseInt(bookingDetails.children) || 0);
    const startingGuests =
      bookingDetails.priceBreakdown?.settings?.startingAtGuest ||
      bookingDetails.priceDetailsSnapshot?.settings?.startingAtGuest ||
      2;
    return Math.max(0, totalGuests - Number(startingGuests));
  };

  if (status === "loading") {
    return (
      /* ... loading spinner JSX ... */ <div
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
      /* ... error display JSX ... */ <div
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
              "Une erreur est survenue..."
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

  const needsSpaScheduling = bookingDetails.spaBookingPreference === "later";
  const scheduledSpaTime =
    (bookingDetails.spaDateTime || bookingDetails.spaInfo?.scheduledDateTime) &&
    bookingDetails.spaBookingPreference === "scheduled";
  let spaTimeDisplay = t("errors.invalidTime", "Heure invalide");

  if (scheduledSpaTime) {
    const spaDateTimeForDisplay =
      bookingDetails.spaDateTime || bookingDetails.spaInfo?.scheduledDateTime;
    const spaEndDateTimeForDisplay =
      bookingDetails.spaEndDateTime || bookingDetails.spaInfo?.endDateTime;
    const startTimeObj = getJsDate(spaDateTimeForDisplay);
    let endTimeObj = spaEndDateTimeForDisplay
      ? getJsDate(spaEndDateTimeForDisplay)
      : null;

    if (startTimeObj) {
      if (!endTimeObj) {
        let actualSlotDurationMinutes = 120;
        const spaSettingsForCalc =
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
          spaSettingsForCalc?.slotDurationMinutes
        ) {
          actualSlotDurationMinutes =
            bookingDetails.spaInfo.slots.length *
            spaSettingsForCalc.slotDurationMinutes;
        }
        if (actualSlotDurationMinutes > 0)
          try {
            endTimeObj = addMinutes(startTimeObj, actualSlotDurationMinutes);
          } catch (e) {}
      }
      try {
        const startTimeString = formatFn(startTimeObj, "HH:mm", {
          locale: currentDateFnsLocale,
        });
        const endTimeString = endTimeObj
          ? formatFn(endTimeObj, "HH:mm", { locale: currentDateFnsLocale })
          : null;
        if (startTimeString && endTimeString)
          spaTimeDisplay = `${startTimeString} - ${endTimeString}`;
        else if (startTimeString)
          spaTimeDisplay = `${startTimeString} (Durée non spécifiée)`;
      } catch (e) {}
    }
  }

  const needsNonAlcoholicChoice =
    bookingDetails.freeDrinkInfo?.needsNonAlcoholicChoice === true;
  const nonAlcoholicChoiceGrantorKeys =
    bookingDetails.freeDrinkInfo?.nonAlcoholicChoiceGrantors || []; // Expecting keys

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
              {parseInt(bookingDetails.children || 0) > 0
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
                    "bookingConfirmation.success.sections.spaTime.scheduledTitle"
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
                  "bookingConfirmation.success.sections.guestDetails.fullName_label"
                )}
              </strong>{" "}
              {bookingDetails.guestName ||
                `${bookingDetails.firstName} ${bookingDetails.lastName}`}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.guestDetails.email_label"
                )}
              </strong>{" "}
              {bookingDetails.email}
            </p>
            {bookingDetails.phone && (
              <p>
                <strong className="font-medium">
                  {t(
                    "bookingConfirmation.success.sections.guestDetails.phone_label"
                  )}
                </strong>{" "}
                {bookingDetails.phone}
              </p>
            )}
          </div>

          {/* Price Details Card */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.priceDetails.title")}
            </h2>
            <p className="text-sm item-line">
              <span>
                {t(
                  "bookingConfirmation.success.sections.priceDetails.basePrice_label"
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
                    { extraGuests: calculateExtraGuests() }
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
                  {t("bookingConfirmation.success.sections.paidExtras.title")}
                </h3>
                {bookingDetails.extras.map((extra, index) => {
                  const displayName = t(extra.nameKeyForClient, extra.name); // Use key, fallback to French name
                  const hasExtraPerson =
                    extra.extraPersonQuantity > 0 &&
                    parseFloat(extra.extraPersonAmount || 0) > 0;
                  return (
                    <div
                      key={`paid-extra-confirm-${extra.id || index}`}
                      className="mb-1"
                    >
                      <p className="text-sm item-line">
                        <span>
                          {displayName} (x{extra.quantity || 1})
                        </span>
                        <span className="price-value">
                          {formatPrice(extra.amount)}€
                        </span>
                      </p>
                      {hasExtraPerson && (
                        <p className="block text-xs text-gray-600 pl-7 sub-item-line">
                          {`↳ ${t("extras.additionalPerson")} x${
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
                    {t("bookingConfirmation.success.sections.freeDrinks.title")}
                  </h3>
                  {bookingDetails.processedFreeDrinks.map((drink, index) => {
                    const grantorText = t(
                      drink.grantorNameKeyForClient,
                      drink.paidExtraGrantor
                    ); // Grantor fallback is French
                    let choiceOrDrinkText;
                    if (drink.chooseNonAlcoholicLater) {
                      choiceOrDrinkText = t(
                        drink.choiceNameKeyForClient,
                        drink.drinkDetails
                      ); // drink.drinkDetails is French fallback
                    } else {
                      choiceOrDrinkText = t(
                        drink.drinkNameKeyForClient,
                        drink.drinkDetails
                      ); // drink.drinkDetails is French fallback
                    }
                    const displayName = `${grantorText}: ${choiceOrDrinkText}`;
                    return (
                      <p
                        key={drink.id || `free-drink-confirm-${index}`}
                        className="text-sm item-line text-green-600 mb-0.5"
                      >
                        <span>
                          {displayName} (x{drink.quantity})
                        </span>
                        <span className="font-semibold price-value">
                          {t("bookingConfirmation.included")}
                        </span>
                      </p>
                    );
                  })}
                </div>
              )}

            {/* Discounts */}
            {parseFloat(
              bookingDetails.priceBreakdown?.appliedLongStayDiscount || 0
            ) > 0 && (
              <p className="mt-3 text-sm text-orange-600 discount-text item-line">
                <span>
                  {t(
                    "bookingConfirmation.success.sections.priceDetails.longStayDiscount_label"
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
                      { code: bookingDetails.couponApplied.code }
                    )}
                    {bookingDetails.couponApplied.type === "percentage" &&
                    bookingDetails.couponApplied.percentageValue
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
                    "bookingConfirmation.success.sections.priceDetails.total_label"
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
              <p className="mb-1 text-sm font-semibold contact-line">
                <a
                  href={`mailto:${t(
                    "bookingConfirmation.emailDefaults.spaContactEmail"
                  )}`}
                  className="text-brandColor hover:underline"
                >
                  {t("bookingConfirmation.emailDefaults.spaContactEmail")}
                </a>
                {t("bookingConfirmation.emailDefaults.spaContactPhone") && (
                  <>
                    {" "}
                    /{" "}
                    <a
                      href={`tel:${t(
                        "bookingConfirmation.emailDefaults.spaContactPhone"
                      ).replace(/\s/g, "")}`}
                      className="text-brandColor hover:underline"
                    >
                      {t("bookingConfirmation.emailDefaults.spaContactPhone")}
                    </a>
                  </>
                )}
              </p>
              <p className="text-xs text-gray-600">
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterPriority"
                )}
              </p>
            </div>
          )}

          {/* Non-Alcoholic Drink Choice Later Section */}
          {needsNonAlcoholicChoice &&
            nonAlcoholicChoiceGrantorKeys.length > 0 && (
              <div className="details-card non-alcoholic-choice-later-card">
                <h2 className="flex items-center titleConfirmation non-alcoholic-title">
                  <Wine
                    size={18}
                    className="inline-block mr-2 text-orange-500"
                  />{" "}
                  {/* Changed Wine to InfoIcon for neutrality */}
                  {t(
                    "bookingConfirmation.success.sections.nonAlcoholicChoice.title"
                  )}
                </h2>
                {nonAlcoholicChoiceGrantorKeys.map((grantorKey, index) => {
                  const translatedGrantor = t(
                    grantorKey,
                    grantorKey
                      .substring(grantorKey.lastIndexOf(".") + 1)
                      .replace(/_/g, " ")
                  ); // Fallback: last part of key
                  const instructionTemplate = t(
                    "bookingConfirmation.success.sections.nonAlcoholicChoice.instructionFor"
                  );
                  const parts = instructionTemplate.split("__GRANTOR_NAME__");
                  return (
                    <p
                      key={`na-instr-confirm-${index}`}
                      className="mb-1 text-sm"
                    >
                      {parts[0]}
                      <strong>{translatedGrantor}</strong>
                      {parts[1]}
                    </p>
                  );
                })}
                <p className="mb-1 text-sm font-semibold contact-line">
                  <a
                    href={`mailto:${t(
                      "bookingConfirmation.emailDefaults.spaContactEmail"
                    )}?subject=${encodeURIComponent(
                      t(
                        "bookingConfirmation.emailSubjects.nonAlcoholicChoice"
                      ) +
                        ` ${bookingDetails.smoobuId || bookingDetails.id || ""}`
                    )}&body=${encodeURIComponent(
                      t("bookingConfirmation.emailBodies.nonAlcoholicChoice", {
                        bookingId:
                          bookingDetails.smoobuId || bookingDetails.id || "",
                        grantors: nonAlcoholicChoiceGrantorKeys
                          .map((key) =>
                            t(key, key.substring(key.lastIndexOf(".") + 1))
                          )
                          .join(" et "),
                        guestName: `${bookingDetails.firstName} ${bookingDetails.lastName}`,
                      })
                    )}`}
                    className="text-brandColor hover:underline"
                  >
                    {t("bookingConfirmation.emailDefaults.spaContactEmail")}
                  </a>
                  {t("bookingConfirmation.emailDefaults.spaContactPhone") && (
                    <>
                      {" "}
                      /{" "}
                      <a
                        href={`tel:${t(
                          "bookingConfirmation.emailDefaults.spaContactPhone"
                        ).replace(/\s/g, "")}`}
                        className="text-brandColor hover:underline"
                      >
                        {t("bookingConfirmation.emailDefaults.spaContactPhone")}
                      </a>
                    </>
                  )}
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
