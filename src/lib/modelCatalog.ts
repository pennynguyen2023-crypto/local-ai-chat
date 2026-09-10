import type { LocalModel } from '../types';

// Danh mục model gợi ý — v1 hard-code, sau này thay bằng gọi API thật (Ollama
// library) để lấy danh sách + kích thước cập nhật theo thời gian thực.
//
// Nguyên tắc chọn model vào danh mục này: PHẢI giỏi tiếng Việt (đa ngôn ngữ có
// tiếng Việt rõ ràng trong dữ liệu huấn luyện) — model chỉ chính thức hỗ trợ
// tiếng Anh/vài ngôn ngữ Âu (vd Llama 3 gốc, Llama 3.2 1B/3B, Mistral 7B gốc)
// bị loại thẳng, không đưa vào để tránh khách tải nhầm rồi thất vọng.
//
// Sắp xếp: nhóm theo cùng họ (name), trong 1 họ xếp theo size tăng dần.
export const MODEL_CATALOG: LocalModel[] = [
  // --- Qwen 2.5: đa ngôn ngữ tốt nhất trong nhóm phổ thông, tiếng Việt tự
  // nhiên ở mọi size — chọn làm lựa chọn mặc định gợi ý cho từng tầm máy.
  {
    id: 'qwen2.5:3b',
    name: 'Qwen 2.5 3B',
    paramSize: '3B',
    fileSize: '1.9 GB',
    ramRequirement: 'Từ 8 GB RAM',
    description: 'Nhẹ, phản hồi nhanh, giỏi tiếng Việt — phù hợp máy cấu hình phổ thông.',
    status: 'not_downloaded',
  },
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B',
    paramSize: '7B',
    fileSize: '4.7 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Cân bằng giữa tốc độ và chất lượng, giỏi tiếng Việt.',
    status: 'not_downloaded',
  },
  {
    id: 'qwen2.5:14b',
    name: 'Qwen 2.5 14B',
    paramSize: '14B',
    fileSize: '9.0 GB',
    ramRequirement: 'Từ 32 GB RAM',
    description: 'Trả lời chất lượng cao hơn, cần máy khá mạnh.',
    status: 'not_downloaded',
  },

  // --- Qwen 2.5 Coder: chuyên viết/sửa/giải thích code, cùng gốc Qwen nên
  // vẫn giỏi tiếng Việt khi giải thích code bằng lời.
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder 7B',
    paramSize: '7B',
    fileSize: '4.7 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Chuyên viết & sửa code, giải thích bằng tiếng Việt tốt.',
    status: 'not_downloaded',
  },
  {
    id: 'qwen2.5-coder:14b',
    name: 'Qwen 2.5 Coder 14B',
    paramSize: '14B',
    fileSize: '9.0 GB',
    ramRequirement: 'Từ 32 GB RAM',
    description: 'Chuyên code, chất lượng cao hơn cho dự án phức tạp.',
    status: 'not_downloaded',
  },

  // --- Llama 3.1 (KHÔNG phải Llama 3 gốc — bản 3.1 đa ngôn ngữ, tiếng Việt
  // dùng ổn, khác hẳn "llama3:latest" yếu tiếng Việt).
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B',
    paramSize: '8B',
    fileSize: '4.7 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Cân bằng giữa tốc độ và chất lượng trả lời.',
    status: 'not_downloaded',
  },

  // --- Gemma 2: của Google, đa ngôn ngữ ổn.
  {
    id: 'gemma2:9b',
    name: 'Gemma 2 9B',
    paramSize: '9B',
    fileSize: '5.4 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Cân bằng, của Google — văn phong tự nhiên.',
    status: 'not_downloaded',
  },

  // --- DeepSeek-R1: có bước suy luận (reasoning) trước khi trả lời, giỏi
  // toán/logic. Đã bật lọc tự động ký tự tiếng Trung (xem lib/textFilter.ts)
  // vì dòng model này thỉnh thoảng lẫn ký tự Hán vào câu trả lời.
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek-R1 8B',
    paramSize: '8B',
    fileSize: '4.9 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Có suy luận từng bước, mạnh về toán/logic.',
    status: 'not_downloaded',
  },
  {
    id: 'deepseek-r1:14b',
    name: 'DeepSeek-R1 14B',
    paramSize: '14B',
    fileSize: '9.0 GB',
    ramRequirement: 'Từ 32 GB RAM',
    description: 'Suy luận từng bước, chất lượng cao hơn.',
    status: 'not_downloaded',
  },

  // --- GPT-OSS: OpenAI mã nguồn mở.
  {
    id: 'gpt-oss:20b',
    name: 'GPT-OSS 20B',
    paramSize: '20B',
    fileSize: '13 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Model mã nguồn mở của OpenAI, suy luận mạnh.',
    status: 'not_downloaded',
  },
  {
    id: 'gpt-oss:120b',
    name: 'GPT-OSS 120B',
    paramSize: '120B',
    fileSize: '65 GB',
    ramRequirement: 'Từ 64 GB RAM',
    description: 'Bản lớn nhất của OpenAI mã nguồn mở — cần máy rất mạnh (workstation/server).',
    status: 'not_downloaded',
  },

  // --- Qwen2.5-VL: model duy nhất hiểu ảnh trong danh mục — cùng họ Qwen nên
  // vẫn giỏi tiếng Việt khi mô tả/trả lời về ảnh. App tự chọn model này khi
  // khách đính kèm ảnh vào chat, không cần chọn tay (xem App.tsx handleSend).
  {
    id: 'qwen2.5vl:7b',
    name: 'Qwen 2.5 VL 7B',
    paramSize: '7B',
    fileSize: '6.0 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Hiểu ảnh (vision) — tự động dùng khi bạn đính kèm ảnh vào chat.',
    status: 'not_downloaded',
    vision: true,
  },
];

export const VISION_MODEL_ID = 'qwen2.5vl:7b';
