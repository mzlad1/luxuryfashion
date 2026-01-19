import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "../css/Contact.css";

// صفحة اتصل بنا
function Contact() {
  const contactInfo = [
    {
      icon: (
        <img
          src="/images/instagram.png"
          alt="Instagram"
          className="bp-contact-icon-img"
        />
      ),
      title: "انستجرام",
      content: "تابعينا للحصول على آخر العروض",
      link: "https://www.instagram.com/luxury_life_stayle",
      linkText: "@luxury_life_stayle",
      type: "instagram",
    },
    {
      icon: <i className="fab fa-facebook-f"></i>,
      title: "فيسبوك",
      content: "تواصلي معنا على صفحتنا",
      link: "https://www.facebook.com/profile.php?id=100087035404500",
      linkText: "لاكجري فاشن Luxury fashion",
      type: "facebook",
    },
  ];

  return (
    <>
      <Navbar />
      <div className="bp-contact-page">
        <div className="bp-contact-container">
          {/* Header Section */}
          <div className="bp-contact-header">
            <h1 className="bp-contact-title">تواصلي معنا</h1>
          </div>

          {/* Contact Content */}
          <div className="bp-contact-content">
            {/* Contact Information */}
            <div className="bp-contact-info-section">
              <div className="bp-contact-cards">
                {contactInfo.map((info, index) => (
                  <a
                    key={index}
                    href={info.link}
                    target={
                      info.type === "phone" || info.type === "email"
                        ? "_self"
                        : "_blank"
                    }
                    rel={
                      info.type === "phone" || info.type === "email"
                        ? ""
                        : "noopener noreferrer"
                    }
                    className={`bp-contact-card ${info.type}`}
                  >
                    <div className="bp-contact-card-icon">{info.icon}</div>
                    <div className="bp-contact-card-content">
                      <h3>{info.title}</h3>
                      <p>{info.content}</p>
                      <span className="bp-contact-link-text">
                        {info.linkText}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default Contact;
