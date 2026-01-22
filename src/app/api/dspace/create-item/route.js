// File: src/app/api/dspace/create-item/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Helper to parse XML response from DSpace
function parseXMLItemResponse(xmlText) {
  try {
    // Extract key fields from XML using regex (simple parser for DSpace XML)
    const idMatch = xmlText.match(/<id>(\d+)<\/id>/);
    const handleMatch = xmlText.match(/<handle>([^<]+)<\/handle>/);
    const nameMatch = xmlText.match(/<name>([^<]+)<\/name>/);
    const archivedMatch = xmlText.match(/<archived>([^<]+)<\/archived>/);

    return {
      id: idMatch ? parseInt(idMatch[1]) : null,
      handle: handleMatch ? handleMatch[1] : null,
      name: nameMatch ? nameMatch[1] : null,
      archived: archivedMatch ? archivedMatch[1] : "false",
      type: "item",
      _rawXML: xmlText,
    };
  } catch (err) {
    console.error("XML parsing error:", err);
    return null;
  }
}

export async function POST(req) {
  try {
    const cookie = req.headers.get("cookie");
    
    if (!cookie) {
      return NextResponse.json(
        { error: "No session cookie - please login first" },
        { status: 401 }
      );
    }

    const { collectionId, metadata, dspaceUrl } = await req.json();

    if (!collectionId || !metadata || !dspaceUrl) {
      return NextResponse.json(
        { error: "Missing required fields: collectionId, metadata, dspaceUrl" },
        { status: 400 }
      );
    }

    // Validate metadata format
    if (!Array.isArray(metadata)) {
      return NextResponse.json(
        { error: "metadata must be an array" },
        { status: 400 }
      );
    }

    // Build payload exactly as DSpace 6.3 expects
    const payload = {
      metadata: metadata.map(m => ({
        key: m.key,
        value: m.value,
        language: m.language || null
      }))
    };

    // POST to DSpace create item endpoint
    const res = await fetch(
      `${dspaceUrl}/rest/collections/${collectionId}/items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Accept: "application/json",
          // Add User-Agent to help with content negotiation
          "User-Agent": "PostmanRuntime/7.x",
        },
        body: JSON.stringify(payload),
      }
    );

    // Always read as text first (DSpace may return XML)
    const responseText = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Failed to create item",
          status: res.status,
          detail: responseText,
        },
        { status: res.status }
      );
    }

    // Try to detect response format
    const trimmed = responseText.trim();
    let itemData;

    if (trimmed.startsWith("<")) {
      // XML response - parse it
      console.log("DSpace returned XML response");
      itemData = parseXMLItemResponse(responseText);
      
      if (!itemData || !itemData.id) {
        return NextResponse.json(
          {
            error: "Failed to parse XML response",
            raw: responseText,
          },
          { status: 500 }
        );
      }
    } else if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      // JSON response
      try {
        itemData = JSON.parse(responseText);
      } catch (err) {
        return NextResponse.json(
          {
            error: "Failed to parse JSON response",
            raw: responseText,
          },
          { status: 500 }
        );
      }
    } else {
      // Unknown format
      return NextResponse.json(
        {
          error: "Unknown response format",
          raw: responseText,
        },
        { status: 500 }
      );
    }

    // Return normalized item data
    return NextResponse.json({
      success: true,
      id: itemData.id,
      handle: itemData.handle || null,
      name: itemData.name || null,
      archived: itemData.archived || "false",
      message: "Item created successfully",
      _format: trimmed.startsWith("<") ? "xml" : "json",
    });

  } catch (err) {
    console.error("Create item error:", err);
    return NextResponse.json(
      { error: "Internal error", message: err.message },
      { status: 500 }
    );
  }
}