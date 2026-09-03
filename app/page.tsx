export default function Home() {
  return (
    <>
      {/* ==================== NAVBAR ==================== */}
      <nav className="navbar">
        <a href="/" className="navbar-logo">
          سَـ<span>نَد</span>
        </a>

        <ul className="navbar-links">
          <li><a href="#services">الخدمات</a></li>
          <li><a href="#how-it-works">كيف يعمل</a></li>
          <li><a href="#about">معلومات عنا</a></li>
        </ul>

        <div className="navbar-actions">
          <a href="/login" className="btn-login">
            تسجيل الدخول
          </a>
        </div>
      </nav>

      {/* ==================== HERO ==================== */}
      <section className="hero-section">
        <h1 className="hero-title">
          صياغة مستنداتك القانونية
          <br />
          بذكاء اصطناعي.
        </h1>

        <p className="hero-description">
          احصل على عقودك واتفاقياتك القانونية جاهزة في دقائق. تحدث مع المساعد
          الذكي، أجب عن بضعة أسئلة، وحمّل وثيقتك كملف PDF احترافي. كل ذلك في
          منصة واحدة.
        </p>

        <div className="hero-actions">
          <a href="/chat" className="btn-primary">
            استكشف الخدمات
          </a>
          <a href="#about" className="btn-secondary">
            اتصل بنا
          </a>
        </div>
      </section>

      {/* ==================== SERVICES ==================== */}
      <section className="services-section" id="services">
        <div className="services-header">
          <span className="services-label">خدماتنا</span>
          <h2 className="services-title">ماذا يمكنك إنشاؤه مع سند؟</h2>
          <p className="services-subtitle">
            قوالب قانونية جاهزة تُعبأ تلقائياً من خلال محادثة ذكية
          </p>
        </div>

        <div className="services-grid">
          <div className="service-card service-card-warm">
            <div className="service-card-icon">📋</div>
            <div className="service-card-dots">
              <span></span><span></span><span></span>
            </div>
            <h3 className="service-card-title">عقود العمل</h3>
            <p className="service-card-desc">
              صياغة عقود توظيف متكاملة تشمل الشروط والأحكام والرواتب والمزايا
              بشكل تلقائي.
            </p>
          </div>

          <div className="service-card service-card-cool">
            <div className="service-card-icon">🤝</div>
            <div className="service-card-dots">
              <span></span><span></span><span></span>
            </div>
            <h3 className="service-card-title">اتفاقيات الاستثمار</h3>
            <p className="service-card-desc">
              إعداد اتفاقيات استثمار تحدد حصص الشركاء والشروط المالية والتزامات
              كل طرف.
            </p>
          </div>

          <div className="service-card service-card-soft">
            <div className="service-card-icon">🔒</div>
            <div className="service-card-dots">
              <span></span><span></span><span></span>
            </div>
            <h3 className="service-card-title">اتفاقيات عدم الإفصاح</h3>
            <p className="service-card-desc">
              حماية معلوماتك السرية باتفاقيات NDA محكمة الصياغة ومخصصة
              لاحتياجاتك.
            </p>
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="steps-section" id="how-it-works">
        <div className="steps-container">
          <div className="steps-header">
            <span className="services-label">كيف يعمل؟</span>
            <h2 className="services-title">ثلاث خطوات فقط</h2>
            <p className="services-subtitle">
              من المحادثة إلى الوثيقة الجاهزة في دقائق معدودة
            </p>
          </div>

          <div className="steps-list">
            <div className="step-item">
              <div className="step-number">١</div>
              <div className="step-content">
                <h3>اختر نوع الوثيقة</h3>
                <p>
                  أخبر المساعد الذكي بنوع العقد أو الاتفاقية التي تحتاجها —
                  عقد عمل، اتفاقية استثمار، أو اتفاقية عدم إفصاح.
                </p>
              </div>
            </div>

            <div className="step-item">
              <div className="step-number">٢</div>
              <div className="step-content">
                <h3>أجب عن الأسئلة</h3>
                <p>
                  سيطرح عليك المساعد أسئلة بسيطة لجمع المعلومات اللازمة
                  كالأسماء والتواريخ والمبالغ والشروط.
                </p>
              </div>
            </div>

            <div className="step-item">
              <div className="step-number">٣</div>
              <div className="step-content">
                <h3>حمّل وثيقتك</h3>
                <p>
                  يُدمج النظام بياناتك في القالب القانوني المعتمد ويُصدر ملف
                  PDF احترافي جاهز للتحميل والتوقيع.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="cta-section">
        <div className="cta-box">
          <h2 className="cta-title">جاهز لتبسيط عملك القانوني؟</h2>
          <p className="cta-desc">
            ابدأ الآن واحصل على وثائقك القانونية في دقائق بدلاً من ساعات
          </p>
          <a href="/chat" className="btn-cta">
            ابدأ محادثتك الأولى ←
          </a>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} سند — جميع الحقوق محفوظة</p>
      </footer>
    </>
  );
}
