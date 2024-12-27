import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([
    { id: 1, code: 'SUMMER2024', discount: 20, type: 'percentage', expiryDate: '2024-12-31', status: 'active' },
    { id: 2, code: 'WELCOME10', discount: 10, type: 'fixed', expiryDate: '2024-06-30', status: 'inactive' }
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    discount: '',
    type: 'percentage',
    expiryDate: '',
    status: 'active'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCoupon) {
      setCoupons(coupons.map(c => 
        c.id === editingCoupon.id ? { ...formData, id: c.id } : c
      ));
    } else {
      setCoupons([...coupons, { ...formData, id: Date.now() }]);
    }
    handleCloseModal();
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData(coupon);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setCoupons(coupons.filter(c => c.id !== id));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    setFormData({
      code: '',
      discount: '',
      type: 'percentage',
      expiryDate: '',
      status: 'active'
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Coupon Management</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Coupon
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Discount</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Expiry Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{coupon.code}</td>
                <td className="px-6 py-4 text-sm">
                  {coupon.discount}{coupon.type === 'percentage' ? '%' : '$'}
                </td>
                <td className="px-6 py-4 text-sm capitalize">{coupon.type}</td>
                <td className="px-6 py-4 text-sm">{coupon.expiryDate}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    coupon.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {coupon.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount
                </label>
                <input
                  type="number"
                  value={formData.discount}
                  onChange={(e) => setFormData({...formData, discount: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCoupon ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;