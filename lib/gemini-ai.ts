import { logger } from './logger';
const log = logger.child('GeminiAI');
async function callGemini(prompt, maxTokens = 1000) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  log.debug('Calling Gemini API', { maxTokens });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 } }) });
  if (!response.ok) { const e = await response.text(); log.error('Gemini API error', { status: response.status, error: e }); throw new Error(`Gemini error: ${response.status}`); }
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  log.info('Gemini response received', { length: content.length });
  return content;
}
export async function generateFlashcards(topic, missedQuestions, learningStyle) {
  log.info('Generating flashcards', { topic, missedCount: missedQuestions.length });
  const prompt = `You are an expert tutor. A student studying "${topic}" missed: ${missedQuestions.join(', ')}. Style: ${learningStyle}. Generate 5 flashcards. Return ONLY valid JSON array, no backticks: [{"front":"...","back":"...","difficulty":"easy|medium|hard"}]`;
  const r = await callGemini(prompt, 1500);
  try { return JSON.parse(r.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()); } catch { return [{ front: topic, back: 'Review this topic.', difficulty: 'medium' }]; }
}
export async function generateVideoSummary(topic, segmentTitle, segmentContent, timestamp) {
  log.info('Generating summary', { topic, segmentTitle });
  return await callGemini(`You are a patient tutor. Student watching "${topic}", segment "${segmentTitle}" clicked "I'm Lost" at ${timestamp}. Content: ${segmentContent}. Give a 3-sentence simplified summary. Start with "Don't worry! Here's the key idea:"`, 300);
}
export async function generatePracticePaper(moduleName, weakTopics, preferredFormat, questionCount = 10) {
  log.info('Generating practice paper', { moduleName, weakTopics });
  const prompt = `Create ${questionCount} ${preferredFormat} questions for "${moduleName}" targeting: ${weakTopics.join(', ')}. Return ONLY valid JSON array: [{"id":"q1","question":"...","type":"${preferredFormat}"${preferredFormat==='mcq'?',"options":["A. ...","B. ...","C. ...","D. ..."]':''},"correctAnswer":"...","explanation":"...","difficulty":"easy|medium|hard","topic":"..."}]`;
  const r = await callGemini(prompt, 3000);
  try { return JSON.parse(r.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()); } catch { return []; }
}
export async function analyzeBurnoutRisk(studyData) {
  log.info('Analyzing burnout', { hours: studyData.totalHoursThisWeek });
  const signals = []; let riskScore = 0;
  if (studyData.totalHoursThisWeek > 35) { signals.push('Studying 35+ hours/week'); riskScore += 30; }
  if (studyData.avgSessionHour >= 23 || studyData.avgSessionHour <= 4) { signals.push('Late night studying'); riskScore += 20; }
  if (studyData.avgDurationMinutes > 180) { signals.push('Sessions exceed 3 hours'); riskScore += 15; }
  if (studyData.scoresTrend?.length >= 3) { const r = studyData.scoresTrend.slice(-3); if (r[2]<r[0]&&r[1]<r[0]) { signals.push('Declining scores'); riskScore += 25; } }
  if (studyData.streakDays > 14) { signals.push('No rest in 2+ weeks'); riskScore += 10; }
  const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 25 ? 'moderate' : 'low';
  let recommendation = 'Your study patterns look healthy!';
  if (riskLevel !== 'low') { recommendation = await callGemini(`Student burnout signals: ${signals.join(', ')}. ${studyData.totalHoursThisWeek}hrs/week. Give 2-3 caring sentences of advice.`, 200); }
  return { riskLevel, riskScore: Math.min(100, riskScore), signals, recommendation };
}
