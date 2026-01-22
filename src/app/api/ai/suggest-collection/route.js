// File: src/app/api/ai/suggest-collection/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { metadata, collections } = await req.json();

    if (!metadata || !collections) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Lấy API key từ environment variable
    const apiKey = process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "CLAUDE_API_KEY not configured in server environment" },
        { status: 500 }
      );
    }

    // Build prompt for Claude
    const metadataStr = metadata.map(m => `${m.key}: ${m.value}`).join('\n');
    
    const collectionsStr = collections.map((c, idx) => 
      `${idx + 1}. ID: ${c.id || c.uuid}
   Name: ${c.name}
   Description: ${c.description || 'N/A'}
   Handle: ${c.handle || 'N/A'}
   Items Count: ${c.archivedItemsCount || 0}`
    ).join('\n\n');

    const prompt = `You are a library cataloging expert. Analyze the following document metadata and suggest the most appropriate DSpace collection from the available options.

DOCUMENT METADATA:
${metadataStr}

AVAILABLE COLLECTIONS:
${collectionsStr}

TASK:
1. Analyze the document's metadata (title, author, subject, type, abstract, etc.)
2. Match it with the most appropriate collection based on:
   - Document type (thesis, textbook, research paper, etc.)
   - Subject area (mathematics, physics, chemistry, etc.)
   - Academic level
   - Language
3. Provide a confidence score (0-100)
4. Give a brief explanation (max 2 sentences)

RESPOND ONLY WITH THIS JSON FORMAT (no markdown, no explanation):
{
  "collectionId": "the collection ID",
  "collectionName": "the collection name",
  "confidence": 85,
  "reasoning": "Brief explanation why this collection is appropriate",
  "alternativeIds": ["alternative1_id", "alternative2_id"]
}

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no additional text.`;

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return NextResponse.json(
        { error: "AI service error", detail: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiResponse = data.content[0].text;

    // Parse AI response
    let suggestion;
    try {
      // Remove markdown code blocks if present
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      suggestion = JSON.parse(cleaned);
    } catch (err) {
      console.error('Failed to parse AI response:', aiResponse);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: aiResponse },
        { status: 500 }
      );
    }

    // Validate suggestion
    if (!suggestion.collectionId) {
      return NextResponse.json(
        { error: "AI did not provide collection ID", raw: suggestion },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      suggestion
    });

  } catch (err) {
    console.error('Suggest collection error:', err);
    return NextResponse.json(
      { error: "Internal error", message: err.message },
      { status: 500 }
    );
  }
}