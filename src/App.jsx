import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import BookingForm from "./Bookings";
import BookingConfirmation from "./components/BookingConfirmation";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BookingForm />} />
        <Route path="/booking-confirmation" element={<BookingConfirmation />} />
      </Routes>
    </Router>
  );
}

export default App;
