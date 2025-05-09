import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom"; // Import useNavigate
import { useTranslation } from "react-i18next";
import logoBaseilles from "../assets/logoBaseilles.webp"; // Verify path to logo
import { addMinutes, format as formatFn } from "date-fns";
import { fr } from "date-fns/locale"; // Import French locale
import "../assets/bookingConfirmation.css"; // Verify path to CSS
// Import an icon if desired, e.g., from lucide-react
import { CalendarClock } from "lucide-react"; // Make sure to install lucide-react if using: npm install lucide-react

const BookingConfirmation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate(); // Hook for navigation back home
  const [status, setStatus] = useState("loading"); // Possible values: 'loading', 'success', 'error'
  const [bookingDetails, setBookingDetails] = useState(null); // State to hold the confirmed booking data
  const [searchParams] = useSearchParams(); // Hook to read URL query parameters
  const paymentIntent = searchParams.get("payment_intent"); // Get payment_intent value from URL
  const [displayPrice, setDisplayPrice] = useState(null); // State for the final price shown to user
  const [priceCalculated, setPriceCalculated] = useState(false); // Flag to run price calculation only once

  // --- Effect 1: Load Booking Data ---
  // Tries to load data from localStorage first (passed after payment),
  // otherwise fetches from backend using paymentIntent ID from URL.
  useEffect(() => {
    const storedBookingData = localStorage.getItem("bookingData");

    if (storedBookingData) {
      // Data found in localStorage
      try {
        const parsedData = JSON.parse(storedBookingData);
        console.log("Loaded booking data from localStorage:", parsedData);
        setBookingDetails(parsedData); // Set the booking details state
        setStatus("success"); // Set status to success
        localStorage.removeItem("bookingData"); // Clean up localStorage
      } catch (error) {
        console.error("Error parsing booking data from localStorage:", error);
        setStatus("error"); // Set error status if parsing fails
      }
    } else if (paymentIntent) {
      // No localStorage data, but paymentIntent exists in URL, fetch from API
      console.log(
        "No localStorage data, fetching using paymentIntent:",
        paymentIntent
      );
      fetchBookingDetails(paymentIntent); // Call the API fetching function
    } else {
      // Critical error: No way to retrieve booking data
      console.error(
        "Cannot display confirmation: No booking data found in localStorage or paymentIntent in URL."
      );
      setStatus("error"); // Set error status
    }
    // This effect runs once on mount or if paymentIntent changes (unlikely after mount)
  }, [paymentIntent]); // Dependency array

  // --- Effect 2: Calculate Display Price ---
  // Runs after bookingDetails state is updated to calculate the final price shown.
  useEffect(() => {
    // Only run if bookingDetails are loaded and price hasn't been calculated yet
    if (bookingDetails && !priceCalculated) {
      calculateAndSetFinalPrice(bookingDetails); // Calculate the price
      setPriceCalculated(true); // Set flag to prevent recalculation
    }
  }, [bookingDetails, priceCalculated]); // Dependencies: re-run if details change or flag resets

  // --- Price Calculation Logic ---
  // Calculates the final price based on various fields potentially present in bookingDetails
  const calculateAndSetFinalPrice = (data) => {
    // Prefer the simple 'price' field if it exists (likely calculated finally on backend/payment)
    if (data.price !== null && data.price !== undefined) {
      console.log("Using top-level price:", data.price);
      setDisplayPrice(parseFloat(data.price));
      return;
    }

    // Fallback calculation if 'price' is missing
    console.log("Calculating price from breakdown...");
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
    console.log("Calculated price breakdown:", {
      basePrice,
      guestFees,
      extrasTotal,
      longStayDiscount,
      couponDiscount,
      finalPrice,
    });
    setDisplayPrice(finalPrice >= 0 ? finalPrice : 0); // Ensure it's not negative
  };

  // --- API Fetching Logic ---
  // Fetches booking details from backend using payment intent ID with retries
  const fetchBookingDetails = async (paymentIntentId) => {
    let attempts = 0;
    const maxAttempts = 5; // Max number of retries
    const retryDelay = 2000; // Delay between retries in milliseconds
    // Use environment variable for API URL, fallback to localhost for development
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"; // Adjust port if needed

    const attemptFetch = async () => {
      try {
        console.log(
          `Attempt ${
            attempts + 1
          } fetching booking for paymentIntent: ${paymentIntentId}`
        );
        const response = await fetch(
          `${API_URL}/api/bookings/${paymentIntentId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        // Handle 404 Not Found (possibly temporary)
        if (response.status === 404) {
          attempts++;
          if (attempts < maxAttempts) {
            console.log(
              `Booking not found (404), retrying in ${retryDelay / 1000}s...`
            );
            setTimeout(attemptFetch, retryDelay); // Schedule retry
            return; // Exit current attempt
          } else {
            console.error(`Booking not found after ${maxAttempts} attempts.`);
            throw new Error(
              t(
                "bookingConfirmation.error.notFound",
                "Booking details not found."
              )
            );
          }
        }

        // Handle other non-successful HTTP statuses
        if (!response.ok) {
          const errorText = await response.text(); // Try to get error text from body
          console.error(
            `API responded with status: ${response.status}. Body: ${errorText}`
          );
          throw new Error(
            t(
              "bookingConfirmation.error.fetchFailed",
              "Failed to fetch booking details."
            )
          );
        }

        // Parse successful JSON response
        const data = await response.json();
        console.log("Fetched booking data from API:", data);

        // Check for application-level errors within the JSON data
        if (data.error) {
          console.error("API returned application error:", data.error);
          throw new Error(data.error);
        }

        // Success! Update state
        setBookingDetails(data);
        setStatus("success");
      } catch (error) {
        // Handle errors during fetch or retries
        console.error("Detailed error in fetchBookingDetails attempt:", error);
        if (attempts < maxAttempts && status !== "success") {
          // Check attempts and ensure we haven't succeeded elsewhere
          attempts++;
          console.log(
            `Fetch attempt failed, retrying in ${retryDelay / 1000}s...`
          );
          setTimeout(attemptFetch, retryDelay); // Schedule retry
        } else {
          setStatus("error"); // Set final error state if max attempts reached or already succeeded
        }
      }
    };

    attemptFetch(); // Initiate the first fetch attempt
  };

  const getJsDate = (dateValue) => {
    if (!dateValue) return null; // Return null if input is falsy
    try {
      let date;
      // CHECK 1: Is it already a JS Date?
      if (dateValue instanceof Date) {
        date = dateValue;
      }
      // CHECK 2: Does it have the .toDate() method (true Firestore Timestamp)?
      else if (dateValue && typeof dateValue.toDate === "function") {
        date = dateValue.toDate();
      }
      // CHECK 3: Does it look like a serialized Timestamp object?
      else if (
        dateValue &&
        typeof dateValue === "object" &&
        dateValue._seconds !== undefined
      ) {
        // Reconstruct from seconds (milliseconds = seconds * 1000)
        date = new Date(dateValue._seconds * 1000);
      }
      // CHECK 4: Assume it's a string or number parseable by new Date()
      else {
        date = new Date(dateValue);
      }

      // CHECK 5: Validate the resulting date object
      if (isNaN(date.getTime())) {
        console.error(
          "getJsDate resulted in an Invalid Date for input:",
          dateValue
        );
        throw new Error("Invalid Date object created");
      }
      return date; // Return the valid JS Date object
    } catch (e) {
      console.error("Error converting to JS Date:", dateValue, e);
      return null; // Return null on error
    }
  };

  // --- Formatting Helper Functions ---
  // Formats a date string (e.g., "2024-08-15" or ISO string) to locale-specific string ("15 août 2024")
  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    try {
      let date;
      // CHECK 1: Is it already a JS Date?
      if (dateValue instanceof Date) {
        date = dateValue;
      }
      // CHECK 2: Does it have the .toDate() method (true Firestore Timestamp)?
      else if (dateValue && typeof dateValue.toDate === "function") {
        date = dateValue.toDate();
      }
      // CHECK 3: Does it look like a serialized Timestamp object?
      else if (
        dateValue &&
        typeof dateValue === "object" &&
        dateValue._seconds !== undefined
      ) {
        date = new Date(dateValue._seconds * 1000); // Reconstruct from seconds
      }
      // CHECK 4: Assume it's a string or number parseable by new Date()
      else {
        date = new Date(dateValue);
      }

      // CHECK 5: Validate the resulting date object
      if (isNaN(date.getTime())) {
        console.error(
          "formatDate resulted in an Invalid Date for input:",
          dateValue
        );
        throw new Error("Invalid Date object created");
      }

      // Proceed with formatting
      return new Intl.DateTimeFormat("fr-BE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
    } catch (e) {
      console.error("Error formatting date:", dateValue, e);
      return t("errors.invalidDate", "Date invalide");
    }
  };

  // Formats a time string (e.g., "14:00") - basic implementation, returns '-' if null/empty
  const formatTime = (timeString) => {
    return timeString || "-";
  };

  // Translates extra names using i18n keys if applicable, otherwise returns the name
  const renderExtraName = (extra) => {
    if (!extra?.name)
      return t("bookingConfirmation.unknownExtra", "Extra Item"); // Fallback name
    // Check if the name follows the convention 'category.item.name'
    return extra.name.startsWith("extras.") ? t(extra.name) : extra.name;
  };

  // Formats a price value to two decimal places, handling various input types
  const formatPrice = (price) => {
    if (price === null || price === undefined) return "0.00"; // Handle null/undefined
    // Convert string to number if necessary
    const numberPrice = typeof price === "string" ? parseFloat(price) : price;
    // Check if it's a valid number before formatting
    return typeof numberPrice === "number" && !isNaN(numberPrice)
      ? numberPrice.toFixed(2)
      : "0.00";
  };

  // Calculates the number of "extra" guests beyond the base occupancy
  const calculateExtraGuests = () => {
    if (!bookingDetails) return 0; // Guard clause
    const totalGuests =
      (parseInt(bookingDetails.adults) || 0) +
      (parseInt(bookingDetails.children) || 0);
    // Default base occupancy to 2 if not specified in booking details
    const startingGuests =
      bookingDetails.priceDetails?.settings?.startingAtGuest || 2;
    return Math.max(0, totalGuests - startingGuests); // Ensure result is not negative
  };
  // --- End Helper Functions ---

  // --- Render Loading State ---
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
          {/* You could add a simple spinner here */}
          <div className="mt-4 spinner"></div> {/* Add CSS for .spinner */}
        </div>
      </div>
    );
  }

  // --- Render Error State ---
  if (status === "error" || !bookingDetails) {
    // Show error if status is error OR if booking details are null after loading
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
          {" "}
          {/* Centered error card */}
          <h2 className="mb-2 text-xl font-semibold text-red-600">
            {t("bookingConfirmation.error.title")}
          </h2>
          <p className="mb-4">{t("bookingConfirmation.error.message")}</p>
          <button
            onClick={() => navigate("/")} // Navigate back home
            className="button-primary"
          >
            {t(
              "bookingConfirmation.error.backHomeButton",
              "Retour à l'accueil"
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- Render Success State ---
  // Determine SPA scheduling status *after* confirming bookingDetails exist

  const needsSpaScheduling = bookingDetails.spaBookingPreference === "later";
  const scheduledSpaTime =
    bookingDetails.spaDateTime &&
    bookingDetails.spaBookingPreference === "scheduled";

  let spaTimeDisplay = t("errors.invalidTime", "Heure invalide"); // Default error message

  if (scheduledSpaTime && bookingDetails) {
    // Ensure bookingDetails exist here too
    const startTimeObj = getJsDate(bookingDetails.spaDateTime); // Use helper to get Date object

    if (startTimeObj) {
      // Proceed only if we got a valid Date object
      const startTimeString = startTimeObj.toLocaleTimeString("fr-BE", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // --- Determine Slot Duration ---
      let actualSlotDurationMinutes;
      // Check if bookingDetails exists before accessing spaSlotDuration
      if (
        bookingDetails &&
        typeof bookingDetails.spaSlotDuration === "number" &&
        bookingDetails.spaSlotDuration > 0
      ) {
        actualSlotDurationMinutes = bookingDetails.spaSlotDuration;
      } else {
        // Fallback and warning if spaSlotDuration is missing or invalid
        console.warn(
          `BookingConfirmation: spaSlotDuration is missing, invalid, or zero in bookingDetails. Falling back to 120 minutes. Booking ID: ${
            bookingDetails?.id || bookingDetails?.smoobuId || "N/A"
          }. Please ensure 'spaSlotDuration' (in minutes) is saved in booking details when SPA is scheduled.`
        );
        actualSlotDurationMinutes = 120; // Default fallback duration in minutes (Assuming 2-hour treatment)
      }
      // --- End Determine Slot Duration ---

      let endTimeString = null; // Initialize end time string

      // --- Calculate End Time based on Start Time and Duration ---
      // We always calculate the end time based on the start time and the actual duration (actualSlotDurationMinutes).
      // We are removing the logic that prioritized using savedSlots[1] for the end time display.
      try {
        const endTimeObj = addMinutes(startTimeObj, actualSlotDurationMinutes);
        // Format the calculated end time
        endTimeString = formatFn(endTimeObj, "HH:mm", { locale: fr }); // Use aliased formatFn, explicitly use fr locale
      } catch (e) {
        console.error("Error calculating end time using addMinutes:", e);
        // endTimeString remains null if calculation fails
      }
      // --- End Calculate End Time ---

      // Construct the final display string
      if (startTimeString && endTimeString) {
        spaTimeDisplay = `${startTimeString} - ${endTimeString}`; // "HH:mm - HH:mm"
      } else if (startTimeString) {
        // This fallback only happens if addMinutes failed to produce an endTimeString
        spaTimeDisplay = startTimeString; // Fallback to only start time
        console.warn(
          "SPA time display only has start time, end time could not be determined from start time + duration."
        );
      }
      // If both are null, it keeps the default error message "Heure invalide"
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
      }} // Added padding
      className="container"
    >
      <div className="card">
        {/* Header Section */}
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
        {/* Details Grid */}
        <div className="grid">
          {/* Stay Details Card */}
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
            {/* Display Scheduled SPA Time if it exists */}
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
                {/* Use the robust formatDate for the date part */}
                {formatDate(bookingDetails.spaDateTime)}{" "}
                {/* Use the correctly calculated time range */}
                <span className="">{spaTimeDisplay}</span>
              </p>
            )}
          </div>

          {/* Guest Details Card */}
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

          {/* Price Details Card */}
          <div className="details-card">
            <h2 className="titleConfirmation">
              {t("bookingConfirmation.success.sections.priceDetails.title")}
            </h2>
            {/* Base Price */}
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
            {/* Guest Fees */}
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
            {/* Extras List */}
            <div className="mt-1 mb-2 extras-list">
              {" "}
              {/* Wrapper for extras */}
              {bookingDetails.extras?.map((extra, index) => {
                const hasExtraPerson = extra.extraPersonQuantity > 0;
                return (
                  <p key={index} className="text-sm">
                    {" "}
                    {/* Reduced text size */}
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
            {/* Long Stay Discount */}
            {(bookingDetails.priceDetails?.discount > 0 ||
              bookingDetails.priceDetails?.longStayDiscount > 0) && (
              <p className="text-sm text-orange-600 discount-text">
                {" "}
                {/* Added text-sm and color */}
                {t(
                  "bookingConfirmation.success.sections.priceDetails.longStayDiscount",
                  {
                    percentage:
                      bookingDetails.priceDetails?.settings
                        ?.lengthOfStayDiscount?.discountPercentage || "?", // Show '?' if percentage unknown
                    amount: formatPrice(
                      bookingDetails.priceDetails?.discount ||
                        bookingDetails.priceDetails?.longStayDiscount ||
                        0
                    ),
                  }
                )}
              </p>
            )}
            {/* Coupon Discount */}
            {bookingDetails.couponApplied && (
              <p className="text-sm text-green-600 discount-text">
                {" "}
                {/* Added text-sm */}
                {t(
                  "bookingConfirmation.success.sections.priceDetails.promoCode",
                  {
                    code: bookingDetails.couponApplied.code,
                    amount: formatPrice(
                      bookingDetails.couponApplied.discount || 0
                    ), // Use coupon discount value directly
                  }
                )}
              </p>
            )}
            {/* Total Section */}
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

          {/* Address Card */}
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

          {/* Conditional SPA Scheduling Info Card (Only shows if preference is 'later') */}
          {needsSpaScheduling && (
            <div className="details-card spa-schedule-later-card">
              {" "}
              {/* Added class for potential styling */}
              <h2 className="flex items-center titleConfirmation spa-schedule-title">
                {" "}
                {/* Added class and flex */}
                <CalendarClock size={18} className="inline-block mr-2" />{" "}
                {/* Icon */}
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterTitle",
                  "Programmation Séance SPA"
                )}
              </h2>
              <p className="mb-1 text-sm">
                {t(
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterInstruction",
                  "Pour planifier votre séance SPA, veuillez nous contacter à l'adresse suivante :"
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
                  "bookingConfirmation.success.sections.spaTime.scheduleLaterPriority",
                  "Note : Les créneaux sont attribués selon le principe du premier arrivé, premier servi."
                )}
              </p>
            </div>
          )}
          {/* End Conditional SPA Card */}
        </div>{" "}
        {/* End Bento Grid */}
        {/* Action Buttons */}
        <div className="actions">
          <button
            onClick={() => navigate("/")} // Use navigate for SPA navigation
            className="button-primary"
          >
            {t("bookingConfirmation.success.buttons.backHome")}
          </button>
          <button onClick={() => window.print()} className="button-secondary">
            {t("bookingConfirmation.success.buttons.print")}
          </button>
        </div>
      </div>{" "}
      {/* End Card */}
    </div> // End Container
  );
};

export default BookingConfirmation;
