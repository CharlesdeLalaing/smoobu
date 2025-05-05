import React, { useState } from "react";
import axios from "axios";

function AdminBookingCancellation() {
  const [reservationId, setReservationId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleCancelClick = async () => {
    if (!reservationId.trim()) {
      // Trim whitespace
      setMessage("Veuillez entrer un ID de réservation Smoobu.");
      setIsError(true);
      return;
    }
    setIsLoading(true);
    setMessage("");
    setIsError(false);
    // Use environment variable for backend URL if available, otherwise default
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"; // Adjust port if needed, Vite uses VITE_ prefix

    try {
      console.log(
        `Sending cancel request for ID: ${reservationId} to ${backendUrl}`
      );
      const response = await axios.delete(
        `${backendUrl}/api/cancel-smoobu-reservation/${reservationId.trim()}`
      ); // Trim ID
      setMessage(response.data.message || "Annulation réussie !");
      setIsError(false);
      setReservationId(""); // Clear input on success
    } catch (error) {
      console.error("Cancellation failed:", error);
      // Provide more user-friendly messages
      let displayMessage = "Échec de l'annulation.";
      if (error.response) {
        switch (error.response.status) {
          case 404:
            displayMessage = "Réservation non trouvée avec cet ID.";
            break;
          case 502:
          case 504:
            displayMessage =
              "Erreur de communication avec le service de réservation (Smoobu). Réessayez plus tard.";
            break;
          default:
            displayMessage =
              error.response.data?.message ||
              "Une erreur inattendue est survenue.";
        }
      } else if (error.request) {
        displayMessage =
          "Aucune réponse du serveur. Vérifiez la connexion et si le backend est lancé.";
      } else {
        displayMessage = `Erreur: ${error.message}`;
      }
      setMessage(displayMessage);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="mb-4 text-xl font-semibold">
        Annuler une réservation Smoobu
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Entrez l'ID numérique de la réservation Smoobu que vous souhaitez
        annuler. Cette action est irréversible via cette interface.
      </p>
      <div className="flex items-end gap-4">
        <div className="flex-grow">
          <label
            htmlFor="smoobuReservationId"
            className="block mb-1 text-sm font-medium text-gray-700"
          >
            ID de Réservation Smoobu
          </label>
          <input
            type="text"
            id="smoobuReservationId"
            value={reservationId}
            onChange={(e) => {
              setReservationId(e.target.value);
              // Clear message when user types
              if (message) setMessage("");
            }}
            placeholder="Ex: 1234567"
            disabled={isLoading}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
          />
        </div>
        <button
          onClick={handleCancelClick}
          disabled={isLoading || !reservationId.trim()} // Disable if loading or input is empty
          className={`px-4 py-2 rounded-md text-white font-medium transition-colors shadow-sm ${
            isLoading || !reservationId.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          }`}
        >
          {isLoading ? "Annulation..." : "Annuler la Réservation"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-4 text-sm ${
            isError ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default AdminBookingCancellation;
