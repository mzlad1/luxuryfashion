import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import "../css/ProductFeedback.css";

function ProductFeedback({ productId }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalImage, setModalImage] = useState(null); // For image modal
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    comment: "",
    rating: 0,
    images: [],
  });

  // Fetch approved feedbacks for this product
  useEffect(() => {
    fetchFeedbacks();
  }, [productId]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "feedbacks"),
        where("productId", "==", productId),
        where("status", "==", "approved"),
        orderBy("createdAt", "desc"),
      );
      const querySnapshot = await getDocs(q);
      const feedbackList = [];
      querySnapshot.forEach((doc) => {
        feedbackList.push({ id: doc.id, ...doc.data() });
      });
      setFeedbacks(feedbackList);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + formData.images.length > 3) {
      alert("يمكنك إضافة 3 صور كحد أقصى");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...files],
    }));
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const uploadImages = async (images) => {
    const uploadPromises = images.map(async (image) => {
      const imageRef = ref(storage, `feedbacks/${Date.now()}-${image.name}`);
      const snapshot = await uploadBytes(imageRef, image);
      return await getDownloadURL(snapshot.ref);
    });
    return await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.name.trim() ||
      !formData.comment.trim() ||
      formData.rating === 0
    ) {
      alert("يرجى إدخال الاسم والتعليق والتقييم");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrls = [];
      if (formData.images.length > 0) {
        imageUrls = await uploadImages(formData.images);
      }

      await addDoc(collection(db, "feedbacks"), {
        productId,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        rating: formData.rating,
        comment: formData.comment.trim(),
        images: imageUrls,
        status: "pending", // pending, approved, rejected
        createdAt: new Date(),
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        comment: "",
        rating: 0,
        images: [],
      });
      setShowForm(false);
      alert("تم إرسال تقييمك بنجاح! سيظهر بعد مراجعة الإدارة");
    } catch (error) {
      alert("حدث خطأ في إرسال التقييم");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (date && date.toDate) {
      return date.toDate().toLocaleDateString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
    return "";
  };

  const openImageModal = (imageUrl) => {
    setModalImage(imageUrl);
  };

  const closeImageModal = () => {
    setModalImage(null);
  };

  // Close modal when clicking outside or pressing Escape
  const handleModalClick = (e) => {
    if (e.target.className === "pf-modal-overlay") {
      closeImageModal();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeImageModal();
      }
    };

    if (modalImage) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [modalImage]);

  return (
    <div className="pf-container">
      <div className="pf-header">
        <h3 className="pf-title">تقييمات العملاء</h3>
        <button
          className="pf-add-button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "إلغاء" : "أضف تقييم"}
        </button>
      </div>

      {/* Add Feedback Form */}
      {showForm && (
        <form className="pf-form" onSubmit={handleSubmit}>
          <div className="pf-form-group">
            <label htmlFor="name">الاسم *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              maxLength={50}
            />
          </div>

          <div className="pf-form-row">
            <div className="pf-form-group">
              <label htmlFor="email">البريد الإلكتروني</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                maxLength={100}
              />
            </div>
            <div className="pf-form-group">
              <label htmlFor="phone">رقم الهاتف</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                maxLength={20}
              />
            </div>
          </div>

          <div className="pf-privacy-notice">
            <p>
              <i className="fas fa-phone"></i> ملاحظة: رقم الهاتف والبريد
              الإلكتروني لن يظهران للزوار، وسيتم استخدامهما فقط للتواصل معك من
              قبل الإدارة
            </p>
          </div>

          <div className="pf-form-group">
            <label htmlFor="rating">التقييم *</label>
            <div className="pf-rating-container">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`pf-star ${
                    formData.rating >= star ? "active" : ""
                  }`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, rating: star }))
                  }
                  aria-label={`${star} نجوم`}
                >
                  {formData.rating >= star ? (
                    <i className="fas fa-star"></i>
                  ) : (
                    <i className="far fa-star"></i>
                  )}
                </button>
              ))}
              <span className="pf-rating-text">
                {formData.rating > 0
                  ? `${formData.rating}/5 نجوم`
                  : "اختر التقييم"}
              </span>
            </div>
          </div>

          <div className="pf-form-group">
            <label htmlFor="comment">التعليق *</label>
            <textarea
              id="comment"
              name="comment"
              value={formData.comment}
              onChange={handleInputChange}
              required
              maxLength={500}
              rows="4"
              placeholder="شاركنا رأيك في المنتج..."
            />
          </div>

          <div className="pf-form-group">
            <label htmlFor="images">الصور (اختياري - حتى 3 صور)</label>
            <input
              type="file"
              id="images"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={formData.images.length >= 3}
            />
            {formData.images.length > 0 && (
              <div className="pf-image-preview">
                {formData.images.map((image, index) => (
                  <div key={index} className="pf-preview-item">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index + 1}`}
                      className="pf-preview-image"
                    />
                    <button
                      type="button"
                      className="pf-remove-image"
                      onClick={() => removeImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pf-form-actions">
            <button
              type="submit"
              className="pf-submit-button"
              disabled={submitting}
            >
              {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
            </button>
          </div>
        </form>
      )}

      {/* Feedbacks List */}
      <div className="pf-feedbacks">
        {loading ? (
          <div className="pf-loading">جاري تحميل التقييمات...</div>
        ) : feedbacks.length === 0 ? (
          <div className="pf-no-feedbacks">لا توجد تقييمات حتى الآن</div>
        ) : (
          feedbacks.map((feedback) => (
            <div key={feedback.id} className="pf-feedback-item">
              <div className="pf-feedback-header">
                <span className="pf-feedback-name">{feedback.name}</span>
                <div className="pf-feedback-meta">
                  {feedback.rating && (
                    <div className="pf-feedback-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`pf-display-star ${
                            feedback.rating >= star ? "active" : ""
                          }`}
                        >
                          {feedback.rating >= star ? (
                            <i className="fas fa-star"></i>
                          ) : (
                            <i className="far fa-star"></i>
                          )}
                        </span>
                      ))}
                      <span className="pf-rating-value">
                        ({feedback.rating}/5)
                      </span>
                    </div>
                  )}
                  <span className="pf-feedback-date">
                    {formatDate(feedback.createdAt)}
                  </span>
                </div>
              </div>
              <div className="pf-feedback-comment">{feedback.comment}</div>
              {feedback.images && feedback.images.length > 0 && (
                <div className="pf-feedback-images">
                  {feedback.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`Feedback ${index + 1}`}
                      className="pf-feedback-image"
                      onClick={() => openImageModal(image)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Image Modal */}
      {modalImage && (
        <div className="pf-modal-overlay" onClick={handleModalClick}>
          <div className="pf-modal-content">
            <button className="pf-modal-close" onClick={closeImageModal}>
              <i className="fas fa-times"></i>
            </button>
            <img src={modalImage} alt="Feedback" className="pf-modal-image" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductFeedback;
