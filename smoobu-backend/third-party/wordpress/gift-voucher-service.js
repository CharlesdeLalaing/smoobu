import { db } from "../../firebase-config.js";

/**
 * Service for handling gift voucher operations
 */
export class GiftVoucherService {
  /**
   * Generates a unique random voucher code
   * @param {string} prefix - Code prefix (default: "GIFT-")
   * @returns {string} - Generated voucher code
   */
  generateVoucherCode(prefix = "GIFT-") {
    // Generate a random alphanumeric sequence
    const randomCode = Math.random()
      .toString(36)
      .substring(2, 12)
      .toUpperCase();

    return `${prefix}${randomCode}`;
  }

  /**
   * Creates a new gift voucher in the database
   * @param {Object} voucherData - Gift voucher data
   * @returns {Promise<Object>} - Created voucher data
   */
  async createGiftVoucher(voucherData) {
    try {
      // Generate the voucher code
      const voucherCode = this.generateVoucherCode();

      // Calculate expiry date (1 year from now)
      const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      // Create the voucher document
      const newVoucher = {
        code: voucherCode,
        amount: Number(voucherData.amount),
        type: "fixed",
        isGiftVoucher: true,
        status: "active",
        orderId: voucherData.orderId,
        customerEmail: voucherData.customerEmail,
        customerName: voucherData.customerName,
        customerPhone: voucherData.customerPhone,
        language: voucherData.language,
        dateCreated: new Date().toISOString(),
        expiryDate: expiryDate.toISOString(),
        usedCount: 0,
        usageHistory: [],
      };

      // Store in Firebase
      const docRef = await db.collection("coupons").add(newVoucher);

      // Return the created voucher with its ID
      return {
        id: docRef.id,
        ...newVoucher,
      };
    } catch (error) {
      console.error("Error creating gift voucher:", error);
      throw error;
    }
  }

  /**
   * Validates required fields for creating a gift voucher
   * @param {Object} data - Input data
   * @returns {Object} - Validation result
   */
  validateVoucherInput(data) {
    const requiredFields = ["amount", "customerEmail", "customerName"];
    const missingFields = requiredFields.filter((field) => !data[field]);

    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      };
    }

    if (isNaN(Number(data.amount)) || Number(data.amount) <= 0) {
      return {
        valid: false,
        error: "Amount must be a positive number",
      };
    }

    return { valid: true };
  }
}
