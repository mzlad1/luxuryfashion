import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "../css/About.css";

const About = () => {
  return (
    <>
      <Navbar />
      <div className="about-page">
        {/* Hero Section */}
        <section className="about-hero">
          <div className="about-hero-overlay"></div>
          <div className="about-hero-content">
            <h1 className="about-hero-title">من نحن</h1>
            <p className="about-hero-subtitle">رحلة من الشغف إلى التميز</p>
          </div>
        </section>

        {/* Main Content */}
        <div className="about-container">
          {/* Story Section */}
          <section className="about-section">
            <div className="about-content-grid">
              <div className="about-text-block">
                <h2 className="about-section-title">قصتنا</h2>
                <div className="about-divider"></div>
                <p className="about-paragraph">
                  لاكجري هي وجهتكِ للأناقة والفخامة في عالم الإكسسوارات
                  والملابس. نختار بعناية أرقى وأفخم الموديلات لنقدّم لكِ تصاميم
                  عصرية تواكب أحدث صيحات الموضة وتناسب كل الأذواق.
                </p>
                <p className="about-paragraph">
                  نحرص في لاكجري على الجودة، الذوق الراقي، والتفاصيل التي تصنع
                  الفرق، لتجدي كل ما يكمّل إطلالتكِ بأسلوب مميّز وفريد.
                </p>
                <p className="about-paragraph">
                  في موقعنا رح تلاقي منتجات مجربة ومختارة بعناية رح تساعدك تبرزي
                  أناقتك وتخليكي دايماً في الصدارة.
                </p>
              </div>
              <div className="about-image-block">
                <div className="about-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800"
                    alt="قصتنا"
                    className="about-image"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Vision Section */}
          <section className="about-section about-section-alt">
            <div className="about-content-grid about-content-grid-reverse">
              <div className="about-image-block">
                <div className="about-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800"
                    alt="رؤيتنا"
                    className="about-image"
                  />
                </div>
              </div>
              <div className="about-text-block">
                <h2 className="about-section-title">رؤيتنا</h2>
                <div className="about-divider"></div>
                <p className="about-paragraph">
                  نسعى لأن نكون الخيار الأول في عالم الموضة الفاخرة والإكسسوارات
                  الراقية، من خلال تقديم قطع استثنائية تلبي أعلى معايير الجودة
                  والأناقة.
                </p>
                <p className="about-paragraph">
                  رؤيتنا هي إعادة تعريف تجربة التسوق للملابس والإكسسوارات،
                  وجعلها ليست مجرد شراء قطعة، بل تجربة فاخرة تمنحك الثقة والتميز
                  في كل إطلالة.
                </p>
              </div>
            </div>
          </section>

          {/* Values Section */}
          <section className="about-section">
            <div className="about-values-header">
              <h2 className="about-section-title about-section-title-center">
                قيمنا
              </h2>
              <div className="about-divider about-divider-center"></div>
              <p className="about-values-subtitle">
                المبادئ التي نؤمن بها ونعمل من خلالها
              </p>
            </div>

            <div className="about-values-grid">
              <div className="about-value-card">
                <div className="about-value-icon">
                  <i className="fas fa-gem"></i>
                </div>
                <h3 className="about-value-title">الجودة</h3>
                <p className="about-value-text">
                  نختار قطعنا بعناية فائقة لضمان أعلى معايير الجودة والفخامة
                </p>
              </div>

              <div className="about-value-card">
                <div className="about-value-icon">
                  <i className="fas fa-shield-alt"></i>
                </div>
                <h3 className="about-value-title">الثقة</h3>
                <p className="about-value-text">
                  نبني علاقات طويلة الأمد مع عملائنا من خلال الشفافية والمصداقية
                </p>
              </div>

              <div className="about-value-card">
                <div className="about-value-icon">
                  <i className="fas fa-award"></i>
                </div>
                <h3 className="about-value-title">التميز</h3>
                <p className="about-value-text">
                  نسعى دائماً لتقديم تجربة استثنائية تفوق توقعات عملائنا
                </p>
              </div>

              <div className="about-value-card">
                <div className="about-value-icon">
                  <i className="fas fa-star"></i>
                </div>
                <h3 className="about-value-title">الأناقة</h3>
                <p className="about-value-text">
                  نقدم قطع عصرية تواكب أحدث صيحات الموضة بأسلوب راقي
                </p>
              </div>
            </div>
          </section>

          {/* Promise Section */}
          <section className="about-section about-section-alt">
            <div className="about-promise">
              <div className="about-promise-content">
                <h2 className="about-section-title about-section-title-center">
                  وعدنا لك
                </h2>
                <div className="about-divider about-divider-center"></div>
                <p className="about-promise-text">
                  نعدك بتقديم قطع ملابس وإكسسوارات فاخرة مختارة بعناية، وخدمة
                  عملاء متميزة، وتجربة تسوق سلسة وممتعة. رضاك هو هدفنا الأول،
                  وأناقتك هي نجاحنا.
                </p>
                <div className="about-promise-stats">
                  <div className="about-stat">
                    <span className="about-stat-number">1000+</span>
                    <span className="about-stat-label">عميل سعيد</span>
                  </div>
                  <div className="about-stat">
                    <span className="about-stat-number">500+</span>
                    <span className="about-stat-label">قطعة فاخرة</span>
                  </div>
                  <div className="about-stat">
                    <span className="about-stat-number">100%</span>
                    <span className="about-stat-label">جودة مضمونة</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Contact CTA */}
          <section className="about-section">
            <div className="about-cta">
              <h2 className="about-cta-title">لديك سؤال؟</h2>
              <p className="about-cta-text">
                فريقنا جاهز دائماً للإجابة على استفساراتك ومساعدتك في اختيار
                المنتج المثالي
              </p>
              <a href="/contact" className="about-cta-button">
                <i className="fas fa-envelope"></i>
                <span>تواصل معنا</span>
              </a>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default About;
