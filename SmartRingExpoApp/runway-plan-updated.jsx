import { useState } from "react";

// ─── ACTUAL COST DATA ────────────────────────────────────────────────────────
// Founder-built solo. Only $1,000 cash out (device testing).
// Sweat equity valued at $100/hr market rate for senior iOS + fullstack dev.
const SWEAT_RATE = 100; // $/hr
const SWEAT_HOURS_PER_MONTH = 140; // ~35 hrs/wk
const SWEAT_VALUE_PER_MONTH = SWEAT_RATE * SWEAT_HOURS_PER_MONTH; // $14,000

const phases = [
  {
    id: 1,
    month: "Month 1",
    calendarMonth: "Oct 2025",
    label: "Foundation Sprint",
    color: "#E8FF47",
    textColor: "#0a0a0a",
    status: "complete",
    focus: "Architecture, BLE foundation, design system, auth flow",
    plannedBurn: 7300,
    actualCash: 0,
    sweatHours: 140,
    teamFocus: { founder: "BLE architecture, Supabase schema, auth, onboarding flow" },
    achievements: [
      "X3/Jstyle SDK integrated via native bridge (JstyleBridge.m)",
      "Supabase backend schema — all health tables, auth, profiles",
      "Expo Router navigation, dark design system, color tokens",
      "Email auth + onboarding BLE pairing flow",
      "Background BLE reconnection with 6s repeating timer",
    ],
    kpis: ["BLE pairing working ✓", "Auth + profile creation ✓", "All health tables in Supabase ✓", "Native bridge with timeout protection ✓"],
    note: "Foundation was rock-solid — native-side timeout recovery, BUSY guard, and serialized queue built in from day one.",
  },
  {
    id: 2,
    month: "Month 2",
    calendarMonth: "Nov 2025",
    label: "Build Hard",
    color: "#FF6B35",
    textColor: "#fff",
    status: "complete",
    focus: "All core health metrics, data pipeline, Supabase sync",
    plannedBurn: 7300,
    actualCash: 0,
    sweatHours: 140,
    teamFocus: { founder: "Health metrics, sync architecture, ring data pipeline" },
    achievements: [
      "Sleep, HR, HRV, SpO₂, temp, steps, battery — all fetched & displayed",
      "DataSyncService: ring → Supabase upsert for all metrics",
      "Background fetch task (15-min sync interval)",
      "Sleep hypnogram chart with stage breakdown",
      "Native bridge busy-guard & serialized native call queue",
    ],
    kpis: ["All health metrics displaying ✓", "Supabase sync working ✓", "Background fetch registered ✓", "Sleep hypnogram rendering ✓"],
    note: "Built the complete data pipeline in one sprint — ring → native bridge → JstyleService → useHomeData → UI.",
  },
  {
    id: 3,
    month: "Month 3",
    calendarMonth: "Dec 2025 – Jan 2026",
    label: "Features & Polish",
    color: "#00C2A0",
    textColor: "#fff",
    status: "complete",
    focus: "Strava, Apple Health, Coach tab, detail screens",
    plannedBurn: 7300,
    actualCash: 1000,
    sweatHours: 140,
    teamFocus: { founder: "Strava OAuth, HealthKit, Focus/Coach screen, all detail views" },
    achievements: [
      "Strava OAuth + activity import (60-day window, zone data)",
      "Apple Health read/write via @kingstinct/react-native-healthkit",
      "Focus/Readiness screen: score ring, ReadinessCard, IllnessWatchCard",
      "All 8 detail screens (sleep, HR, HRV, SpO₂, temp, activity, recovery, sleep debt)",
      "$1,000 device testing costs (physical ring hardware)",
    ],
    kpis: ["Strava integrated ✓", "Apple Health integrated ✓", "Coach tab built ✓", "All detail screens done ✓"],
    note: "$1,000 device testing = only cash spent in entire project. Purchased physical X3 rings for development.",
  },
  {
    id: 4,
    month: "Month 4",
    calendarMonth: "Feb – Mar 2026",
    label: "Harden & AI",
    color: "#7C6FFF",
    textColor: "#fff",
    status: "complete",
    focus: "AI Coach, i18n, design polish, stability sprint",
    plannedBurn: 7300,
    actualCash: 0,
    sweatHours: 140,
    teamFocus: { founder: "Claude-powered Coach, i18n EN+ES, full UI redesign, sync stability" },
    achievements: [
      "Real Claude AI Coach via Supabase Edge Function (claude-haiku-4-5)",
      "Full i18n — English + Spanish across all screens",
      "Coach chat redesign (Figma-matched cinematic gradient UI)",
      "Sleep debt tracking + baseline tier system",
      "Nap detection & classification",
      "Sync Status bottom sheet + SyncProgressState",
      "Training Insights card with HR zone visualization",
    ],
    kpis: ["AI Coach live ✓", "EN + ES translations ✓", "Sleep debt feature ✓", "Nap detection ✓", "Training insights ✓"],
    note: "Sentry error tracking, OTA deployments via EAS, and Claude-powered health coaching — feature set exceeds original plan.",
  },
  {
    id: 5,
    month: "Month 5",
    calendarMonth: "Mar – Apr 2026",
    label: "Pre-Launch",
    color: "#FF3D71",
    textColor: "#fff",
    status: "in-progress",
    focus: "TestFlight live, App Store prep, monetization next",
    plannedBurn: 7300,
    actualCash: 0,
    sweatHours: 100,
    teamFocus: { founder: "TestFlight build, App Store assets, final QA, monetization setup" },
    achievements: [
      "v1.0.18 (build 19) live on TestFlight ✓",
      "EAS build pipeline (dev / preview / production channels) ✓",
      "Sentry error tracking in production ✓",
      "Coach chat auto-send from any tab ✓",
      "Ask Coach bar as real input on all tabs ✓",
    ],
    pending: [
      "RevenueCat + paywall UI",
      "Strip ~100 console.log calls",
      "Remove Google OAuth stub or complete it",
      "App Store listing (screenshots, description)",
      "Final App Store submission",
    ],
    kpis: ["TestFlight live ✓", "EAS pipeline ✓", "RevenueCat — pending", "App Store submission — pending"],
    note: "App is functionally complete and in testers' hands. Monetization integration is the critical remaining piece.",
  },
  {
    id: 6,
    month: "Month 6",
    calendarMonth: "Apr – May 2026",
    label: "LAUNCH",
    color: "#E8FF47",
    textColor: "#0a0a0a",
    status: "upcoming",
    focus: "App Store live, first paying users, team hire begins",
    plannedBurn: 7300,
    actualCash: null,
    sweatHours: null,
    teamFocus: { founder: "Launch execution, first hires, community, press" },
    achievements: [],
    pending: [
      "App Store submission & approval",
      "RevenueCat paywall live",
      "ProductHunt launch",
      "iOS Engineer hire (Month 6 or 7)",
      "First 100 paying users → $700+ MRR target",
    ],
    kpis: ["App Store live", "100 paying users", "$700+ MRR", "iOS hire in process"],
    note: "This is where team costs begin. First hire (iOS engineer) planned for this month or month 7.",
  },
];

const totalCashSpent = phases.filter(p => p.status !== "upcoming").reduce((s, p) => s + (p.actualCash || 0), 0);
const totalSweatHours = phases.filter(p => p.status !== "upcoming").reduce((s, p) => s + (p.sweatHours || 0), 0);
const totalSweatValue = totalSweatHours * SWEAT_RATE;
const monthsComplete = phases.filter(p => p.status === "complete").length;

const STATUS_CONFIG = {
  complete: { label: "COMPLETE", color: "#00C2A0", bg: "rgba(0,194,160,0.12)" },
  "in-progress": { label: "IN PROGRESS", color: "#E8FF47", bg: "rgba(232,255,71,0.10)" },
  upcoming: { label: "UPCOMING", color: "#555", bg: "rgba(80,80,80,0.10)" },
};

export default function RunwayPlanUpdated() {
  const [active, setActive] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const phase = phases[active];
  const sc = STATUS_CONFIG[phase.status];

  return (
    <div style={{ minHeight: "100vh", background: "#070707", color: "#e8e8e8", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "28px 32px 0", borderBottom: "1px solid #141414" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#444", textTransform: "uppercase", marginBottom: "6px" }}>Focus App · Solo Founder · Oct 2025 – Present</div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "2px", margin: 0, lineHeight: 1, color: "#fff" }}>
              6-MONTH RUNWAY —<br />
              <span style={{ color: "#E8FF47" }}>ACTUAL VS PLAN</span>
            </h1>
          </div>
          {/* Key numbers */}
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: "#444", letterSpacing: "2px", marginBottom: "2px" }}>CASH SPENT</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px", color: "#00C2A0", letterSpacing: "1px" }}>$1,000</div>
              <div style={{ fontSize: "9px", color: "#444", letterSpacing: "1px" }}>device testing only</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: "#444", letterSpacing: "2px", marginBottom: "2px" }}>SWEAT EQUITY</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px", color: "#7C6FFF", letterSpacing: "1px" }}>${(totalSweatValue / 1000).toFixed(0)}k</div>
              <div style={{ fontSize: "9px", color: "#444", letterSpacing: "1px" }}>{totalSweatHours}h @ $100/hr mkt rate</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: "#444", letterSpacing: "2px", marginBottom: "2px" }}>PLANNED BURN</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px", color: "#FF6B35", letterSpacing: "1px", textDecoration: "line-through", opacity: 0.5 }}>$43,800</div>
              <div style={{ fontSize: "9px", color: "#444", letterSpacing: "1px" }}>if team-built ($7,300 × 6)</div>
            </div>
          </div>
        </div>

        {/* Phase tabs */}
        <div style={{ display: "flex", gap: "2px", overflowX: "auto", paddingBottom: "0" }}>
          {phases.map((p, i) => {
            const s = STATUS_CONFIG[p.status];
            return (
              <button key={i} onClick={() => { setActive(i); setShowSummary(false); }}
                style={{ padding: "10px 14px", background: active === i ? p.color : "transparent", color: active === i ? p.textColor : p.status === "upcoming" ? "#333" : "#666", border: "none", cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", fontSize: "12px", letterSpacing: "1.5px", borderRadius: "4px 4px 0 0", transition: "all 0.2s", whiteSpace: "nowrap", position: "relative" }}>
                M{i + 1} · {p.label.split(" ")[0].toUpperCase()}
                {active !== i && p.status !== "upcoming" && (
                  <span style={{ display: "block", width: "5px", height: "5px", borderRadius: "50%", background: s.color, position: "absolute", top: "6px", right: "6px" }} />
                )}
              </button>
            );
          })}
          <button onClick={() => setShowSummary(!showSummary)}
            style={{ padding: "10px 14px", background: showSummary ? "#E8FF47" : "transparent", color: showSummary ? "#0a0a0a" : "#444", border: "none", cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", fontSize: "12px", letterSpacing: "1.5px", borderRadius: "4px 4px 0 0", transition: "all 0.2s", marginLeft: "8px", borderLeft: "1px solid #1a1a1a" }}>
            📊 INVESTOR VIEW
          </button>
        </div>
      </div>

      {showSummary ? (
        /* ── INVESTOR SUMMARY VIEW ── */
        <div style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "22px", letterSpacing: "2px", margin: "0 0 4px", color: "#fff" }}>CAPITAL EFFICIENCY SUMMARY</h2>
            <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>6 months of product development — solo founder, production-ready iOS app on TestFlight.</p>
          </div>

          {/* Big stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "28px" }}>
            {[
              { label: "Cash Invested", value: "$1,000", sub: "device testing", color: "#00C2A0" },
              { label: "Sweat Equity Value", value: `$${(totalSweatValue/1000).toFixed(0)}k`, sub: `${totalSweatHours} founder hours`, color: "#7C6FFF" },
              { label: "Team Cost Avoided", value: "$42,800", sub: "vs $7,300/mo team plan", color: "#E8FF47" },
              { label: "Months to TestFlight", value: "5 months", sub: "v1.0.18 build 19 live", color: "#FF6B35" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#0d0d0d", border: `1px solid ${s.color}22`, borderTop: `3px solid ${s.color}`, borderRadius: "8px", padding: "18px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "2px", color: s.color, marginBottom: "6px" }}>{s.label.toUpperCase()}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px", color: "#fff", letterSpacing: "1px" }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Phase progress table */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#444", marginBottom: "16px" }}>PHASE-BY-PHASE COST BREAKDOWN</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 90px 90px 100px 110px", gap: "0", fontSize: "11px" }}>
              {/* Header */}
              {["", "Phase", "Calendar", "Cash Out", "Hours", "Mkt Value"].map((h, i) => (
                <div key={i} style={{ color: "#444", paddingBottom: "8px", borderBottom: "1px solid #1a1a1a", letterSpacing: "1px", fontSize: "10px", paddingRight: "12px" }}>{h}</div>
              ))}
              {/* Rows */}
              {phases.map((p, i) => {
                const s = STATUS_CONFIG[p.status];
                const sweatVal = p.sweatHours ? p.sweatHours * SWEAT_RATE : null;
                return [
                  <div key={`${i}-dot`} style={{ paddingTop: "12px", paddingBottom: "12px", borderBottom: "1px solid #111", paddingRight: "12px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: p.status === "upcoming" ? "#333" : s.color, marginTop: "1px" }} />
                  </div>,
                  <div key={`${i}-name`} style={{ paddingTop: "12px", paddingBottom: "12px", borderBottom: "1px solid #111", paddingRight: "12px" }}>
                    <div style={{ color: p.status === "upcoming" ? "#444" : "#ccc", fontWeight: 500 }}>M{p.id}: {p.label}</div>
                    <div style={{ color: "#444", fontSize: "10px", marginTop: "2px" }}>{p.focus.substring(0, 45)}…</div>
                  </div>,
                  <div key={`${i}-cal`} style={{ paddingTop: "12px", paddingBottom: "12px", borderBottom: "1px solid #111", color: "#555", paddingRight: "12px", fontSize: "10px" }}>{p.calendarMonth}</div>,
                  <div key={`${i}-cash`} style={{ paddingTop: "12px", paddingBottom: "12px", borderBottom: "1px solid #111", paddingRight: "12px" }}>
                    {p.status === "upcoming"
                      ? <span style={{ color: "#333" }}>—</span>
                      : <span style={{ color: p.actualCash > 0 ? "#FF6B35" : "#00C2A0", fontFamily: "monospace" }}>{p.actualCash > 0 ? `$${p.actualCash.toLocaleString()}` : "$0"}</span>}
                  </div>,
                  <div key={`${i}-hrs`} style={{ paddingTop: "12px", paddingBottom: "12px", borderBottom: "1px solid #111", paddingRight: "12px" }}>
                    {p.sweatHours ? <span style={{ color: "#7C6FFF", fontFamily: "monospace" }}>{p.sweatHours}h</span> : <span style={{ color: "#333" }}>—</span>}
                  </div>,
                  <div key={`${i}-val`} style={{ paddingTop: "12px", paddingBottom: "12px", borderBottom: "1px solid #111" }}>
                    {sweatVal ? <span style={{ color: "#7C6FFF", fontFamily: "monospace" }}>${sweatVal.toLocaleString()}</span> : <span style={{ color: "#333" }}>—</span>}
                  </div>,
                ];
              })}
              {/* Totals */}
              <div style={{ paddingTop: "12px", gridColumn: "1/3" }}>
                <span style={{ color: "#888", fontWeight: 600 }}>TOTAL (months 1–5)</span>
              </div>
              <div style={{ paddingTop: "12px", color: "#555", fontSize: "10px" }}>Oct '25–Apr '26</div>
              <div style={{ paddingTop: "12px" }}>
                <span style={{ color: "#FF6B35", fontFamily: "monospace", fontWeight: 700 }}>${totalCashSpent.toLocaleString()}</span>
              </div>
              <div style={{ paddingTop: "12px" }}>
                <span style={{ color: "#7C6FFF", fontFamily: "monospace", fontWeight: 700 }}>{totalSweatHours}h</span>
              </div>
              <div style={{ paddingTop: "12px" }}>
                <span style={{ color: "#E8FF47", fontFamily: "monospace", fontWeight: 700 }}>${totalSweatValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* What was built */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <div style={{ padding: "16px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderLeft: "3px solid #00C2A0", borderRadius: "8px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#00C2A0", marginBottom: "8px" }}>✅ WHAT'S BUILT</div>
              {["BLE smart ring (X3) full integration", "All health metrics: sleep, HR, HRV, SpO₂, temp, steps", "AI Coach powered by Claude + Supabase edge", "Strava + Apple Health integrations", "EN + ES internationalization", "TestFlight live (v1.0.18, build 19)"].map((item, i) => (
                <div key={i} style={{ fontSize: "11px", color: "#666", lineHeight: 1.7 }}>· {item}</div>
              ))}
            </div>
            <div style={{ padding: "16px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderLeft: "3px solid #FF3D71", borderRadius: "8px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#FF3D71", marginBottom: "8px" }}>🔜 STILL TO DO</div>
              {["RevenueCat paywall + subscription", "App Store listing + screenshots", "Final App Store submission", "Strip debug console.logs", "iOS engineer hire (post-revenue)"].map((item, i) => (
                <div key={i} style={{ fontSize: "11px", color: "#666", lineHeight: 1.7 }}>· {item}</div>
              ))}
            </div>
            <div style={{ padding: "16px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderLeft: "3px solid #E8FF47", borderRadius: "8px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#E8FF47", marginBottom: "8px" }}>💡 INVESTOR SIGNAL</div>
              <div style={{ fontSize: "11px", color: "#666", lineHeight: 1.75 }}>A team following the original runway plan would have spent <strong style={{ color: "#fff" }}>$43,800</strong> to reach this point. Founder-built in 5 months at <strong style={{ color: "#fff" }}>$1,000 cash</strong> — demonstrating extreme capital efficiency and technical depth before the first hire.</div>
            </div>
          </div>

          {/* Sweat equity note */}
          <div style={{ padding: "14px 18px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", fontSize: "11px", color: "#555", lineHeight: 1.75 }}>
            <span style={{ color: "#7C6FFF", fontWeight: 600 }}>Sweat equity methodology:</span> {totalSweatHours} founder hours × $100/hr (conservative LATAM senior iOS + fullstack rate) = <span style={{ color: "#7C6FFF" }}>${totalSweatValue.toLocaleString()}</span> in equivalent market labor. US market rate ($150–180/hr) would value this at ${(totalSweatHours * 165 / 1000).toFixed(0)}k–${(totalSweatHours * 180 / 1000).toFixed(0)}k.
          </div>
        </div>
      ) : (
        /* ── PHASE DETAIL VIEW ── */
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", overflow: "hidden" }}>
          {/* Left */}
          <div style={{ padding: "28px 32px", overflowY: "auto" }}>
            {/* Phase header */}
            <div style={{ marginBottom: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: phase.color }} />
                <span style={{ fontSize: "10px", letterSpacing: "3px", color: phase.color, textTransform: "uppercase" }}>{phase.month} · {phase.calendarMonth}</span>
                <span style={{ fontSize: "10px", letterSpacing: "2px", color: sc.color, background: sc.bg, padding: "2px 8px", borderRadius: "4px" }}>{sc.label}</span>
              </div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "26px", margin: "0 0 4px", letterSpacing: "1px", color: "#fff" }}>{phase.label}</h2>
              <p style={{ fontSize: "13px", color: "#666", margin: "0 0 14px", lineHeight: 1.5 }}>{phase.focus}</p>

              {/* Team strip */}
              {Object.entries(phase.teamFocus).map(([key, val]) => (
                <div key={key} style={{ padding: "6px 10px", background: "#0d0d0d", border: "1px solid rgba(232,255,71,0.2)", borderRadius: "6px", display: "inline-flex", gap: "6px", alignItems: "center" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#E8FF47" }} />
                  <span style={{ fontSize: "10px", color: "#E8FF47", fontWeight: 600 }}>Founder:</span>
                  <span style={{ fontSize: "10px", color: "#666" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Achievements (complete/in-progress) */}
            {phase.achievements.length > 0 && (
              <>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "8px" }}>
                  {phase.status === "complete" ? "✅ Shipped" : "✅ Shipped So Far"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "16px" }}>
                  {phase.achievements.map((item, i) => (
                    <div key={i} style={{ background: "#0c0c0c", border: "1px solid #1a1a1a", borderLeft: `3px solid ${phase.color}55`, borderRadius: "6px", padding: "10px 14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ color: phase.color, fontSize: "12px", marginTop: "1px", flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: "12px", color: "#aaa", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pending items */}
            {phase.pending && phase.pending.length > 0 && (
              <>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "8px" }}>
                  {phase.status === "upcoming" ? "🔜 Planned" : "🔜 Remaining"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "16px" }}>
                  {phase.pending.map((item, i) => (
                    <div key={i} style={{ background: "#0a0a0a", border: "1px solid #161616", borderLeft: "3px solid #333", borderRadius: "6px", padding: "10px 14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ color: "#444", fontSize: "12px", marginTop: "1px", flexShrink: 0 }}>○</span>
                      <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Note */}
            <div style={{ padding: "13px 15px", background: "#0c0c0c", border: "1px solid #1a1a1a", borderLeft: `3px solid ${phase.color}55`, borderRadius: "8px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: phase.color, marginBottom: "5px" }}>💡 NOTE</div>
              <div style={{ fontSize: "12px", color: "#777", lineHeight: 1.65 }}>{phase.note}</div>
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ borderLeft: "1px solid #111", padding: "28px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Actual cost */}
            <div>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "10px" }}>Actual Cost</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d0d0d", borderRadius: "6px", border: "1px solid #161616" }}>
                  <span style={{ fontSize: "11px", color: "#555" }}>Cash out</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: phase.actualCash > 0 ? "#FF6B35" : "#00C2A0" }}>
                    {phase.status === "upcoming" ? "TBD" : phase.actualCash > 0 ? `$${phase.actualCash.toLocaleString()}` : "$0"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d0d0d", borderRadius: "6px", border: "1px solid #161616" }}>
                  <span style={{ fontSize: "11px", color: "#555" }}>Founder hours</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#7C6FFF" }}>
                    {phase.sweatHours ? `${phase.sweatHours}h` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0d0d0d", borderRadius: "6px", border: "1px solid #161616" }}>
                  <span style={{ fontSize: "11px", color: "#555" }}>Mkt equiv.</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#7C6FFF" }}>
                    {phase.sweatHours ? `$${(phase.sweatHours * SWEAT_RATE).toLocaleString()}` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#111", borderRadius: "6px", border: "1px solid #1e1e1e" }}>
                  <span style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Planned burn</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#444", textDecoration: "line-through" }}>$7,300</span>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "10px" }}>KPIs</div>
              {phase.kpis.map((kpi, i) => {
                const done = kpi.includes("✓");
                return (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: done ? `${phase.color}22` : "transparent", border: `1.5px solid ${done ? phase.color : "#222"}`, marginTop: "1px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {done && <span style={{ fontSize: "9px", color: phase.color }}>✓</span>}
                    </div>
                    <span style={{ fontSize: "11px", color: done ? "#888" : "#444", lineHeight: 1.5 }}>{kpi.replace(" ✓", "")}</span>
                  </div>
                );
              })}
            </div>

            {/* Timeline bar */}
            <div>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#333", textTransform: "uppercase", marginBottom: "10px" }}>Timeline</div>
              {phases.map((p, i) => {
                const s = STATUS_CONFIG[p.status];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: p.status === "upcoming" ? "#222" : s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "10px", color: active === i ? p.color : "#444", width: "100px" }}>M{i + 1}: {p.label}</span>
                    <span style={{ fontSize: "9px", color: s.color, letterSpacing: "1px" }}>{s.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Savings callout */}
            <div style={{ padding: "12px", background: "#0a0a0a", border: "1px solid #161616", borderRadius: "8px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#E8FF47", marginBottom: "6px" }}>💰 CAPITAL SAVED</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "26px", color: "#E8FF47", lineHeight: 1 }}>$42,800</div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "4px", lineHeight: 1.5 }}>vs. hiring a team from day 1 at $7,300/mo</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
