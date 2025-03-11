import axios from "axios";
import { discountSettings } from "../../../../config/config.js"
import { calculatePriceWithSettings } from "../../../../helpers/pricing/calculate-price-with-settings.js";

export async function fetchRates(req, res) {
  try {
    const { apartments, start_date, end_date, adults, children } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        error: "Missing dates",
        details: "Both start_date and end_date are required",
      });
    }

    if (!apartments) {
      return res.status(400).json({
        error: "Missing apartments",
        details: "Apartments parameter is required",
      });
    }

    const response = await axios.get("https://login.smoobu.com/api/rates", {
      headers: {
        "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
        "Content-Type": "application/json",
      },
      params: {
        apartments: Array.isArray(apartments) ? apartments : [apartments],
        start_date,
        end_date,
      },
    });

    if (!response.data || !response.data.data) {
      return res.status(404).json({
        error: "No rates found",
        details: "The API returned no data",
      });
    }

    const formattedData = {};
    const priceDetailsByApartment = {};
    let hasAvailability = false;

    (Array.isArray(apartments) ? apartments : [apartments]).forEach(
      (apartmentId) => {
        const apartmentData = response.data.data[apartmentId];
        if (!apartmentData) return;

        formattedData[apartmentId] = apartmentData;
        const settings = discountSettings[apartmentId];

        if (!settings) {
          return;
        }

        try {
          const priceCalculation = calculatePriceWithSettings(
            apartmentData,
            start_date,
            end_date,
            parseInt(adults) || 1,
            parseInt(children) || 0,
            settings
          );

          if (priceCalculation && priceCalculation.finalPrice > 0) {
            priceDetailsByApartment[apartmentId] = {
              ...priceCalculation,
              isAvailable: true,
              settings: {
                maxGuests: settings.maxGuests,
                startingAtGuest: settings.startingAtGuest,
                extraGuestsPerNight: settings.extraGuestsPerNight,
                extraChildPerNight: settings.extraChildPerNight,
                lengthOfStayDiscount: settings.lengthOfStayDiscount,
              },
            };
            hasAvailability = true;
          }
        } catch (calcError) {}
      }
    );

    if (!hasAvailability) {
      return res.status(200).json({
        data: formattedData,
        priceDetails: {},
        hasAvailability: false,
        message: "No apartments available for the selected dates and guests",
      });
    }

    res.json({
      data: formattedData,
      priceDetails: priceDetailsByApartment,
      hasAvailability: true,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch rates",
      details: error.response?.data || error.message,
      status: error.response?.status || 500,
    });
  }
}
