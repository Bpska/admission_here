import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function RetiredCollegeSection({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;
 const college=await db.college.findUnique({where:{slug,isPublished:true},select:{slug:true}});
 if(!college)notFound();
 permanentRedirect(`/college/${college.slug}`);
}
