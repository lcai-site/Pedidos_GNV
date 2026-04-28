import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const SetPasswordPage: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const hashParams = useMemo(() => new URLSearchParams(window.location.hash.replace(/^#/, '')), []);
  const authError = params.get('error_description') || hashParams.get('error_description');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(authError);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setCheckingSession(false);
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}#/`);
  };

  const goToLogin = async () => {
    await supabase.auth.signOut();
    window.location.replace(`${window.location.origin}${window.location.pathname}#/login`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-8">
        <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
          {success ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          ) : (
            <Lock className="w-7 h-7 text-emerald-400" />
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center">
          {success ? 'Senha criada' : 'Criar senha de acesso'}
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
          {success
            ? 'Sua senha foi salva. Você já pode acessar o ERP.'
            : 'Defina uma senha para concluir a criação da sua conta.'}
        </p>

        {checkingSession ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Validando convite...
          </div>
        ) : success ? (
          <button
            onClick={() => window.location.replace(`${window.location.origin}${window.location.pathname}#/`)}
            className="w-full mt-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium"
          >
            Entrar no sistema
          </button>
        ) : !hasSession ? (
          <div className="mt-6 space-y-4">
            <div className="flex gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-500">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Este convite expirou ou já foi usado. Solicite um novo convite ao administrador.</span>
            </div>
            <button
              onClick={goToLogin}
              className="w-full py-2.5 border border-border text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="flex gap-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg px-4 py-2.5 pr-11 text-slate-900 dark:text-slate-200"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Confirmar senha
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-border rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-200"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SetPasswordPage;
