import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import type { SharingController } from '../state/useSharing';

export function LoginScreen({ sharing, onSuccess }: { sharing: SharingController; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="login-screen">
    <div className="login-content">
      <header className="login-brand"><span className="brand">beli</span><p>收藏餐厅，记下每一餐。</p></header>
      <form className="login-form" onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError('');
        try { await sharing.signIn('WXY', password); setPassword(''); onSuccess(); }
        catch (err) { setError(err instanceof Error ? err.message : '暂时无法登录，请稍后重试'); }
        finally { setBusy(false); }
      }}>
        <h1>我的用餐日记</h1><p className="subtle">输入私人访问码，在这台设备上继续。验证后会记住设备。</p>
        <label htmlFor="login-password">私人访问码</label>
        <div className="login-password-field"><input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} disabled={busy || !sharing.configured} onChange={event => setPassword(event.target.value)} placeholder="输入私人访问码" aria-label="私人访问码" aria-describedby={error ? 'login-error' : undefined}/><button type="button" className="icon-button" aria-label={visible ? '隐藏密码' : '显示密码'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
        {(error || sharing.error || !sharing.configured) && <p id="login-error" role="alert" className="form-error">{error || sharing.error || '暂时无法连接，请稍后重试。'}</p>}
        <button className="primary login-submit" disabled={busy || !sharing.configured}>{busy ? '正在验证…' : '进入日记'}<ArrowRight size={17}/></button>
      </form>
    </div>
  </main>;
}

export function SessionScreen({ message, error, onRetry, onSignOut }: { message: string; error?: string; onRetry?: () => void; onSignOut?: () => void }) {
  return <main className="login-screen"><div className="login-content login-status"><span className="brand">beli</span><p role={error ? 'alert' : 'status'}>{error || message}</p>{error && onRetry && <button className="primary full" onClick={onRetry}>重新连接</button>}{onSignOut && <button className="text-button" onClick={onSignOut}>锁定此设备</button>}</div></main>;
}
