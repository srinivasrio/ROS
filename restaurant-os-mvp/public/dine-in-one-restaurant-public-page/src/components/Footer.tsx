const Footer = () => (
  <footer className="py-16 border-t border-border">
    <div className="max-w-6xl mx-auto px-6">
      <div className="mb-8 md:hidden">
        <h3 className="text-xl font-heading font-bold mb-3">
          Dine <span className="gradient-text-coral">in</span> One
        </h3>
        <p className="text-sm text-muted-foreground">Smart restaurant management platform built for Indian restaurants.</p>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-6 md:gap-10 mb-12">
        <div className="hidden md:block">
          <h3 className="text-xl font-heading font-bold mb-3">
            Dine <span className="gradient-text-coral">in</span> One
          </h3>
          <p className="text-sm text-muted-foreground">Smart restaurant management platform built for Indian restaurants.</p>
        </div>
        {[
          { title: "Product", links: ["QR Ordering", "Kitchen Panel", "Billing", "Analytics"] },
          { title: "Panels", links: ["Customer", "Waiter", "Kitchen", "Billing", "Admin"] },
          { title: "Company", links: ["About", "Blog", "Careers", "Contact", "Privacy Policy"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-heading font-bold text-sm mb-4">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l}>
                  <span className="text-sm text-muted-foreground">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, #FF6B6B, #A855F7, #4ECDC4)" }} />
      <p className="text-center text-sm text-muted-foreground mt-6">
        © 2026 Dine in One. All rights reserved. Made in India
      </p>
    </div>
  </footer>
);

export default Footer;
