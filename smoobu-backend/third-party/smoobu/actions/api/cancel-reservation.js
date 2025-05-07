import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Cancels a Smoobu reservation by its ID.
 * This function now returns a Promise that resolves on success or rejects on failure.
 * @param {string} reservationId - The ID of the reservation to cancel.
 * @returns {Promise<object>} A promise that resolves with { success: true, message: "..." } or rejects with an error object.
 */
export async function cancelSmoobuReservationById(reservationId) {
  console.log(
    `[Smoobu API] Attempting to cancel reservation ID: ${reservationId}`
  );

  // --- Validate Input ---
  if (!reservationId) {
    console.error("[Smoobu API] Error: Missing reservationId.");
    // Reject with an error object that can be caught
    return Promise.reject({
      status: 400,
      message: "Reservation ID is required.",
      source: "inputValidation",
    });
  }

  // --- Check for API Key ---
  const smoobuApiKey = process.env.SMOOBU_API_KEY;
  if (!smoobuApiKey) {
    console.error(
      "[Smoobu API] FATAL Error: SMOOBU_API_KEY environment variable is not set."
    );
    return Promise.reject({
      status: 500,
      message: "Internal server configuration error (API key missing).",
      source: "configValidation",
    });
  }

  // --- Prepare Smoobu API Request ---
  const smoobuApiUrl = `https://login.smoobu.com/api/reservations/${reservationId}`;

  try {
    // --- Send DELETE Request to Smoobu ---
    console.log(
      `[Smoobu API] Sending DELETE request to Smoobu: ${smoobuApiUrl}`
    );
    const response = await axios.delete(smoobuApiUrl, {
      headers: {
        "Api-Key": smoobuApiKey,
        "Cache-Control": "no-cache",
        Accept: "application/json",
      },
    });

    // --- Process Successful Smoobu Response ---
    if (response.status === 200 && response.data?.success === true) {
      console.log(
        `[Smoobu API] Successfully cancelled reservation ID: ${reservationId} via Smoobu.`
      );
      return {
        // Resolve with success
        success: true,
        message: `Reservation ${reservationId} cancelled successfully in Smoobu.`,
        data: response.data,
      };
    } else {
      console.warn(
        `[Smoobu API] Unexpected successful response format from Smoobu for ID ${reservationId}. Status: ${response.status}, Data:`,
        response.data
      );
      return Promise.reject({
        // Reject with an error-like object
        status: 502, // Bad Gateway - unexpected response from upstream
        message:
          "Cancellation processed by Smoobu but received an unexpected confirmation.",
        smoobuData: response.data,
        source: "smoobuResponseFormat",
      });
    }
  } catch (error) {
    // --- Handle Errors During Smoobu API Call ---
    console.error(
      `[Smoobu API] Error during cancellation attempt for ID ${reservationId}:`,
      error.message
    );

    const errorResponse = {
      message: "Failed to cancel reservation with external booking service.",
      source: "smoobuApiError",
      originalError: error.message,
    };

    if (error.response) {
      // Smoobu responded with an error status
      errorResponse.status = error.response.status; // e.g., 401, 404
      errorResponse.smoobuData = error.response.data;
      if (error.response.status === 401) {
        errorResponse.message =
          "Authentication failed with Smoobu (check API Key).";
      } else if (error.response.status === 404) {
        errorResponse.message = `Reservation with ID ${reservationId} not found in Smoobu.`;
      } else {
        errorResponse.message = `Smoobu API error: ${
          error.response.data?.detail || error.response.status
        }`;
      }
    } else if (error.request) {
      // No response received
      errorResponse.status = 504; // Gateway Timeout
      errorResponse.message = "No response received from Smoobu.";
    } else {
      // Setup error
      errorResponse.status = 500;
      errorResponse.message = "Error setting up Smoobu cancellation request.";
    }
    return Promise.reject(errorResponse); // Reject with the constructed error object
  }
}
