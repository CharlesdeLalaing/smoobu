import { db, FieldValue } from "../../../firebase-config.js"; // Ensure this path is correct relative to this file

export const updateCouponUsage = async (
  appliedCouponObject, // The coupon object that was actually applied during booking
  userEmail,
  userFirstName,
  userLastName,
  bookingPrice, // The final price of the booking where coupon was used
  smoobuReservationId // Optional: Smoobu reservation ID for logging in usage history
) => {
  // Validate that essential information is present
  if (!appliedCouponObject || !appliedCouponObject.code) {

    // Returning success:true because it's not an error if no coupon was applied.
    return { success: true, message: "No coupon data to update." };
  }

  // Ensure userEmail is at least a placeholder if not provided to prevent Firestore errors with undefined
  const emailForRecord = userEmail || "unknown_email@system.placeholder";
  const userNameForRecord =
    `${userFirstName || ""} ${userLastName || ""}`.trim() || "Unknown User";

  const couponCodeToUpdate = appliedCouponObject.code;

  try {


    const couponsRef = db.collection("coupons");
    const couponQuery = await couponsRef
      .where("code", "==", couponCodeToUpdate)
      .get();

    if (couponQuery.empty) {
      console.error(
        `🟥 [updateCouponUsage] Coupon document not found in Firestore for code: ${couponCodeToUpdate}`
      );
      return {
        success: false,
        message: `Coupon ${couponCodeToUpdate} not found in Firestore.`,
      };
    }

    const couponDoc = couponQuery.docs[0];
    const couponDataFromDb = couponDoc.data(); // Fresh data from the database for this coupon

 

    // Prepare the record for usage history
    const usageRecord = {
      email: emailForRecord,
      name: userNameForRecord,
      bookingAmount: bookingPrice !== undefined ? Number(bookingPrice) : 0,
      usageDate: new Date().toISOString(),
      discountApplied:
        appliedCouponObject.discount !== undefined
          ? Number(appliedCouponObject.discount)
          : 0,
      smoobuReservationId: smoobuReservationId || null,
      bookingLanguage: appliedCouponObject.bookingLanguage || null, // If you pass this from bookingDoc.language
    };

    // Determine if the coupon from DB is effectively unlimited
    // A coupon is effectively unlimited if its 'isUnlimited' field is true OR its code is "POTES".
    const isEffectivelyUnlimited =
      couponDataFromDb.isUnlimited === true ||
      couponDataFromDb.code === "POTES";

    // Prepare the fields to update in Firestore
    const updates = {
      usageHistory: FieldValue.arrayUnion(usageRecord), // Add to usage history
      usedCount: FieldValue.increment(1), // Increment usage count
      lastUsedDate: new Date().toISOString(), // Record when it was last used
      updatedAt: new Date().toISOString(), // Standard timestamp update
    };

    // Only set lastUsedBy if email is not the placeholder
    if (userEmail) {
      updates.lastUsedBy = userEmail;
    }

    if (!isEffectivelyUnlimited) {
      // This section is for coupons that are NOT unlimited.
      // This includes:
      // 1. Standard promo codes (where isUnlimited is false or undefined, and code is not POTES).
      // 2. One-time-use Gift Vouchers (where isGiftVoucher is true, AND isUnlimited is false or undefined in Firestore).
      updates.status = "inactive";

    } else {
      console.log(
        `🟩 [updateCouponUsage] Coupon ${couponDataFromDb.code} (ID: ${couponDoc.id}) is effectively unlimited. Status will not be changed to 'inactive' by this update.`
      );
    }

    // Perform the Firestore update
    await couponDoc.ref.update(updates);

    const finalStatus = updates.status || couponDataFromDb.status; // Get the status that was applied or the existing one
    console.log(
      `🟩 [updateCouponUsage] Coupon usage successfully recorded in Firestore for ${couponDataFromDb.code}. New/Current status: '${finalStatus}'. Used count will be incremented.`
    );

    return {
      success: true,
      message: `Coupon ${couponDataFromDb.code} usage updated successfully. Status: ${finalStatus}.`,
    };
  } catch (error) {
    console.error(
      `🟥 [updateCouponUsage] Error updating coupon ${couponCodeToUpdate} in Firestore:`,
      {
        message: error.message,
        stack: error.stack, // Log stack for better debugging
      }
    );
    // It's important that the webhook doesn't get stuck retrying if this fails due to bad data.
    // The caller (handleWebhook) can decide if this error is critical enough to stop the whole process.
    return { success: false, error: error.message };
  }
};
