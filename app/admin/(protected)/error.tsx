"use client";
export default function ErrorState({reset}:{reset:()=>void}){return <div className="panel-error" role="alert"><h2>The admin workspace couldn’t load</h2><p>Please try again in a moment.</p><button className="primary-btn" onClick={reset}>Try again</button></div>;}
