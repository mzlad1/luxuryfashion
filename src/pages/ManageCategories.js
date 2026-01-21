import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import "../css/ManageCategories.css";
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
import { CacheManager, CACHE_KEYS } from "../utils/cache";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

// صفحة إدارة الفئات
function ManageCategories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [formName, setFormName] = useState("");
  const [formImage, setFormImage] = useState(null);
  const [formImagePreview, setFormImagePreview] = useState("");
  const [formSubcategories, setFormSubcategories] = useState([]);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Add search functionality
  const [currentPage, setCurrentPage] = useState(1); // Add pagination
  const [itemsPerPage] = useState(8); // 8 categories per page

  useEffect(() => {
    async function fetchCategories() {
      try {
        // Check cache first
        const cachedCategories = CacheManager.get(CACHE_KEYS.CATEGORIES);
        if (cachedCategories) {
          setCategories(cachedCategories);
          return;
        }

        const snapshot = await getDocs(collection(db, "categories"));
        const data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setCategories(data);

        // Cache for 10 minutes
        CacheManager.set(CACHE_KEYS.CATEGORIES, data, 10 * 60 * 1000);

      } catch (error) {
        // بيانات تجريبية
        setCategories([
          { id: "cat1", name: "الوجه", imageUrl: "" },
          { id: "cat2", name: "الشعر", imageUrl: "" },
          { id: "cat3", name: "الجسم", imageUrl: "" },
        ]);
      }
    }
    fetchCategories();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormImage(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setFormImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormImage(null);
    setFormImagePreview("");
  };

  const uploadImageToStorage = async (file, categoryId) => {
    if (!file) return null;

    const storageRef = ref(storage, `categories/${categoryId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  };

  const deleteImageFromStorage = async (imageUrl) => {
    if (!imageUrl) return;

    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
    }
  };

  const handleEdit = (cat) => {
    setFormName(cat.name);
    setFormImage(null);
    setFormImagePreview(cat.imageUrl || "");
    setFormSubcategories(cat.subcategories || []);
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setFormName("");
    setFormImage(null);
    setFormImagePreview("");
    setFormSubcategories([]);
    setNewSubcategory("");
    setEditingId(null);
    setShowForm(false);
  };

  const addSubcategory = () => {
    if (newSubcategory.trim()) {
      setFormSubcategories([...formSubcategories, newSubcategory.trim()]);
      setNewSubcategory("");
    }
  };

  const removeSubcategory = (index) => {
    setFormSubcategories(formSubcategories.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName) return;
    setLoading(true);

    try {
      let updatedCategories;

      if (editingId) {
        // Editing existing category
        const docRef = doc(db, "categories", editingId);
        const updateData = { 
          name: formName,
          subcategories: formSubcategories
        };

        // Handle image update
        if (formImage) {
          // Delete old image if exists
          const oldCategory = categories.find((c) => c.id === editingId);
          if (oldCategory?.imageUrl) {
            await deleteImageFromStorage(oldCategory.imageUrl);
          }

          // Upload new image
          const imageUrl = await uploadImageToStorage(formImage, editingId);
          updateData.imageUrl = imageUrl;
        }

        await updateDoc(docRef, updateData);

        updatedCategories = categories.map((c) =>
          c.id === editingId ? { ...c, ...updateData } : c
        );
      } else {
        // Adding new category
        const docRef = await addDoc(collection(db, "categories"), {
          name: formName,
          imageUrl: "",
          subcategories: formSubcategories,
        });

        let imageUrl = "";
        if (formImage) {
          imageUrl = await uploadImageToStorage(formImage, docRef.id);
          // Update the document with image URL
          await updateDoc(docRef, { imageUrl });
        }

        updatedCategories = [
          ...categories,
          { id: docRef.id, name: formName, imageUrl, subcategories: formSubcategories },
        ];
      }

      setCategories(updatedCategories);

      // Update cache
      CacheManager.set(
        CACHE_KEYS.CATEGORIES,
        updatedCategories,
        10 * 60 * 1000
      );

      setFormName("");
      setFormImage(null);
      setFormImagePreview("");
      setFormSubcategories([]);
      setNewSubcategory("");
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("هل تريد حذف هذه الفئة؟")) return;
    try {
      // Delete image from storage if exists
      const category = categories.find((c) => c.id === id);
      if (category?.imageUrl) {
        await deleteImageFromStorage(category.imageUrl);
      }

      await deleteDoc(doc(db, "categories", id));
      const updatedCategories = categories.filter((c) => c.id !== id);
      setCategories(updatedCategories);

      // Update cache
      CacheManager.set(
        CACHE_KEYS.CATEGORIES,
        updatedCategories,
        10 * 60 * 1000
      );
    } catch (error) {
    }
  };

  // Filter categories based on search term
  const filteredCategories = searchTerm
    ? categories.filter((category) =>
        category.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : categories;

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCategories = filteredCategories.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Initialize session management
  useEffect(() => {
    const handleSessionExpired = async () => {
      try {
        await signOut(auth);
        CacheManager.clearAll();
        navigate("/admin");
      } catch (error) {
        navigate("/admin");
      }
    };

    return () => {};
  }, [navigate]);

  return (
    <>
      <Navbar />
      <div className="manage-categories-page">
        <h1>إدارة الفئات</h1>

        {/* Add Category Button */}
        {!showForm && (
          <div className="mc-add-section">
            <button className="mc-add-button" onClick={() => setShowForm(true)}>
              + إضافة فئة جديدة
            </button>
          </div>
        )}

        {/* Search Section */}
        {!showForm && (
          <div className="mc-search-bar">
            <input
              type="text"
              placeholder="ابحث عن فئة بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mc-search-input"
            />
            <div className="mc-categories-count">
              عرض {indexOfFirstItem + 1}-
              {Math.min(indexOfLastItem, filteredCategories.length)} من{" "}
              {filteredCategories.length} فئة
            </div>
          </div>
        )}

        {/* Category Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mc-form">
            <h2>{editingId ? "تعديل الفئة" : "إضافة فئة جديدة"}</h2>
            <div className="mc-form-group">
              <label>اسم الفئة:</label>
              <input
                type="text"
                value={formName}
                required
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="mc-form-group">
              <label>صورة الفئة:</label>
              <div className="mc-image-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mc-file-input"
                  id="category-image"
                />
                <label htmlFor="category-image" className="mc-file-label">
                  {formImage ? "تغيير الصورة" : "اختر صورة"}
                </label>

                {(formImagePreview || formImage) && (
                  <div className="mc-image-preview">
                    <img
                      src={formImagePreview}
                      alt="معاينة الصورة"
                      className="mc-preview-img"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="mc-remove-image-btn"
                    >
                      حذف الصورة
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mc-form-group">
              <label>الفئات الفرعية (اختياري):</label>
              <div className="mc-subcategories-section">
                <div className="mc-subcategory-input-group">
                  <input
                    type="text"
                    value={newSubcategory}
                    onChange={(e) => setNewSubcategory(e.target.value)}
                    placeholder="مثال: قمصان، بناطيل، جاكيتات..."
                    className="mc-subcategory-input"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubcategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addSubcategory}
                    className="mc-add-subcategory-btn"
                    disabled={!newSubcategory.trim()}
                  >
                    + إضافة
                  </button>
                </div>

                {formSubcategories.length > 0 && (
                  <div className="mc-subcategories-list">
                    {formSubcategories.map((sub, index) => (
                      <div key={index} className="mc-subcategory-item">
                        <span className="mc-subcategory-name">{sub}</span>
                        <button
                          type="button"
                          onClick={() => removeSubcategory(index)}
                          className="mc-remove-subcategory-btn"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <small className="mc-subcategory-hint">
                  <i className="fas fa-lightbulb"></i> الفئات الفرعية تساعد في تنظيم المنتجات بشكل أفضل
                </small>
              </div>
            </div>

            <button type="submit" className="mc-save-btn" disabled={loading}>
              {loading ? "جاري الحفظ..." : editingId ? "تحديث" : "إضافة"}
            </button>
            <button
              type="button"
              className="mc-cancel-btn"
              onClick={handleCancel}
            >
              إلغاء
            </button>
          </form>
        )}

        <table className="mc-table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>اسم الفئة</th>
              <th>الفئات الفرعية</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {currentCategories.map((cat) => (
              <tr key={cat.id}>
                <td data-label="الصورة" className="mc-image-cell">
                  {cat.imageUrl ? (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="mc-category-image"
                    />
                  ) : (
                    <div className="mc-no-image">لا توجد صورة</div>
                  )}
                </td>
                <td data-label="اسم الفئة">{cat.name}</td>
                <td data-label="الفئات الفرعية">
                  {cat.subcategories && cat.subcategories.length > 0 ? (
                    <div className="mc-subcategories-display">
                      {cat.subcategories.map((sub, index) => (
                        <span key={index} className="mc-subcategory-tag">
                          {sub}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="mc-no-subcategories">لا توجد</span>
                  )}
                </td>
                <td data-label="إجراءات">
                  <button
                    className="mc-edit-btn"
                    onClick={() => handleEdit(cat)}
                  >
                    تعديل
                  </button>{" "}
                  <button
                    className="mc-delete-btn"
                    onClick={() => handleDelete(cat.id)}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && !showForm && (
          <div className="mc-pagination">
            <button
              className="mc-pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              السابق
            </button>

            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  className={`mc-pagination-btn ${
                    currentPage === pageNumber ? "active" : ""
                  }`}
                  onClick={() => handlePageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              className="mc-pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              التالي
            </button>
          </div>
        )}

        {filteredCategories.length === 0 && !showForm && (
          <div className="mc-no-results">
            <p>لا توجد فئات {searchTerm ? "تطابق البحث" : ""}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default ManageCategories;
