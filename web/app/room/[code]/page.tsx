import type { Metadata } from "next";
import RoomDisplay from "@/components/RoomDisplay";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Room ${code.toUpperCase()} · Peachy Timer` };
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  return <RoomDisplay code={code.toUpperCase()} />;
}
