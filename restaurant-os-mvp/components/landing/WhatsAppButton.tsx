"use client";

const WhatsAppButton = () => {
  const phoneNumber = "918247005501";
  const message = encodeURIComponent("Hi! I'm interested in Dine in One. Can you tell me more?");
  const url = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full liquid-glass-dense border border-white/90 bg-white/90 flex items-center justify-center shadow-[0_8px_28px_rgba(37,211,102,0.32),0_4px_12px_rgba(15,23,42,0.08),inset_0_1px_1.5px_rgba(255,255,255,1)] hover:scale-110 hover:shadow-[0_12px_36px_rgba(37,211,102,0.5),0_6px_16px_rgba(15,23,42,0.12),inset_0_1px_2px_rgba(255,255,255,1)] transition-all duration-300 active:scale-95 group backdrop-blur-2xl"
      aria-label="Chat on WhatsApp"
    >
      <img src="/assets/whatsapp.png" alt="WhatsApp" width={32} height={32} loading="lazy" decoding="async" className="w-8 h-8 object-contain transition-transform group-hover:scale-105" />
    </a>
  );
};

export default WhatsAppButton;
