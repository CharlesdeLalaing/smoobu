import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LocalStorageDebug from './LocalStorageDebug';

import logoBaseilles from "../assets/logoBaseilles.webp"
import { useTranslation } from "react-i18next";
import "../assets/bookingConfirmation.css"

const BookingConfirmation = () => {
  const [status, setStatus] = useState("loading");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const paymentIntent = searchParams.get("payment_intent");
  const { t } = useTranslation();

  useEffect(() => {
    console.log('Payment Intent:', paymentIntent);
    const storedBookingData = localStorage.getItem("bookingData");
    console.log('Initial stored data:', storedBookingData);
    
    if (storedBookingData) {
      try {
        const parsedData = JSON.parse(storedBookingData);
        console.log('Parsed booking data:', parsedData);
        setBookingDetails(parsedData);
        setStatus("success");
        // Only remove after confirming the data is displayed
        if (parsedData) {
          localStorage.removeItem("bookingData");
        }
      } catch (error) {
        console.error("Error parsing booking data:", error);
        setStatus("error");
      }
    } else {
      if (paymentIntent) {
        console.log('No stored data, fetching from API...');
        fetchBookingDetails(paymentIntent);
      }
    }
  }, [paymentIntent]);

  const API_URL = "https://booking-9u8u.onrender.com/"

  const fetchBookingDetails = async (paymentIntentId) => {

    try {
      const response = await fetch(
        `${API_URL}/api/bookings/${paymentIntentId}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setBookingDetails(data);
      setStatus("success");
    } catch (error) {
      console.error("Error fetching booking details:", error);
      setStatus("error");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fr-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  if (status === "loading") {
    return (
      <div className="container">
        <div className="card">
          <h2>Traitement de votre réservation...</h2>
          <p>Veuillez patienter pendant que nous confirmons votre paiement.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container">
        <div className="card">
          <h2>Une erreur s'est produite lors de la récupération de vos détails de réservation.</h2>
          <p>Veuillez vérifier votre email pour les détails de la réservation ou nous contacter.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        minWidth: "100vw",
        display: "flex",
        alignItems: "center",
      }}
      className="container"
    >
      <div className="card">
        {/* Success Header */}
        <div className="header">
          <div className="icon-container">
            <img src={logoBaseilles} alt="Logo Baseilles" className="icon" />
          </div>
          <div>
            <h1 className="title">Réservation Confirmée</h1>
            <p className="subtitle">
              Une confirmation vous a été envoyée à {bookingDetails?.email}
            </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid">
          {/* Stay Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">Détails du séjour</h2>
            <p>Check-in: {formatDate(bookingDetails?.arrivalDate)}</p>
            <p>Heure d'arrivée: {bookingDetails?.arrivalTime}</p>
            <p>Check-out: {formatDate(bookingDetails?.departureDate)}</p>
            <p>
              Voyageurs: {bookingDetails?.adults} adultes
              {bookingDetails?.children > 0 &&
                `, ${bookingDetails?.children} enfants`}
            </p>
          </div>

          {/* Guest Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">Informations du client</h2>
            <p>
              Nom complet: {bookingDetails?.firstName}{" "}
              {bookingDetails?.lastName}
            </p>
            <p>Email: {bookingDetails?.email}</p>
            <p>Téléphone: {bookingDetails?.phone || "-"}</p>
          </div>

          {/* Price Details */}
          {/* Price Details */}
          <div className="details-card">
            <h2 className="titleConfirmation">Détails du prix</h2>
            <p>
              Prix de base:{" "}
              {(bookingDetails?.priceBreakdown?.basePrice || 0).toFixed(2)}€
            </p>

            {/* Show extras */}
            {bookingDetails?.extras?.map((extra, index) => {
              const totalAmount =
                (extra.amount || 0) + (extra.extraPersonAmount || 0);
              return (
                <div key={index}>
                  <p>
                    {extra.name} (x{extra.quantity}): {totalAmount.toFixed(2)}€
                  </p>
                  {extra.extraPersonQuantity > 0 && (
                    <p className="ml-4">
                      Personne supplémentaire (x{extra.extraPersonQuantity}):{" "}
                      {extra.extraPersonAmount?.toFixed(2)}€
                    </p>
                  )}
                </div>
              );
            })}

            {/* Long stay discount if applicable */}
            {bookingDetails?.priceDetails?.discount > 0 && (
              <p className="discount-text">
                Réduction long séjour (
                {
                  bookingDetails.priceDetails.settings.lengthOfStayDiscount
                    .discountPercentage
                }
                %): -{bookingDetails.priceDetails.discount.toFixed(2)}€
              </p>
            )}

            {/* Coupon discount if applicable */}
            {bookingDetails?.couponApplied && (
              <p className="discount-text">
                Code promo ({bookingDetails.couponApplied.code}): -
                {bookingDetails.couponApplied.discount.toFixed(2)}€
              </p>
            )}

            {/* Total */}
            <div className="total-section">
              <p className="total-text">
                Total: {(bookingDetails?.price || 0).toFixed(2)}€
              </p>
              <p>Conditions générales: Acceptée</p>
            </div>
          </div>

          {/* Address */}
          <div className="details-card">
            <h2 className="titleConfirmation">Adresse</h2>
            <p>{bookingDetails?.street}</p>
            <p>
              {bookingDetails?.postalCode} {bookingDetails?.location}
            </p>
            <p>{bookingDetails?.country}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="actions">
          <button
            onClick={() => (window.location.href = "/")}
            className="button-primary"
          >
            Retour à l'accueil
          </button>
          <button onClick={() => window.print()} className="button-secondary">
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;