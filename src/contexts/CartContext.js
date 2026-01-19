import React, { createContext, useContext, useState, useEffect } from "react";

// سياق لإدارة عربة التسوق عبر صفحات الموقع
const CartContext = createContext();

// مزود السياق
export function CartProvider({ children }) {
  // Load cart from localStorage on initialization
  const [cartItems, setCartItems] = useState(() => {
    const savedCart = localStorage.getItem("beautyCart");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  // Save to localStorage whenever cartItems changes
  useEffect(() => {
    localStorage.setItem("beautyCart", JSON.stringify(cartItems));
  }, [cartItems]);

  // Helper function to generate cart item ID
  const generateCartItemId = (product) => {
    if (product.hasVariants && product.selectedVariant) {
      return `${product.id}-${product.selectedVariant.size}-${product.selectedVariant.color}`;
    }
    return product.id;
  };

  // Helper function to check if two items are the same variant
  const isSameVariant = (item1, item2) => {
    if (item1.id !== item2.id) return false;

    if (item1.hasVariants && item2.hasVariants) {
      return (
        item1.selectedVariant &&
        item2.selectedVariant &&
        item1.selectedVariant.size === item2.selectedVariant.size &&
        item1.selectedVariant.color === item2.selectedVariant.color
      );
    }

    return !item1.hasVariants && !item2.hasVariants;
  };

  // Helper function to get total quantity of a product across all variants
  const getProductTotalQuantity = (productId) => {
    return cartItems
      .filter((item) => item.id === productId)
      .reduce((total, item) => total + item.quantity, 0);
  };

  // إضافة عنصر إلى العربة
  const addToCart = (product) => {
    setCartItems((prevItems) => {
      // Create unique identifier for the cart item
      const cartItemId = generateCartItemId(product);

      // Check if item with same ID and variant exists
      const existingItem = prevItems.find((item) => {
        if (product.hasVariants && product.selectedVariant) {
          // For variants, check both product ID and variant details
          return (
            item.id === product.id &&
            item.selectedVariant &&
            item.selectedVariant.size === product.selectedVariant.size &&
            item.selectedVariant.color === product.selectedVariant.color
          );
        } else {
          // For regular products, just check product ID
          return item.id === product.id;
        }
      });

      if (existingItem) {
        // If item exists, increment quantity
        return prevItems.map((item) => {
          if (product.hasVariants && product.selectedVariant) {
            // For variants, match both product ID and variant details
            if (
              item.id === product.id &&
              item.selectedVariant &&
              item.selectedVariant.size === product.selectedVariant.size &&
              item.selectedVariant.color === product.selectedVariant.color
            ) {
              return { ...item, quantity: item.quantity + 1 };
            }
          } else {
            // For regular products, match just product ID
            if (item.id === product.id) {
              return { ...item, quantity: item.quantity + 1 };
            }
          }
          return item;
        });
      } else {
        // If item doesn't exist, add new item with quantity 1
        return [...prevItems, { ...product, quantity: 1, cartItemId }];
      }
    });
  };

  // إزالة عنصر من العربة
  const removeFromCart = (productId) => {
    setCartItems((prev) =>
      prev.filter((item) => item.cartItemId !== productId)
    );
  };

  // تحديث كمية عنصر
  const updateQuantity = (productId, quantity) => {
    setCartItems((prev) => {
      const updated = prev.map((item) =>
        item.cartItemId === productId ? { ...item, quantity } : item
      );
      return updated;
    });
  };

  // إفراغ العربة
  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem("beautyCart");
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        generateCartItemId,
        isSameVariant,
        getProductTotalQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// خطاف لاستخدام سياق العربة بسهولة
export function useCart() {
  return useContext(CartContext);
}
