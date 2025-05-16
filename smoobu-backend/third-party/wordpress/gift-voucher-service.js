import { db } from "../../firebase-config.js"; // Ensure this path is correct

/**
 * Service for handling gift voucher operations
 */
export class GiftVoucherService {
  /**
   * Generates a random voucher code.
   * The random part consists of uppercase alphanumeric characters.
   * @param {string} prefix - Code prefix (default: "GIFT-")
   * @param {number} length - Length of the random alphanumeric part (default: 5)
   * @returns {string} - Generated voucher code (e.g., "GIFT-A1B2C")
   */
  generateVoucherCode(prefix = "GIFT-", length = 5) {
    // Ensure length is at least 1.
    // The useful part of Math.random().toString(36) is typically around 10-11 chars after "0."
    // So, asking for more than 10-11 with this method might not yield distinct characters.
    const effectiveLength = Math.max(1, Math.min(length, 10));

    const randomCodePart = Math.random()
      .toString(36)
      .substring(2, 2 + effectiveLength) // Get 'effectiveLength' characters after "0."
      .toUpperCase();

    return `${prefix}${randomCodePart}`;
  }

  /**
   * Creates a new gift voucher in the database with a unique code.
   * @param {Object} voucherData - Gift voucher data. Can include 'prefix' to override default.
   * @returns {Promise<Object>} - Created voucher data including its ID and code.
   */
  async createGiftVoucher(voucherData) {
    try {
      let voucherCode;
      let isUnique = false;
      let attempts = 0;
      const MAX_ATTEMPTS = 20; // Sufficient for 5 alphanumeric chars (36^5 possibilities)

      // If voucherData.prefix is an empty string "", no prefix will be used.
      const CODE_PREFIX =
        voucherData.prefix !== undefined && voucherData.prefix !== null
          ? voucherData.prefix
          : "GIFT-";
      const CODE_LENGTH = 5; // Desired length of the random part of the code

      // Loop to generate a unique code
      while (!isUnique && attempts < MAX_ATTEMPTS) {
        voucherCode = this.generateVoucherCode(CODE_PREFIX, CODE_LENGTH);

        const existingVoucher = await db
          .collection("coupons")
          .where("code", "==", voucherCode)
          .limit(1)
          .get();
        if (existingVoucher.empty) {
          isUnique = true;
        } else {
          console.warn(
            `Generated voucher code ${voucherCode} already exists. Retrying (attempt ${
              attempts + 1
            }/${MAX_ATTEMPTS})...`
          );
          attempts++;
        }
      }

      if (!isUnique) {
        const errorMessage = `Failed to generate a unique ${CODE_LENGTH}-character voucher code with prefix "${CODE_PREFIX}" after ${MAX_ATTEMPTS} attempts. This is unusual with a large code pool; check for potential issues or if the pool is nearing exhaustion for this specific prefix.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Calculate expiry date (1 year from now)
      const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      // Create the voucher document
      const newVoucher = {
        code: voucherCode,
        amount: Number(voucherData.amount),
        type: "fixed", // Assuming 'fixed' type, adjust if dynamic
        isGiftVoucher: true,
        status: "active", // Default status
        orderId: voucherData.orderId || null, // Store orderId if provided
        customerEmail: voucherData.customerEmail || "",
        customerName: voucherData.customerName || "",
        customerPhone: voucherData.customerPhone || "",
        language: voucherData.language || "unknown", // Store language if provided
        dateCreated: new Date().toISOString(),
        expiryDate: expiryDate.toISOString(),
        usedCount: 0,
        usageHistory: [], // To track when and how the voucher is used
      };

      // Store in Firebase
      const docRef = await db.collection("coupons").add(newVoucher);
      console.log(
        `Successfully created gift voucher with code: ${voucherCode}`
      );

      // Return the created voucher with its ID from Firestore
      return {
        id: docRef.id,
        ...newVoucher,
      };
    } catch (error) {
      console.error("Error creating gift voucher:", error.message);
      // Propagate the error so the calling function (e.g., API endpoint handler) can manage it
      throw error;
    }
  }

  /**
   * Validates required fields for creating a gift voucher.
   * @param {Object} data - Input data from the request.
   * @returns {Object} - An object containing { valid: boolean, error?: string }.
   */
  validateVoucherInput(data) {
    const requiredFields = ["amount", "customerEmail", "customerName"]; // Adjust as per your actual requirements
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
        error: "Amount must be a positive number.",
      };
    }

    // Add any other specific validations you need (e.g., email format)

    return { valid: true };
  }
}
