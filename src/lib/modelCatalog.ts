import type { LocalModel } from '../types';

// Danh mục model gợi ý — v1 hard-code, sau này thay bằng gọi API thật (Ollama
// library) để lấy danh sách + kích thước cập nhật theo thời gian thực.
export const MODEL_CATALOG: LocalModel[] = [
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    paramSize: '3B',
    fileSize: '2.0 GB',
    ramRequirement: 'Từ 8 GB RAM',
    description: 'Nhẹ, phản hồi nhanh — phù hợp máy cấu hình phổ thông.',
    status: 'not_downloaded',
  },
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B',
    paramSize: '8B',
    fileSize: '4.7 GB',
    ramRequirement: 'Từ 16 GB RAM',
    description: 'Cân bằng giữa tốc độ và chất lượng trả lời.',
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
];
