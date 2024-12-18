import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import BookingConfirmation from "./components/BookingConfirmation";
import Booking2 from "./components/booking/BookingForm";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import "./index.css";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <Routes>
          <Route
            path="/booking-confirmation"
            element={<BookingConfirmation />}
          />
          <Route path="/" element={<Booking2 />} />
        </Routes>
      </Router>
    </I18nextProvider>
  );
}

export default App;
