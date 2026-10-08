import Dashboard from "../../dashboard";
export default async function Page({searchParams}:{searchParams:Promise<{archive?:string}>}){const q=await searchParams;return <Dashboard archived={q.archive==="true"}/>;}
