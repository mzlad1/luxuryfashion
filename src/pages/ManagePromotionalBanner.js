import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";
import Navbar from "../components/Navbar";
import "../css/ManagePromotionalBanner.css";
import toast from "react-hot-toast";

function ManagePromotionalBanner() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    backgroundImage: "",
    headline: "",
    subheading: "",
    primaryButtonText: "",
    secondaryButtonText: "",
    primaryButtonAction: "",
    secondaryButtonAction: "",
    isActive: true,
  });
  const [bannerId, setBannerId] = useState(null);
  const [imageUploadMode, setImageUploadMode] = useState("url"); // "url" or "upload"
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [oldImageUrl, setOldImageUrl] = useState("");

  // Available pages for dropdown
  const availablePages = [
    { value: "/", label: "الصفحة الرئيسية" },
    { value: "/products", label: "المنتجات" },
    { value: "/about", label: "من نحن" },
    { value: "/contact", label: "اتصل بنا" },
    { value: "/cart", label: "السلة" },
  ];

  useEffect(() => {
    fetchBanner();
  }, []);

  const fetchBanner = async () => {
    setLoading(true);
    try {
      const bannersSnapshot = await getDocs(
        collection(db, "promotionalBanner"),
      );
      if (!bannersSnapshot.empty) {
        const bannerDoc = bannersSnapshot.docs[0];
        setBannerId(bannerDoc.id);
        const bannerData = bannerDoc.data();
        setFormData({
          backgroundImage: bannerData.backgroundImage || "",
          headline: bannerData.headline || "",
          subheading: bannerData.subheading || "",
          primaryButtonText: bannerData.primaryButtonText || "",
          secondaryButtonText: bannerData.secondaryButtonText || "",
          primaryButtonAction: bannerData.primaryButtonAction || "",
          secondaryButtonAction: bannerData.secondaryButtonAction || "",
          isActive:
            bannerData.isActive !== undefined
              ? bannerData.isActive
              : true,
        });
        setOldImageUrl(bannerData.backgroundImage || "");
      } else {
        // Set default values if no banner exists
        setFormData({
          backgroundImage:
            "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
          headline: "عروض حصرية على جميع القطع في المتجر",
          subheading: "وفري حتى 30% على قطع مختارة لفترة محدودة",
          primaryButtonText: "تسوقي الآن",
          secondaryButtonText: "اعرفي المزيد",
          primaryButtonAction: "/products",
          secondaryButtonAction: "/contact",
          isActive: true,
        });
      }
    } catch (error) {
      toast.error("حدث خطأ في تحميل البيانات");
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("يُسمح فقط بملفات الصور (JPG, PNG, WEBP)");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
        return;
      }

      setSelectedFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({
        ...prev,
        backgroundImage: previewUrl,
      }));
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) return formData.backgroundImage;

    setUploading(true);
    try {
      const fileName = `promotional-banner/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, fileName);
      
      const snapshot = await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Delete old image if it exists and is from Firebase Storage
      if (oldImageUrl && oldImageUrl.includes("firebase")) {
        try {
          const oldImageRef = ref(storage, oldImageUrl);
          await deleteObject(oldImageRef);
        } catch (error) {
          // Ignore errors when deleting old image
        }
      }

      return downloadURL;
    } catch (error) {
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalImageUrl = formData.backgroundImage;

      // Upload image if user selected a file
      if (imageUploadMode === "upload" && selectedFile) {
        finalImageUrl = await uploadImage();
      }

      const bannerData = {
        ...formData,
        backgroundImage: finalImageUrl,
        updatedAt: new Date(),
      };

      if (bannerId) {
        // Update existing banner
        await updateDoc(doc(db, "promotionalBanner", bannerId), bannerData);
      } else {
        // Create new banner with fixed ID
        await setDoc(doc(db, "promotionalBanner", "main"), {
          ...bannerData,
          createdAt: new Date(),
        });
        setBannerId("main");
      }

      setOldImageUrl(finalImageUrl);
      setSelectedFile(null);
      toast.success("تم حفظ البانر بنجاح!");
    } catch (error) {
      toast.error("حدث خطأ في حفظ البانر");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="mpb-container">
          <div className="mpb-loading">جاري تحميل البيانات...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="mpb-container">
        <div className="mpb-header">
          <h1 className="mpb-title">إدارة البانر الترويجي</h1>
        </div>

        <form onSubmit={handleSubmit} className="mpb-form">
          <div className="mpb-preview-section">
            <h3>معاينة البانر</h3>
            <div
              className="mpb-preview"
              style={{
                backgroundImage: `url(${formData.backgroundImage})`,
                opacity: formData.isActive ? 1 : 0.5,
              }}
            >
              <div className="mpb-preview-overlay">
                <div className="mpb-preview-content">
                  <h2>{formData.headline || "العنوان الرئيسي"}</h2>
                  <p>{formData.subheading || "العنوان الفرعي"}</p>
                  <div className="mpb-preview-buttons">
                    <button type="button" className="mpb-preview-btn-primary">
                      {formData.primaryButtonText || "الزر الأساسي"}
                    </button>
                    <button type="button" className="mpb-preview-btn-secondary">
                      {formData.secondaryButtonText || "الزر الثانوي"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {!formData.isActive && (
              <p className="mpb-inactive-notice">
                 البانر غير نشط - لن يظهر في الصفحة الرئيسية
              </p>
            )}
          </div>

          <div className="mpb-form-section">
            <h3>إعدادات البانر</h3>

            <div className="mpb-form-group">
              <label>صورة الخلفية:</label>
              <div className="mpb-image-mode-toggle">
                <label className="mpb-radio-label">
                  <input
                    type="radio"
                    name="imageMode"
                    value="url"
                    checked={imageUploadMode === "url"}
                    onChange={(e) => setImageUploadMode(e.target.value)}
                  />
                  <span>رابط صورة</span>
                </label>
                <label className="mpb-radio-label">
                  <input
                    type="radio"
                    name="imageMode"
                    value="upload"
                    checked={imageUploadMode === "upload"}
                    onChange={(e) => setImageUploadMode(e.target.value)}
                  />
                  <span>رفع صورة</span>
                </label>
              </div>

              {imageUploadMode === "url" ? (
                <>
                  <input
                    type="url"
                    name="backgroundImage"
                    value={formData.backgroundImage}
                    onChange={handleChange}
                    required
                    placeholder="https://example.com/image.jpg"
                  />
                  <small>
                    أدخل رابط الصورة من الإنترنت (Unsplash، Pexels، إلخ)
                  </small>
                </>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="mpb-file-input"
                  />
                  <small>
                    اختر صورة من جهازك (JPG, PNG, WEBP - حد أقصى 5MB)
                    {selectedFile && (
                      <span className="mpb-file-selected">
                        {" "}
                        ✓ تم اختيار: {selectedFile.name}
                      </span>
                    )}
                  </small>
                </>
              )}
            </div>

            <div className="mpb-form-group">
              <label>العنوان الرئيسي:</label>
              <input
                type="text"
                name="headline"
                value={formData.headline}
                onChange={handleChange}
                required
                placeholder="مثال: عروض حصرية على جميع المنتجات"
              />
            </div>

            <div className="mpb-form-group">
              <label>العنوان الفرعي:</label>
              <input
                type="text"
                name="subheading"
                value={formData.subheading}
                onChange={handleChange}
                required
                placeholder="مثال: وفري حتى 30% على منتجات مختارة"
              />
            </div>

            <div className="mpb-form-row">
              <div className="mpb-form-group">
                <label>نص الزر الأساسي:</label>
                <input
                  type="text"
                  name="primaryButtonText"
                  value={formData.primaryButtonText}
                  onChange={handleChange}
                  required
                  placeholder="مثال: تسوقي الآن"
                />
              </div>

              <div className="mpb-form-group">
                <label>صفحة الزر الأساسي:</label>
                <select
                  name="primaryButtonAction"
                  value={formData.primaryButtonAction}
                  onChange={handleChange}
                  required
                  className="mpb-select"
                >
                  <option value="">اختر الصفحة...</option>
                  {availablePages.map((page) => (
                    <option key={page.value} value={page.value}>
                      {page.label}
                    </option>
                  ))}
                </select>
                <small>اختر الصفحة التي سينتقل إليها المستخدم عند الضغط</small>
              </div>
            </div>

            <div className="mpb-form-row">
              <div className="mpb-form-group">
                <label>نص الزر الثانوي:</label>
                <input
                  type="text"
                  name="secondaryButtonText"
                  value={formData.secondaryButtonText}
                  onChange={handleChange}
                  required
                  placeholder="مثال: اعرفي المزيد"
                />
              </div>

              <div className="mpb-form-group">
                <label>صفحة الزر الثانوي:</label>
                <select
                  name="secondaryButtonAction"
                  value={formData.secondaryButtonAction}
                  onChange={handleChange}
                  required
                  className="mpb-select"
                >
                  <option value="">اختر الصفحة...</option>
                  {availablePages.map((page) => (
                    <option key={page.value} value={page.value}>
                      {page.label}
                    </option>
                  ))}
                </select>
                <small>اختر الصفحة التي سينتقل إليها المستخدم عند الضغط</small>
              </div>
            </div>

            <div className="mpb-form-group">
              <label className="mpb-checkbox-label">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <span>البانر نشط (سيظهر في الصفحة الرئيسية)</span>
              </label>
            </div>
          </div>

          <div className="mpb-form-actions">
            <button
              type="submit"
              className="mpb-save-btn"
              disabled={saving || uploading}
            >
              {uploading
                ? "جاري رفع الصورة..."
                : saving
                  ? "جاري الحفظ..."
                  : "حفظ التغييرات"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default ManagePromotionalBanner;

