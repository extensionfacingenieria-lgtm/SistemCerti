import React, { useState, useEffect } from "react";
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import PublicSearch from "./components/PublicSearch";
import AdminPanel from "./components/AdminPanel";
import { Certificate } from "./types";
import { KeyRound, Mail, Lock, ShieldCheck, X, Eye, EyeOff, Sparkles } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Interface view switching states
  // "public" | "auth" | "admin"
  const [view, setView] = useState<"public" | "auth" | "admin">("public");

  // Authentication Fields States
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Listen for user session changes from Firebase Auth Client SDK
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Fetch token to authorize operations inside full-stack custom node server
          const idToken = await currentUser.getIdToken(true);
          setToken(idToken);
          // Redirect authenticated admins straight into administration panel
          setView("admin");
        } catch (error) {
          console.error("No se pudo obtener el token ID:", error);
        }
      } else {
        setUser(null);
        setToken(null);
        if (view === "admin") {
          setView("public");
        }
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [view]);

  // Auth Handler for Administrator logins/signups
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setAuthError("Debe escribir sus credenciales de administración.");
      return;
    }
    if (password.length < 6) {
      setAuthError("La contraseña debe tener un largo mínimo de 6 caracteres.");
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");

    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      // Success triggers Auth change handler and moves inside admin routing automatically
    } catch (err: any) {
      console.error(err);
      // Friendly translations of Firebase errors
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setAuthError("Credenciales inválidas. Verifique su correo o contraseña.");
      } else if (err.code === "auth/email-already-in-use") {
        setAuthError("El correo electrónico ingresado ya se encuentra registrado.");
      } else if (err.code === "auth/weak-password") {
        setAuthError("Clave muy débil. Use un mínimo de 6 caracteres.");
      } else {
        setAuthError(err.message || "Fallo en la autenticación.");
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogoutAction = () => {
    setUser(null);
    setToken(null);
    setView("public");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-mono text-xs text-slate-500">
        <Sparkles className="w-10 h-10 text-indigo-600 animate-pulse mb-3" />
        <span>SistemCerti • Verificando identidad...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Content Rendering Switcher */}
      <main className="flex-grow flex items-center justify-center">
        {view === "public" && (
          <PublicSearch
            onAdminClick={() => {
              if (user) {
                setView("admin");
              } else {
                setView("auth");
              }
            }}
          />
        )}

        {view === "auth" && (
          <div className="w-full max-w-md mx-auto px-4 py-12">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl relative overflow-hidden">
              <button
                onClick={() => setView("public")}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Volver"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="bg-slate-900 text-white p-3 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-indigo-400" />
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {authMode === "login" ? "Acceso de Administrador" : "Registro de Administrador"}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-[280px] mx-auto">
                  {authMode === "login" 
                    ? "Escriba sus claves autorizadas para ingresar al gestor SistemCerti."
                    : "Cree una cuenta administrativa inicial para gestionar certificados."}
                </p>
              </div>

              {/* Login / Signup Tabs */}
              <div className="flex bg-slate-100 rounded-xl p-1 mb-6 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className={`flex-1 text-center text-xs font-bold py-2 rounded-lg cursor-pointer transition-all ${
                    authMode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                  }}
                  className={`flex-1 text-center text-xs font-bold py-2 rounded-lg cursor-pointer transition-all ${
                    authMode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Registrarse
                </button>
              </div>

              {authError && (
                <p className="bg-red-50 border border-red-100 text-red-700 px-4 py-2.5 rounded-xl text-xs font-semibold mb-4 leading-normal">
                  {authError}
                </p>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4" id="auth-form">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@sistemcerti.co"
                      className="w-full bg-white text-slate-800 rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white text-slate-800 rounded-xl border border-slate-300 pl-10 pr-10 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition mt-2"
                  id="btn-login-submit"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>{authSubmitting ? "Autenticando..." : authMode === "login" ? "Ingresar al Panel" : "Completar Registro"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {view === "admin" && token && (
          <AdminPanel
            token={token}
            onLogout={handleLogoutAction}
          />
        )}
      </main>

      {/* Footer copyright */}
      <footer className="w-full py-4 text-center border-t border-slate-200/50 bg-white text-[10px] text-slate-400 font-mono tracking-wide print:hidden">
        <div>SISTEMCERTI © 2026 • REGISTRO Y EMISIÓN AUTÓNOMA DEL CERTIFICADO</div>
      </footer>
    </div>
  );
}
