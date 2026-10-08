"use client";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight, LoaderCircle, CheckCircle2 } from "lucide-react";
export default function PasswordForm({setup=false}:{setup?:boolean}){
  const [pending,setPending]=useState(false),[error,setError]=useState(""),[shown,setShown]=useState(false),[saved,setSaved]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending)return;
    const form=event.currentTarget,data=new FormData(form),password=String(data.get("password")||"");
    if(setup&&password!==data.get("confirmation")){setError("The passwords don’t match.");return;}
    setPending(true);setError("");
    try{
      const response=await fetch(setup?"/api/auth/password":"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(setup?{password,confirmation:String(data.get("confirmation"))}:{username:String(data.get("username")),password})});
      const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"Please try again.");
      if(setup){form.reset();setSaved(true);}else window.location.assign("/admin/dashboard");
    }catch(e){setError(e instanceof Error?e.message:"Couldn’t connect. Please try again.");}finally{setPending(false);}
  }
  if(saved)return <div className="password-saved" role="status"><CheckCircle2 size={28}/><h2>Password saved</h2><p>Sign in with <strong>Admin</strong> and your new password. Previous administrator sessions have been signed out.</p><a className="primary-btn login-cta" href="/admin/login">Go to sign in <ArrowRight size={16}/></a></div>;
  return <form className="admin-login-form" onSubmit={submit} aria-busy={pending}>
    {setup?<div className="fixed-username"><span>Username</span><strong>Admin</strong><small>Capitalization doesn’t matter.</small></div>:<div className="field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} defaultValue="Admin" maxLength={80} required/></div>}
    <div className="field"><label htmlFor="password">{setup?"New password":"Password"}</label><div className="password-input"><input id="password" name="password" type={shown?"text":"password"} autoComplete={setup?"new-password":"current-password"} minLength={setup?15:undefined} maxLength={128} aria-describedby={setup?"password-help":error?"login-error":undefined} required/><button type="button" aria-label={shown?"Hide password":"Show password"} aria-pressed={shown} onClick={()=>setShown(!shown)}>{shown?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{setup?<p id="password-help" className="password-help">Use at least 15 characters. Three unrelated words are easy to remember; numbers and symbols aren’t required. Capitalization matters.</p>:null}</div>
    {setup?<div className="field"><label htmlFor="confirmation">Confirm password</label><input id="confirmation" name="confirmation" type={shown?"text":"password"} autoComplete="new-password" minLength={15} maxLength={128} required/></div>:null}
    {error?<div id="login-error" className="form-error" role="alert">{error}</div>:null}
    <button className="primary-btn login-cta" disabled={pending} type="submit">{pending?<><LoaderCircle className="spin" size={17}/>{setup?"Saving password…":"Signing in…"}</>:<>{setup?"Save password":"Sign in"}<ArrowRight size={17}/></>}</button>
  </form>;
}
