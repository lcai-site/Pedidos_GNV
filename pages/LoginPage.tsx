import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2, AlertCircle, ArrowRight, UserPlus, CheckCircle, Database, Wrench } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { logoUrl } = useTheme();
  // Default to Login (false)
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single();
          
        if (profile) {
          navigate('/');
        } else {
          await supabase.auth.signOut();
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        // --- FLUXO DE CADASTRO ---
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        if (data.user) {
           await new Promise(resolve => setTimeout(resolve, 1000));
           
           const { data: profile } = await supabase
             .from('profiles')
             .select('id')
             .eq('id', data.user.id)
             .single();

           if (!profile) {
             setSuccess("Conta criada. Faça login para concluir a configuração.");
           } else {
             setSuccess("Conta criada com sucesso! Você já pode entrar.");
           }
           setIsSignUp(false);
           setPassword('');
        }

      } else {
        // --- FLUXO DE LOGIN ---
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Erro ao identificar usuário.");

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        // Self-Healing
        if (!profile) {
          console.log("Auto-corrigindo perfil...");
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([
              { 
                id: authData.user.id, 
                email: authData.user.email, 
                role: 'usuario',
                created_at: new Date().toISOString()
              }
            ]);

          if (insertError) {
             await supabase.auth.signOut();
             throw new Error("Erro ao restaurar perfil.");
          }
          setSuccess("Perfil restaurado. Redirecionando...");
        }

        navigate('/');
      }
    } catch (err: any) {
      if (!isSignUp && !err.message.includes('restaurado')) await supabase.auth.signOut();

      if (err.message === 'Invalid login credentials') {
         setError('Senha incorreta ou email não cadastrado.');
      } else if (err.message.includes('already registered')) {
         setError('E-mail já cadastrado. Faça Login.');
      } else {
         setError(err.message || 'Erro inesperado.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setSuccess(null);
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-8 relative z-10 transition-all duration-300">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex justify-center">
             <img 
               src={logoUrl} 
               alt="Gestão Pedidos GNV" 
               className="h-16 w-auto object-contain" 
             />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isSignUp ? 'Solicitar Acesso' : 'Acesso Restrito'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            {isSignUp 
              ? 'Crie seu perfil de acesso ao sistema.' 
              : 'Gestão Logística e Financeira GNV.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 text-red-500 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-3 text-green-600 dark:text-green-400 text-sm animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">Email Corporativo</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                required
                minLength={6}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-medium py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-6 shadow-lg active:scale-[0.98] ${
                isSignUp 
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 text-white' 
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 text-white'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isSignUp ? (
              <>
                Criar Conta <UserPlus className="w-4 h-4" />
              </>
            ) : (
              <>
                Entrar no Sistema <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center space-y-4">
          <button 
            onClick={toggleMode}
            className="text-slate-500 hover:text-blue-500 text-xs transition-colors hover:underline flex items-center justify-center gap-2 mx-auto"
          >
            {isSignUp ? (
                <>Já tem cadastro? <strong>Fazer Login</strong></>
            ) : (
                <>Não tem acesso? <strong>Criar nova conta</strong></>
            )}
          </button>
          
          {!isSignUp && (
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-4">
                  <Database className="w-3 h-3" />
                  <span>v2.0</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <Wrench className="w-3 h-3" />
                  <span>GNV System</span>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};