import axios from "axios";
import { roomNames, portalNames } from "../../../../config/config.js";

export async function generateBookingsReport(req, res) {
  try {
    const { startMonth, startYear, endMonth, endYear } = req.query;

    // Validate and fix date range
    let finalStartMonth = String(startMonth).padStart(2, "0");
    let finalStartYear = startYear;
    let finalEndMonth = String(endMonth).padStart(2, "0");
    let finalEndYear = endYear;

    const startDate = `${finalStartYear}-${finalStartMonth}-01`;
    const lastDay = new Date(
      finalEndYear,
      parseInt(finalEndMonth),
      0
    ).getDate();
    const endDate = `${finalEndYear}-${finalEndMonth}-${lastDay}`;

    console.log("=== START OF BOOKINGS REPORT REQUEST ===");
    console.log("Request params:", {
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear,
    });

    // Fetch bookings for the period
    const bookingsResponse = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          excludeBlocked: true,
          showCancellation: true,
        },
      }
    );

    const bookings = bookingsResponse.data.bookings || [];
    console.log(
      `Found ${bookings.length} bookings for period ${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`
    );

    // Process each booking to get price elements and extras
    const processedBookings = [];
    for (const booking of bookings) {
      try {
        console.log(`Processing booking ${booking.id}`);

        // Skip if it's a blocked booking or cancelled booking
        if (
          booking.channelId === "Blocked" ||
          booking.type === "cancellation"
        ) {
          console.log(
            `Skipping ${
              booking.channelId === "Blocked" ? "blocked" : "cancelled"
            } booking ${booking.id}`
          );
          continue;
        }

        // Fetch price elements for each booking
        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${booking.id}/price-elements`,
          {
            headers: {
              "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const priceElements = priceElementsResponse.data.priceElements || [];
        console.log(
          "Price elements for booking",
          booking.id,
          ":",
          priceElements
        );

        // Calculate nights
        const checkIn = new Date(booking.arrival);
        const checkOut = new Date(booking.departure);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Find long stay discount first
        const longStayDiscount =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("long stay") ||
              el.name?.toLowerCase().includes("long-stay")
          )?.amount || 0;

        // Process extras - all non-base price elements, excluding cancellations and long stay discount
        const extras = priceElements.filter((element) => {
          const name = element.name?.toLowerCase() || "";
          const type = element.type?.toLowerCase() || "";

          // Skip cancellation-related items and long stay discount
          if (
            name.includes("cancellation") ||
            name.includes("pass_through") ||
            name.includes("prix de base") ||
            name.includes("base price") ||
            name.includes("long stay") ||
            name.includes("long-stay") ||
            name === "base" ||
            type === "base"
          ) {
            return false;
          }

          // Include addons, linen fees, and exclude base price and discounts
          return (
            element.type === "addon" ||
            name.includes("linen fee") ||
            name.includes("frais de linge") ||
            (element.type !== "base" && element.type !== "discount")
          );
        });

        // Find commission from extras
        const commissionExtra = extras.find((extra) =>
          extra.name?.toLowerCase().includes("commission")
        );
        const commission = commissionExtra ? commissionExtra.amount : 0;

        // Remove commission from extras list if it exists
        const nonCommissionExtras = extras.filter(
          (extra) => !extra.name?.toLowerCase().includes("commission")
        );

        const linenFee =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("linen_fee") ||
              el.name?.toLowerCase().includes("pass_through_linen_fee")
          )?.amount || 0;

        // Calculate base price
        const basePrice =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("base") ||
              el.type?.toLowerCase() === "base"
          )?.amount || 0;

        // Calculate other discounts (excluding long stay)
        const otherDiscounts = priceElements
          .filter(
            (el) =>
              el.type === "discount" &&
              !el.name?.toLowerCase().includes("long stay") &&
              !el.name?.toLowerCase().includes("long-stay")
          )
          .reduce((sum, discount) => sum + Math.abs(discount.amount), 0);

        const extrasTotal = extras.reduce(
          (sum, extra) => sum + extra.amount,
          0
        );

        // Add portal name mapping

        const processedBooking = {
          id: booking.id,
          guest:
            booking["guest-name"] ||
            `${booking.firstName || ""} ${booking.lastName || ""}`.trim() ||
            (booking.notice?.match(/Message du client:?\s*([^\n]+)/) ||
              [])[1] ||
            booking.email?.split("@")[0] ||
            "Sans nom",
          property:
            roomNames[booking.apartmentId] || booking.apartment?.name || "",
          portal:
            portalNames[booking.channel?.name] ||
            booking.channel?.name ||
            "Website",
          created:
            booking["created-at"] ||
            booking.created ||
            new Date().toISOString(),
          email: booking.email || "",
          phone: booking.phone || "",
          address: booking.address || "",
          adults: parseInt(booking.adults) || 0,
          children: parseInt(booking.children) || 0,
          checkIn: booking.arrival,
          checkOut: booking.departure,
          arrivalTime: booking["check-in"] || "",
          departureTime: booking["check-out"] || "",
          notes: booking.notice || "",
          price: parseFloat(booking.price) || 0,
          priceDetails: {
            basePrice: parseFloat(basePrice),
            linenFee: parseFloat(linenFee),
            extrasTotal: parseFloat(extrasTotal),
            longStayDiscount: parseFloat(longStayDiscount),
            discounts: parseFloat(otherDiscounts),
            promoCode: priceElements.find(
              (el) =>
                el.name?.toLowerCase().includes("code promo") ||
                el.name?.toLowerCase().includes("coupon") ||
                (el.type === "discount" &&
                  !el.name?.toLowerCase().includes("long stay") &&
                  !el.name?.toLowerCase().includes("long-stay"))
            ),
            total:
              parseFloat(basePrice) +
              parseFloat(linenFee) +
              parseFloat(extrasTotal) +
              parseFloat(longStayDiscount) -
              parseFloat(otherDiscounts),
          },
          commission: parseFloat(commission),
          nights,
          extras:
            nonCommissionExtras
              .filter(
                (extra) =>
                  !extra.name?.toLowerCase().includes("code promo") &&
                  !extra.name?.toLowerCase().includes("coupon") &&
                  extra.type !== "discount"
              )
              .map((extra) => ({
                name: extra.name || "Extra sans nom",
                amount: parseFloat(extra.amount) || 0,
                quantity: parseInt(extra.quantity) || 1,
              })) || [],
        };

        processedBookings.push(processedBooking);
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
        console.error("Full error:", error);
      }
    }

    console.log("=== PROCESSING SUMMARY ===");
    console.log({
      period: `${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`,
      totalBookings: bookings.length,
      processedBookings: processedBookings.length,
      sampleBooking: processedBookings[0],
    });

    res.json({
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear,
      data: processedBookings,
    });
  } catch (error) {
    console.error("=== ERROR IN REQUEST ===");
    console.error("Full error:", error);
    console.error("Error response:", error.response?.data);
    res.status(500).json({
      error: "Failed to generate bookings report",
      details: error.message,
    });
  }
}
