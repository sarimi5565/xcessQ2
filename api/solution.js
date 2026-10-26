import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question = '', answer = '', youtubeUrl = '', topic = '', subtopic = '', course = '' } = req.body || {};

  try {
    const prompt = `
You are a helpful math tutor.
Explain the following question step by step in a clear, educational style.

Course: ${course}
Topic: ${topic}
Subtopic: ${subtopic}

Question:
${question}

Reference answer:
${answer}

YouTube URL:
${youtubeUrl}

Requirements:
- Return a numbered step-by-step explanation.
- Keep it short but educational.
- Explain the method, not just the final answer.
- Return valid JSON in this format:
{
  "steps": [
    { "text": "Step 1: ..." },
    { "text": "Step 2: ..." }
  ]
}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a concise but helpful tutor.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return res.status(200).json({
      steps: Array.isArray(parsed.steps) ? parsed.steps : [{ text: parsed.solution || 'Step 1: Review the problem carefully and solve it logically.' }],
    });
  } catch (error) {
    console.error('AI solution generation failed:', error);
    return res.status(500).json({
      error: 'Failed to generate solution. Please try again later.',
    });
  }
}
