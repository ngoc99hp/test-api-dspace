import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    // ✅ Await params trước khi access
    const { jobId } = await params;
    
    const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL;

    const res = await fetch(`${ocrApiUrl}/api/v2/download/${jobId}`);
    
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Download failed' },
        { status: res.status }
      );
    }

    // Stream ZIP file
    const blob = await res.blob();
    const filename = res.headers.get('content-disposition')?.match(/filename\*?=['"]?([^'";\n]+)/)?.[1] || `${jobId}.zip`;

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err) {
    return NextResponse.json(
      { error: 'Download error', message: err.message },
      { status: 500 }
    );
  }
}