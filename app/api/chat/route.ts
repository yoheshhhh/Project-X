import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/api-auth';

const log = logger.child('API:Chat');

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { messages, systemInstruction, image } = body as {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      systemInstruction?: string;
      image?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_2;
    if (!apiKey) {
      log.error('OpenAI API key not configured');
      return NextResponse.json({ error: 'Chat is not configured. Set OPENAI_API_KEY.' }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const hasImage = typeof image === 'string' && image.startsWith('data:image');

    const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemInstruction) {
      openAIMessages.push({ role: 'system', content: systemInstruction });
    }
    const lastIdx = messages.length - 1;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      const isLastUserWithImage = hasImage && i === lastIdx && m.role === 'user';
      if (isLastUserWithImage && image) {
        openAIMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: image } },
          ],
        });
      } else {
        openAIMessages.push({ role: m.role, content: m.content });
      }
    }

    const completion = await openai.chat.completions.create({
      model,
      messages: openAIMessages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "I couldn't generate a response. Try rephrasing.";
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Chat API error', { error: msg });
    return NextResponse.json(
      { error: msg.includes('rate') ? 'Rate limit reached. Please wait a minute and try again.' : 'Something went wrong.' },
      { status: 500 }
    );
  }
}
