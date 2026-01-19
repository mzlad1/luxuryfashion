import React from "react";
import "../css/Footer.css";

function Footer() {
  return (
    <footer className="ft-footer">
      <div className="ft-container">
        <div className="ft-content">
          {/* Brand Section */}
          <div className="ft-brand">
            <div className="ft-logo">
              <span className="ft-logo-text">Luxury Fashion</span>
            </div>
            <p className="ft-brand-name">لاكجري للاكسسوارات والملابس</p>
          </div>

          {/* Contact Info Section */}
          <div className="ft-contact">
            <h3 className="ft-section-title">معلومات التواصل</h3>
            <div className="ft-contact-item">
              <i className="fas fa-map-marker-alt"></i>
              <span>
                طولكرم قرب تكسي التفال-دخلة تكاسي العزب شارع كلاج الطوباسي
              </span>
            </div>
            <div className="ft-contact-item">
              <i className="fas fa-phone-alt"></i>
              <a href="tel:+972592806088">972592806088+</a>
            </div>
            <div className="ft-contact-item">
              <i className="fas fa-envelope"></i>
              <a href="mailto:anwaroohasan44@gmail.com">
                anwaroohasan44@gmail.com
              </a>
            </div>
          </div>

          {/* Social Media Section */}
          <div className="ft-social">
            <h3 className="ft-section-title">تابعنا</h3>
            <div className="ft-social-links">
              <a
                href="https://www.instagram.com/luxury_life_stayle/"
                className="ft-social-link instagram"
                target="_blank"
                rel="noopener noreferrer"
                title="انستغرام"
              >
                <i className="fab fa-instagram"></i>
                <span>Instagram</span>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=100087035404500"
                className="ft-social-link facebook"
                target="_blank"
                rel="noopener noreferrer"
                title="فيسبوك"
              >
                <i className="fab fa-facebook-f"></i>
                <span>Facebook</span>
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="ft-copyright">
          <p>© 2026 Luxury Fashion. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
