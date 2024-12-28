// App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import BookingConfirmation from "./components/BookingConfirmation";
import "react-datepicker/dist/react-datepicker.css";
import Booking2 from "./components/booking/BookingForm";
import CouponManagement from "./components/Admin/CouponManagement";
import Login from "./components/Admin/Login";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/Admin/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <I18nextProvider i18n={i18n}>
        <Router>
          <Routes>
            <Route path="/booking-confirmation" element={<BookingConfirmation />} />
            <Route path="/" element={<Booking2 />} />
            <Route path="/admin/login" element={<Login />} />
            <Route 
              path="/coupons" 
              element={
                <ProtectedRoute>
                  <CouponManagement />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Router>
      </I18nextProvider>
    </AuthProvider>
  );
}

export default App;