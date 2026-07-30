import { NextRequest, NextResponse } from "next/server";

function getFastApiBaseUrl(): string {
  const internal = process.env.FAST_API_INTERNAL_URL?.trim();
  if (internal) {
    return internal.replace(/\/+$/, "");
  }

  const configured = process.env.NEXT_PUBLIC_FAST_API?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params;
  if (!id) {
    return NextResponse.json(
      { detail: "Missing presentation id" },
      { status: 400 }
    );
  }

  const exportCookie = request.headers.get("x-export-cookie")?.trim();
  if (!exportCookie) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const presentationUrl = `${getFastApiBaseUrl()}/api/v1/ppt/presentation/${id}`;

  try {
    const response = await fetch(presentationUrl, {
      method: "GET",
      headers: {
        Cookie: exportCookie,
      },
      cache: "no-store",
    });

    const bodyText = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json";

    return new NextResponse(bodyText, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export-presentation-data] Failed to fetch presentation", error);
    return NextResponse.json(
      { detail: "Failed to fetch presentation data" },
      { status: 500 }
    );
  }
}
