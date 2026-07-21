import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return new NextResponse('Missing path parameter', { status: 400 })
  }

  try {
    const absolutePath = path.resolve(filePath)
    const fileStat = await stat(absolutePath)

    if (!fileStat.isFile()) {
      return new NextResponse('File not found', { status: 404 })
    }

    // Determine mime type
    const ext = path.extname(absolutePath).toLowerCase()
    let contentType = 'application/octet-stream'
    if (ext === '.mp4') contentType = 'video/mp4'
    else if (ext === '.webm') contentType = 'video/webm'
    else if (ext === '.wav') contentType = 'audio/wav'
    else if (ext === '.png') contentType = 'image/png'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'

    const stream = createReadStream(absolutePath)
    
    // We can cast stream to any because NextResponse handles Node.js readable streams under the hood
    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Accept-Ranges': 'bytes'
      }
    })
  } catch (error) {
    console.error('Error serving local file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
