import { projectPreviewResponse } from "@/lib/preview/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return projectPreviewResponse(projectId, true);
}
