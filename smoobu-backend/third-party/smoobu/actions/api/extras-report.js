import { db } from "../../../../firebase-config.js";
import { extrasFrenchNames } from "../../../../config/config.js"; // Adjust the path as needed

export async function generateExtrasReport(req, res) {
  try {
    const { startMonth, startYear, endMonth, endYear } = req.query;

    const normalizeExtraName = (name) => {
      const frenchName = Object.entries(extrasFrenchNames).find(
        ([key, value]) =>
          value.toLowerCase() === name.toLowerCase() ||
          key.toLowerCase() === name.toLowerCase()
      );
      return frenchName ? frenchName[1] : name;
    };

    // Calculate start and end dates
    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(endYear, parseInt(endMonth), 0).getDate();
    const endDate = `${endYear}-${String(endMonth).padStart(
      2,
      "0"
    )}-${lastDay}`;



    // Query Firebase for bookings in the date range
    const bookingsSnapshot = await db
      .collection("bookings")
      .where("arrivalDate", ">=", startDate)
      .where("arrivalDate", "<=", endDate)
      .get();

    const bookings = [];
    bookingsSnapshot.forEach((doc) => {
      bookings.push({
        id: doc.id,
        ...doc.data(),
      });
    });


    const extrasCount = {};
    let bookingsWithExtras = 0;

    // Define unwanted extras patterns similar to BookingDetails.js
    const unwantedPatterns = [
      "cancellation",
      "Cancellation",
      "pass_through",
      "PASS_THROUGH",
      "service fee",
      "Service Fee",
      "host fee",
      "Host Fee",
      "guest fee",
      "Guest Fee",
      "cleaning fee",
      "Cleaning Fee",
      "LINEN_FEE",
      "linen_fee",
      "Base Price",
      "base_price",
      "Commission",
      "commission",
      "Tax",
      "tax",
      "VAT",
      "vat",
    ];

    for (const booking of bookings) {
      try {
        // Get portal name
        const portalName = booking.portalName || booking.channelName || "";
        const isAirbnb = portalName === "Airbnb";
        const isBookingCom = portalName === "Booking.com";

        // Process extras using the same approach as BookingDetails.js
        let displayExtras = [];

        // If we have price elements, use those for a consistent display
        if (booking.priceDetails?.priceElements?.length > 0) {
          const priceElements = booking.priceDetails.priceElements;

          // Only include relevant price elements
          const relevantElements = priceElements.filter((el) => {
            if (!el || !el.amount || !el.name) return false;

            // For Airbnb, be very selective
            if (isAirbnb) {
              // Only allow formules and specific extras
              return (
                el.name.toLowerCase().includes("formule") ||
                el.name.toLowerCase().includes("anniversaire") ||
                el.name.toLowerCase().includes("détente") ||
                el.name.toLowerCase().includes("gourmet") ||
                el.name.toLowerCase().includes("essentiel") ||
                el.name.toLowerCase().includes("romantique")
              );
            } else {
              // For non-Airbnb, filter out unwanted patterns
              return (
                el.amount > 0 &&
                !el.name.includes("Prix de base") &&
                !el.name.includes("Base price") &&
                !el.name.includes("Code promo") &&
                !el.name.includes("Réduction") &&
                !unwantedPatterns.some((pattern) => el.name.includes(pattern))
              );
            }
          });

          // Use a Map for deduplication
          const uniqueExtras = new Map();

          // Process all extras
          relevantElements.forEach((el) => {
            // Create a clean key for the map
            const cleanName = el.name.trim();

            // If we already have this extra in our map
            if (uniqueExtras.has(cleanName)) {
              // For "Personne supplémentaire" extras, merge quantities and amounts
              if (cleanName.includes("Personne supplémentaire")) {
                const existingExtra = uniqueExtras.get(cleanName);

                // Calculate total quantity and amount
                const existingQuantity = parseInt(existingExtra.quantity) || 1;
                const currentQuantity = parseInt(el.quantity) || 1;
                const totalQuantity = existingQuantity + currentQuantity;

                const existingAmount = parseFloat(existingExtra.amount) || 0;
                const currentAmount = parseFloat(el.amount) || 0;
                const totalAmount = existingAmount + currentAmount;

                // Update the existing extra
                existingExtra.quantity = totalQuantity;
                existingExtra.amount = totalAmount;

                // Update the map
                uniqueExtras.set(cleanName, existingExtra);
              }
              // For other extras, only replace if this one has more data
              else if (
                parseFloat(el.amount) >
                parseFloat(uniqueExtras.get(cleanName).amount)
              ) {
                uniqueExtras.set(cleanName, {
                  name: cleanName,
                  amount: parseFloat(el.amount) || 0,
                  quantity: parseInt(el.quantity) || 1,
                  id: el.id,
                });
              }
            }
            // If this is a new extra, add it to the map
            else {
              uniqueExtras.set(cleanName, {
                name: cleanName,
                amount: parseFloat(el.amount) || 0,
                quantity: parseInt(el.quantity) || 1,
                id: el.id,
              });
            }
          });

          // Convert Map values to array
          displayExtras = Array.from(uniqueExtras.values());

          // Special handling for duplicate "Frais supplémentaires"
          const fraisElements = displayExtras.filter((e) =>
            e.name.includes("Frais supplémentaires")
          );
          if (fraisElements.length > 1) {
            // Keep only the first one
            const toKeep = fraisElements[0];
            displayExtras = displayExtras.filter(
              (e) => !e.name.includes("Frais supplémentaires") || e === toKeep
            );
          }
        }
        // Otherwise fall back to the extras array
        else if (booking.extras?.length > 0) {
          displayExtras = booking.extras.filter((extra) => {
            if (!extra.name) return false;
            return !unwantedPatterns.some((pattern) =>
              extra.name.toLowerCase().includes(pattern.toLowerCase())
            );
          });
        }

        // For Booking.com, remove TVA and taxe de séjour from extras
        if (isBookingCom) {
          displayExtras = displayExtras.filter(
            (extra) =>
              !extra.name.includes("TVA") &&
              !extra.name.toLowerCase().includes("taxe de séjour")
          );
        }

        if (displayExtras.length > 0) {
          bookingsWithExtras++;


          // Process each extra for the report
          displayExtras.forEach((extra) => {
            if (!extra.name) return;

            const normalizedName = normalizeExtraName(extra.name);
            if (!extrasCount[normalizedName]) {
              extrasCount[normalizedName] = {
                count: 0,
                totalAmount: 0,
                details: {
                  type: extra.type || "addon",
                  optional: true,
                },
              };
            }
            const quantity = parseInt(extra.quantity) || 1;
            const amount = parseFloat(extra.amount) || 0;

            extrasCount[normalizedName].count += quantity;
            extrasCount[normalizedName].totalAmount += amount;
          });
        }
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
      }
    }

    const reportData = Object.entries(extrasCount)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalAmount: data.totalAmount,
        details: data.details,
      }))
      .sort((a, b) => b.count - a.count);



    res.json({
      startMonth,
      startYear,
      endMonth,
      endYear,
      data: reportData,
      totalBookings: bookings.length,
    });
  } catch (error) {
    console.error("=== ERROR IN REQUEST ===");
    console.error(error);
    res.status(500).json({
      error: "Failed to generate report",
      details: error.message,
    });
  }
}
