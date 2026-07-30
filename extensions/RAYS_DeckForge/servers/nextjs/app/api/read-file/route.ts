import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '@/app/(presentation-generator)/utils/others';


export async function POST(request: Request) {
  try {
    const { filePath } = await request.json();
   
      const sanitizedFilePath = sanitizeFilename(filePath);
      const normalizedPath = path.normalize(sanitizedFilePath);
      const allowedBaseDirs = [
        process.env.APP_DATA_DIRECTORY || '/app/user_data',
        process.env.TEMP_DIRECTORY || '/tmp',
        '/app/user_data' 
      ];
      const resolvedPath = fs.realpathSync(path.resolve(normalizedPath));
      const isPathAllowed = allowedBaseDirs.some(baseDir => {
      const resolvedBaseDir = fs.realpathSync(path.resolve(baseDir));
      return resolvedPath.startsWith(resolvedBaseDir + path.sep) || resolvedPath === resolvedBaseDir;
    });
    if (!isPathAllowed) {
      console.error('Unauthorized file access attempt:', resolvedPath);
      return NextResponse.json(
        { error: 'Access denied: File path not allowed' },
        { status: 403 }
      );
    }
    const content=  fs.readFileSync(resolvedPath, 'utf-8');
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
} 