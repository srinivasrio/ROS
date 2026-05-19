import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";

const Login = () => {
  useEffect(() => {
    // Redirect to the main app's premium multi-method login
    window.location.href = "http://localhost:3000/login";
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.post("/api/login", { email, password });
      
      if (data?.access) {
        localStorage.setItem("access", data.access);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        if (data.user?.is_approved) {
          window.location.href = "/dashboard"; // Use window.location for cross-app navigation
        } else {
          navigate("/waiting");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-border">
        <h2 className="text-3xl font-heading font-bold mb-6 gradient-text-coral text-center">Welcome Back</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-coral transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-coral transition-colors"
              required
            />
          </div>
          <button type="submit" className="w-full btn-primary !py-2.5 mt-4">
            Login
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-coral hover:underline">
            Get Started
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
