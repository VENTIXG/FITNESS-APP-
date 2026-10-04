import type { Metadata } from "next";
import { ProgramList } from "@/components/training/program-list";
import { getT, getUserContext } from "@/server/context";
import { getPrograms } from "@/server/queries/training";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).training.program.title };
}

export default async function ProgramsPage() {
  const ctx = await getUserContext();
  return <ProgramList programs={await getPrograms(ctx.userId)} />;
}
