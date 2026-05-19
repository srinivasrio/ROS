const DashboardPlaceholder = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md w-full glass-panel p-10 rounded-2xl border border-border">
        <h2 className="text-3xl font-heading font-bold mb-4 gradient-text-coral">SaaS Dashboard</h2>
        <p className="text-muted-foreground mb-8">
          Welcome, <strong>{user.name || "Restaurant Owner"}</strong>! 👋 <br />
          This is your SaaS Dashboard. Full functionality coming soon.
        </p>
        
        <div className="bg-emerald/10 text-emerald p-4 rounded-lg text-sm mb-8">
          <p className="font-medium">Status: Approved & Access Granted</p>
        </div>

        <button 
          onClick={() => {
            localStorage.clear();
            window.location.href = "/";
          }}
          className="btn-outline w-full !py-2.5"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default DashboardPlaceholder;
