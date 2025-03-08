import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [filteredCoupons, setFilteredCoupons] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formData, setFormData] = useState({
    code: "",
    discount: "",
    type: "fixed",
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    validityStartDate: "",
    validityEndDate: "",
    status: "active",
    currency: "EUR",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    type: "all", // 'all', 'regular', 'gift'
  });

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
    if (typeof timestamp === "string") {
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
      filtered = filtered.filter((coupon) =>
        coupon.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((coupon) => coupon.status === statusFilter);
    }
  
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(coupon => 
        typeFilter === 'gift' ? coupon.isGiftVoucher : !coupon.isGiftVoucher
      );
    }
  
    // Sort by used/unused and date
    filtered.sort((a, b) => {
      if (a.usedCount === 0 && b.usedCount > 0) return -1;
      if (a.usedCount > 0 && b.usedCount === 0) return 1;
      
      const dateA = convertToDate(a.dateCreated);
      const dateB = convertToDate(b.dateCreated);
      return dateB - dateA;
    });
  
    setFilteredCoupons(filtered);
  };

  const fetchCoupons = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "coupons"));
      const couponsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        dateCreated: convertToDate(doc.data().dateCreated),
        expiryDate: convertToDate(doc.data().expiryDate),
        lastUsedDate: convertToDate(doc.data().lastUsedDate),
      }));

      setCoupons(couponsData);
    } catch (error) {
      console.error("Erreur lors du chargement des coupons:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   try {
  //     const data = {
  //       ...formData,
  //       code: formData.code.toUpperCase(),
  //       discount: Number(formData.discount),
  //       dateCreated: editingCoupon ? formData.dateCreated : Timestamp.now(),
  //       expiryDate: Timestamp.fromDate(new Date(formData.expiryDate)),
  //       usedCount: editingCoupon ? formData.usedCount : 0,
  //       lastUsedDate: null,
  //       usedBy: editingCoupon ? formData.usedBy || [] : [],
  //       currency: "EUR",
  //       type: formData.type || "fixed",
  //       status: formData.status || "active",
  //     };

  //     if (editingCoupon) {
  //       await updateDoc(doc(db, "coupons", editingCoupon.id), data);
  //     } else {
  //       await addDoc(collection(db, "coupons"), data);
  //     }

  //     await fetchCoupons();
  //     handleCloseModal();
  //   } catch (error) {
  //     console.error("Erreur lors de la sauvegarde du coupon:", error);
  //   }
  // };


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        code: formData.code.toUpperCase(),
        dateCreated: editingCoupon ? formData.dateCreated : Timestamp.now(),
        expiryDate: Timestamp.fromDate(new Date(formData.expiryDate)),
        validityStartDate: formData.validityStartDate ? Timestamp.fromDate(new Date(formData.validityStartDate)) : null,
        validityEndDate: formData.validityEndDate ? Timestamp.fromDate(new Date(formData.validityEndDate)) : null,
        usedCount: editingCoupon ? formData.usedCount : 0,
        lastUsedDate: null,
        usedBy: editingCoupon ? formData.usedBy || [] : [],
        currency: "EUR",
        type: formData.type,
        status: formData.status || "active"
      };
  
      // Handle discount values based on type
      if (formData.type === "percentage") {
        data.percentageValue = Number(formData.discount);
        data.discount = Number(formData.discount); // Keep for backwards compatibility
        data.amount = null; // Clear amount field for percentage discounts
      } else {
        data.amount = Number(formData.discount);
        data.discount = Number(formData.discount); // Keep for backwards compatibility
        data.percentageValue = null; // Clear percentage field for fixed discounts
      }
  
      if (editingCoupon) {
        await updateDoc(doc(db, "coupons", editingCoupon.id), data);
      } else {
        await addDoc(collection(db, "coupons"), data);
      }
  
      await fetchCoupons();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving coupon:", error);
    }
  };

  
  // const handleEdit = (coupon) => {
  //   if (coupon.isGiftVoucher) return; // Prevent editing gift vouchers
  //   setEditingCoupon(coupon);
  //   setFormData({
  //     ...coupon,
  //     expiryDate:
  //       coupon.expiryDate instanceof Date
  //         ? coupon.expiryDate.toISOString().split("T")[0]
  //         : new Date(coupon.expiryDate).toISOString().split("T")[0],
  //   });
  //   setIsModalOpen(true);
  // };

  const handleEdit = (coupon) => {
    if (coupon.isGiftVoucher) return; // Prevent editing gift vouchers
    
    // Convert dates to proper format for input fields
    const formattedExpiryDate = coupon.expiryDate instanceof Date
      ? coupon.expiryDate.toISOString().split("T")[0]
      : new Date(coupon.expiryDate).toISOString().split("T")[0];
      
    // Convert validity dates from Firestore to format for input fields
    let formattedValidityStartDate = "";
    let formattedValidityEndDate = "";
    
    if (coupon.validityStartDate) {
      const validityStartDate = convertToDate(coupon.validityStartDate);
      if (validityStartDate) {
        formattedValidityStartDate = validityStartDate.toISOString().split("T")[0];
      }
    }
    
    if (coupon.validityEndDate) {
      const validityEndDate = convertToDate(coupon.validityEndDate);
      if (validityEndDate) {
        formattedValidityEndDate = validityEndDate.toISOString().split("T")[0];
      }
    }
    
    setEditingCoupon(coupon);
    setFormData({
      ...coupon,
      expiryDate: formattedExpiryDate,
      validityStartDate: formattedValidityStartDate,
      validityEndDate: formattedValidityEndDate
    });
    
    setIsModalOpen(true);
  };


  const handleDelete = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce coupon ?")) {
      try {
        await deleteDoc(doc(db, "coupons", id));
        await fetchCoupons();
      } catch (error) {
        console.error("Erreur lors de la suppression du coupon:", error);
      }
    }
  };

  // const handleCloseModal = () => {
  //   setIsModalOpen(false);
  //   setEditingCoupon(null);
  //   setFormData({
  //     code: "",
  //     discount: "",
  //     type: "fixed",
  //     expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  //       .toISOString()
  //       .split("T")[0],
  //     status: "active",
  //     currency: "EUR",
  //     usedCount: 0,
  //     lastUsedDate: null,
  //     usedBy: [],
  //   });
  // };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    setFormData({
      code: "",
      discount: "",
      type: "fixed",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      validityStartDate: "",
      validityEndDate: "",
      status: "active",
      currency: "EUR",
      usedCount: 0,
      lastUsedDate: null,
      usedBy: [],
    });
  };
  

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Chargement...</div>;
  }

  return (
    <div className="w-full max-w-7xl p-3 mx-auto md:p-6">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Gestion des Coupons</h1>
        <button onClick={() => setIsModalOpen(true)} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#4a6553] transition-colors w-full sm:w-auto">
          <Plus size={20} />
          <span>Ajouter un Coupon</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input type="text" placeholder="Rechercher un code..."
                   value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]">
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]">
            <option value="all">Tous les types</option>
            <option value="regular">Codes promo</option>
            <option value="gift">Bons cadeaux</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code & Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validité</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCoupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{coupon.code}</span>
                      <span className={`mt-1 px-2 py-0.5 inline-flex text-xs rounded-full ${
                        coupon.isGiftVoucher ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {coupon.isGiftVoucher ? "Bon cadeau" : "Code promo"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {coupon.isGiftVoucher ? `${coupon.amount}€` : `${coupon.discount}${coupon.type === 'percentage' ? '%' : '€'}`}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {coupon.isGiftVoucher ? coupon.customerEmail : coupon.lastUsedBy || '-'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col text-sm space-y-1">
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="text-xs">Créé:</span>
                        <span>{formatDate(coupon.dateCreated)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="text-xs">Expire:</span>
                        <span>{formatDate(coupon.expiryDate)}</span>
                      </div>
                      {coupon.validityStartDate && coupon.validityEndDate && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <span className="text-xs">Période:</span>
                          <span className="text-xs">
                            {formatDate(coupon.validityStartDate)} - {formatDate(coupon.validityEndDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      coupon.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {coupon.status === 'active' ? 'Actif' : 'Utilisé'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {!coupon.isGiftVoucher && (
                        <button onClick={() => handleEdit(coupon)}
                                className="text-[#678D73] hover:text-[#4a6553]">
                          <Pencil size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(coupon.id)}
                              className="text-red-600 hover:text-red-800">
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
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingCoupon ? "Modifier le Coupon" : "Ajouter un nouveau Coupon"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Code du Coupon</label>
                <input type="text" value={formData.code}
                       onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                       className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
                       required />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Montant</label>
                <input type="number" value={formData.discount}
                       onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                       className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
                       required />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Type</label>
                <select value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]">
                  <option value="fixed">Montant fixe</option>
                  <option value="percentage">Pourcentage</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Date d'expiration</label>
                <input type="date" value={formData.expiryDate}
                       onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                       className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
                       required />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Période de validité (optionnel)</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-xs text-gray-500">Date de début</label>
                    <input type="date" value={formData.validityStartDate}
                           onChange={(e) => setFormData({ ...formData, validityStartDate: e.target.value })}
                           className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]" />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs text-gray-500">Date de fin</label>
                    <input type="date" value={formData.validityEndDate}
                           onChange={(e) => setFormData({ ...formData, validityEndDate: e.target.value })}
                           className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Statut</label>
                <select value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]">
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit"
                        className="px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#4a6553]">
                  {editingCoupon ? "Mettre à jour" : "Créer"}
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