import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { identities, type IdentityName } from '../state/identities';
import type { SharingController } from '../state/useSharing';

export function LoginScreen({ sharing, onSuccess }: { sharing: SharingController; onSuccess: () => void }) {
  const [identity, setIdentity] = useState<IdentityName>('WXY');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="login-screen">
    <div className="login-content">
      <header className="login-brand"><span className="brand">beli</span><p>共享清单，各自排名。</p></header>
      <form className="login-form" onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError('');
        try { await sharing.signIn(identity, password); setPassword(''); onSuccess(); }
        catch (err) { setError(err instanceof Error ? err.message : '暂时无法登录，请稍后重试'); }
        finally { setBusy(false); }
      }}>
        <h1>选择你的身份</h1>
        <div className="login-identities" role="group" aria-label="选择身份">
          {identities.map(person => <button type="button" key={person.name} aria-label={person.name} disabled={busy} aria-pressed={identity === person.name} className={identity === person.name ? 'selected' : ''} onClick={() => { setIdentity(person.name); setPassword(''); setError(''); }}>
            <span className="login-avatar">{person.name[0]}</span><strong>{person.name}</strong><span className="login-check" aria-hidden="true">{identity === person.name && <Check size={15}/>}</span>
          </button>)}
        </div>
        <label htmlFor="login-password">密码</label>
        <div className="login-password-field"><input id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} disabled={busy || !sharing.configured} onChange={event => setPassword(event.target.value)} placeholder="输入密码" aria-label="登录密码" aria-describedby={error ? 'login-error' : undefined}/><button type="button" className="icon-button" aria-label={visible ? '隐藏密码' : '显示密码'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
        {(error || sharing.error || !sharing.configured) && <p id="login-error" role="alert" className="form-error">{error || sharing.error || '暂时无法连接，请稍后重试。'}</p>}
        <button className="primary login-submit" disabled={busy || !sharing.configured}>{busy ? '正在登录…' : '登录'}<ArrowRight size={17}/></button>
      </form>
    </div>
  </main>;
}

export function SessionScreen({ message, error, onRetry, onSignOut }: { message: string; error?: string; onRetry?: () => void; onSignOut?: () => void }) {
  return <main className="login-screen"><div className="login-content login-status"><span className="brand">beli</span><p role={error ? 'alert' : 'status'}>{error || message}</p>{error && onRetry && <button className="primary full" onClick={onRetry}>重新连接</button>}{onSignOut && <button className="text-button" onClick={onSignOut}>退出登录</button>}</div></main>;
}
