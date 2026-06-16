import { NextResponse } from 'next/server'
import { ALL_LISTS } from '@/lib/synkdata'

export async function GET() {
  return NextResponse.json({ lists: ALL_LISTS })
}
