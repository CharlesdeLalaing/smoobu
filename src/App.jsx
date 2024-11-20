import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import BookingForm from "./Bookings";
import BookingConfirmation from "./components/BookingConfirmation";
import Booking2 from "./components/booking/BookingForm"
import './index.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BookingForm />} />
        <Route path="/booking-confirmation" element={<BookingConfirmation />} />
        <Route path="/dummy-component" element={<Booking2 />} />
        <Route path="/dummy" element={<Booking2 />} />
      </Routes>
    </Router>
  );
}

export default App;
