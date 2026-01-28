import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CartProvider } from "./contexts/CartContext";

// Hide loading indicator once React starts
window.reactLoaded = true;
const loadingIndicator = document.getElementById("loading-indicator");
if (loadingIndicator) {
  loadingIndicator.style.display = "none";
}

// Log successful React initialization
console.log("React app initialized successfully");

// نقطة البداية للتطبيق
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
