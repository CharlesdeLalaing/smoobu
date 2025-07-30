// src/pages/BookingConfirmation.js
import React, { useEffect, useState, useCallback } from "react"; // Added useCallback
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
  InfoIcon, // Using InfoIcon instead of Wine for neutrality
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

  const [bookingDetails, setBookingDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const paymentIntentIdFromUrl = searchParams.get("payment_intent");
  const [displayPrice, setDisplayPrice] = useState(null);

  // Main page status: 'initialLoading', 'fetching', 'success', 'error'
  const [pageStatus, setPageStatus] = useState("initialLoading");
  const [pageError, setPageError] = useState(null); // For storing specific error messages

  // State to track if the price details section is ready to be displayed
  const [isPriceDetailsReady, setIsPriceDetailsReady] = useState(false);

  const currentLocale = i18n.language;
  const currentDateFnsLocale = getDateFnLocale(currentLocale);

  // Function to check if bookingDetails are complete enough to display the page
  const areBookingDetailsSufficient = useCallback((details) => {
    if (!details) return false;

    const hasBaseInfo =
      details.arrivalDate &&
      details.departureDate &&
      details.email &&
      details.guestName;
    const hasPriceBreakdownStructure =
      typeof details.priceBreakdown !== "undefined";
    const hasExtrasStructure = typeof details.extras !== "undefined";
    const hasFreeDrinksStructure =
      typeof details.processedFreeDrinks !== "undefined";
    const hasSpaInfoStructure =
      typeof details.spaInfo !== "undefined" ||
      typeof details.spaBookingPreference !== "undefined"; // Check for either

    // Price can be 0, so check for its existence as a property
    const hasPriceField =
      details.hasOwnProperty("price") ||
      (details.priceBreakdown &&
        details.priceBreakdown.hasOwnProperty("finalPayableAmount"));

    return (
      hasBaseInfo &&
      hasPriceBreakdownStructure &&
      hasExtrasStructure &&
      hasFreeDrinksStructure &&
      hasSpaInfoStructure &&
      hasPriceField
    );
  }, []); // Empty dependency array as it doesn't depend on component state/props

  const calculateAndSetFinalPrice = useCallback((data) => {
    if (!data) return;

    // Always calculate manually to ensure all components are included
    const basePrice = parseFloat(
      data.priceBreakdown?.roomBasePrice || data.basePrice || 0
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
      data.priceBreakdown?.appliedLongStayDiscount || 0
    );
    const couponDiscount = parseFloat(
      data.priceBreakdown?.appliedCouponDiscount ||
        data.couponApplied?.discount ||
        0
    );
    const finalPrice =
      basePrice + guestFees + extrasTotal - longStayDiscount - couponDiscount;
    setDisplayPrice(finalPrice >= 0 ? finalPrice : 0);
  }, []); // Empty dependency array

  const fetchBookingDetails = useCallback(
    async (paymentIntentId) => {
      setPageStatus("fetching");
      setPageError(null);
      let attempts = 0;
      const maxAttempts = 8; // Slightly increased
      let currentRetryDelay = 2000; // Initial delay 2s
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
              console.log(
                `Attempt ${attempts}/${maxAttempts}: Booking not found yet for PI ${paymentIntentId}, retrying in ${
                  currentRetryDelay / 1000
                }s...`
              );
              setTimeout(attemptFetch, currentRetryDelay);
              currentRetryDelay = Math.min(currentRetryDelay * 1.5, 12000); // Max 12s
              return;
            } else {
              throw new Error(
                t(
                  "bookingConfirmation.error.notFound",
                  "Booking details not found. Please check your email or contact us."
                )
              );
            }
          }
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `${t(
                "bookingConfirmation.error.fetchFailed",
                "Failed to fetch booking details."
              )} Status: ${response.status}. Details: ${errorText}`
            );
          }

          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }

          if (areBookingDetailsSufficient(data)) {
            setBookingDetails(data);
            setPageStatus("success");
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              console.log(
                `Attempt ${attempts}/${maxAttempts}: Booking data fetched for PI ${paymentIntentId} but insufficient, retrying in ${
                  currentRetryDelay / 1000
                }s...`
              );
              setTimeout(attemptFetch, currentRetryDelay);
              currentRetryDelay = Math.min(currentRetryDelay * 1.5, 12000);
              return;
            } else {
              console.error(
                `Booking data for PI ${paymentIntentId} remained insufficient after ${maxAttempts} retries:`,
                data
              );
              setBookingDetails(data); // Set what we have
              setPageError(
                t(
                  "bookingConfirmation.error.incompleteData",
                  "Booking details appear incomplete. Please contact support."
                )
              );
              setPageStatus("error"); // Or a specific status like "partialError"
            }
          }
        } catch (error) {
          console.error(
            `BookingConfirmation: Error in fetchBookingDetails attempt ${attempts}/${maxAttempts} for PI ${paymentIntentId}:`,
            error
          );
          if (
            attempts < maxAttempts - 1 &&
            (error.message.includes("not found") ||
              error.message.includes("insufficient"))
          ) {
            // Retry is handled by the logic within the try block
          } else {
            setPageError(
              error.message ||
                t("bookingConfirmation.error.message", "An error occurred...")
            );
            setPageStatus("error");
          }
        }
      };
      attemptFetch();
    },
    [t, areBookingDetailsSufficient]
  ); // Dependencies for fetchBookingDetails

  // Effect to load booking details (from localStorage or API)
  useEffect(() => {
    const storedBookingData = localStorage.getItem("bookingData");
    if (storedBookingData) {
      try {
        const parsedData = JSON.parse(storedBookingData);
        if (areBookingDetailsSufficient(parsedData)) {
          setBookingDetails(parsedData);
          setPageStatus("success");
          localStorage.removeItem("bookingData"); // Clean up after successful load
        } else {
          console.warn(
            "Data from localStorage insufficient, attempting API fetch."
          );
          localStorage.removeItem("bookingData"); // Clear potentially bad/old data
          if (paymentIntentIdFromUrl) {
            fetchBookingDetails(paymentIntentIdFromUrl);
          } else {
            setPageError(
              t(
                "bookingConfirmation.error.noPaymentIntent",
                "Cannot retrieve booking without payment reference."
              )
            );
            setPageStatus("error");
          }
        }
      } catch (error) {
        console.error("Error parsing booking data from localStorage:", error);
        localStorage.removeItem("bookingData"); // Clear potentially bad data
        if (paymentIntentIdFromUrl) {
          fetchBookingDetails(paymentIntentIdFromUrl);
        } else {
          setPageError(
            t(
              "bookingConfirmation.error.localStorageError",
              "Error loading booking data."
            )
          );
          setPageStatus("error");
        }
      }
    } else if (paymentIntentIdFromUrl) {
      fetchBookingDetails(paymentIntentIdFromUrl);
    } else {
      console.error(
        "Cannot display confirmation: No booking data source found (localStorage or payment_intent)."
      );
      setPageError(
        t(
          "bookingConfirmation.error.noDataSource",
          "No booking reference found."
        )
      );
      setPageStatus("error");
    }
  }, [
    paymentIntentIdFromUrl,
    fetchBookingDetails,
    areBookingDetailsSufficient,
    t,
  ]);

  // Effect to calculate final price and set price details readiness
  useEffect(() => {
    if (bookingDetails && pageStatus === "success") {
      calculateAndSetFinalPrice(bookingDetails);
    }
  }, [bookingDetails, pageStatus, calculateAndSetFinalPrice]);

  useEffect(() => {
    // Price details are considered ready if the main page status is success
    // and the displayPrice has been calculated (is not null).
    if (pageStatus === "success" && displayPrice !== null) {
      setIsPriceDetailsReady(true);
    } else {
      setIsPriceDetailsReady(false); // Reset if conditions aren't met
    }
  }, [pageStatus, displayPrice]);

  // Effect to set i18next language based on bookingDetails.language
  useEffect(() => {
    if (bookingDetails?.language && i18n.language !== bookingDetails.language) {
      i18n.changeLanguage(bookingDetails.language);
    }
  }, [bookingDetails, i18n]);

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
        /* ignore error, try next */
      }
    }
    if (
      typeof timeStringOrDate === "string" &&
      /^\d{2}:\d{2}$/.test(timeStringOrDate)
    )
      return timeStringOrDate;
    return "-";
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

  // Main page loading state
  if (pageStatus === "initialLoading" || pageStatus === "fetching") {
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
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <h2 className="mb-2 text-xl font-semibold">
            {pageStatus === "initialLoading"
              ? t(
                  "bookingConfirmation.loading.titlePage",
                  "Loading Confirmation..."
                )
              : t(
                  "bookingConfirmation.loading.title",
                  "Processing your reservation..."
                )}
          </h2>
          <p>
            {pageStatus === "initialLoading"
              ? t(
                  "bookingConfirmation.loading.messagePage",
                  "Please wait while we retrieve your booking details."
                )
              : t(
                  "bookingConfirmation.loading.message",
                  "This may take a moment while we finalize everything."
                )}
          </p>
          <div
            className="mt-4 spinner"
            style={{
              margin: "20px auto",
              width: "40px",
              height: "40px",
              borderTopColor: "#668E73",
            }}
          ></div>
        </div>
      </div>
    );
  }

  // Error state for the entire page
  if (pageStatus === "error" || !bookingDetails) {
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
            {pageError ||
              t(
                "bookingConfirmation.error.message",
                "An unexpected error occurred."
              )}
          </p>
          <button onClick={() => navigate("/")} className="button-primary">
            {t("bookingConfirmation.error.backHomeButton", "Back to Home")}
          </button>
        </div>
      </div>
    );
  }

  // If pageStatus is "success" and bookingDetails are available
  const needsSpaScheduling = bookingDetails.spaBookingPreference === "later";
  const scheduledSpaTime =
    (bookingDetails.spaDateTime || bookingDetails.spaInfo?.scheduledDateTime) &&
    bookingDetails.spaBookingPreference === "scheduled";
  let spaTimeDisplay = t("errors.invalidTime", "Time not set");

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
        let actualSlotDurationMinutes = 120; // Default or fetch from settings
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
          } catch (e) {
            /* ignore */
          }
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
          spaTimeDisplay = `${startTimeString} (Duration not specified)`;
      } catch (e) {
        /* ignore */
      }
    }
  }

  const needsNonAlcoholicChoice =
    bookingDetails.freeDrinkInfo?.needsNonAlcoholicChoice === true;
  const nonAlcoholicChoiceGrantorKeys =
    bookingDetails.freeDrinkInfo?.nonAlcoholicChoiceGrantors || [];

  // Simple inline loader component for sections
  const SectionLoader = ({ text }) => (
    <div className="py-6 text-sm text-center text-gray-500">
      <div className="inline-block w-6 h-6 mr-3 border-4 border-gray-200 rounded-full spinner border-t-brandColor animate-spin"></div>
      {text || t("bookingConfirmation.loading.details", "Loading details...")}
    </div>
  );

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
                  "bookingConfirmation.success.sections.stayDetails.checkIn_label"
                )}
              </strong>{" "}
              {formatDate(bookingDetails.arrivalDate)}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.stayDetails.arrivalTime_label"
                )}
              </strong>{" "}
              {formatTime(bookingDetails.arrivalTime)}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.stayDetails.checkOut_label"
                )}
              </strong>{" "}
              {formatDate(bookingDetails.departureDate)}
            </p>
            <p>
              <strong className="font-medium">
                {t(
                  "bookingConfirmation.success.sections.stayDetails.travelers_label"
                )}
              </strong>{" "}
              {bookingDetails.adults} {t("bookingConfirmation.adults")}
              {parseInt(bookingDetails.children || 0) > 0
                ? `, ${bookingDetails.children} ${t(
                    "bookingConfirmation.children"
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
              {bookingDetails.guestName}
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
            {!isPriceDetailsReady ? (
              <SectionLoader
                text={t(
                  "bookingConfirmation.loading.priceDetails",
                  "Finalizing price details..."
                )}
              />
            ) : (
              <>
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

                {/* Paid Extras - defensive check */}
                {bookingDetails.extras && bookingDetails.extras.length > 0 && (
                  <div className="mt-3 sub-section">
                    <h3 className="flex items-center mb-2 text-base font-semibold text-gray-800">
                      <ShoppingBagIcon
                        size={18}
                        className="inline-block mr-2 text-brandColor"
                      />
                      {t(
                        "bookingConfirmation.success.sections.paidExtras.title"
                      )}
                    </h3>
                    {bookingDetails.extras.map((extra, index) => {
                      const displayName = t(extra.nameKeyForClient, extra.name);
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

                {/* Free Drinks - defensive check */}
                {bookingDetails.processedFreeDrinks &&
                  bookingDetails.processedFreeDrinks.length > 0 && (
                    <div className="mt-3 sub-section">
                      <h3 className="flex items-center mb-2 text-base font-semibold text-green-700">
                        <GiftIcon
                          size={18}
                          className="inline-block mr-2 text-green-600"
                        />
                        {t(
                          "bookingConfirmation.success.sections.freeDrinks.title"
                        )}
                      </h3>
                      {bookingDetails.processedFreeDrinks.map(
                        (drink, index) => {
                          const grantorText = t(
                            drink.grantorNameKeyForClient,
                            drink.paidExtraGrantor
                          );
                          let choiceOrDrinkText;
                          if (drink.chooseNonAlcoholicLater) {
                            choiceOrDrinkText = t(
                              drink.choiceNameKeyForClient,
                              drink.drinkDetails
                            );
                          } else {
                            choiceOrDrinkText = t(
                              drink.drinkNameKeyForClient,
                              drink.drinkDetails
                            );
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
                        }
                      )}
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
                      bookingDetails.priceBreakdown?.settings
                        ?.lengthOfStayDiscount?.discountPercentage
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
                  parseFloat(bookingDetails.couponApplied.discount || 0) >
                    0 && (
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
              </>
            )}
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
              {!(
                bookingDetails.spaInfo || bookingDetails.spaBookingPreference
              ) ? ( // Check if SPA info is loaded before showing content
                <SectionLoader
                  text={t(
                    "bookingConfirmation.loading.spaInfo",
                    "Loading SPA details..."
                  )}
                />
              ) : (
                <>
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
                          {t(
                            "bookingConfirmation.emailDefaults.spaContactPhone"
                          )}
                        </a>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">
                    {t(
                      "bookingConfirmation.success.sections.spaTime.scheduleLaterPriority"
                    )}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Non-Alcoholic Drink Choice Later Section */}
          {needsNonAlcoholicChoice &&
            nonAlcoholicChoiceGrantorKeys.length > 0 && (
              <div className="details-card non-alcoholic-choice-later-card">
                {!(
                  bookingDetails.freeDrinkInfo &&
                  bookingDetails.freeDrinkInfo.nonAlcoholicChoiceGrantors
                ) ? (
                  <SectionLoader
                    text={t(
                      "bookingConfirmation.loading.drinkChoiceInfo",
                      "Loading drink choice details..."
                    )}
                  />
                ) : (
                  <>
                    <h2 className="flex items-center titleConfirmation non-alcoholic-title">
                      <InfoIcon
                        size={18}
                        className="inline-block mr-2 text-orange-500"
                      />{" "}
                      {/* Using InfoIcon now */}
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
                      );
                      const instructionTemplate = t(
                        "bookingConfirmation.success.sections.nonAlcoholicChoice.instructionFor"
                      );
                      const parts =
                        instructionTemplate.split("__GRANTOR_NAME__");
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
                            ` ${
                              bookingDetails.smoobuId || bookingDetails.id || ""
                            }`
                        )}&body=${encodeURIComponent(
                          t(
                            "bookingConfirmation.emailBodies.nonAlcoholicChoice",
                            {
                              bookingId:
                                bookingDetails.smoobuId ||
                                bookingDetails.id ||
                                "",
                              grantors: nonAlcoholicChoiceGrantorKeys
                                .map((key) =>
                                  t(
                                    key,
                                    key.substring(key.lastIndexOf(".") + 1)
                                  )
                                )
                                .join(" et "),
                              guestName: `${bookingDetails.firstName} ${bookingDetails.lastName}`,
                            }
                          )
                        )}`}
                        className="text-brandColor hover:underline"
                      >
                        {t("bookingConfirmation.emailDefaults.spaContactEmail")}
                      </a>
                      {t(
                        "bookingConfirmation.emailDefaults.spaContactPhone"
                      ) && (
                        <>
                          {" "}
                          /{" "}
                          <a
                            href={`tel:${t(
                              "bookingConfirmation.emailDefaults.spaContactPhone"
                            ).replace(/\s/g, "")}`}
                            className="text-brandColor hover:underline"
                          >
                            {t(
                              "bookingConfirmation.emailDefaults.spaContactPhone"
                            )}
                          </a>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">
                      {t(
                        "bookingConfirmation.success.sections.nonAlcoholicChoice.contactPrompt"
                      )}
                    </p>
                  </>
                )}
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
    </div>
  );
};

export default BookingConfirmation;
