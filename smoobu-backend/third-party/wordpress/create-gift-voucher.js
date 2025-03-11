import { GiftVoucherService } from "./gift-voucher-service.js";
import { verifyWordPressAuth } from "../wordpress/verify-wordpress-auth.js";

/**
 * Controller for creating gift vouchers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createGiftVoucher(req, res) {
  try {
    const voucherData = req.body;

    // Create a new gift voucher service
    const voucherService = new GiftVoucherService();

    // Validate input data
    const validation = voucherService.validateVoucherInput(voucherData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Create the voucher
    const voucher = await voucherService.createGiftVoucher(voucherData);

    // Return success response
    res.json({
      success: true,
      voucherCode: voucher.code,
      amount: voucher.amount,
    });
  } catch (error) {
    console.error("Error creating gift voucher:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create gift voucher",
      details: error.message,
    });
  }
}

/**
 * Middleware function to handle gift voucher creation
 * Combines WordPress authentication and gift voucher creation
 */
export const handleCreateGiftVoucher = [verifyWordPressAuth, createGiftVoucher];
