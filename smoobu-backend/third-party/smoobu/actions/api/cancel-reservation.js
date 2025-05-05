// smoobu-backend/third-party/smoobu/actions/api/cancel-reservation.js
import axios from "axios";
import * as dotenv from "dotenv";

// Load environment variables (ensure .env file exists at the root or configure dotenv path)
dotenv.config();

/**
 * Handles the request to cancel a Smoobu reservation by its ID.
 * This function is intended to be used as an Express route handler.
 * @param {object} req - Express request object. Expects reservation ID in req.params.reservationId
 * @param {object} res - Express response object.
 */
export async function handleCancelSmoobuReservation(req, res) {
  // Extract the reservation ID from the URL path parameters
  const { reservationId } = req.params;

  console.log(
    `[Cancel Smoobu] Received request to cancel reservation ID: ${reservationId}`
  );

  // --- Validate Input ---
  if (!reservationId) {
    console.error(
      "[Cancel Smoobu] Error: Missing reservationId path parameter."
    );
    // Send 400 Bad Request if the ID is missing in the URL structure
    return res
      .status(400)
      .json({ message: "Reservation ID is required in the URL path." });
  }
  // Optional: Add validation to check if reservationId looks like a number if needed
  // if (!/^\d+$/.test(reservationId)) {
  //    return res.status(400).json({ message: "Invalid Reservation ID format." });
  // }

  // --- Check for API Key ---
  const smoobuApiKey = process.env.SMOOBU_API_KEY;
  if (!smoobuApiKey) {
    console.error(
      "[Cancel Smoobu] FATAL Error: SMOOBU_API_KEY environment variable is not set."
    );
    // Don't reveal internal configuration issues to the client
    return res
      .status(500)
      .json({ message: "Internal server configuration error." });
  }

  // --- Prepare Smoobu API Request ---
  const smoobuApiUrl = `https://login.smoobu.com/api/reservations/${reservationId}`;

  try {
    // --- Send DELETE Request to Smoobu ---
    console.log(
      `[Cancel Smoobu] Sending DELETE request to Smoobu API: ${smoobuApiUrl}`
    );
    const response = await axios.delete(smoobuApiUrl, {
      headers: {
        "Api-Key": smoobuApiKey, // Use the API key from environment variables
        "Cache-Control": "no-cache", // As recommended by Smoobu docs
        Accept: "application/json", // Specify expected response type
      },
      // Axios throws an error for non-2xx status codes by default,
      // so we can catch specific errors below.
    });

    // --- Process Successful Smoobu Response ---
    // Check if Smoobu confirmed success (status 200 and success: true)
    if (response.status === 200 && response.data?.success === true) {
      console.log(
        `[Cancel Smoobu] Successfully cancelled reservation ID: ${reservationId} via Smoobu.`
      );
      // Send success response back to your client (e.g., admin panel)
      return res
        .status(200)
        .json({
          success: true,
          message: `Reservation ${reservationId} cancelled successfully.`,
        });
    } else {
      // This case might indicate an unexpected 2xx response from Smoobu
      console.warn(
        `[Cancel Smoobu] Unexpected successful response format from Smoobu for ID ${reservationId}. Status: ${response.status}, Data:`,
        response.data
      );
      return res
        .status(502)
        .json({
          message:
            "Cancellation processed by Smoobu but received an unexpected confirmation.",
        });
    }
  } catch (error) {
    // --- Handle Errors During Smoobu API Call ---
    console.error(
      `[Cancel Smoobu] Error during cancellation attempt for ID ${reservationId}:`,
      error.message
    );

    if (error.response) {
      // Smoobu responded with an error status (4xx or 5xx)
      console.error(
        "[Cancel Smoobu] Smoobu Error Status:",
        error.response.status
      );
      console.error("[Cancel Smoobu] Smoobu Error Data:", error.response.data);

      // Provide specific feedback based on Smoobu's error code
      if (error.response.status === 401) {
        // Unauthorized - Indicates an issue with your API key
        console.error(
          "[Cancel Smoobu] Smoobu authentication failed (401). Check API Key."
        );
        return res
          .status(500)
          .json({
            message: "Authentication failed with the external booking service.",
          }); // Hide details from client
      } else if (error.response.status === 404) {
        // Not Found - The reservation ID likely doesn't exist in Smoobu
        console.log(
          `[Cancel Smoobu] Reservation ID ${reservationId} not found in Smoobu (404).`
        );
        return res
          .status(404)
          .json({ message: `Reservation with ID ${reservationId} not found.` });
      } else {
        // Handle other potential Smoobu errors (e.g., 400 Bad Request, 5xx Server Error)
        return res.status(502).json({
          // 502 Bad Gateway suggests an issue upstream
          message:
            "Failed to cancel reservation. The external booking service reported an error.",
          details:
            error.response.data?.detail ||
            error.response.data ||
            "Unknown error from booking service.",
        });
      }
    } else if (error.request) {
      // The request was made, but no response was received from Smoobu
      console.error(
        "[Cancel Smoobu] No response received from Smoobu:",
        error.request
      );
      return res
        .status(504)
        .json({
          message: "No response received from the external booking service.",
        }); // 504 Gateway Timeout
    } else {
      // An error occurred setting up the request before it was sent
      console.error(
        "[Cancel Smoobu] Error setting up cancellation request:",
        error.message
      );
      return res
        .status(500)
        .json({
          message: "Internal server error preparing the cancellation request.",
        });
    }
  }
}
