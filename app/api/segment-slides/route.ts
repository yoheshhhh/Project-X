import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { demoModule } from '@/data/demoModule';
import { logger } from '@/lib/logger';

const log = logger.child('API:SegmentSlides');

const DEFAULT_SEGMENT_COUNT = 3;

async function findPdfInContent(contentDir: string): Promise<string | null> {
  try {
    const entries = await readdir(contentDir, { withFileTypes: true });
    const pdf = entries.find((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'));
    return pdf ? path.join(contentDir, pdf.name) : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/segment-slides?moduleId=demo-1
 * Returns segment slide text for the module.
 * If content/slides.pdf exists, extracts text and splits by page into segments.
 * Otherwise returns the built-in segmentSlides from demoModule.
 */
/**
 * True if the line looks like a module/course code or slide metadata, not a topic title.
 * Skipped: SC3010, 2552-SC3010, CC0006, slide numbers (e.g. 1), short code-only lines.
 * Not skipped: "Software Security II", "Introduction to Databases" (have spaces / punctuation).
 */
function shouldSkipLineForTopic(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return true;
  if (t.length > 50) return false;
  if (/^\d+$/.test(t)) return true;
  if (/^[A-Z0-9\-]+$/i.test(t)) return true;
  if (/^\d{4}-[A-Z0-9\-]+$/i.test(t)) return true;
  if (/^[A-Z]{2}\d{4}(-[A-Z0-9\-]*)?$/i.test(t)) return true;
  return false;
}

/**
 * Extract module topic from the first slide of the PDF (same slides used for AI).
 * Skips lines that look like module codes or numbers; returns the first line that
 * looks like a title (e.g. "Software Security II", "Software Security(II)").
 * Works for any PDF you add: first page text is split into lines and the first
 * non-skipped line is used as the topic.
 */
function topicFromFirstPage(pages: Array<{ text?: string }>): string | undefined {
  const first = pages[0];
  const text = typeof first?.text === 'string' ? first.text.trim() : '';
  if (!text) return undefined;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l.length > 0);
  const topicLine = lines.find((l) => !shouldSkipLineForTopic(l));
  if (topicLine) return topicLine.slice(0, 300);
  return lines[0]?.slice(0, 300);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const _moduleId = searchParams.get('moduleId') ?? 'demo-1';

    const projectRoot = process.cwd();
    const contentDir = path.join(projectRoot, 'content');
    const slidesPath = path.join(contentDir, 'slides.pdf');
    const pdfPath = (await findPdfInContent(contentDir)) ?? slidesPath;

    let segmentSlides: string[];
    let moduleTopic: string | undefined;

    try {
      const buffer = await readFile(pdfPath);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      await parser.destroy();

      const pages = textResult.pages ?? [];
      const totalPages = Math.max(1, pages.length);
      const segmentCount = Math.min(DEFAULT_SEGMENT_COUNT, totalPages);

      if (pages.length > 0) moduleTopic = topicFromFirstPage(pages);

      if (segmentCount === 0 || totalPages === 0) {
        segmentSlides = demoModule.segmentSlides ?? [];
        log.info('PDF had no pages, using demo segmentSlides');
      } else {
        const pagesPerSegment = Math.ceil(totalPages / segmentCount);
        segmentSlides = [];

        for (let s = 0; s < segmentCount; s++) {
          const startPage = s * pagesPerSegment;
          const endPage = Math.min(startPage + pagesPerSegment, totalPages);
          const segmentTexts: string[] = [];
          for (let p = startPage; p < endPage; p++) {
            const pageData = pages[p];
            const pageText = typeof pageData?.text === 'string' ? pageData.text : '';
            if (pageText.trim()) segmentTexts.push(`[Page ${p + 1}]\n${pageText.trim()}`);
          }
          segmentSlides.push(segmentTexts.join('\n\n') || '(No text for this segment.)');
        }

        log.info('Extracted segment slides from PDF', {
          pdf: path.basename(pdfPath),
          totalPages,
          segmentCount,
          moduleTopic: moduleTopic ?? '(none)',
          segmentLengths: segmentSlides.map((s) => s.length),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT') || msg.includes('no such file')) {
        log.info('No PDF in content/, using demo segmentSlides');
        segmentSlides = demoModule.segmentSlides ?? [];
      } else {
        log.error('PDF read or parse failed', { error: msg });
        return NextResponse.json(
          { error: 'Failed to read or parse PDF', segmentSlides: demoModule.segmentSlides ?? [], moduleTopic: undefined },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ segmentSlides, moduleTopic: moduleTopic ?? demoModule.moduleTopic ?? undefined });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Segment slides failed', { error: msg });
    return NextResponse.json(
      { error: 'Server error', segmentSlides: demoModule.segmentSlides ?? [], moduleTopic: demoModule.moduleTopic ?? undefined },
      { status: 500 }
    );
  }
}
