import whatsappIcon from "@/assets/whatsapp.png";

const WhatsAppButton = () => {
  const phoneNumber = "918247005501";
  const message = encodeURIComponent("Hi! I'm interested in Dine in One. Can you tell me more?");
  const url = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-[0_4px_24px_rgba(37,211,102,0.4)] hover:scale-110 hover:shadow-[0_8px_32px_rgba(37,211,102,0.55)] transition-all duration-300 active:scale-95"
      aria-label="Chat on WhatsApp"
    >
      <img src={whatsappIcon} alt="WhatsApp" className="w-9 h-9" />
    </a>
  );
};

export default WhatsAppButton;
