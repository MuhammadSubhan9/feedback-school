import Detail from "../../../detail";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Detail referenceCode={id}/>;}
