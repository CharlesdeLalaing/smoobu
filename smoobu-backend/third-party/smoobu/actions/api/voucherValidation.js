import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../../firebase-config.js";

export async function validateVoucher(req, res) {
  try {
    const { code, amount } = req.body;
    const voucherQuery = await getDocs(
      query(collection(db, "coupons"), where("code", "==", code.toUpperCase()))
    );

    if (voucherQuery.empty) {
      return res.status(404).json({
        valid: false,
        error: "not_found",
        message: "Code invalide",
      });
    }

    const voucherDoc = voucherQuery.docs[0];
    const voucherData = voucherDoc.data();
    const currentDate = new Date();

    // Helper function to safely convert Firestore dates
    const convertToDate = (timestamp) => {
      if (!timestamp) return null;
      return timestamp?.toDate?.() || new Date(timestamp);
    };

    // Helper function to format dates in French
    const formatFrenchDate = (date) => {
      if (!date) return "date inconnue";
      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    // Check validity period for all coupon types
    if (voucherData.validityStartDate && voucherData.validityEndDate) {
      const startDate = convertToDate(voucherData.validityStartDate);
      const endDate = convertToDate(voucherData.validityEndDate);

      // Format dates for error message
      const formattedStartDate = formatFrenchDate(startDate);
      const formattedEndDate = formatFrenchDate(endDate);

      if (startDate && currentDate < startDate) {
        return res.status(400).json({
          valid: false,
          error: "invalid_dates",
          message: `Ce code n'est valable que pour les séjours entre le ${formattedStartDate} et le ${formattedEndDate}`,
        });
      }

      if (endDate && currentDate > endDate) {
        return res.status(400).json({
          valid: false,
          error: "invalid_dates",
          message: `Ce code n'est valable que pour les séjours entre le ${formattedStartDate} et le ${formattedEndDate}`,
        });
      }
    }

    if (voucherData.isGiftVoucher) {
      if (voucherData.usedCount > 0) {
        return res.status(400).json({
          valid: false,
          error: "used",
          message: "Ce bon cadeau a déjà été utilisé",
        });
      }

      const expiryDate = convertToDate(voucherData.expiryDate);
      if (expiryDate && expiryDate < currentDate) {
        return res.status(400).json({
          valid: false,
          error: "expired",
          message: "Ce bon cadeau a expiré",
        });
      }

      if (amount < voucherData.amount) {
        return res.status(400).json({
          valid: false,
          error: "amount_too_low",
          message: `Le montant de la réservation doit être supérieur au montant du bon cadeau (${voucherData.amount}€)`,
        });
      }
    } else {
      // Modified logic to handle unlimited coupons
      // Check if the coupon is unlimited or the POTES code
      const isUnlimitedCoupon = voucherData.isUnlimited || code === "POTES";

      // Only check active status for non-unlimited coupons
      if (voucherData.status !== "active" && !isUnlimitedCoupon) {
        return res.status(400).json({
          valid: false,
          error: "inactive",
          message: "Ce code promo n'est plus valide",
        });
      }

      if (voucherData.expiryDate) {
        const expiryDate = convertToDate(voucherData.expiryDate);
        if (expiryDate && expiryDate < currentDate) {
          return res.status(400).json({
            valid: false,
            error: "expired",
            message: "Ce code promo a expiré",
          });
        }
      }
    }

    let discount = 0;
    if (voucherData.type === "percentage") {
      discount = (amount * voucherData.discount) / 100;
    } else {
      discount = voucherData.discount;
    }

    res.json({
      valid: true,
      code: voucherData.code,
      type: voucherData.type,
      isGiftVoucher: voucherData.isGiftVoucher || false,
      isUnlimited: voucherData.isUnlimited || false, // Include this in the response
      discount: discount,
      amount: voucherData.amount,
      percentageValue:
        voucherData.type === "percentage" ? voucherData.discount : null,
    });
  } catch (error) {
    console.error("Error validating voucher:", error);
    res.status(500).json({
      valid: false,
      error: "server_error",
      message: "Erreur lors de la validation du bon cadeau",
    });
  }
}
