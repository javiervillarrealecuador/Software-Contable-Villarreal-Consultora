import { NextResponse } from 'next/server';
const msg = { moved: true, url: 'http://localhost:3001', info: 'Este módulo fue separado al proyecto sri-descargador. Accede a http://localhost:3001' };
export async function GET()    { return NextResponse.json(msg, { status: 410 }); }
export async function POST()   { return NextResponse.json(msg, { status: 410 }); }
