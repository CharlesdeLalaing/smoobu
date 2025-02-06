import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [filteredCoupons, setFilteredCoupons] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formData, setFormData] = useState({
    code: '',
    discount: '',
    type: 'fixed',
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default to 1 year from now
    status: 'active',
    currency: 'EUR',
    usedCount: 0,
    lastUsedDate: null,
    usedBy: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCoupons();
  }, []);

  useEffect(() => {
    filterCoupons();
  }, [coupons, searchTerm, statusFilter, typeFilter]);

  const convertToDate = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp?.toDate) {
      return timestamp.toDate();
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return null;
  };

  const filterCoupons = () => {
    let filtered = [...coupons];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(coupon => 
        coupon.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(coupon => coupon.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(coupon => coupon.type === typeFilter);
    }

    // Sort by used/unused and date
    filtered.sort((a, b) => {
      // First sort by used status (unused first)
      if (a.usedCount === 0 && b.usedCount > 0) return -1;
      if (a.usedCount > 0 && b.usedCount === 0) return 1;
      
      // Then sort by creation date (most recent first)
      const dateA = convertToDate(a.dateCreated);
      const dateB = convertToDate(b.dateCreated);
      return dateB - dateA;
    });

    setFilteredCoupons(filtered);
  };

  const fetchCoupons = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'coupons'));
      const couponsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateCreated: convertToDate(doc.data().dateCreated),
        expiryDate: convertToDate(doc.data().expiryDate),
        lastUsedDate: convertToDate(doc.data().lastUsedDate)
      }));
      
      setCoupons(couponsData);
    } catch (error) {
      console.error('Erreur lors du chargement des coupons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Set expiration date to one year from now if not editing
      const defaultExpiryDate = !editingCoupon ? 
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : 
        new Date(formData.expiryDate);

      const data = {
        ...formData,
        code: formData.code.toUpperCase(),
        discount: Number(formData.discount),
        dateCreated: editingCoupon ? formData.dateCreated : Timestamp.now(),
        expiryDate: Timestamp.fromDate(defaultExpiryDate),
        usedCount: editingCoupon ? formData.usedCount : 0,
        lastUsedDate: null,
        usedBy: editingCoupon ? formData.usedBy || [] : [],
        currency: 'EUR',
        type: formData.type || 'fixed',
        status: formData.status || 'active'
      };
      
      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), data);
      } else {
        await addDoc(collection(db, 'coupons'), data);
      }
      
      await fetchCoupons();
      handleCloseModal();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du coupon:', error);
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      ...coupon,
      expiryDate: coupon.expiryDate instanceof Date 
        ? coupon.expiryDate.toISOString().split('T')[0]
        : new Date(coupon.expiryDate).toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce coupon ?')) {
      try {
        await deleteDoc(doc(db, 'coupons', id));
        await fetchCoupons();
      } catch (error) {
        console.error('Erreur lors de la suppression du coupon:', error);
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    // Reset form with default expiry date of one year from now
    setFormData({
      code: '',
      discount: '',
      type: 'fixed',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active',
      currency: 'EUR',
      usedCount: 0,
      lastUsedDate: null,
      usedBy: []
    });
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Chargement...</div>;
  }

  return (
    <div className="w-full max-w-7xl p-3 mx-auto md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Gestion des Coupons</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#4a6553] transition-colors w-full sm:w-auto"
        >
          <Plus size={20} />
          <span>Ajouter un Coupon</span>
        </button>
      </div>

      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher un code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            >
              <option value="all">Tous les types</option>
              <option value="fixed">Montant fixe</option>
              <option value="percentage">Pourcentage</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600">Code</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600">Réduction</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 hidden md:table-cell">Type</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 hidden lg:table-cell">Créé le</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600 hidden sm:table-cell">Expire le</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600">Statut</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCoupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium">{coupon.code}</td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm">
                    {coupon.discount} {coupon.currency}
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm capitalize hidden md:table-cell">
                    {coupon.type === 'fixed' ? 'Montant fixe' : 'Pourcentage'}
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm hidden lg:table-cell">{formatDate(coupon.dateCreated)}</td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm hidden sm:table-cell">{formatDate(coupon.expiryDate)}</td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      coupon.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {coupon.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  {/* <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm hidden sm:table-cell">
                    {coupon.usedCount || 0} fois
                  </td> */}
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm">
                    <div className="flex gap-2 md:gap-3">
                      <button
                        onClick={() => handleEdit(coupon)}
                        className="text-[#678D73] hover:text-[#678D73]"
                        disabled={coupon.usedCount > 0}
                        title="Modifier"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(coupon.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Supprimer"
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg md:text-xl font-semibold">
                {editingCoupon ? 'Modifier le Coupon' : 'Ajouter un nouveau Coupon'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code du Coupon
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant de la réduction
                </label>
                <input
                  type="number"
                  value={formData.discount}
                  onChange={(e) => setFormData({...formData, discount: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
                >
                  <option value="fixed">Montant fixe</option>
                  <option value="percentage">Pourcentage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date d'expiration
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full sm:w-auto px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#678D73]"
                >
                  {editingCoupon ? 'Mettre à jour' : 'Créer'}
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