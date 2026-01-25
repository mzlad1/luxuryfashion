import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase";
import Navbar from "../components/Navbar";
import "../css/ManageHeroSlides.css";
import toast from "react-hot-toast";

function ManageHeroSlides() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    buttonText: "",
    buttonLink: "/",
    order: 1,
    isActive: true,
    textColor: "#FFFFFF", // Default white color
    buttonColor: "#BFA57A", // Default button color
  });

  const [colorErrors, setColorErrors] = useState({
    textColor: "",
    buttonColor: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Available pages for customers
  const availablePages = [
    { value: "/", label: "الصفحة الرئيسية" },
    { value: "/products", label: "المنتجات" },
    { value: "/about", label: "من نحن" },
    { value: "/contact", label: "اتصل بنا" },
    { value: "/cart", label: "سلة المشتريات" },
  ];

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "heroSlides"));
      const slidesData = [];
      querySnapshot.forEach((doc) => {
        slidesData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by order
      slidesData.sort((a, b) => (a.order || 0) - (b.order || 0));
      setSlides(slidesData);
    } catch (error) {
      toast.error("حدث خطأ أثناء تحميل الشرائح");
    } finally {
      setLoading(false);
    }
  };

  const isValidHexColor = (color) => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  const handleColorChange = (name, value) => {
    // Allow empty input while typing
    if (value === "" || value === "#") {
      setFormData((prev) => ({ ...prev, [name]: value }));
      setColorErrors((prev) => ({
        ...prev,
        [name]: "أدخل لون صالح بصيغة #RRGGBB",
      }));
      return;
    }

    // Add # if missing
    if (!value.startsWith("#")) {
      value = "#" + value;
    }

    // Update the form data
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validate complete color
    if (value.length === 7) {
      if (isValidHexColor(value)) {
        setColorErrors((prev) => ({ ...prev, [name]: "" }));
      } else {
        setColorErrors((prev) => ({
          ...prev,
          [name]: "لون غير صالح. استخدم الصيغة #RRGGBB",
        }));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "textColor" || name === "buttonColor") {
      handleColorChange(name, value);
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file) => {
    const timestamp = Date.now();
    const imageName = `hero-${timestamp}-${file.name}`;
    const storageRef = ref(storage, `hero-slides/${imageName}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate colors before submission
    if (!isValidHexColor(formData.textColor)) {
      toast.error("لون النص غير صالح. يجب أن يكون بصيغة #RRGGBB");
      return;
    }

    if (!isValidHexColor(formData.buttonColor)) {
      toast.error("لون الزر غير صالح. يجب أن يكون بصيغة #RRGGBB");
      return;
    }

    setUploading(true);

    try {
      const orderNumber = parseInt(formData.order) || 1;

      // Check if order already exists (excluding current slide when editing)
      const orderExists = slides.some(
        (slide) =>
          slide.order === orderNumber &&
          (!editingSlide || slide.id !== editingSlide.id),
      );

      if (orderExists) {
        toast.error(
          `الترتيب ${orderNumber} مستخدم بالفعل. الرجاء اختيار ترتيب آخر.`,
        );
        setUploading(false);
        return;
      }

      let imageUrl = editingSlide?.imageUrl || "";

      // Upload new image if selected
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const slideData = {
        ...formData,
        imageUrl,
        order: orderNumber,
        updatedAt: new Date(),
      };

      if (editingSlide) {
        // Update existing slide
        await updateDoc(doc(db, "heroSlides", editingSlide.id), slideData);
        toast.success("تم تحديث الشريحة بنجاح");
      } else {
        // Add new slide
        slideData.createdAt = new Date();
        await addDoc(collection(db, "heroSlides"), slideData);
        toast.success("تم إضافة الشريحة بنجاح");
      }

      fetchSlides();
      closeModal();
    } catch (error) {
      toast.error("حدث خطأ أثناء حفظ الشريحة");
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (slide) => {
    setEditingSlide(slide);
    setFormData({
      title: slide.title || "",
      subtitle: slide.subtitle || "",
      buttonText: slide.buttonText || "",
      buttonLink: slide.buttonLink || "",
      order: slide.order || 1,
      isActive: slide.isActive !== false,
      textColor: slide.textColor || "#FFFFFF",
      buttonColor: slide.buttonColor || "#BFA57A",
    });
    setImagePreview(slide.imageUrl || null);
    setShowModal(true);
  };

  const handleDelete = async (slide) => {
    const confirmDelete = await new Promise((resolve) => {
      const toastId = toast(
        (t) => (
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "15px", fontWeight: "bold" }}>
              هل أنت متأكد من حذف هذه الشريحة؟
            </p>
            <div
              style={{ display: "flex", gap: "10px", justifyContent: "center" }}
            >
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(true);
                }}
                style={{
                  padding: "8px 20px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                حذف
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(false);
                }}
                style={{
                  padding: "8px 20px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        ),
        { duration: Infinity },
      );
    });
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "heroSlides", slide.id));
      toast.success("تم حذف الشريحة بنجاح");
      fetchSlides();
    } catch (error) {
      toast.error("حدث خطأ أثناء حذف الشريحة");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSlide(null);
    setFormData({
      title: "",
      subtitle: "",
      buttonText: "",
      buttonLink: "/",
      order: 1,
      isActive: true,
      textColor: "#FFFFFF",
      buttonColor: "#BFA57A",
    });
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <>
      <Navbar />
      <div className="manage-hero-slides">
        <div className="mhs-header">
          <h1>إدارة شرائح الصفحة الرئيسية</h1>
          <button
            className="mhs-btn primary"
            onClick={() => setShowModal(true)}
          >
            + إضافة شريحة جديدة
          </button>
        </div>

        {loading ? (
          <div className="mhs-loading">
            <div className="spinner"></div>
            <p>جاري التحميل...</p>
          </div>
        ) : (
          <div className="mhs-slides-grid">
            {slides.map((slide) => (
              <div key={slide.id} className="mhs-slide-card">
                <div className="mhs-slide-image">
                  {slide.imageUrl ? (
                    <img src={slide.imageUrl} alt={slide.title} />
                  ) : (
                    <div className="mhs-no-image">لا توجد صورة</div>
                  )}
                  {!slide.isActive && (
                    <div className="mhs-inactive-badge">غير نشط</div>
                  )}
                </div>
                <div className="mhs-slide-content">
                  <h3>{slide.title || "بدون عنوان"}</h3>
                  <p>{slide.subtitle || "بدون نص فرعي"}</p>
                  <div className="mhs-slide-meta">
                    <span className="mhs-order">الترتيب: {slide.order}</span>
                    {slide.buttonText && (
                      <span className="mhs-button-text">
                        زر: {slide.buttonText}
                      </span>
                    )}
                  </div>
                  <div className="mhs-slide-actions">
                    <button
                      className="mhs-btn edit"
                      onClick={() => handleEdit(slide)}
                    >
                      <i className="fas fa-edit"></i> تعديل
                    </button>
                    <button
                      className="mhs-btn delete"
                      onClick={() => handleDelete(slide)}
                    >
                      <i className="fas fa-trash-alt"></i> حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {slides.length === 0 && (
              <div className="mhs-empty">
                <p>لا توجد شرائح. قم بإضافة شريحة جديدة للبدء.</p>
              </div>
            )}
          </div>
        )}

        {showModal && (
          <div className="mhs-modal-overlay" onClick={closeModal}>
            <div className="mhs-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mhs-modal-header">
                <h2>{editingSlide ? "تعديل الشريحة" : "إضافة شريحة جديدة"}</h2>
                <button className="mhs-close-btn" onClick={closeModal}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="mhs-form">
                <div className="mhs-form-group">
                  <label>العنوان الرئيسي *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    placeholder="مثال: أحدث منتجات العناية بالشعر"
                  />
                </div>

                <div className="mhs-form-group">
                  <label>النص الفرعي</label>
                  <textarea
                    name="subtitle"
                    value={formData.subtitle}
                    onChange={handleInputChange}
                    placeholder="مثال: اكتشف مجموعتنا المميزة من منتجات العناية"
                    rows="3"
                  />
                </div>

                <div className="mhs-form-row">
                  <div className="mhs-form-group">
                    <label>نص الزر</label>
                    <input
                      type="text"
                      name="buttonText"
                      value={formData.buttonText}
                      onChange={handleInputChange}
                      placeholder="مثال: تسوق الآن"
                    />
                  </div>

                  <div className="mhs-form-group">
                    <label>رابط الزر</label>
                    <select
                      name="buttonLink"
                      value={formData.buttonLink}
                      onChange={handleInputChange}
                      className="mhs-select"
                    >
                      {availablePages.map((page) => (
                        <option key={page.value} value={page.value}>
                          {page.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mhs-form-row">
                  <div className="mhs-form-group">
                    <label>الترتيب *</label>
                    <input
                      type="number"
                      name="order"
                      value={formData.order}
                      onChange={handleInputChange}
                      required
                      min="1"
                    />
                  </div>

                  <div className="mhs-form-group">
                    <label>إظهار الشريحة</label>
                    <label className="mhs-checkbox-label">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                      />
                      <span>نشط</span>
                    </label>
                  </div>

                  <div className="mhs-form-group">
                    <label>لون النص</label>
                    <div className="color-picker-container">
                      <input
                        type="color"
                        name="textColor"
                        value={
                          isValidHexColor(formData.textColor)
                            ? formData.textColor
                            : "#FFFFFF"
                        }
                        onChange={handleInputChange}
                        className="mhs-color-picker"
                      />
                      <input
                        type="text"
                        name="textColor"
                        value={formData.textColor}
                        onChange={handleInputChange}
                        placeholder="#FFFFFF"
                        className={`mhs-color-input ${colorErrors.textColor ? "error" : ""}`}
                      />
                    </div>
                    {colorErrors.textColor && (
                      <div className="mhs-color-error">
                        {colorErrors.textColor}
                      </div>
                    )}
                  </div>

                  <div className="mhs-form-group">
                    <label>لون الزر</label>
                    <div className="color-picker-container">
                      <input
                        type="color"
                        name="buttonColor"
                        value={
                          isValidHexColor(formData.buttonColor)
                            ? formData.buttonColor
                            : "#BFA57A"
                        }
                        onChange={handleInputChange}
                        className="mhs-color-picker"
                      />
                      <input
                        type="text"
                        name="buttonColor"
                        value={formData.buttonColor}
                        onChange={handleInputChange}
                        placeholder="#BFA57A"
                        className={`mhs-color-input ${colorErrors.buttonColor ? "error" : ""}`}
                      />
                    </div>
                    {colorErrors.buttonColor && (
                      <div className="mhs-color-error">
                        {colorErrors.buttonColor}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mhs-form-group">
                  <label>صورة الشريحة *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    required={!editingSlide}
                  />
                  {imagePreview && (
                    <div className="mhs-image-preview">
                      <img src={imagePreview} alt="Preview" />
                    </div>
                  )}
                </div>

                <div className="mhs-form-actions">
                  <button
                    type="button"
                    className="mhs-btn cancel"
                    onClick={closeModal}
                    disabled={uploading}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="mhs-btn primary"
                    disabled={uploading}
                  >
                    {uploading
                      ? "جاري الحفظ..."
                      : editingSlide
                        ? "تحديث الشريحة"
                        : "إضافة الشريحة"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ManageHeroSlides;
