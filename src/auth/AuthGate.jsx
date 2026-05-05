import React, { useState } from "react";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen } from "./SignupScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";

// Top-level switch for the unauthenticated flow. Login is the default
// landing view; users navigate sideways to signup or forgot-password from
// inline links and back via the same.
export function AuthGate() {
  const [view, setView] = useState("login");

  if (view === "signup") {
    return <SignupScreen onSwitchToLogin={() => setView("login")} />;
  }
  if (view === "forgot") {
    return <ForgotPasswordScreen onSwitchToLogin={() => setView("login")} />;
  }
  return (
    <LoginScreen
      onSwitchToSignup={() => setView("signup")}
      onSwitchToForgot={() => setView("forgot")}
    />
  );
}
