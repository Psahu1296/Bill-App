import React, { useEffect, useState } from "react";
import restaurant from "../assets/images/restaurant-img.jpg";
const logo = "/dhaba_logo.webp";
import Register from "../components/auth/Register";
import Login from "../components/auth/Login";

const Auth: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Login"; }, []);
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-dhaba-bg">
      {/* Left — Hero */}
      <div className="w-1/2 relative flex items-center justify-center overflow-hidden">
        <img className="w-full h-full object-cover scale-105" src={restaurant} alt="Restaurant" />
        <div className="absolute inset-0 bg-gradient-to-br from-dhaba-bg/90 via-dhaba-bg/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-dhaba-bg via-transparent to-transparent" />

        <div className="absolute bottom-12 left-10 right-10">
          <h2 className="font-display text-5xl font-bold text-dhaba-text leading-tight mb-4">
            Welcome to <br />
            <span className="text-dhaba-accent">Dhaba</span>POS
          </h2>
          <p className="text-dhaba-muted text-lg max-w-md leading-relaxed">
            "Serve customers the best food with love and they'll keep coming back."
          </p>
          <p className="text-dhaba-accent font-semibold mt-4 text-sm tracking-wider uppercase">
            — Dhaba Founder
          </p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="w-1/2 min-h-screen flex flex-col justify-center p-16">
        <div className="max-w-md mx-auto w-full">
          <div className="flex flex-col items-center gap-3 mb-10">
            <div className="relative">
              <img src={logo} alt="Logo" className="h-16 w-16 object-contain" />
              <div className="absolute -inset-2 bg-dhaba-accent/20 rounded-2xl blur-lg" />
            </div>
            <h1 className="font-display text-2xl font-bold text-dhaba-text">
              Dhaba<span className="text-dhaba-accent">POS</span>
            </h1>
          </div>

          <h2 className="font-display text-3xl text-center font-bold text-dhaba-text mb-2">
            {isRegister ? "Create Account" : "Sign In"}
          </h2>
          <p className="text-dhaba-muted text-center text-sm mb-8">
            {isRegister ? "Register as a new employee" : "Enter your credentials to continue"}
          </p>

          <div className="glass-card rounded-3xl p-8">
            {isRegister ? <Register setIsRegister={setIsRegister} /> : <Login />}
          </div>

          <div className="flex justify-center mt-6">
            <p className="text-sm text-dhaba-muted">
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-dhaba-accent font-bold hover:underline"
              >
                {isRegister ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
