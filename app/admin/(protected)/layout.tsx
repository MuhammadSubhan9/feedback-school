import { requireAdminPage } from "@/lib/server";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import AdminShell from "../shell";
export const dynamic="force-dynamic";
export const metadata={title:"Admin · Student Feedback",robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}){const user=await requireAdminPage();return <AdminShell email={user.email} logoutUrl={chatGPTSignOutPath("/admin/login")}>{children}</AdminShell>;}
