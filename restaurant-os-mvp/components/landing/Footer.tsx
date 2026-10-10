const Footer = () => (
  <footer className="py-16 border-t border-slate-200/80 bg-white/70 backdrop-blur-2xl relative overflow-hidden">
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      <div className="mb-8 md:hidden">
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Dine <span className="gradient-text-coral drop-shadow-xs">in</span> One
        </h3>
        <p className="text-xs text-slate-600 font-medium">Unified restaurant management ecosystem built for Indian food businesses.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-12">
        <div className="hidden md:block">
          <h3 className="text-xl font-bold text-slate-900 mb-3">
            Dine <span className="gradient-text-coral drop-shadow-xs">in</span> One
          </h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Full-stack restaurant operating system powering QR self-ordering, kitchen KDS, delivery fleets, inventory, and automated GST billing.
          </p>
        </div>
        {[
          { title: "Product", links: ["QR Table Ordering", "Customizable Delivery", "Kitchen KDS Station", "Recipe Inventory", "GST Billing POS"] },
          { title: "Smart Panels", links: ["Customer Self-Order", "Waiter Captain", "Kitchen Display", "Delivery Boy App", "Branch Admin", "Multi-Branch Owner"] },
          { title: "Platform", links: ["Pricing & Plans", "FAQ", "Book Free Demo", "Contact Support", "Privacy & Security"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-4">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l}>
                  <span className="text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer font-medium">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="h-px w-full bg-gradient-to-r from-[#FF6B6B]/40 via-[#8278FF]/40 to-[#4ECDC4]/40" />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 mt-6 font-medium">
        <p>© 2026 Dine in One. All rights reserved.</p>
        <p>Built with ❤️ for hospitality & food service in India.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
