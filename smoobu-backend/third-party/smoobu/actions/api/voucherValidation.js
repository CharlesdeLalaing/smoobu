import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../../firebase-config.js"; 

export async function validateVoucher(req, res) {
  try {
    const { code, amount } = req.body;
    console.log("Validating voucher with code:", code, "for amount:", amount);

    const voucherQuery = await getDocs(
      query(collection(db, "coupons"), where("code", "==", code.toUpperCase()))
    );

    if (voucherQuery.empty) {
      console.log("No voucher found with code:", code);
      return res.status(404).json({
        valid: false,
        message: "Code invalide",
      });
    }

    const voucherDoc = voucherQuery.docs[0];
    const voucherData = voucherDoc.data();
    console.log("Found voucher:", voucherData);

    if (voucherData.isGiftVoucher) {
      if (voucherData.usedCount > 0) {
        console.log("Gift voucher already used");
        return res.status(400).json({
          valid: false,
          message: "Ce bon cadeau a déjà été utilisé",
        });
      }

      const expiryDate =
        voucherData.expiryDate?.toDate?.() || new Date(voucherData.expiryDate);
      if (expiryDate < new Date()) {
        console.log("Gift voucher expired");
        return res.status(400).json({
          valid: false,
          message: "Ce bon cadeau a expiré",
        });
      }

      if (amount < voucherData.amount) {
        console.log("Booking amount insufficient");
        return res.status(400).json({
          valid: false,
          message: `Le montant de la réservation doit être supérieur au montant du bon cadeau (${voucherData.amount}€)`,
        });
      }
    } else {
      if (voucherData.status !== "active" && code !== "POTES") {
        console.log("Coupon not active");
        return res.status(400).json({
          valid: false,
          message: "Ce code promo n'est plus valide",
        });
      }

      if (voucherData.expiryDate) {
        const expiryDate =
          voucherData.expiryDate?.toDate?.() ||
          new Date(voucherData.expiryDate);
        if (expiryDate < new Date()) {
          console.log("Coupon expired");
          return res.status(400).json({
            valid: false,
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

    console.log("Voucher validated successfully");
    res.json({
      valid: true,
      code: voucherData.code,
      type: voucherData.type,
      isGiftVoucher: voucherData.isGiftVoucher || false,
      discount: discount,
      amount: voucherData.amount,
      percentageValue:
        voucherData.type === "percentage" ? voucherData.discount : null,
    });
  } catch (error) {
    console.error("Error validating voucher:", error);
    res.status(500).json({
      valid: false,
      message: "Erreur lors de la validation du bon cadeau",
    });
  }
}
