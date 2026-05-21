import { useState, useEffect } from "react";

const STEPS = [
  { id: "lead", label: "1. Lead Input", icon: "📍" },
  { id: "scrape", label: "2. Firecrawl Scrape", icon: "🕷️" },
  { id: "audit", label: "3. Claude Audit", icon: "🤖" },
  { id: "sheet", label: "4. Google Sheets", icon: "📊" },
  { id: "email", label: "5. Gmail Outreach", icon: "✉️" },
];

const FIRECRAWL_KEY = ""; // fc-4f66c49a02db4d83beed097ce509752d
const ANTHROPIC_KEY = ""; // handled by artifact proxy

const AUDIT_SYSTEM_PROMPT = `You are a premium hospitality website audit expert. You analyze restaurant and hotel websites and produce detailed, actionable audit reports.

When given website content, analyze it for:
1. DESIGN QUALITY: layout, typography, visual hierarchy, luxury feel, image quality
2. UX ISSUES: navigation, mobile experience, reservation flow, CTAs
3. CONVERSION PROBLEMS: hero section, trust signals, emotional storytelling
4. SEO GAPS: H1/H2 structure, metadata, local SEO, schema
5. MISSING HOSPITALITY FEATURES: events page, wedding section, menu experience, gallery

Return ONLY valid JSON in this exact structure:
{
  "businessName": "string",
  "overallScore": number (1-10),
  "summary": "2 sentence verdict",
  "issues": [
    { "category": "Design|UX|Conversion|SEO|Features", "severity": "high|medium|low", "problem": "string", "fix": "string" }
  ],
  "redesignHighlights": ["string", "string", "string"],
  "emailSubject": "string",
  "emailBody": "string (personalized cold email, 4-5 sentences, professional, mention 2 specific issues found)"
}`;

export default function App() {
  const [step, setStep] = useState("lead");
  const [url, setUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [scraped, setScraped] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [sheetAdded, setSheetAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  const activeIdx = STEPS.findIndex((s) => s.id === step);

  async function handleScrape() {
    if (!url) return setError("Enter a website URL first.");
    if (!firecrawlKey) return setError("Enter your Firecrawl API key in ⚙️ Config.");
    setError("");
    setLoading(true);
    setLoadingMsg("Crawling website with Firecrawl...");
    setStep("scrape");

    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Scrape failed");
      setScraped(data.data?.markdown || data.data?.content || "");
      setStep("audit");
      await runAudit(data.data?.markdown || data.data?.content || "");
    } catch (e) {
      setError("Firecrawl error: " + e.message);
      setStep("lead");
    } finally {
      setLoading(false);
    }
  }

  async function runAudit(content) {
    setLoading(true);
    setLoadingMsg("Claude is analyzing the website...");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: AUDIT_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Website URL: ${url}\nBusiness Name (if known): ${businessName || "Unknown"}\n\nWebsite Content:\n${content.slice(0, 6000)}`,
            },
          ],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAudit(parsed);
      if (parsed.businessName && !businessName) setBusinessName(parsed.businessName);
      setStep("sheet");
    } catch (e) {
      setError("Audit error: " + e.message);
      setStep("lead");
    } finally {
      setLoading(false);
    }
  }

  function handleSheetConfirm() {
    setSheetAdded(true);
    setStep("email");
  }

  function copyEmail() {
    if (!audit) return;
    navigator.clipboard.writeText(`Subject: ${audit.emailSubject}\n\n${audit.emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setStep("lead");
    setUrl("");
    setBusinessName("");
    setScraped(null);
    setAudit(null);
    setSheetAdded(false);
    setError("");
  }

  const severityColor = (s) =>
    s === "high" ? "#ff4d4d" : s === "medium" ? "#f5a623" : "#4db8ff";

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#0a0a0a", minHeight: "100vh", color: "#e8e4dc", padding: "0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        input, textarea { font-family: inherit !important; }
        .btn { cursor: pointer; border: none; font-family: 'DM Mono', monospace; transition: all 0.2s; }
        .btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .issue-card:hover { border-color: #333 !important; background: #111 !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", letterSpacing: "0.02em", color: "#c8b99a" }}>
            LUXE<span style={{ color: "#fff" }}>AUDIT</span>
          </div>
          <div style={{ fontSize: "10px", color: "#444", letterSpacing: "0.15em", marginTop: "2px" }}>AI HOSPITALITY PIPELINE</div>
        </div>
        <button className="btn" onClick={() => setShowConfig(!showConfig)}
          style={{ background: "none", color: "#555", fontSize: "18px", padding: "4px 8px" }}>⚙️</button>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="fade-in" style={{ background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", padding: "16px 24px" }}>
          <div style={{ fontSize: "11px", color: "#666", letterSpacing: "0.1em", marginBottom: "10px" }}>CONFIGURATION</div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "4px" }}>FIRECRAWL API KEY (free at firecrawl.dev)</div>
              <input value={firecrawlKey} onChange={e => setFirecrawlKey(e.target.value)}
                placeholder="fc-xxxxxxxxxxxxxxxx"
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #222", borderRadius: "4px", padding: "8px 12px", color: "#e8e4dc", fontSize: "12px" }} />
            </div>
            <div style={{ fontSize: "11px", color: "#444", marginTop: "14px" }}>Claude API: handled ✅</div>
          </div>
        </div>
      )}

      {/* Pipeline Steps */}
      <div style={{ display: "flex", padding: "16px 24px", gap: "0", overflowX: "auto", borderBottom: "1px solid #111" }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              padding: "6px 14px", borderRadius: "4px", fontSize: "11px", letterSpacing: "0.08em", whiteSpace: "nowrap",
              background: i < activeIdx ? "#1a1a1a" : i === activeIdx ? "#1c1810" : "transparent",
              color: i < activeIdx ? "#4caf50" : i === activeIdx ? "#c8b99a" : "#333",
              border: i === activeIdx ? "1px solid #2a2418" : "1px solid transparent",
            }}>
              {i < activeIdx ? "✓ " : s.icon + " "}{s.label}
            </div>
            {i < STEPS.length - 1 && <div style={{ color: "#222", padding: "0 4px", fontSize: "12px" }}>→</div>}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Error */}
        {error && (
          <div className="fade-in" style={{ background: "#1a0a0a", border: "1px solid #3a1515", borderRadius: "6px", padding: "12px 16px", marginBottom: "24px", color: "#ff6b6b", fontSize: "13px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="fade-in" style={{ textAlign: "center", padding: "48px 0" }}>
            <div className="pulse" style={{ fontSize: "32px", marginBottom: "16px" }}>⟳</div>
            <div style={{ color: "#666", fontSize: "13px", letterSpacing: "0.1em" }}>{loadingMsg}</div>
          </div>
        )}

        {/* STEP 1 — LEAD INPUT */}
        {step === "lead" && !loading && (
          <div className="fade-in">
            <div style={{ marginBottom: "32px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", marginBottom: "8px" }}>Start a New Audit</div>
              <div style={{ color: "#555", fontSize: "13px" }}>Find a restaurant or hotel on Google Maps, grab their website URL, paste it below.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.12em", marginBottom: "6px" }}>BUSINESS NAME (optional)</div>
                <input value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. The Grand Rooftop Bar"
                  style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: "6px", padding: "12px 16px", color: "#e8e4dc", fontSize: "14px" }} />
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.12em", marginBottom: "6px" }}>WEBSITE URL *</div>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://restaurant.com"
                  style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: "6px", padding: "12px 16px", color: "#e8e4dc", fontSize: "14px" }} />
              </div>

              <button className="btn" onClick={handleScrape}
                style={{ background: "#c8b99a", color: "#0a0a0a", padding: "14px", borderRadius: "6px", fontSize: "13px", fontWeight: "500", letterSpacing: "0.1em", marginTop: "8px" }}>
                RUN FULL PIPELINE →
              </button>
            </div>

            {/* Setup guide */}
            <div style={{ marginTop: "40px", borderTop: "1px solid #111", paddingTop: "28px" }}>
              <div style={{ fontSize: "10px", color: "#444", letterSpacing: "0.12em", marginBottom: "16px" }}>PIPELINE SETUP GUIDE</div>
              {[
                { step: "01", title: "Google Maps", desc: "Search 'rooftop bar [city]' → pick businesses with weak websites (4.2-4.6 stars, outdated look)", free: true },
                { step: "02", title: "Firecrawl Free Tier", desc: "Sign up at firecrawl.dev → get free API key → paste in ⚙️ Config above (500 pages free)", free: true },
                { step: "03", title: "Claude Audit (this app)", desc: "Automatic — Claude API runs inside this artifact at no extra cost to you", free: true },
                { step: "04", title: "Google Sheets CRM", desc: "Copy audit results → paste into your lead tracker sheet (template below)", free: true },
                { step: "05", title: "Gmail Outreach", desc: "Copy the generated email → send from Gmail with one click", free: true },
              ].map(item => (
                <div key={item.step} style={{ display: "flex", gap: "16px", marginBottom: "14px", padding: "14px", background: "#0d0d0d", borderRadius: "6px", border: "1px solid #111" }}>
                  <div style={{ fontSize: "10px", color: "#333", minWidth: "24px", paddingTop: "2px" }}>{item.step}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", color: "#c8b99a", marginBottom: "3px" }}>{item.title} {item.free && <span style={{ fontSize: "9px", color: "#4caf50", border: "1px solid #1a3a1a", borderRadius: "3px", padding: "1px 5px", marginLeft: "6px" }}>FREE</span>}</div>
                    <div style={{ fontSize: "12px", color: "#555" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 — AUDIT RESULTS */}
        {step === "sheet" && audit && !loading && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", marginBottom: "4px" }}>{audit.businessName || businessName}</div>
                <div style={{ color: "#555", fontSize: "12px" }}>{url}</div>
              </div>
              <div style={{ textAlign: "center", background: "#111", borderRadius: "8px", padding: "12px 20px", border: "1px solid #1a1a1a" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "36px", color: audit.overallScore <= 4 ? "#ff4d4d" : audit.overallScore <= 7 ? "#f5a623" : "#4caf50" }}>
                  {audit.overallScore}
                </div>
                <div style={{ fontSize: "9px", color: "#444", letterSpacing: "0.1em" }}>/ 10 SCORE</div>
              </div>
            </div>

            <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "16px", marginBottom: "24px", color: "#999", fontSize: "13px", lineHeight: "1.6" }}>
              {audit.summary}
            </div>

            {/* Issues */}
            <div style={{ fontSize: "10px", color: "#444", letterSpacing: "0.12em", marginBottom: "12px" }}>AUDIT FINDINGS ({audit.issues?.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
              {audit.issues?.map((issue, i) => (
                <div key={i} className="issue-card" style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "14px 16px", transition: "all 0.2s" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: severityColor(issue.severity), marginTop: "5px", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "9px", color: "#444", border: "1px solid #222", borderRadius: "3px", padding: "1px 6px" }}>{issue.category}</span>
                        <span style={{ fontSize: "9px", color: severityColor(issue.severity) }}>{issue.severity.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "#ccc", marginBottom: "4px" }}>{issue.problem}</div>
                      <div style={{ fontSize: "12px", color: "#555" }}>→ {issue.fix}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Redesign highlights */}
            <div style={{ fontSize: "10px", color: "#444", letterSpacing: "0.12em", marginBottom: "12px" }}>REDESIGN RECOMMENDATIONS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "32px" }}>
              {audit.redesignHighlights?.map((h, i) => (
                <div key={i} style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "12px 14px", fontSize: "12px", color: "#c8b99a" }}>
                  ✦ {h}
                </div>
              ))}
            </div>

            {/* Google Sheets CRM data */}
            <div style={{ fontSize: "10px", color: "#444", letterSpacing: "0.12em", marginBottom: "12px" }}>COPY TO GOOGLE SHEETS CRM</div>
            <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "16px", marginBottom: "24px", fontFamily: "monospace", fontSize: "11px", color: "#555", overflowX: "auto" }}>
              <div style={{ color: "#333", marginBottom: "6px" }}># Paste this row into your Google Sheet</div>
              <div style={{ color: "#888", whiteSpace: "nowrap" }}>
                {[
                  audit.businessName || businessName,
                  url,
                  audit.overallScore + "/10",
                  audit.issues?.filter(i => i.severity === "high").length + " high issues",
                  new Date().toLocaleDateString(),
                  "Pending outreach"
                ].join(" | ")}
              </div>
            </div>

            <button className="btn" onClick={handleSheetConfirm}
              style={{ width: "100%", background: "#c8b99a", color: "#0a0a0a", padding: "14px", borderRadius: "6px", fontSize: "13px", fontWeight: "500", letterSpacing: "0.1em" }}>
              ADDED TO SHEET — GENERATE EMAIL →
            </button>
          </div>
        )}

        {/* STEP 5 — EMAIL */}
        {step === "email" && audit && !loading && (
          <div className="fade-in">
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", marginBottom: "8px" }}>Outreach Email</div>
            <div style={{ color: "#555", fontSize: "13px", marginBottom: "28px" }}>Personalized email generated by Claude — ready to send via Gmail.</div>

            <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", overflow: "hidden", marginBottom: "20px" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #111", display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ fontSize: "10px", color: "#444", letterSpacing: "0.1em", minWidth: "50px" }}>SUBJECT</div>
                <div style={{ fontSize: "13px", color: "#c8b99a" }}>{audit.emailSubject}</div>
              </div>
              <div style={{ padding: "18px", fontSize: "13px", color: "#888", lineHeight: "1.8", whiteSpace: "pre-wrap" }}>
                {audit.emailBody}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button className="btn" onClick={copyEmail}
                style={{ flex: 1, background: copied ? "#1a3a1a" : "#c8b99a", color: copied ? "#4caf50" : "#0a0a0a", padding: "14px", borderRadius: "6px", fontSize: "13px", fontWeight: "500", letterSpacing: "0.1em" }}>
                {copied ? "✓ COPIED TO CLIPBOARD" : "COPY EMAIL"}
              </button>
              <a href={`mailto:?subject=${encodeURIComponent(audit.emailSubject)}&body=${encodeURICompo
