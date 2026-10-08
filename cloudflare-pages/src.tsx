import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MessageSquare, LockKeyhole, ShieldCheck } from "lucide-react";
import { deriveVerifier, newSalt } from "./password";
import "../app/globals.css";
const FeedbackForm = React.lazy(() => import("../app/feedback-form"));
const Dashboard = React.lazy(() => import("../app/admin/dashboard"));
const Detail = React.lazy(() => import("../app/admin/detail"));
const AdminShell = React.lazy(() => import("../app/admin/shell"));

function Setup() {
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (password !== confirmation) { setError("The passwords don’t match."); return; }
    if (password.length < 15 || password.length > 128 || /^(admin|password|school|student|welcome|letmein|123456|qwerty)[\d\s!@#$._-]*$/i.test(password)) { setError("Use at least 15 characters and avoid obvious school words or common passwords."); return; }
    setPending(true);
    try {
      const salt = newSalt();
      const verifier = await deriveVerifier(password, salt);
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json", "x-owner-setup-key": key }, body: JSON.stringify({ verifier, salt }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Couldn’t save the password.");
      setKey(""); setPassword(""); setConfirmation(""); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setPending(false); }
  }
  return <main id="main" className="login-page"><div className="brand"><span className="brand-icon"><MessageSquare size={19}/></span>Student Feedback</div><section className="login-card"><span className="login-lock"><LockKeyhole size={26}/></span><span className="eyebrow">SITE OWNER ONLY</span><h1>Your admin access.</h1>{saved?<><p>Password saved. Sign in as <strong>Admin</strong>.</p><a className="primary-btn login-cta" href="/admin/login">Go to sign in</a></>:<><p>Enter the private owner setup key and choose a password. Keep the key and password out of shared computers.</p><form className="admin-login-form" onSubmit={submit}><div className="field"><label htmlFor="setup-key">Owner setup key</label><input id="setup-key" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} required minLength={32}/></div><div className="field"><label htmlFor="setup-password">New password</label><input id="setup-password" type="password" autoComplete="new-password" minLength={15} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required/><p className="field-help">At least 15 characters. Three memorable words work well.</p></div><div className="field"><label htmlFor="setup-confirm">Confirm password</label><input id="setup-confirm" type="password" autoComplete="new-password" minLength={15} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} required/></div>{error&&<p role="alert" className="form-error">{error}</p>}<button className="primary-btn login-cta" disabled={pending}>{pending?"Saving…":"Save password"}</button></form></>}<div className="login-security"><ShieldCheck size={16}/> Only someone with the private key can set or reset the password.</div><a className="password-recovery" href="/admin/login">Back to administrator sign in</a></section></main>;
}
function Login() {
  const [config, setConfig] = useState<{configured:boolean;salt:string|null}|null>(null);
  const [username,setUsername]=useState("Admin"),[password,setPassword]=useState(""),[error,setError]=useState(""),[pending,setPending]=useState(false);
  useEffect(() => { fetch("/api/auth/config", {cache:"no-store"}).then(r=>r.json() as Promise<{configured:boolean;salt:string|null}>).then(d=>setConfig(d)).catch(()=>setError("Could not check administrator access. Please reload.")); }, []);
  async function submit(e:React.FormEvent) {
    e.preventDefault();setError("");setPending(true);
    try {
      const verifier=await deriveVerifier(password,config?.salt||"");
      const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password:verifier})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||"Sign in failed.");
      location.assign("/admin/dashboard");
    } catch(e) { setError(e instanceof Error?e.message:"Please try again."); }
    finally { setPending(false); }
  }
  return <main id="main" className="login-page"><div className="login-brand brand"><span className="brand-icon"><MessageSquare size={19}/></span>Student Feedback</div><section className="login-card"><span className="login-lock"><LockKeyhole size={26}/></span><span className="eyebrow">ADMINISTRATOR ACCESS</span><h1>A space to listen.<br/>And take action.</h1><p>Sign in to review anonymous feedback and manage the next steps.</p>{config===null?<p role="status">Checking access…</p>:config.configured?<form className="admin-login-form" onSubmit={submit}><div className="field"><label htmlFor="username">Username</label><input id="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>{error&&<p role="alert" className="form-error">{error}</p>}<button className="primary-btn login-cta" disabled={pending}>{pending?"Signing in…":"Sign in"}</button></form>:<div className="setup-notice"><p>The site owner needs to set the administrator password before the first sign-in.</p><a className="primary-btn login-cta" href="/admin/setup">Set up administrator access</a></div>}<div className="login-security"><ShieldCheck size={16}/> Access is restricted to authorized administrators.</div>{config?.configured&&<a className="password-recovery" href="/admin/setup">Forgot password? Owner recovery</a>}</section></main>;
}
function Protected({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean|null>(null);
  useEffect(() => { fetch("/api/auth/session", {cache:"no-store"}).then(r=>r.json() as Promise<{signedIn:boolean}>).then(d=>{ if (!d.signedIn) location.replace("/admin/login"); else setSignedIn(true); }).catch(()=>location.replace("/admin/login")); }, []);
  return signedIn?<AdminShell email="Admin">{children}</AdminShell>:<main id="main" className="login-page" role="status">Checking administrator access…</main>;
}
function App() {
  const path = location.pathname;
  if (path === "/admin/login") return <Login/>;
  if (path === "/admin/setup") return <Setup/>;
  if (path === "/admin/dashboard") return <Protected><Dashboard archived={new URLSearchParams(location.search).get("archive")==="true"}/></Protected>;
  const detail = path.match(/^\/admin\/submissions\/(AF-[A-Z2-9]{12})$/);
  if (detail) return <Protected><Detail referenceCode={detail[1]}/></Protected>;
  return <FeedbackForm/>;
}
createRoot(document.getElementById("root")!).render(<><a className="skip-link" href="#main">Skip to content</a><React.Suspense fallback={<main id="main" role="status" className="login-page">Loading…</main>}><App/></React.Suspense></>);
