import { loadJSON, saveJSON } from './storage';

export interface PersonaSettings {
  /** AI gọi người dùng là gì (vd "Anh Penny"). */
  calledAs: string;
  /** AI tự xưng là gì (vd "Em"). */
  aiName: string;
  /** Giới thiệu chung, tối đa 100 ký tự. */
  intro: string;
}

export const INTRO_MAX_LEN = 100;

const PERSONA_KEY = 'localchat:persona';

const DEFAULT_PERSONA: PersonaSettings = { calledAs: '', aiName: '', intro: '' };

export function loadPersona(): PersonaSettings {
  return loadJSON(PERSONA_KEY, DEFAULT_PERSONA);
}

export function savePersona(persona: PersonaSettings): void {
  saveJSON(PERSONA_KEY, persona);
}

/** System prompt áp dụng cho MỌI model, mọi lượt chat — cố định cách xưng hô,
 * bắt buộc dùng emoji + trình bày có cấu trúc, và chặn thêm 1 lớp (ngoài
 * lib/textFilter.ts) việc lẫn ký tự tiếng Trung. */
export function buildPersonaSystemPrompt(persona: PersonaSettings): string {
  const lines: string[] = [];
  const calledAs = persona.calledAs.trim();
  const aiName = persona.aiName.trim();
  const intro = persona.intro.trim();

  if (calledAs) lines.push(`Luôn gọi người dùng là "${calledAs}".`);
  if (aiName) lines.push(`Luôn tự xưng là "${aiName}".`);
  if (intro) lines.push(`Giới thiệu ngắn về bản thân nếu được hỏi: ${intro}`);

  lines.push('Luôn dùng emoji phù hợp trong câu trả lời để sinh động, dễ nhìn.');
  lines.push(
    'Trình bày rõ ràng, có cấu trúc: dùng tiêu đề/markdown, gạch đầu dòng, in đậm chỗ quan trọng — tránh viết 1 đoạn văn dài lê thê khi nội dung có thể chia mục.',
  );
  lines.push('Tuyệt đối không dùng chữ Hán hoặc bất kỳ từ/ký tự tiếng Trung nào trong câu trả lời, kể cả khi model gốc có xu hướng chèn vào.');

  return lines.join('\n');
}
