// src/components/Admin/CouponsPage.jsx
import React, { useState, useEffect } from 'react';
import { PlusCircle, Pencil, Trash2, Search } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase-config';

const CouponsPage = () => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [coupons, setCoupons] = useState([]);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        discount: '',
        type: 'percentage',
        validUntil: ''
    });

    // Fetch coupons from Firebase
    const fetchCoupons = async () => {
        try {
            const couponsCollection = collection(db, 'coupons');
            const couponsSnapshot = await getDocs(couponsCollection);
            const couponsList = couponsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCoupons(couponsList);
        } catch (error) {
            console.error('Error fetching coupons:', error);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    // Create new coupon
    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        try {
            const couponsCollection = collection(db, 'coupons');
            await addDoc(couponsCollection, {
                ...formData,
                discount: Number(formData.discount),
                createdAt: new Date().toISOString(),
                active: true
            });
            setShowCreateModal(false);
            resetForm();
            fetchCoupons();
        } catch (error) {
            console.error('Error creating coupon:', error);
        }
    };

    // Update existing coupon
    const handleUpdateCoupon = async (e) => {
        e.preventDefault();
        try {
            const couponRef = doc(db, 'coupons', editingCoupon.id);
            await updateDoc(couponRef, {
                ...formData,
                discount: Number(formData.discount),
                updatedAt: new Date().toISOString()
            });
            setShowCreateModal(false);
            setEditingCoupon(null);
            resetForm();
            fetchCoupons();
        } catch (error) {
            console.error('Error updating coupon:', error);
        }
    };

    // Delete coupon
    const handleDeleteCoupon = async (couponId) => {
        if (window.confirm('Are you sure you want to delete this coupon?')) {
            try {
                await deleteDoc(doc(db, 'coupons', couponId));
                fetchCoupons();
            } catch (error) {
                console.error('Error deleting coupon:', error);
            }
        }
    };

    // Handle edit button click
    const handleEditClick = (coupon) => {
        setEditingCoupon(coupon);
        setFormData({
            code: coupon.code,
            discount: coupon.discount,
            type: coupon.type,
            validUntil: coupon.validUntil
        });
        setShowCreateModal(true);
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            code: '',
            discount: '',
            type: 'percentage',
            validUntil: ''
        });
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Filter coupons based on search query
    const filteredCoupons = coupons.filter(coupon =>
        coupon.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Header Section */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Coupon Management</h1>
                <p className="mt-2 text-gray-600">Create and manage discount coupons for your customers</p>
            </div>

            {/* Actions Bar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search coupons..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={() => {
                        setEditingCoupon(null);
                        resetForm();
                        setShowCreateModal(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <PlusCircle className="h-5 w-5" />
                    Create Coupon
                </button>
            </div>

            {/* Coupons Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Code
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Discount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Valid Until
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredCoupons.map((coupon) => (
                            <tr key={coupon.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                    {coupon.code}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                    {coupon.discount}{coupon.type === 'percentage' ? '%' : '€'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 capitalize">
                                    {coupon.type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                    {new Date(coupon.validUntil).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button 
                                        onClick={() => handleEditClick(coupon)}
                                        className="text-blue-600 hover:text-blue-900 mr-4"
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteCoupon(coupon.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
                        </h2>
                        <form className="space-y-4" onSubmit={editingCoupon ? handleUpdateCoupon : handleCreateCoupon}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Coupon Code
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter coupon code"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Discount
                                </label>
                                <input
                                    type="number"
                                    name="discount"
                                    value={formData.discount}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter discount amount"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Discount Type
                                </label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="percentage">Percentage</option>
                                    <option value="fixed">Fixed Amount</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Valid Until
                                </label>
                                <input
                                    type="date"
                                    name="validUntil"
                                    value={formData.validUntil}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setEditingCoupon(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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

export default CouponsPage;