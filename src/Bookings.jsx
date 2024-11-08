import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentForm from "./components/PaymentForm";
import StripeWrapper from "./components/StripeWrapper";
import BookingConfirmation from "./components/BookingConfirmation";

import Calendar from './assets/icons8-calendar-50.png';
import Group from './assets/icons8-group-48.png';

// Initialize Stripe
const stripePromise = loadStripe(
  "pk_test_51QHmafIhkftuEy3nUnQeADHtSgrHJDHFtkQDfKK7dtkN8XwYw4qImtQTAgGiV0o9TR2m2DZfHhc4VmugNUw0pEuF009YsiV98I"
);

// Create API instance
const api = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

const BookingForm = () => {
  const [formData, setFormData] = useState({
    arrivalDate: "",
    departureDate: "",
    channelId: 3960043,
    apartmentId: 2402388,
    arrivalTime: "",
    departureTime: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notice: "",
    adults: 1,
    children: 0,
    price: "",
    priceStatus: 1,
    deposit: 0,
    depositStatus: 1,
    language: "en",
    street: "",
    postalCode: "",
    location: "",
    country: ""
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [dailyRates, setDailyRates] = useState({});
  const [priceDetails, setPriceDetails] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState("");

//DISCOUNT
  const [discountCode, setDiscountCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isDiscountValid, setIsDiscountValid] = useState(false);

  const [showExtras, setShowExtras] = useState(false);
const [selectedExtras, setSelectedExtras] = useState({});

const extras = [
  { id: 'spa', name: 'Formule SPA (2pers)', price: 50, type: 'booking' },
  { id: 'spaBottle', name: 'Formule SPA + bouteille (2pers)', price: 90, type: 'booking' },
  { id: 'passion', name: 'Formule passion', price: 50, type: 'booking' },
  { id: 'anniversary', name: 'Formule anniversaire (2pers)', price: 55, type: 'booking' },
  { id: 'breakfast', name: 'Formule petit-déjeuner (2pers)', price: 35, type: 'booking' },
  { id: 'gourmet', name: 'Formule gourmet (2pers)', price: 85, type: 'booking' },
  { id: 'raclette', name: 'Formule raclette (2pers)', price: 85, type: 'booking' },
  { id: 'apero', name: 'Formule planche apéro (2pers)', price: 30, type: 'booking' },
  { id: 'extraSpa', name: 'Personne supplémentaire SPA', price: 10, type: 'booking' },
  { id: 'extraAnniversary', name: 'Personne supplémentaire anniversaire', price: 5, type: 'booking' },
  { id: 'extraBreakfast', name: 'Personne supplémentaire petit-déjeuner', price: 10, type: 'booking' },
  { id: 'extraRaclette', name: 'Personne supplémentaire raclette', price: 20, type: 'booking' },
  { id: 'extraGourmet', name: 'Personne supplémentaire gourmet', price: 20, type: 'booking' },
  // Meals
  { id: 'meatballsTomato', name: 'Boulette de viande sauce tomate (1pers)', price: 15, type: 'meal' },
  { id: 'waterzooi', name: 'Waterzooï de volaille (1pers)', price: 15, type: 'meal' },
  { id: 'chiliVeg', name: 'Chili végétarien (1pers)', price: 15, type: 'meal' },
  { id: 'meatballsLiege', name: 'Boulettes de viande sauce liégeoise (1pers)', price: 15, type: 'meal' },
  { id: 'carrotSoup', name: 'Velouté de carotte et cumin (1pers)', price: 5, type: 'meal' },
  // Drinks
  { id: 'brutBioul', name: 'Brut de Bioul', price: 50, type: 'drink' },
  { id: 'cortilBarco', name: 'Cortil Barco', price: 30, type: 'drink' },
  { id: 'terreCharlot', name: 'Terre Charlot', price: 30, type: 'drink' },
  { id: 'houblondeTriple', name: 'Houblonde Triple', price: 4, type: 'drink' },
  { id: 'houblondeBlonde', name: 'Houblonde Blonde', price: 4, type: 'drink' },
  { id: 'houblondeWhite', name: 'Houblonde White IPA', price: 4, type: 'drink' },
  { id: 'bruneCondroz', name: 'Brune du Condroz', price: 4, type: 'drink' },
  { id: 'ambreeCondroz', name: 'Ambrée du Condroz', price: 4, type: 'drink' },
  { id: 'blancheCondroz', name: 'Blanche du Condroz', price: 4, type: 'drink' },
  { id: 'saisonCondroz', name: 'Saison du Condroz', price: 4, type: 'drink' },
  { id: 'appleJuice', name: 'Jus de pomme « Happy »', price: 3, type: 'drink' },
  { id: 'ritchieLemonRasp', name: 'Ritchie Citron/Framboise', price: 3, type: 'drink' },
  { id: 'ritchieOrangeVan', name: 'Ritchie Orange/Vanille', price: 3, type: 'drink' },
  { id: 'ritchieCola', name: 'Ritchie Cola', price: 3, type: 'drink' },
  { id: 'ritchieColaZero', name: 'Ritchie Cola Zéro', price: 3, type: 'drink' },
];

  const arrivalDateRef = useRef(null);
  const departureDateRef = useRef(null);

  const openArrivalDatePicker = () => arrivalDateRef.current?.showPicker();
  const openDepartureDatePicker = () => departureDateRef.current?.showPicker();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  };


  const handleExtraChange = (extraId, quantity) => {
    setSelectedExtras(prev => ({
      ...prev,
      [extraId]: quantity
    }));
  };
  
  //DISCOUNT
  const calculateExtrasTotal = () => {
    const extrasTotal = Object.entries(selectedExtras).reduce((total, [extraId, quantity]) => {
      const extra = extras.find(e => e.id === extraId);
      return total + (extra?.price || 0) * quantity;
    }, 0);
  
    // Apply discount if valid
    return extrasTotal - (isDiscountValid ? discountAmount : 0);
  };
  

  const fetchRates = async (apartmentId, startDate, endDate) => {
    if (!apartmentId || !startDate || !endDate) return;

    setLoading(true);
    try {
      const response = await api.get("/rates", {
        params: {
          apartments: [apartmentId],
          start_date: startDate,
          end_date: endDate,
          adults: formData.adults,
          children: formData.children,
        },
      });

      if (response.data.data && response.data.data[apartmentId]) {
        setPriceDetails(response.data.priceDetails);
        setFormData(prevData => ({
          ...prevData,
          price: response.data.priceDetails?.finalPrice || 0,
        }));
        setIsAvailable(true);
        setShowPriceDetails(true);
        setError(null);
      } else {
        setIsAvailable(false);
        setShowPriceDetails(false);
        setError("Aucun tarif trouvé pour les dates sélectionnées");
        setPriceDetails(null);
      }
    } catch (err) {
      setIsAvailable(false);
      setShowPriceDetails(false);
      setError(err.response?.data?.error || "Impossible de récupérer les tarifs. Veuillez réessayer plus tard.");
      setPriceDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = () => {
    fetchRates(formData.apartmentId, formData.arrivalDate, formData.departureDate);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
  
    if (name === "arrivalDate" || name === "departureDate") {
      setShowPriceDetails(false);
    }
  
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.price) {
      setError("Please wait for the price calculation before submitting.");
      return;
    }
  
    setLoading(true);
    try {
      // Calculate total with extras
      const extrasTotal = calculateExtrasTotal();
      const totalPrice = Number(formData.price) + extrasTotal;
  
      // Create array of selected extras for the booking
      const selectedExtrasArray = Object.entries(selectedExtras)
        .filter(([_, quantity]) => quantity > 0)
        .map(([extraId, quantity]) => {
          const extra = extras.find(e => e.id === extraId);
          return {
            type: 'addon',
            name: extra.name,
            amount: extra.price * quantity,
            quantity: quantity,
            currencyCode: 'EUR'
          };
        });
  
      console.log("Submitting booking data:", formData);
      const response = await api.post("/create-payment-intent", {
        price: totalPrice, // Send total price including extras
        bookingData: {
          ...formData,
          price: totalPrice, // Update price to include extras
          extras: selectedExtrasArray, // Send extras details
          adults: Number(formData.adults),
          children: Number(formData.children),
          deposit: Number(formData.deposit)
        }
      });
  
      console.log("Payment intent created:", response.data);
      setClientSecret(response.data.clientSecret);
      setShowPayment(true);
      setError(null);
    } catch (err) {
      console.error("Error:", err);
      setError(err.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setSuccessMessage("Paiement réussi ! Votre réservation est confirmée.");
    setShowPayment(false);
  };

  const handlePaymentError = (errorMessage) => {
    setError(`Échec du paiement: ${errorMessage}`);
  };

  //DISCOUNT
  const handleApplyDiscount = async () => {
    try {
      // Example API call to verify discount code
      const response = await api.post("/booking/checkApartmentAvailability", { code: discountCode });
      if (response.data.isValid) {
        setDiscountAmount(response.data.discountAmount);
        setIsDiscountValid(true);
        setError(null);
      } else {
        setDiscountAmount(0);
        setIsDiscountValid(false);
        setError("Code de réduction invalide.");
      }
    } catch (err) {
      console.error("Discount verification error:", err);
      setError("Erreur lors de la vérification du code.");
    }
  };


  //DISCOUNT
  const renderPriceDetails = () => {
    if (!priceDetails) return null;
  
    const extrasTotal = calculateExtrasTotal();
    const finalTotal = priceDetails.finalPrice + extrasTotal - (isDiscountValid ? discountAmount : 0);
  
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-bold mb-2">Détail des prix:</h3>
        {priceDetails.priceElements.map((element, index) => (
          <div key={index} className={`flex justify-between items-center ${element.amount < 0 ? "text-green-600" : ""}`}>
            <span>{element.name}</span>
            <span>{Math.abs(element.amount).toFixed(2)} {element.currencyCode}</span>
          </div>
        ))}
  
        {extrasTotal > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold">Extras sélectionnés:</h4>
            {Object.entries(selectedExtras).map(([extraId, quantity]) => {
              if (quantity > 0) {
                const extra = extras.find(e => e.id === extraId);
                return (
                  <div key={extraId} className="flex justify-between items-center">
                    <span>{extra.name} x {quantity}</span>
                    <span>{(extra.price * quantity).toFixed(2)} EUR</span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
        {isDiscountValid && (
          <div className="mt-2 text-green-600 flex justify-between items-center">
            <span>Réduction</span>
            <span>-{discountAmount.toFixed(2)} EUR</span>
          </div>
        )}
  
        <div className="mt-4 pt-2 border-t border-gray-200 font-bold flex justify-between items-center">
          <span>Prix final</span>
          <span>{finalTotal.toFixed(2)} EUR</span>
        </div>
      </div>
    );
  };
  

  const renderPaymentForm = () => (
    <div className="mt-8">
      <h3 className="text-lg font-medium mb-4">Finaliser votre paiement</h3>
      {clientSecret && (
        <StripeWrapper clientSecret={clientSecret}>
          <PaymentForm
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </StripeWrapper>
      )}
    </div>
  );

  return (
    <div className="mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Réserver le Dôme des Libellules</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {successMessage && <p className="text-green-500 mb-4">{successMessage}</p>}
      {loading && <p className="text-blue-500 mb-4">Chargement...</p>}

      {!showPayment ? (
        <form onSubmit={handleSubmit} className="space-y-4 w-full mx-auto">
          {/* Search Section */}
          <div className="border border-[#668E73] p-5 rounded space-y-4">
            <div className="grid grid-cols-1 gap-4 text-left">
            <div className="border border-[#668E73] p-5 rounded space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
          
          {/* Arrival Date */}
          <div className="relative">
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              Arrivé
              <div className="relative">
                <input
                  type="date"
                  name="arrivalDate"
                  value={formData.arrivalDate}
                  onChange={handleChange}
                  placeholder="Select arrival date"
                  ref={arrivalDateRef} // Add ref to arrival date input
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 pr-10"
                  required
                />
                <img
                  src={Calendar}
                  alt="Calendar Icon"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 cursor-pointer"
                  onClick={openArrivalDatePicker} // Open calendar on click
                />
              </div>
            </label>
          </div>

          {/* Departure Date */}
          <div className="relative">
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              Départ
              <div className="relative">
                <input
                  type="date"
                  name="departureDate"
                  value={formData.departureDate}
                  onChange={handleChange}
                  placeholder="Select departure date"
                  ref={departureDateRef} // Add ref to departure date input
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 pr-10"
                  required
                />
                <img
                  src={Calendar}
                  alt="Calendar Icon"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 cursor-pointer"
                  onClick={openDepartureDatePicker} // Open calendar on click
                />
              </div>
            </label>
          </div>

          {/* Adults Dropdown */}
          <div>
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              Adultes
              <select
                name="adults"
                value={formData.adults}
                onChange={handleChange}
                className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 appearance-none"
                required
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='green' d='M5.23 7.21a.75.75 0 011.06 0L10 10.92l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 0.5rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5rem 1.5rem",
                }}
              >
                {[...Array(10).keys()].map((i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Children Dropdown */}
          <div>
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              Enfants
              <select
                name="children"
                value={formData.children}
                onChange={handleChange}
                className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='green' d='M5.23 7.21a.75.75 0 011.06 0L10 10.92l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 0.5rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5rem 1.5rem",
                }}
              >
                {[...Array(11).keys()].map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Check Availability Button */}
          <div className="block align-baseline">
          <button
              type="button"
              onClick={handleCheckAvailability}
              className="w-full h-12 p-2 mt-7 border rounded shadow-sm text-[16px] font-medium text-white bg-[#668E73] hover:bg-opacity-90 focus:outline-none"
            >
              Rechercher
            </button>
          </div>

        </div>
      </div>
            </div>
          </div>

          {/* Main Content Section */}
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            {/* Left Column - Property Details */}
            <div className="w-full md:w-1/3 border border-[#668E73] p-4 rounded text-left">
              <img
                src="https://images.unsplash.com/photo-1720293315632-37efe958d5ec?q=80&w=3432&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Property"
                className="w-[100%] h-[250px] object-cover rounded-[0.3em] mt-4"
              />
              <h2 className="text-[18px] md:text-[23px] font-normal text-black">
                Le dôme des libellules
              </h2>
              
              {/* Guest Count */}
              <div className="flex items-center justify-between mt-4">
                <img src={Group} alt="Profile Icon" className="w-6 h-6" />
                <span className="text-[16px] font-light text-black">
                  {Number(formData.adults) + Number(formData.children)}{" "}
                  {Number(formData.adults) + Number(formData.children) > 1 ? "personnes" : "personne"}
                </span>
              </div>

              {/* Dates */}
              <div className="flex items-center justify-between mt-2 mb-5">
                <img src={Calendar} alt="Calendar Icon" className="w-6 h-6" />
                <div className="flex items-center text-[16px] font-light text-black">
                  {formData.arrivalDate && <span>{formatDate(formData.arrivalDate)}</span>}
                  <span className="mx-2 text-black">→</span>
                  {formData.departureDate && <span>{formatDate(formData.departureDate)}</span>}
                </div>
              </div>

              <hr />
              {showPriceDetails && renderPriceDetails()}
            </div>

            {/* Right Column - Contact Form */}
            <div className="w-full md:w-2/3 border border-[#668E73] p-4 rounded space-y-4 text-left">
              <h2 className="text-[18px] md:text-[23px] font-normal text-black">Contact</h2>
              {/* Your existing contact form fields go here */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
            Prénom*
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Prénom"
              className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
              required
            />
          </label>
        </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Nom*
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Nom"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Email*
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                  required
                />
              </label>
            </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Téléphone
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Téléphone"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                />
              </label>
            </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Rue/numéro
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  placeholder="Rue/Numéro"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                />
              </label>
            </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Code postal
                <input
                  type="number"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="Code postal"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                />
              </label>
            </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Ville
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Ville"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                />
              </label>
            </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Pays
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Pays"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                />
              </label>
            </div>

            <div>
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Check-in*
                <select
                  name="arrivalTime"
                  value={formData.arrivalTime}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 appearance-none"
                  required
                  style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='green' d='M5.23 7.21a.75.75 0 011.06 0L10 10.92l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 0.5rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5rem 1.5rem",
                }}
                >
                  <option value="">Heure d'arrivée</option>
                  <option value="17:00">17:00</option>
                  <option value="17:30">17:30</option>
                  <option value="18:00">18:00</option>
                  <option value="18:30">18:30</option>
                  <option value="19:00">19:00</option>
                  <option value="19:30">19:30</option>
                  <option value="20:00">20:00</option>
                  <option value="20:30">20:30</option>
                  <option value="21:00">21:00</option>
                  <option value="21:30">21:30</option>
                  <option value="22:00">22:00</option>
                  <option value="22:30">22:30</option>
                  <option value="23:00">23:00</option>
                </select>
              </label>
            </div>

          </div>

          <div className="mt-8">
  <button
    type="button"
    onClick={() => setShowExtras(!showExtras)}
    className="w-full flex justify-between items-center p-4 bg-[#668E73] bg-opacity-20 rounded-lg text-[#668E73] hover:bg-opacity-30 transition-all"
  >
    <span className="text-lg font-medium">Extras</span>
    <svg
      className={`w-6 h-6 transform transition-transform ${showExtras ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {showExtras && (
    <div className="mt-4 space-y-6">
      {/* Formules */}
      <div>
        <h3 className="text-lg font-medium mb-3">Formules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {extras.filter(extra => !extra.type.includes('meal') && !extra.type.includes('drink')).map(extra => (
            <div key={extra.id} className="flex items-center justify-between p-3 bg-[#668E73] bg-opacity-10 rounded-lg">
              <div>
                <p className="font-medium">{extra.name}</p>
                <p className="text-sm text-gray-600">{extra.price} EUR</p>
              </div>
              <select
                value={selectedExtras[extra.id] || 0}
                onChange={(e) => handleExtraChange(extra.id, Number(e.target.value))}
                className="ml-4 bg-white rounded-md border-[#668E73] text-sm focus:ring-[#668E73]"
              >
                {[...Array(11)].map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Meals */}
      <div>
        <h3 className="text-lg font-medium mb-3">Repas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {extras.filter(extra => extra.type === 'meal').map(extra => (
            <div key={extra.id} className="flex items-center justify-between p-3 bg-[#668E73] bg-opacity-10 rounded-lg">
              <div>
                <p className="font-medium">{extra.name}</p>
                <p className="text-sm text-gray-600">{extra.price} EUR</p>
              </div>
              <select
                value={selectedExtras[extra.id] || 0}
                onChange={(e) => handleExtraChange(extra.id, Number(e.target.value))}
                className="ml-4 bg-white rounded-md border-[#668E73] text-sm focus:ring-[#668E73]"
              >
                {[...Array(11)].map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Drinks */}
      <div>
        <h3 className="text-lg font-medium mb-3">Boissons</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {extras.filter(extra => extra.type === 'drink').map(extra => (
            <div key={extra.id} className="flex items-center justify-between p-3 bg-[#668E73] bg-opacity-10 rounded-lg">
              <div>
                <p className="font-medium">{extra.name}</p>
                <p className="text-sm text-gray-600">{extra.price} EUR</p>
              </div>
              <select
                value={selectedExtras[extra.id] || 0}
                onChange={(e) => handleExtraChange(extra.id, Number(e.target.value))}
                className="ml-4 rounded-md bg-white border-[#668E73] text-sm focus:ring-[#668E73]"
              >
                {[...Array(11)].map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Total des extras */}
      {Object.keys(selectedExtras).some(key => selectedExtras[key] > 0) && (
        <div className="mt-4 p-4 bg-[#668E73] bg-opacity-10 rounded-lg">
          <div className="flex justify-between items-center font-medium">
            <span>Total des extras</span>
            <span>{calculateExtrasTotal()} EUR</span>
          </div>
        </div>
      )}
    </div>
  )}
</div>

<div className="mt-4">
              <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                Code de réduction
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="Entrez le code"
                  className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                />
              </label>
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="mt-2 px-4 py-2 bg-[#668E73] text-white rounded shadow"
              >
                Appliquer le code
              </button>
            </div>

              <button
                type="submit"
                disabled={loading || !formData.price}
                className="w-full py-2 px-4 border border-transparent rounded shadow-sm text-[16px] font-medium text-white bg-[#668E73] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#668E73] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? "En cours..." : "Passer au paiement"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        renderPaymentForm()
      )}
    </div>
  );
};

export default BookingForm;