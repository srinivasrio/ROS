import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dine in One — AI Restaurant Operating System",
  description: "Dine in, Takeaway and Delivery in one system. Scan QR ordering, Waiter Captain app, Live Kitchen Display, Billing & POS, and Multi-outlet Admin.",
};

export default function LandingPage() {
  return (
    <main className="w-full min-h-screen bg-[#FBF9F7] overflow-x-hidden">
      <iframe
        src="/landing.html"
        title="Dine in One — AI Restaurant Operating System"
        className="w-full min-h-screen border-none block"
        style={{ minHeight: "100vh", height: "100vh", width: "100%" }}
      />
    </main>
  );
}
