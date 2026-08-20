import { APP_VERSION, BUILD_DATE, BUILD_HASH, DISPLAY_VERSION } from "../utils/version";

export function About() {
  const currentYear = new Date().getFullYear();

  const TECH_STACK = [
    { name: "React 18", category: "UI Framework", desc: "Concurrent Rendering & Modern Component Architecture" },
    { name: "TypeScript 5.6", category: "Language", desc: "Strict End-to-End Type Safety & Shared Repositories" },
    { name: "Vite 5.4", category: "Build Tooling", desc: "Lightning-Fast ESM Bundling & Optimized Production Assets" },
    { name: "Vite PWA", category: "App Shell", desc: "Service Worker Caching & Offline App-Shell Readiness" },
    { name: "Cloud Firestore", category: "Database & Auth", desc: "Serverless NoSQL Storage & Google OAuth Security Rules" },
    { name: "Cloudflare Pages", category: "Edge Hosting", desc: "Zero-Cost Global CDN & Static Asset Deployment" },
  ];

  const KEY_FEATURES = [
    {
      title: "Real-Time Formulary & Tier Lookup",
      desc: "Instant typeahead search across thousands of medications and insurance plans with Tier 1–5 classification and copay estimates.",
      icon: "⚡",
    },
    {
      title: "Intelligent Covered Alternatives",
      desc: "Automatically surfaces lower-tier and covered therapeutic alternatives within the same drug class when a medication is high-cost or denied.",
      icon: "🔄",
    },
    {
      title: "Prior Auth & Step Therapy Visibility",
      desc: "Upfront warning flags for Prior Authorization (PA), Step Therapy (ST), and Quantity Limits (QL) before prescriptions reach the pharmacy.",
      icon: "🛡",
    },
    {
      title: "Zero-PHI Privacy by Design",
      desc: "Deliberately collects zero patient identifiers (no names, DOB, SSN, or MRN). Only stores drug and plan audit timestamps.",
      icon: "🔒",
    },
    {
      title: "Dual Data Ingestion Engine",
      desc: "Supports instantaneous manual entry via Admin UI as well as automated batch loading of official CMS Medicare & ACA Public Use Files.",
      icon: "📥",
    },
    {
      title: "Installable Progressive Web App",
      desc: "Install directly on iOS, Android, and Desktop with full-screen experience and instant offline app-shell access.",
      icon: "📱",
    },
  ];

  const TERMINOLOGY = [
    { term: "Formulary", def: "The official master list of medications subsidized and covered by a health insurance plan." },
    { term: "Tiers 1–5", def: "Cost rankings: Tier 1 (preferred generic, cheapest) to Tier 5 (specialty biologics, highest cost)." },
    { term: "Prior Auth (PA)", def: "Insurer mandate requiring physician medical records and clinical review before covering a medication." },
    { term: "Step Therapy (ST)", def: "'Fail first' protocol requiring trial of cheaper/older first-line medications before approving costlier treatments." },
    { term: "Copay vs. Coinsurance", def: "Fixed flat fee per refill ($15) vs. percentage of total retail cost (20% of $1,200)." },
    { term: "CMS PUF", def: "Centers for Medicare & Medicaid Services Public Use Files — open datasets for Medicare Advantage & Part D." },
  ];

  return (
    <div className="about-page">
      {/* Hero Header Card */}
      <div className="card about-hero">
        <div className="about-hero-badge-row">
          <span className="badge badge-primary">Official Release</span>
          <span className="badge badge-secondary">v{APP_VERSION} Stable</span>
          {BUILD_HASH && <span className="badge badge-hash">commit #{BUILD_HASH}</span>}
        </div>

        <div className="about-hero-content">
          <div className="about-hero-logo-box">
            <img src="/logo.svg" alt="MedCheck Logo" className="about-hero-logo" />
          </div>
          <div className="about-hero-text">
            <h1>MedCheck</h1>
            <p className="about-subtitle">Point-of-Care Medication Coverage & Formulary Intelligence</p>
            <p className="about-description">
              An installable, zero-backend Progressive Web App empowering physicians, medical assistants, and care
              coordinators to instantly check medication formulary tiers, prior authorization requirements, and covered
              alternatives under patient insurance plans.
            </p>
          </div>
        </div>

        <div className="about-stats-row">
          <div className="stat-card">
            <span className="stat-label">Version</span>
            <span className="stat-value font-mono">v{APP_VERSION}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Build / Commit</span>
            <span className="stat-value font-mono">{BUILD_HASH ? `#${BUILD_HASH}` : "Production"}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Build Date</span>
            <span className="stat-value font-mono">{BUILD_DATE}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Infrastructure</span>
            <span className="stat-value">100% Free Tiers</span>
          </div>
        </div>
      </div>

      {/* Developer & Credits Card */}
      <div className="card about-section">
        <h2>👥 Contributors & Development</h2>
        <div className="about-dev-grid">
          <div className="dev-card">
            <div className="dev-avatar-box">
              <span className="dev-avatar-text">LV</span>
            </div>
            <div className="dev-details">
              <h3>Ly Vuong</h3>
              <p className="dev-role">Creator & Lead Maintainer</p>
              <a
                href="https://github.com/lyvuong/MedCheck"
                target="_blank"
                rel="noopener noreferrer"
                className="link-button github-link"
              >
                GitHub Repository ↗
              </a>
            </div>
          </div>

          <div className="dev-card">
            <div className="dev-avatar-box ai-box">
              <span className="dev-avatar-text">AI</span>
            </div>
            <div className="dev-details">
              <h3>Antigravity</h3>
              <p className="dev-role">Google DeepMind — Technical AI Co-developer</p>
              <p className="dev-desc">Architecture, TypeScript algorithms, security rules, and PWA design pairing.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Capabilities */}
      <div className="card about-section">
        <h2>✨ Core Capabilities</h2>
        <div className="features-grid">
          {KEY_FEATURES.map((f, i) => (
            <div key={i} className="feature-item">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-info">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technology Stack */}
      <div className="card about-section">
        <h2>🛠 Technology Stack</h2>
        <div className="tech-grid">
          {TECH_STACK.map((t, i) => (
            <div key={i} className="tech-item">
              <div className="tech-header">
                <strong>{t.name}</strong>
                <span className="badge badge-small">{t.category}</span>
              </div>
              <p>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Terminology Guide */}
      <div className="card about-section">
        <h2>📚 Healthcare Terminology Quick Reference</h2>
        <div className="terminology-grid">
          {TERMINOLOGY.map((item, i) => (
            <div key={i} className="terminology-item">
              <strong>{item.term}</strong>
              <p>{item.def}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Disclaimer & Footer */}
      <div className="card about-disclaimer-card">
        <h3>⚖️ Clinical Decision-Support Notice</h3>
        <p className="disclaimer-text">
          MedCheck is designed as a workflow aid and reference tool. Formulary policies and patient cost-sharing amounts
          are subject to mid-year plan amendments, employer carve-outs, and pharmacy benefit manager exclusions. This
          tool does not constitute medical advice or a formal insurer pre-determination of benefits.
        </p>
        <div className="about-footer-text">
          <span>MedCheck PWA • {DISPLAY_VERSION}</span>
          <span>© {currentYear} Ly Vuong. Open source under the MIT License.</span>
        </div>
      </div>
    </div>
  );
}
