import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";

const Signup = () => {
  useEffect(() => {
    // Redirect to the main app's premium multi-method registration
    window.location.href = "http://localhost:3000/register";
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.post("/api/signup", {
        ...formData,
        restaurant_name: formData.name
      });
      
      if (data?.user) {
        toast.success("Account created! Please wait for approval.");
        navigate("/waiting");
      }
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-border">
        <h2 className="text-3xl font-heading font-bold mb-2 gradient-text-coral text-center">Get Started</h2>
        <p className="text-center text-muted-foreground mb-6">Join the smartest restaurant platform</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Restaurant Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-coral transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-coral transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-coral transition-colors"
              required
            />
          </div>
          <button type="submit" className="w-full btn-primary !py-2.5 mt-4">
            Create Account
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-coral hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
