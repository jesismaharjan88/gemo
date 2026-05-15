import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg)" }}>
      <Header />
      <main className="flex-1">
        <HeroSection />
        <HowItWorksSection />
        <WhoItIsForSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header
      className="sticky top-0 z-10 border-b px-6 py-4 flex items-center justify-between"
      style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
    >
      <span
        className="text-xl tracking-tight"
        style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
      >
        Gemo
      </span>
      <nav className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-sm font-medium px-4 py-2 rounded-[10px] transition-colors"
          style={{ color: "var(--muted)" }}
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="text-sm font-medium px-4 py-2 rounded-[10px] text-white transition-colors"
          style={{ backgroundColor: "var(--green)" }}
        >
          Get started
        </Link>
      </nav>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="px-6 pt-20 pb-16 text-center max-w-3xl mx-auto">
      <div
        className="inline-block text-xs font-medium px-3 py-1 rounded-full mb-6 tracking-wide uppercase"
        style={{
          backgroundColor: "var(--green-light)",
          color: "var(--green-text)",
          border: "1px solid var(--green-border)",
        }}
      >
        Free for events of any size
      </div>

      <h1
        className="text-4xl sm:text-5xl md:text-6xl leading-tight mb-6"
        style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
      >
        Collect food picks from your guests{" "}
        <span style={{ color: "var(--green)" }}>before the event</span>
      </h1>

      <p
        className="text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        No more guessing. Share a link, let guests tap their picks, and get a
        clean order ready for the restaurant — perfect for weddings, corporate
        lunches, and celebrations.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 text-base font-semibold px-7 py-4 rounded-[16px] text-white transition-colors"
          style={{ backgroundColor: "var(--green)" }}
        >
          Create your first event — free
        </Link>
        <Link
          href="#how-it-works"
          className="inline-flex items-center justify-center text-base font-medium px-7 py-4 rounded-[16px] transition-colors"
          style={{
            color: "var(--text)",
            border: "1px solid var(--border-med)",
            backgroundColor: "var(--surface)",
          }}
        >
          See how it works
        </Link>
      </div>

      {/* Admin tally preview card */}
      <div
        className="mt-16 rounded-[16px] overflow-hidden mx-auto max-w-sm sm:max-w-md text-left"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-med)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="px-5 py-4 border-b"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--green-light)",
          }}
        >
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--green-text)" }}
          >
            Guest picks — Jesis &amp; Rista&apos;s Wedding Lunch
          </p>
        </div>
        {[
          { name: "Butter Chicken", count: 24, top: true },
          { name: "Paneer Tikka Masala", count: 18, top: false },
          { name: "Dal Makhani", count: 15, top: false },
          { name: "Biryani", count: 12, top: false },
        ].map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between px-5 py-3 border-b last:border-0"
            style={{
              borderColor: "var(--border)",
              borderLeft: item.top ? "3px solid var(--green)" : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text)" }}
              >
                {item.name}
              </span>
              {item.top && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "var(--green-light)",
                    color: "var(--green-text)",
                  }}
                >
                  Top pick
                </span>
              )}
            </div>
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: "var(--green)" }}
            >
              {item.count} picks
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      icon: "✦",
      title: "Create your event",
      description:
        "Add your menu, set the venue, and configure how many picks each guest gets.",
    },
    {
      icon: "↗",
      title: "Share the link",
      description:
        "Send a WhatsApp link or QR code. Guests tap their choices in seconds — no app needed.",
    },
    {
      icon: "☑",
      title: "Get the consolidated order",
      description:
        "One clean printable page with dish counts and dietary notes, ready to hand to the restaurant.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="px-6 py-16"
      style={{
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl text-center mb-12"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-start gap-4">
              <div
                className="w-12 h-12 rounded-[12px] flex items-center justify-center text-xl"
                style={{
                  backgroundColor: "var(--green-light)",
                  color: "var(--green)",
                }}
              >
                {step.icon}
              </div>
              <div>
                <h3
                  className="text-base font-semibold mb-1"
                  style={{ color: "var(--text)" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhoItIsForSection() {
  const occasions = [
    { emoji: "💍", label: "Weddings", note: "Lunch receptions, dinner banquets" },
    { emoji: "🏢", label: "Corporate lunches", note: "Team offsites, client meals" },
    { emoji: "🎉", label: "Pasni & celebrations", note: "Rice ceremonies, birthdays" },
    { emoji: "🎂", label: "Anniversaries", note: "Family gatherings, reunions" },
  ];

  return (
    <section className="px-6 py-16" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl text-center mb-3"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          Made for every occasion
        </h2>
        <p className="text-center mb-10" style={{ color: "var(--muted)" }}>
          Any event where a restaurant needs to know what to prepare.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {occasions.map((o) => (
            <div
              key={o.label}
              className="rounded-[16px] p-5 flex flex-col gap-2"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span className="text-3xl">{o.emoji}</span>
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--text)" }}
              >
                {o.label}
              </p>
              <p className="text-xs" style={{ color: "var(--subtle)" }}>
                {o.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section
      className="px-6 py-16"
      style={{ backgroundColor: "var(--green)" }}
    >
      <div className="max-w-2xl mx-auto text-center">
        <h2
          className="text-3xl sm:text-4xl text-white mb-4"
          style={{ fontFamily: "var(--font-dm-serif)" }}
        >
          Ready to skip the guessing?
        </h2>
        <p className="text-white/80 mb-8 text-lg">
          Create your event in two minutes. Free, forever.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center text-base font-semibold px-8 py-4 rounded-[16px] transition-colors"
          style={{
            backgroundColor: "var(--surface)",
            color: "var(--green-dark)",
          }}
        >
          Create your first event — free
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="px-6 py-8 border-t text-center"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
    >
      <p className="text-sm" style={{ color: "var(--subtle)" }}>
        Built by Jesis &nbsp;·&nbsp;{" "}
        <a
          href="mailto:jesismaharjan88@gmail.com"
          className="hover:underline"
          style={{ color: "var(--green)" }}
        >
          jesismaharjan88@gmail.com
        </a>
      </p>
    </footer>
  );
}
