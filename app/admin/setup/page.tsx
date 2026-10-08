import { MessageSquare, LockKeyhole, ShieldCheck } from "lucide-react";
import { ownerIdentity } from "@/lib/server";
import { credential } from "@/lib/admin-auth";
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import PasswordForm from "../password-form";
export const dynamic="force-dynamic";
export const metadata={title:"Owner password setup · Student Feedback",robots:{index:false,follow:false}};
export default async function Setup(){
  const owner=await ownerIdentity(),signedIn=await getChatGPTUser(),configured=!!await credential();
  return <main id="main" className="login-page"><div className="brand"><span className="brand-icon"><MessageSquare size={19}/></span>Student Feedback</div><section className="login-card"><span className="login-lock"><LockKeyhole size={26}/></span><span className="eyebrow">SITE OWNER ONLY</span><h1>{configured?"Reset admin access.":"Your admin access."}</h1>{owner?<><p>Choose your administrator password privately. {configured?"Saving a new password signs out all existing administrator sessions.":"After setup, administrator sign-in uses only your username and password."}</p><PasswordForm setup/></>:<><p>Verify the site owner’s ChatGPT account to {configured?"reset":"set"} the administrator password. Regular administrator sign-in uses a username and password.</p>{signedIn?<div role="alert" className="form-error">This account isn’t the site owner. Sign in with the owner’s account to continue.</div>:null}<a className="primary-btn login-cta" target="_top" href={signedIn?chatGPTSignOutPath("/admin/setup"):chatGPTSignInPath("/admin/setup")}>{signedIn?"Use the owner’s account":"Verify owner account"}</a></>}<div className="login-security"><ShieldCheck size={16}/> Only the verified site owner can change this password.</div><a className="password-recovery" href="/admin/login">Back to administrator sign in</a></section></main>;
}
