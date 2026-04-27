import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validarEmail } from "@/lib/validators";
import { Mail, Lock } from "lucide-react";
import brqLogo from "@/assets/brq-logo-interna.png";

export default function Auth() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [signinErrors, setSigninErrors] = useState<{ email?: string; password?: string }>({});

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const errs = {
      email: validarEmail(email) ?? undefined,
      password: password.length < 6 ? "Senha mínima 6 caracteres" : undefined,
    };
    setSigninErrors(errs);
    if (errs.email || errs.password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast({ title: "Erro ao entrar", description: error, variant: "destructive" });
    else { toast({ title: "Bem-vindo!" }); nav("/"); }
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validarEmail(forgotEmail)) { toast({ title: "E-mail inválido", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "E-mail enviado", description: "Confira sua caixa de entrada." }); setForgot(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f0f10] p-4">
      {/* Animação de carros no fundo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <svg
          className="absolute top-[20%] left-0 h-16 w-32 animate-[car-drive_22s_linear_infinite] text-[#FFD700] opacity-[0.06]"
          viewBox="0 0 120 50"
          fill="currentColor"
        >
          <path d="M10,35 L15,20 Q18,15 25,15 L75,15 Q85,15 92,22 L108,28 Q115,30 115,35 L115,40 L100,40 A8,8 0 0,0 84,40 L36,40 A8,8 0 0,0 20,40 L10,40 Z" />
          <circle cx="28" cy="40" r="6" />
          <circle cx="92" cy="40" r="6" />
        </svg>
        <svg
          className="absolute top-[55%] left-0 h-20 w-40 animate-[car-drive_30s_linear_infinite] text-[#FFD700] opacity-[0.06]"
          style={{ animationDelay: "-8s" }}
          viewBox="0 0 120 50"
          fill="currentColor"
        >
          <path d="M10,35 L15,20 Q18,15 25,15 L75,15 Q85,15 92,22 L108,28 Q115,30 115,35 L115,40 L100,40 A8,8 0 0,0 84,40 L36,40 A8,8 0 0,0 20,40 L10,40 Z" />
          <circle cx="28" cy="40" r="6" />
          <circle cx="92" cy="40" r="6" />
        </svg>
        <svg
          className="absolute top-[80%] left-0 h-14 w-28 animate-[car-drive_26s_linear_infinite] text-[#FFD700] opacity-[0.06]"
          style={{ animationDelay: "-15s" }}
          viewBox="0 0 120 50"
          fill="currentColor"
        >
          <path d="M10,35 L15,20 Q18,15 25,15 L75,15 Q85,15 92,22 L108,28 Q115,30 115,35 L115,40 L100,40 A8,8 0 0,0 84,40 L36,40 A8,8 0 0,0 20,40 L10,40 Z" />
          <circle cx="28" cy="40" r="6" />
          <circle cx="92" cy="40" r="6" />
        </svg>
      </div>

      {/* Card de login */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1c] p-8 md:p-10"
        style={{ boxShadow: "0 10px 40px -10px rgba(255, 215, 0, 0.18), 0 0 0 1px rgba(255, 215, 0, 0.05)" }}
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-xl bg-white px-4 py-3">
            <img
              src={brqLogo}
              alt="BRQ Frota Interna"
              style={{ mixBlendMode: "multiply" }}
              className="h-16 w-auto object-contain"
            />
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">
            {forgot ? "Recuperar senha" : "Bem-vindo"}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {forgot ? "Enviaremos um link para redefinir sua senha." : "Acesse sua conta"}
          </p>
        </div>

        {forgot ? (
          <form onSubmit={onForgot} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fe" className="text-white/80">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="fe"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-[#FFD700] font-bold text-black hover:bg-[#FFC700]"
              disabled={loading}
            >
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-white/70 hover:bg-white/5 hover:text-white"
              onClick={() => setForgot(false)}
            >
              Voltar
            </Button>
          </form>
        ) : (
          <form onSubmit={onSignIn} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="se" className="text-white/80">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="se"
                  name="email"
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40"
                  onBlur={(e) =>
                    setSigninErrors((s) => ({ ...s, email: validarEmail(e.target.value) ?? undefined }))
                  }
                />
              </div>
              {signinErrors.email && <p className="text-xs text-destructive">{signinErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp" className="text-white/80">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="sp"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40"
                />
              </div>
              {signinErrors.password && <p className="text-xs text-destructive">{signinErrors.password}</p>}
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-[#FFD700] font-bold text-black hover:bg-[#FFC700]"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <p className="pt-2 text-center text-[11px] text-white/40">
              Acesso restrito. Solicite seu cadastro ao administrador.
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-white/30">
          <Link to="/setup" className="hover:text-white/60">​</Link>
        </p>
      </div>
    </div>
  );
}
