import type { Metadata } from "next";
import ControlPanel from "@/components/ControlPanel";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Timekeeper · Room ${code.toUpperCase()} · Peachy Timer` };
}

export default async function ControlPage({ params }: Props) {
  const { code } = await params;
  return <ControlPanel code={code.toUpperCase()} />;
}
