import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COLLECTION_ID = "id-collection";

export async function POST(req) {
  try {
    const cookie = req.headers.get("cookie");
    if (!cookie) {
      return NextResponse.json(
        { error: "No session cookie" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const res = await fetch(
      `https://lib.hpu.edu.vn/rest/collections/${COLLECTION_ID}/items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Accept: "application/json", // yêu cầu JSON nhưng DSpace có thể ignore
        },
        body: JSON.stringify(body),
      }
    );

    const text = await res.text(); // ⬅️ luôn đọc text

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Create item failed",
          status: res.status,
          raw: text,
        },
        { status: res.status }
      );
    }

    // 👉 DSpace có thể trả XML → wrap lại cho frontend
    return NextResponse.json({
      success: true,
      raw: text,        // XML gốc
      message: "Item created successfully",
    });

  } catch (err) {
    return NextResponse.json(
      { error: "Internal error", message: err.message },
      { status: 500 }
    );
  }
}
