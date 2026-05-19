import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";

const Waiting = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md w-full glass-panel p-10 rounded-2xl border border-border">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="inline-block mb-6"
        >
          <Clock size={64} className="text-coral" />
        </motion.div>
        
        <h2 className="text-3xl font-heading font-bold mb-4 gradient-text-coral">Account Under Review</h2>
        <p className="text-muted-foreground mb-8">
          Thank you for joining Dine in One! Your account is currently under admin review. 
          You will gain access once your application is approved.
        </p>
        
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-sm">
            <p className="font-medium text-foreground">Status: Pending Approval</p>
          </div>
          
          <button 
            onClick={() => navigate("/")}
            className="btn-outline w-full !py-2.5"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Waiting;
