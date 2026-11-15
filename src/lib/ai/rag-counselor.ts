import { db } from "../db";

export interface StudentProfileContext {
  studentName?: string;
  targetStream?: string;
  targetDegree?: string;
  entranceExam?: string;
  rankOrPercentile?: number;
  category?: string;
  homeState?: string;
  budgetInr?: number;
}

export async function retrieveCounselingContext(query: string, profile?: StudentProfileContext) {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !["the","and","for","with","college","colleges","recommend","best","show","what","which","can","please","want","admission","engineering"].includes(word)).slice(0,12);
  const courseFilter = {
    ...(profile?.budgetInr ? {totalFeesInr: {lte: profile.budgetInr}} : {}),
    ...(profile?.targetStream || profile?.targetDegree ? {course: {
      ...(profile.targetStream ? {stream: {contains: profile.targetStream, mode: "insensitive" as const}} : {}),
      ...(profile.targetDegree ? {degree: {contains: profile.targetDegree, mode: "insensitive" as const}} : {})
    }} : {})
  };
  // Query terms select named institutions, locations, and course specializations.
  const matches = tokens.length ? await db.college.findMany({where:{isPublished:true, OR:tokens.flatMap(token => [{name:{contains:token,mode:"insensitive" as const}}, {shortName:{contains:token,mode:"insensitive" as const}}, {city:{contains:token,mode:"insensitive" as const}}, {state:{contains:token,mode:"insensitive" as const}}, {courses:{some:{specialization:{contains:token,mode:"insensitive" as const}}}}])},select:{id:true}}) : [];
  // 1. Fetch relevant colleges based on stream or query
  const colleges = await db.college.findMany({
    where: {
      isPublished: true,
      ...(matches.length ? {id:{in:matches.map(c => c.id)}} : {}),
      ...(Object.keys(courseFilter).length ? {courses:{some:courseFilter}} : {}),
      ...(profile?.homeState ? { state: { contains: profile.homeState, mode: "insensitive" } } : {}),
    },
    take: 5,
    include: {
      courses: {
        where: courseFilter,
        include: {
          course: true,
          cutoffs: {
            where: { ...(profile?.entranceExam ? {exam:{slug:profile.entranceExam}} : {}), ...(profile?.category ? {category:profile.category} : {}) },
            take: 3,
            orderBy: { academicYear: "desc" },
          },
        },
        take: 3,
      },
      placements: {
        take: 1,
        orderBy: { batchYear: "desc" },
      },
    },
    orderBy: { nirfRank: "asc" },
  });

  return {
    colleges: colleges.map((c) => ({
      slug: c.slug,
      name: c.name,
      city: c.city,
      state: c.state,
      nirfRank: c.nirfRank,
      rating: c.ratingOverall,
      courses: c.courses.map((co) => ({
        name: `${co.course.degree} in ${co.specialization}`,
        fees: co.totalFeesInr,
        cutoffs: co.cutoffs.map((ct) => `${ct.category} (${ct.quota}): Round ${ct.counselingRound} Rank ${ct.closingRank}`),
      })),
      latestPlacement: c.placements[0]
        ? {
            year: c.placements[0].batchYear,
            averagePackage: Number(c.placements[0].averagePackageInr),
            highestPackage: Number(c.placements[0].highestPackageInr),
            topRecruiters: c.placements[0].topRecruiters,
          }
        : null,
    })),
  };
}

export const COUNSELOR_SYSTEM_PROMPT = `
You are an expert Higher Education Admissions Counselor & Career Advisor for Indian universities (Engineering, Medical, MBA, Law, Architecture).
Your guidance is backed by verified data from NIRF rankings, official JoSAA/CSAB/NEET/CAT cutoffs, placement records, and institutional accreditation (NAAC, NBA).

Guidelines:
1. Provide realistic admission chances based on the student's category, home state quota, and entrance exam score/rank.
2. Structure your answers cleanly with:
   - 🎯 Recommended Options (Target, Realistic, Safe)
   - 💰 Estimated Tuition Fees & ROI Analysis
   - 💼 Recent Placement Highlights
   - 📝 Next Actionable Step (Counseling Round dates, Application CTA)
3. Be professional, supportive, objective, and transparent.
`;

