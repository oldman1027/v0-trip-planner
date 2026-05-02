import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

export async function POST(req: NextRequest) {
  try {
    const { tripId, action, tripDetails, message, currentActivities, conversationHistory } = await req.json();

    if (action === 'generate') {
      const prompt = `You are Tripletto AI. Generate a ${tripDetails.days}-day itinerary for ${tripDetails.people} people visiting ${tripDetails.destination} with budget $${tripDetails.budget}/day/person.

Create activities with: title, category, day, time (24h format), duration, location, cost, description

Output JSON between [ACTIVITIES] and [/ACTIVITIES] tags.`;

      const completion = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      });

      const text = completion.choices[0]?.message?.content || '';
      let activities = [];
      const match = text.match(/\[ACTIVITIES\]([\s\S]*?)\[\/ACTIVITIES\]/);
      if (match) {
        try { activities = JSON.parse(match[1].trim()); } catch (e) { console.error('Parse error:', e); }
      }

      return NextResponse.json({
        response: text.replace(/\[ACTIVITIES\][\s\S]*?\[\/ACTIVITIES\]/, '').trim() || "Here's your itinerary!",
        activities
      });

    } else if (action === 'refine') {
      const prompt = `Current: ${JSON.stringify(currentActivities)}
User: "${message}"
Update itinerary. Output JSON between [ACTIVITIES][/ACTIVITIES].`;

      const completion = await openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      });

      const text = completion.choices[0]?.message?.content || '';
      let activities = currentActivities;
      const match = text.match(/\[ACTIVITIES\]([\s\S]*?)\[\/ACTIVITIES\]/);
      if (match) {
        try { activities = JSON.parse(match[1].trim()); } catch (e) { console.error('Parse error:', e); }
      }

      return NextResponse.json({
        response: text.replace(/\[ACTIVITIES\][\s\S]*?\[\/ACTIVITIES\]/, '').trim() || "Updated!",
        activities
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      response: "Error generating itinerary. Please try again!",
      activities: []
    }, { status: 500 });
  }
}
