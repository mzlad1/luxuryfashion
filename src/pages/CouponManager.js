import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import Navbar from "../components/Navbar";
import "../css/CouponManager.css";
import toast from "react-hot-toast";

function CouponManager() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    discountType: "percentage", // percentage or fixed
    discountValue: "",
    minPurchase: "",
    maxDiscount: "",
    allowOnDiscounted: false,
    usageLimit: "",
    usedCount: 0,
    isActive: true,
    expiresAt: "",
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const couponsSnapshot = await getDocs(collection(db, "coupons"));
      const couponsList = [];
      couponsSnapshot.forEach((doc) => {
        couponsList.push({ id: doc.id, ...doc.data() });
      });
      setCoupons(couponsList);
    } catch (error) {
      toast.error("حدث خطأ في تحميل الكوبونات");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate code format (uppercase, no spaces)
      const code = formData.code.toUpperCase().trim();
      if (!/^[A-Z0-9]+$/.test(code)) {
        toast.error("رمز الكوبون يجب أن يحتوي على حروف إنجليزية كبيرة وأرقام فقط");
        setSaving(false);
        return;
      }

      // Check if code already exists (when creating new)
      if (!editingCoupon) {
        const existingCoupon = coupons.find((c) => c.code === code);
        if (existingCoupon) {
          toast.error("رمز الكوبون موجود بالفعل");
          setSaving(false);
          return;
        }
      }

      const couponData = {
        code: code,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        minPurchase: formData.minPurchase
          ? parseFloat(formData.minPurchase)
          : 0,
        maxDiscount:
          formData.discountType === "percentage" && formData.maxDiscount
            ? parseFloat(formData.maxDiscount)
            : null,
        allowOnDiscounted: formData.allowOnDiscounted,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        usedCount: editingCoupon ? formData.usedCount : 0,
        isActive: formData.isActive,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
        updatedAt: Timestamp.now(),
      };

      if (!editingCoupon) {
        couponData.createdAt = Timestamp.now();
        await addDoc(collection(db, "coupons"), couponData);
      } else {
        await updateDoc(doc(db, "coupons", editingCoupon.id), couponData);
      }

      await fetchCoupons();
      resetForm();
      setShowForm(false);
    } catch (error) {
      toast.error("حدث خطأ في حفظ الكوبون");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchase: coupon.minPurchase || "",
      maxDiscount: coupon.maxDiscount || "",
      allowOnDiscounted: coupon.allowOnDiscounted || false,
      usageLimit: coupon.usageLimit || "",
      usedCount: coupon.usedCount || 0,
      isActive: coupon.isActive,
      expiresAt: coupon.expiresAt
        ? new Date(coupon.expiresAt.seconds * 1000).toISOString().slice(0, 16)
        : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("هل تريد حذف هذا الكوبون؟")) return;

    try {
      await deleteDoc(doc(db, "coupons", id));
      await fetchCoupons();
    } catch (error) {
      toast.error("حدث خطأ في حذف الكوبون");
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      discountType: "percentage",
      discountValue: "",
      minPurchase: "",
      maxDiscount: "",
      allowOnDiscounted: false,
      usageLimit: "",
      usedCount: 0,
      isActive: true,
      expiresAt: "",
    });
    setEditingCoupon(null);
  };

  const handleCancel = () => {
    resetForm();
    setShowForm(false);
  };

  // Check if coupon is expired
  const isCouponExpired = (coupon) => {
    if (!coupon.expiresAt) return false;
    const expiryDate = new Date(coupon.expiresAt.seconds * 1000);
    return expiryDate < new Date();
  };

  // Check if coupon usage limit is reached
  const isUsageLimitReached = (coupon) => {
    if (!coupon.usageLimit) return false;
    return (coupon.usedCount || 0) >= coupon.usageLimit;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="coupon-manager">
          <div className="cm-loading">جاري تحميل الكوبونات...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="coupon-manager">
        <div className="cm-header">
          <h1 className="cm-title">إدارة الكوبونات</h1>
        </div>

        {/* Add Coupon Button */}
        {!showForm && (
          <div className="cm-add-section">
            <button
              className="cm-add-button"
              onClick={() => setShowForm(true)}
            >
              + إضافة كوبون جديد
            </button>
          </div>
        )}

        {/* Coupon Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="cm-form">
            <h2>{editingCoupon ? "تعديل الكوبون" : "إضافة كوبون جديد"}</h2>

            <div className="cm-form-row">
              <div className="cm-form-group">
                <label>رمز الكوبون:</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  placeholder="مثال: SUMMER2024"
                  style={{ textTransform: "uppercase" }}
                  disabled={editingCoupon}
                />
                <small>حروف إنجليزية كبيرة وأرقام فقط (بدون مسافات)</small>
              </div>

              <div className="cm-form-group">
                <label>نوع الخصم:</label>
                <select
                  name="discountType"
                  value={formData.discountType}
                  onChange={handleChange}
                  required
                >
                  <option value="percentage">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت (شيكل)</option>
                </select>
              </div>
            </div>

            <div className="cm-form-row">
              <div className="cm-form-group">
                <label>قيمة الخصم:</label>
                <input
                  type="number"
                  name="discountValue"
                  value={formData.discountValue}
                  onChange={handleChange}
                  required
                  min="0"
                  step={formData.discountType === "percentage" ? "1" : "0.01"}
                  max={formData.discountType === "percentage" ? "100" : undefined}
                  placeholder={
                    formData.discountType === "percentage"
                      ? "مثال: 25"
                      : "مثال: 50"
                  }
                />
                <small>
                  {formData.discountType === "percentage"
                    ? "النسبة المئوية للخصم (0-100)"
                    : "المبلغ الثابت للخصم بالشيكل"}
                </small>
              </div>

              <div className="cm-form-group">
                <label>الحد الأدنى للشراء (اختياري):</label>
                <input
                  type="number"
                  name="minPurchase"
                  value={formData.minPurchase}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="مثال: 100"
                />
                <small>الحد الأدنى لقيمة الطلب لتطبيق الكوبون</small>
              </div>
            </div>

            {formData.discountType === "percentage" && (
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>الحد الأقصى للخصم (اختياري):</label>
                  <input
                    type="number"
                    name="maxDiscount"
                    value={formData.maxDiscount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="مثال: 200"
                  />
                  <small>الحد الأقصى لقيمة الخصم بالشيكل</small>
                </div>
              </div>
            )}

            <div className="cm-form-row">
              <div className="cm-form-group">
                <label>حد الاستخدام (اختياري):</label>
                <input
                  type="number"
                  name="usageLimit"
                  value={formData.usageLimit}
                  onChange={handleChange}
                  min="1"
                  placeholder="مثال: 50"
                />
                <small>عدد المرات التي يمكن استخدام الكوبون فيها</small>
              </div>

              <div className="cm-form-group">
                <label>تاريخ الانتهاء (اختياري):</label>
                <input
                  type="datetime-local"
                  name="expiresAt"
                  value={formData.expiresAt}
                  onChange={handleChange}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <small>اتركه فارغاً إذا كنت تريد كوبون دائم</small>
              </div>
            </div>

            <div className="cm-form-group">
              <label className="cm-checkbox-label">
                <input
                  type="checkbox"
                  name="allowOnDiscounted"
                  checked={formData.allowOnDiscounted}
                  onChange={handleChange}
                />
                <span>السماح بتطبيق الكوبون على المنتجات التي لديها خصم مسبق</span>
              </label>
            </div>

            <div className="cm-form-group">
              <label className="cm-checkbox-label">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <span>الكوبون نشط</span>
              </label>
            </div>

            <div className="cm-form-actions">
              <button
                type="submit"
                className="cm-save-btn"
                disabled={saving}
              >
                {saving ? "جاري الحفظ..." : editingCoupon ? "تحديث" : "إضافة"}
              </button>
              <button
                type="button"
                className="cm-cancel-btn"
                onClick={handleCancel}
                disabled={saving}
              >
                إلغاء
              </button>
            </div>
          </form>
        )}

        {/* Coupons List */}
        <div className="cm-coupons-section">
          <h2>الكوبونات الحالية ({coupons.length})</h2>

          {coupons.length === 0 ? (
            <div className="cm-no-coupons">لا توجد كوبونات</div>
          ) : (
            <div className="cm-coupons-grid">
              {coupons.map((coupon) => {
                const isExpired = isCouponExpired(coupon);
                const usageLimitReached = isUsageLimitReached(coupon);
                const isInactive = !coupon.isActive;

                return (
                  <div
                    key={coupon.id}
                    className={`cm-coupon-card ${
                      isExpired || usageLimitReached || isInactive
                        ? "cm-coupon-disabled"
                        : ""
                    }`}
                  >
                    <div className="cm-coupon-header">
                      <h3 className="cm-coupon-code">{coupon.code}</h3>
                      <div className="cm-coupon-badges">
                        {isInactive && (
                          <span className="cm-badge cm-badge-inactive">
                            غير نشط
                          </span>
                        )}
                        {isExpired && (
                          <span className="cm-badge cm-badge-expired">
                            منتهي
                          </span>
                        )}
                        {usageLimitReached && (
                          <span className="cm-badge cm-badge-used">
                            مستهلك
                          </span>
                        )}
                        {!isExpired && !usageLimitReached && coupon.isActive && (
                          <span className="cm-badge cm-badge-active">نشط</span>
                        )}
                      </div>
                    </div>

                    <div className="cm-coupon-details">
                      <p className="cm-coupon-discount">
                        <strong>الخصم:</strong>{" "}
                        {coupon.discountValue}
                        {coupon.discountType === "percentage" ? "%" : " شيكل"}
                      </p>

                      {coupon.minPurchase > 0 && (
                        <p>
                          <strong>الحد الأدنى:</strong> {coupon.minPurchase}{" "}
                          شيكل
                        </p>
                      )}

                      {coupon.maxDiscount && (
                        <p>
                          <strong>الحد الأقصى:</strong> {coupon.maxDiscount}{" "}
                          شيكل
                        </p>
                      )}

                      <p>
                        <strong>على المنتجات المخصومة:</strong>{" "}
                        {coupon.allowOnDiscounted ? "نعم" : "لا"}
                      </p>

                      {coupon.usageLimit && (
                        <p>
                          <strong>الاستخدام:</strong> {coupon.usedCount || 0} /{" "}
                          {coupon.usageLimit}
                        </p>
                      )}

                      {!coupon.usageLimit && (
                        <p>
                          <strong>مرات الاستخدام:</strong>{" "}
                          {coupon.usedCount || 0}
                        </p>
                      )}

                      {coupon.expiresAt && (
                        <p>
                          <strong>ينتهي في:</strong>{" "}
                          {new Date(
                            coupon.expiresAt.seconds * 1000,
                          ).toLocaleString("en-US")}
                        </p>
                      )}
                    </div>

                    <div className="cm-coupon-actions">
                      <button
                        className="cm-edit-btn"
                        onClick={() => handleEdit(coupon)}
                      >
                        تعديل
                      </button>
                      <button
                        className="cm-delete-btn"
                        onClick={() => handleDelete(coupon.id)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default CouponManager;

