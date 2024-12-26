// src/components/coupons/CouponsPage.jsx
import React, { useState } from 'react';
import { PlusCircle, Pencil, Trash2, Search } from 'lucide-react';

const CouponsPage = () => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Placeholder data - will be replaced with Firebase data later
    const [coupons] = useState([
        { id: 1, code: 'SUMMER2024', discount: 20, type: 'percentage', validUntil: '2024-08-31' },
        { id: 2, code: 'WELCOME10', discount: 10, type: 'fixed', validUntil: '2024-12-31' },
    ]);

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
            onClick={() => setShowCreateModal(true)}
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
                {coupons.map((coupon) => (
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
                    <button className="text-blue-600 hover:text-blue-900 mr-4">
                        <Pencil className="h-5 w-5" />
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-5 w-5" />
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>

        {/* Create/Edit Modal - Placeholder for now */}
        {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">Create New Coupon</h2>
                <form className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coupon Code
                    </label>
                    <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter coupon code"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount
                    </label>
                    <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter discount amount"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                    Cancel
                    </button>
                    <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                    Create
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