import type { Metadata } from "next";

import { WebContainerRunner } from "@/components/preview/webcontainer-runner";

export const metadata: Metadata = {
  title: "WebContainer Preview",
};

/**
 * Dedicated WebContainer route — served with COOP/COEP headers (see
 * next.config.ts) so SharedArrayBuffer is available.
 */
export default async function ContainerPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <WebContainerRunner projectId={projectId} />;
}
