import React from "react";
import { useNavigate } from "react-router-dom";
import "../css/PromotionalBanner.css";

/**
 * PromotionalBanner Component
 *
 * A reusable promotional banner component with RTL support
 *
 * Usage Examples:
 *
 * // Basic usage
 * <PromotionalBanner />
 *
 * // Custom content
 * <PromotionalBanner
 *   headline="عرض خاص للأعضاء الجدد"
 *   subheading="احصلي على خصم 50% على أول جلسة ليزر"
 *   primaryButtonText="احجزي الآن"
 *   secondaryButtonText="تعرفي على الشروط"
 * />
 *
 * // Custom navigation and image
 * <PromotionalBanner
 *   backgroundImage="https://example.com/custom-image.jpg"
 *   primaryButtonAction="/booking"
 *   secondaryButtonAction="/terms"
 *   onBannerClick={() => console.log('Banner clicked')}
 * />
 */

const PromotionalBanner = ({
  backgroundImage = "https://images.unsplash.com/photo-1559599101-f09722fb4948?q=80&w=1000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  headline = "عروض حصرية على منتجاتنا المميزة",
  subheading = "وفري حتى 30% على مجموعات العناية المتكاملة",
  primaryButtonText = "تسوقي الآن",
  secondaryButtonText = "اكتشفي العروض",
  primaryButtonAction = "/products",
  secondaryButtonAction = "/services",
  onBannerClick = null,
  className = "",
}) => {
  const navigate = useNavigate();

  const handlePrimaryClick = (e) => {
    e.stopPropagation();
    navigate(primaryButtonAction);
  };

  const handleSecondaryClick = (e) => {
    e.stopPropagation();
    navigate(secondaryButtonAction);
  };

  const handleBannerClick = () => {
    if (onBannerClick) {
      onBannerClick();
    }
  };

  return (
    <div
      className={`promotional-banner ${className}`}
      onClick={handleBannerClick}
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="promotional-banner-overlay">
        <div className="promotional-banner-content">
          <h2 className="promotional-banner-headline">{headline}</h2>
          <p className="promotional-banner-subheading">{subheading}</p>

          <div className="promotional-banner-actions">
            <button
              className="promotional-banner-btn promotional-banner-btn-primary"
              onClick={handlePrimaryClick}
            >
              {primaryButtonText}
            </button>
            <button
              className="promotional-banner-btn promotional-banner-btn-secondary"
              onClick={handleSecondaryClick}
            >
              {secondaryButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionalBanner;
