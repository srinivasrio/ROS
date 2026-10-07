const Footer = () => (
  <footer className="py-16 border-t border-border bg-background">
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      <div className="mb-8 md:hidden">
        <div className="flex flex-col items-start leading-none mb-2">
          <h3 className="text-xl font-bold text-foreground">
            Dine <span className="gradient-text-coral">in</span> One
          </h3>
          <span className="text-[8px] font-black tracking-[0.28em] text-neutral-400 uppercase mt-0.5">
            SMART POS
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-medium">Unified restaurant management ecosystem built for Indian food businesses.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-12">
        <div className="hidden md:block">
          <div className="flex flex-col items-start leading-none mb-3">
            <h3 className="text-xl font-bold text-foreground">
              Dine <span className="gradient-text-coral">in</span> One
            </h3>
            <span className="text-[8px] font-black tracking-[0.28em] text-neutral-400 uppercase mt-0.5">
              SMART POS
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            Full-stack restaurant operating system powering QR self-ordering, kitchen KDS, delivery fleets, inventory, and automated GST billing.
          </p>
        </div>
        {[
          { title: "Product", links: ["QR Table Ordering", "Customizable Delivery", "Kitchen KDS Station", "Recipe Inventory", "GST Billing POS"] },
          { title: "Smart Panels", links: ["Customer Self-Order", "Waiter Captain", "Kitchen Display", "Delivery Boy App", "Branch Admin", "Multi-Branch Owner"] },
          { title: "Platform", links: ["Pricing & Plans", "FAQ", "Book Free Demo", "Contact Support", "Privacy & Security"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-bold text-xs uppercase tracking-wider text-foreground mb-4">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l}>
                  <span className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors font-medium">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, #FF6B6B, #A855F7, #4ECDC4)" }} />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground mt-6 font-medium">
        <p>© 2026 Dine in One. All rights reserved.</p>
        <p>Built with ❤️ for hospitality & food service in India.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
