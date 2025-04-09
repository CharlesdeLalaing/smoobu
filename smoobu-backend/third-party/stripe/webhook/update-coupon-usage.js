import { db, FieldValue } from "../../../firebase-config.js";

export const updateCouponUsage = async (bookingData) => {
  if (!bookingData.couponApplied?.code) {
    return { success: true, message: "No coupon to update" };
  }
  try {
    console.log("🟨 Starting coupon update process:", {
      couponCode: bookingData.couponApplied.code,
      couponData: bookingData.couponApplied,
    });
    const couponsRef = db.collection("coupons");
    const couponQuery = await couponsRef
      .where("code", "==", bookingData.couponApplied.code)
      .get();
    if (couponQuery.empty) {
      console.error(
        "🟥 Coupon document not found for code:",
        bookingData.couponApplied.code
      );
      return { success: false, message: "Coupon not found" };
    }
    const couponDoc = couponQuery.docs[0];
    const couponData = couponDoc.data();

    const usageRecord = {
      email: bookingData.email,
      name: `${bookingData.firstName} ${bookingData.lastName}`,
      bookingAmount: bookingData.price,
      usageDate: new Date().toISOString(),
      discountApplied: bookingData.couponApplied.discount,
    };

    // Check if this is an unlimited coupon or the POTES code
    const isUnlimitedCoupon =
      couponData.isUnlimited || bookingData.couponApplied.code === "POTES";

    if (isUnlimitedCoupon) {
      // For unlimited coupons, just record the usage without marking as inactive
      await couponDoc.ref.update({
        usageHistory: FieldValue.arrayUnion(usageRecord),
        usedCount: FieldValue.increment(1),
        lastUsedDate: new Date().toISOString(),
        lastUsedBy: bookingData.email,
        updatedAt: new Date().toISOString(),
      });
      console.log("🟩 Unlimited coupon usage recorded:", {
        couponId: couponDoc.id,
        code: bookingData.couponApplied.code,
      });
    } else {
      // Regular coupons (one-time use)
      await couponDoc.ref.update({
        status: "inactive", // Mark as used
        usedCount: FieldValue.increment(1),
        lastUsedDate: new Date().toISOString(),
        lastUsedBy: bookingData.email,
        usageHistory: FieldValue.arrayUnion(usageRecord),
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error("🟥 Error updating coupon:", {
      error: error.message,
      stack: error.stack,
      couponData: bookingData.couponApplied,
    });
    return { success: false, error: error.message };
  }
};