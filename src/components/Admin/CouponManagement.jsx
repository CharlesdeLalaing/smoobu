import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    discount: '',
    type: 'percentage',
    expiryDate: '',
    status: 'active',
    usedCount: 0,
    lastUsedDate: null,
    lastUsedBy: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'coupons'));
      const couponsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCoupons(couponsData);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // In CouponManagement.jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  const data = {
    ...formData,
    expiryDate: Timestamp.fromDate(new Date(formData.expiryDate)),
    usedCount: 0, // Track usage
    lastUsedDate: null
  };
  
  try {
    if (editingCoupon) {
      await updateDoc(doc(db, 'coupons', editingCoupon.id), data);
    } else {
      await addDoc(collection(db, 'coupons'), data);
    }
    await fetchCoupons();
    handleCloseModal();
  } catch (error) {
    console.error('Error:', error);
  }
};

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData(coupon);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      await fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
    }
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

  // Function to mark coupon as used
const markCouponAsUsed = async (couponId) => {
  try {
    const couponRef = doc(db, 'coupons', couponId);
    await updateDoc(couponRef, {
      status: 'used',
      usedCount: increment(1),
      lastUsedDate: Timestamp.now()
    });
    await fetchCoupons();
  } catch (error) {
    console.error('Error marking coupon as used:', error);
  }
};



  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

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
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Used</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
          <tbody className="divide-y divide-gray-200">
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{coupon.code}</td>
                <td className="px-6 py-4 text-sm">
                  {coupon.discount}{coupon.type === 'percentage' ? '%' : '€'}
                </td>
                <td className="px-6 py-4 text-sm capitalize">{coupon.type}</td>
                <td className="px-6 py-4 text-sm">
                  {coupon.expiryDate instanceof Timestamp ? 
                    coupon.expiryDate.toDate().toLocaleDateString() : 
                    coupon.expiryDate}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    coupon.status === 'active' && (!coupon.usedCount || coupon.usedCount === 0)
                      ? 'bg-green-100 text-green-800'
                      : coupon.status === 'used' || coupon.usedCount > 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {coupon.usedCount > 0 ? 'Used' : coupon.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {coupon.lastUsedDate ? (
                    <span title={`Used by: ${coupon.lastUsedBy || 'Unknown'}`}>
                      {new Date(coupon.lastUsedDate).toLocaleDateString()}
                    </span>
                  ) : 'Never'}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="text-blue-600 hover:text-blue-800"
                      disabled={coupon.usedCount > 0}
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