// The result of a model or calculator, as sent by the genai service
export interface Analysis {
  supported: boolean;
  kind: "brain" | "lung" | "wound" | "heart" | "diabetes" | "bmi" | "bp" | "unsupported";
  title: string;
  label?: string;
  uncertain?: boolean;
  reasons?: string[];
  notes?: string[];
  model?: string;

  // Image readings
  confidence?: number | null;
  probabilities?: { label: string; score: number }[];
  image_url?: string;
  heatmap_url?: string | null;

  // Heart and diabetes risk
  probability?: number | null;
  band?: "low" | "moderate" | "high";
  factors?: { label: string; effect: number }[];

  // Calculators
  value?: number | string;
  unit?: string;
  scale?: { min: number; max: number; bands: { label: string; to: number | null }[] };
  steps?: { labels: string[]; current: number };
  metrics?: { label: string; value: string }[];
  urgent?: boolean;
}

// Saved chats store a result as an assistant message holding this JSON
export function parseAnalysis(content: string): Analysis | null {
  if (!content.startsWith('{"type": "analysis"')) return null;
  try {
    return JSON.parse(content).data as Analysis;
  } catch {
    return null;
  }
}

const FOLLOW_UPS: Record<string, string[]> = {
  image: ["What should I do right now?", "How serious is this?", "What will a doctor check?"],
  heart: ["How can I lower my risk?", "Which tests should I ask for?", "What do these values mean?"],
  diabetes: ["How can I lower my risk?", "Which blood test should I get?", "What are the early signs?"],
  bmi: ["Give me a simple plan", "What should I eat?", "How much exercise do I need?"],
  bp: ["How do I measure it properly?", "How can I bring it down?", "When is it an emergency?"],
  text: ["Explain in more detail", "When should I see a doctor?"],
};

export function followUpsFor(analysis?: Analysis | null) {
  if (!analysis?.supported) return FOLLOW_UPS.text;
  if (analysis.kind === "brain" || analysis.kind === "lung" || analysis.kind === "wound") return FOLLOW_UPS.image;
  return FOLLOW_UPS[analysis.kind] ?? FOLLOW_UPS.text;
}

const EMERGENCY_WORDS =
  /chest pain|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|short(ness)? of breath|heart attack|stroke|face (is )?droop|unconscious|passed out|seizure|suicid|kill myself|end my life|overdose|(severe|heavy|won'?t stop) bleeding|coughing (up )?blood/i;

export function mentionsEmergency(text: string) {
  return EMERGENCY_WORDS.test(text);
}
