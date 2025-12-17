import DisplayClient from "./viewer";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DisplayClient displayId={id} />;
}

