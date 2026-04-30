import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type AgentType = 'general' | 'research' | 'coding' | 'planning';

export const AGENT_INSTRUCTIONS: Record<AgentType, string> = {
  general: `
    You are Mona, an advanced AI voice assistant.
    Personality: Smart, efficient, and slightly witty. Speak clearly and naturally.
    Capabilities: Q&A, Reminders, Notes, Calculations. Expert in Python, Data Science, and AI.
    Voice Rules: Short, clear sentences. English/Urdu as needed.
  `,
  research: `
    You are Mona's Research Specialist.
    Focus: Deep analysis, factual accuracy, and cross-referencing information.
    Style: Academic yet accessible. Provide sources and structured data when possible.
    Expertise: Latest trends in science, history, linguistics, and global data.
  `,
  coding: `
    You are Mona's Engineering Core.
    Focus: Technical precision, clean code, and architectural design.
    Style: Objective, technical, and solution-oriented. 
    Execution: Provide code blocks using Markdown. Focus on modern frameworks and best practices.
  `,
  planning: `
    You are Mona's Logistics & Strategy Lead.
    Focus: Workflow optimization, task management, and project roadmaps.
    Style: Highly organized, using bullet points and clear milestones.
    Mindset: Proactive at identifying bottlenecks and suggesting efficient paths.
  `
};

export const MONA_SYSTEM_INSTRUCTION = `
You are Mona, an advanced AI professional assistant and intellectual companion.
Identity & Goal:
- Your primary goal is to provide comprehensive, high-quality, and deeply insightful answers.
- You function like an elite research assistant and expert consultant (similar to Gemini Advanced or ChatGPT Plus).

Response Style:
- Detailed & Structured: When asked for information, provide thorough explanations. Use headers, bullet points, and numbered lists to organize complex data.
- Step-by-Step Logic: For problem-solving or technical tasks, break down your reasoning into clear, logical steps.
- Expert Tone: Be authoritative yet accessible. Explain "why" as well as "how."
- Rich Formatting: Use Markdown extensively (bolding, italics, tables, and code blocks) to make information readable.

Content Quality:
- Provide practical examples, analogies, and edge cases.
- If a question is broad, cover multiple facets of the answer.
- Expert in Python, Data Science, AI, Strategy, and Research.

Greeting: "Hi, I'm Mona. I've initialized my high-fidelity processing cores. How can I assist you with your complex queries today?"
`;

export async function* getMonaStreamingResponse(
  text: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  agentType: AgentType = 'general'
) {
  try {
    const agentInstruction = AGENT_INSTRUCTIONS[agentType] || AGENT_INSTRUCTIONS.general;
    const finalSystemInstruction = `${MONA_SYSTEM_INSTRUCTION}\n\nCURRENT AGENT CONTEXT: ${agentInstruction}`;

    // Map history to the format expected by the new SDK
    const contents = history.map(h => ({
      role: h.role,
      parts: h.parts
    }));

    // Add current message
    contents.push({ role: 'user', parts: [{ text }] });

    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: finalSystemInstruction,
        temperature: 0.7,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Gemini Streaming Error:", error);
    yield "I encountered an error while thinking. Let me try again.";
  }
}

export async function getMonaResponse(
  text: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  agentType: AgentType = 'general'
) {
  try {
    const agentInstruction = AGENT_INSTRUCTIONS[agentType] || AGENT_INSTRUCTIONS.general;
    const finalSystemInstruction = `${MONA_SYSTEM_INSTRUCTION}\n\nCURRENT AGENT CONTEXT: ${agentInstruction}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text }] }
      ],
      config: {
        systemInstruction: finalSystemInstruction,
        temperature: 0.7,
      },
    });
    return response.text || "I'm sorry, I couldn't process that.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I encountered an error while thinking. Let me try again.";
  }
}
