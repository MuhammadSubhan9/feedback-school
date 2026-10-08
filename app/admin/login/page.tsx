import { MessageSquare, LockKeyhole, ShieldCheck } from "lucide-react";
import { credential } from "@/lib/admin-auth";
import LoginForm from "../password-form";
import { adminIdentity } from "@/lib/server";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export const metadata={title:"Administrator sign in · Student Feedback",robots:{index:false,follow:false}};
export default async function Login(){
  if(await adminIdentity())redirect("/admin/dashboard");
  const configured=!!await credential();
  return <main id="main" className="login-page"><div className="login-brand brand"><span className="brand-icon"><MessageSquare size={19}/></span>Student Feedback</div><section className="login-card"><span className="login-lock"><LockKeyhole size={26}/></span><span className="eyebrow">ADMINISTRATOR ACCESS</span><h1>A space to listen.<br/>And take action.</h1><p>Sign in to review anonymous feedback and manage the next steps.</p>{configured?<LoginForm/>:<div className="setup-notice"><p>The site owner needs to set the administrator password before the first sign-in.</p><a className="primary-btn login-cta" href="/admin/setup">Set up administrator access</a></div>}<div className="login-security"><ShieldCheck size={16}/> Access is restricted to authorized administrators.</div>{configured?<a className="password-recovery" href="/admin/setup">Forgot password? Owner recovery</a>:null}</section><p className="muted small">Your school feedback, handled with care.</p></main>;
}
