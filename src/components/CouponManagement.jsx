// Create a new file: src/components/CouponManagement.jsx

import React, { useState, useEffect } from 'react';
import { api } from "./utils/api";

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount: '',
    type: 'fixed',
    currency: 'EUR'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const response = await api.get('/coupons');
      setCoupons(response.data);
    } catch (error) {
      setError('Failed to fetch coupons');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/coupons', newCoupon);
      setSuccess('Coupon created successfully');
      setNewCoupon({
        code: '',
        discount: '',
        type: 'fixed',
        currency: 'EUR'
      });
      fetchCoupons();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create coupon');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Coupon Management</h1>
      
      {/* Create Coupon Form */}
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label className="block mb-1">Code:</label>
          <input
            type="text"
            value={newCoupon.code}
            onChange={e => setNewCoupon(prev => ({ ...prev, code: e.target.value }))}
            className="border p-2 rounded w-full"
            required
          />
        </div>
        
        <div>
          <label className="block mb-1">Discount Amount:</label>
          <input
            type="number"
            value={newCoupon.discount}
            onChange={e => setNewCoupon(prev => ({ ...prev, discount: e.target.value }))}
            className="border p-2 rounded w-full"
            required
          />
        </div>
        
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Create Coupon
        </button>
      </form>

      {error && <div className="text-red-500 mb-4">{error}</div>}
      {success && <div className="text-green-500 mb-4">{success}</div>}

      {/* Coupons List */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Discount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Used Count</th>
              <th className="px-4 py-2">Created At</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map(coupon => (
              <tr key={coupon.id}>
                <td className="border px-4 py-2">{coupon.code}</td>
                <td className="border px-4 py-2">{coupon.discount} {coupon.currency}</td>
                <td className="border px-4 py-2">
                  <span className={`px-2 py-1 rounded ${coupon.isUsable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {coupon.isUsable ? 'Active' : 'Used'}
                  </span>
                </td>
                <td className="border px-4 py-2">{coupon.usedCount || 0}</td>
                <td className="border px-4 py-2">{new Date(coupon.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CouponManagement;