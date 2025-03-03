export async function syncReservations() {
  try {
    console.log("🟦 Starting reservation sync...", new Date().toISOString());

    const channelMapping = {
      // Channel IDs
      2323525: "Website",
      2323516: "Blocked",
      2323543: "Airbnb",

      // Channel Names
      Homepage: "Website",
      "Direct booking": "Website",
      "Homepage direct": "Website",
      Direct: "Website",
      Airbnb: "Airbnb",
      airbnb: "Airbnb",
      "booking.com": "Booking.com",
      "Booking.com": "Booking.com",
      "Blocked channel": "Blocked",
      Blocked: "Blocked",
    };

    // Improved normalize function
    const normalizeBookingId = (id) => {
      if (!id) return null;
      return String(id).trim();
    };

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          showCancellation: false,
          excludeBlocked: true,
          pageSize: 100,
        },
      }
    );

    console.log(
      "Full booking details:",
      response.data.bookings?.map((booking) => ({
        id: normalizeBookingId(booking.id),
        channel: booking.channel,
        channelId: booking.channel?.id,
        channelName: booking.channel?.name,
        arrival: booking.arrival,
        guest: booking["guest-name"],
      }))
    );

    const reservations = response.data.bookings || [];
    console.log(`🟦 Found ${reservations.length} reservations to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const reservation of reservations) {
      try {
        const normalizedId = normalizeBookingId(reservation.id);
        if (!normalizedId) {
          console.error("🟥 Invalid reservation ID, skipping...");
          errorCount++;
          continue;
        }

        console.log(`🟦 Processing reservation ${normalizedId} from channel:`, {
          rawChannelName: reservation.channel?.name,
          mappedChannelName:
            channelMapping[reservation.channel?.name] || "Website",
        });

        // Check for existing booking with normalized ID
        const existingBookingRef = await db
          .collection("bookings")
          .where("smoobuId", "==", String(normalizedId))
          .get();

        const existingDoc = existingBookingRef.empty
          ? null
          : existingBookingRef.docs[0];

        // Get price elements
        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${normalizedId}/price-elements`,
          {
            headers: {
              "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const priceElements = priceElementsResponse.data.priceElements || [];

        // Add debug logging for all price elements
        console.log(
          `Raw price elements for booking ${normalizedId}:`,
          priceElements
        );

        // Improved extras processing with better filtering
        const extras = priceElements.filter((element) => {
          const name = (element.name || "").toLowerCase();
          const type = (element.type || "").toLowerCase();

          // Exclude base price, discounts, etc.
          if (
            name.includes("prix de base") ||
            name.includes("base price") ||
            name.includes("code promo") ||
            name.includes("réduction") ||
            name.includes("commission") ||
            type === "base" ||
            type === "discount"
          ) {
            return false;
          }

          // Include extras, but exclude standalone "personne supplémentaire" items
          // We'll handle these separately to associate them with their parent extras
          return (
            (type === "addon" ||
              name.includes("formule") ||
              name.includes("formule spa") ||
              name.includes("petit-déjeuner") ||
              name.includes("raclette") ||
              name.includes("barbecue") ||
              name.includes("spa") ||
              name.includes("bouteille") ||
              name.includes("2 pers") ||
              name.includes("essentiel") ||
              name.includes("détente") ||
              name.includes("gourmet") ||
              name.includes("frais supplémentaires")) &&
            !name.match(/^personne supplémentaire/i)
          ); // Exclude standalone person items
        });

        // Find extra person elements that might be associated with the extras
        const personElements = priceElements.filter((element) => {
          const name = (element.name || "").toLowerCase();
          return name.includes("personne supplémentaire");
        });

        console.log(
          `Found ${personElements.length} person elements for booking ${normalizedId}`
        );

        // Process extras and link person elements to them
        const processedExtras = extras.map((extra) => {
          const extraResult = {
            name: extra.name || "Extra",
            amount: Math.abs(parseFloat(extra.amount) || 0),
            quantity: parseInt(extra.quantity) || 1,
            type: extra.type || "addon",
            id: extra.id,
            currencyCode: extra.currencyCode || "EUR",
            extraPersonQuantity: 0,
            extraPersonPrice: 0,
            extraPersonAmount: 0,
          };

          // Look for matching person element
          const extraNameLower = extra.name.toLowerCase();

          // Try to find a person element that might be related to this extra
          const relatedPersonElement = personElements.find((personEl) => {
            const personNameLower = personEl.name.toLowerCase();

            // Check for specific patterns:
            // 1. "Extra Name - Personne supplémentaire"
            if (
              personNameLower.includes(extraNameLower) ||
              personNameLower.includes(
                extraNameLower.replace(" (pour 2)", "")
              ) ||
              personNameLower.includes(extraNameLower.replace(" (2 pers)", ""))
            ) {
              return true;
            }

            // 2. "Personne supplémentaire - Extra Name"
            if (
              personNameLower.includes("supplémentaire") &&
              (personNameLower.includes(extraNameLower) ||
                personNameLower.includes(
                  extraNameLower.replace(" (pour 2)", "")
                ) ||
                personNameLower.includes(
                  extraNameLower.replace(" (2 pers)", "")
                ))
            ) {
              return true;
            }

            return false;
          });

          // If we found a related person element, extract the data
          if (relatedPersonElement) {
            console.log(
              `Found related person element for extra "${extra.name}": ${relatedPersonElement.name}`
            );

            extraResult.extraPersonQuantity =
              parseInt(relatedPersonElement.quantity) || 1;
            extraResult.extraPersonPrice =
              Math.abs(parseFloat(relatedPersonElement.amount)) /
              extraResult.extraPersonQuantity;
            extraResult.extraPersonAmount = Math.abs(
              parseFloat(relatedPersonElement.amount)
            );
            extraResult.extraPersonName = relatedPersonElement.name;
          }

          return extraResult;
        });

        // Debug log the filtered extras
        console.log(
          `Filtered extras for booking ${normalizedId}:`,
          processedExtras
        );

        const hasSpa = processedExtras.some((extra) =>
          extra.name.toLowerCase().includes("formule spa")
        );
        if (!hasSpa) {
          const spaElement = priceElements.find((element) =>
            (element.name || "").toLowerCase().includes("formule spa")
          );
          if (spaElement) {
            processedExtras.push({
              name: spaElement.name,
              amount: Math.abs(parseFloat(spaElement.amount) || 0),
              quantity: parseInt(spaElement.quantity) || 1,
              type: spaElement.type || "addon",
              id: spaElement.id,
              currencyCode: spaElement.currencyCode || "EUR",
              extraPersonQuantity: 0,
              extraPersonPrice: 0,
              extraPersonAmount: 0,
            });
            console.log(
              `✅ "Formule SPA" was missing, manually added to extras.`
            );
          }
        }

        // Calculate base price and other components
        const basePrice =
          priceElements.find(
            (el) =>
              el.type === "base" ||
              el.name?.toLowerCase().includes("prix de base")
          )?.amount || 0;

        const extrasTotal = processedExtras.reduce(
          (sum, extra) =>
            sum +
            (Number(extra.amount) || 0) +
            (Number(extra.extraPersonAmount) || 0),
          0
        );

        // Look for discounts
        const discounts = priceElements.filter((element) => {
          const name = (element.name || "").toLowerCase();
          return (
            element.type === "discount" ||
            name.includes("code promo") ||
            name.includes("réduction")
          );
        });

        // Calculate total discounts
        const totalDiscounts = discounts.reduce(
          (sum, discount) => sum + Math.abs(parseFloat(discount.amount) || 0),
          0
        );

        // Extract long stay discount if present
        const longStayDiscount =
          discounts.find((d) =>
            d.name?.toLowerCase().includes("réduction long séjour")
          )?.amount || 0;

        // Extract coupon discount if present
        const couponDiscount =
          discounts.find((d) => d.name?.toLowerCase().includes("code promo"))
            ?.amount || 0;

        // Prepare booking document with complete extra details
        const bookingDoc = {
          smoobuId: normalizedId,
          smoobuReservationId: normalizedId,
          firstName: reservation.firstName || "",
          lastName: reservation.lastName || "",
          guestName:
            reservation["guest-name"] ||
            `${reservation.firstName || ""} ${
              reservation.lastName || ""
            }`.trim() ||
            "Sans nom",
          email: reservation.email || "",
          phone: reservation.phone || "",
          address: reservation.address || "",
          adults: parseInt(reservation.adults) || 0,
          children: parseInt(reservation.children) || 0,
          arrivalDate: reservation.arrival,
          departureDate: reservation.departure,
          checkInTime: reservation["check-in"] || "",
          checkOutTime: reservation["check-out"] || "",
          apartmentId: reservation.apartment?.id,
          property:
            roomNames[reservation.apartment?.id] || reservation.apartment?.name,
          channelId: reservation.channel?.id,
          channelName: reservation.channel?.name,
          notice: reservation.notice || "",
          status:
            reservation.type === "cancellation" ? "cancelled" : "confirmed",
          basePrice: parseFloat(basePrice),
          price: parseFloat(reservation.price),
          priceDetails: {
            basePrice: parseFloat(basePrice),
            extrasTotal: extrasTotal,
            longStayDiscount: Math.abs(parseFloat(longStayDiscount)),
            couponDiscount: Math.abs(parseFloat(couponDiscount)),
            totalDiscounts: totalDiscounts,
            extras: processedExtras,
            priceElements: priceElements,
            guestFees: parseFloat(
              priceElements.find((el) =>
                el.name?.toLowerCase().includes("frais supplémentaires")
              )?.amount || 0
            ),
          },
          portalName: getPortalName(
            reservation.channel?.name || reservation.channel?.id
          ),
          updatedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          extras: processedExtras,
        };

        // If booking exists, update it, otherwise create new
        if (existingDoc) {
          await db
            .collection("bookings")
            .doc(existingDoc.id)
            .update({
              ...bookingDoc,
              createdAt: existingDoc.data().createdAt,
              smoobuId: normalizedId,
              smoobuReservationId: normalizedId,
            });
          console.log(
            `🟦 Updated existing booking ${normalizedId} with ${processedExtras.length} extras:`,
            processedExtras.map((e) => e.name)
          );
        } else {
          // For new bookings, set creation date
          const newBookingDoc = {
            ...bookingDoc,
            createdAt: reservation["created-at"] || new Date().toISOString(),
            smoobuId: normalizedId,
            smoobuReservationId: normalizedId,
          };
          await db.collection("bookings").doc(normalizedId).set(newBookingDoc);
          console.log(
            `🟩 Added new booking ${normalizedId} with ${processedExtras.length} extras:`,
            processedExtras.map((e) => e.name)
          );
        }

        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 500)); // Add delay between requests
      } catch (error) {
        console.error(
          `🟥 Error processing reservation ${reservation.id}:`,
          error
        );
        errorCount++;
        continue;
      }
    }

    console.log("🟦 Sync Summary:", {
      totalReservations: reservations.length,
      successfullyProcessed: successCount,
      errors: errorCount,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Sync completed successfully",
      stats: {
        total: reservations.length,
        successful: successCount,
        failed: errorCount,
      },
    };
  } catch (error) {
    console.error("🟥 Error in syncReservations:", error);
    throw error;
  }
}
