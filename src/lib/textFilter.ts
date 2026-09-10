// Vài model (họ Qwen/DeepSeek gốc Trung Quốc) thỉnh thoảng lẫn ký tự Hán vào
// câu trả lời dù hỏi bằng tiếng Việt/Anh — lọc bằng post-processing thay vì
// chỉ dặn trong system prompt (model không phải lúc nào cũng tuân theo prompt
// tuyệt đối). Áp dụng cho MỌI model, không riêng model nào.
//
// Dùng \u{} escape thay vì dán thẳng ký tự Hán vào regex — tránh lỗi encoding
// khi file bị copy/paste qua lại. Dải loại bỏ: CJK Unified Ideographs (+
// Extension A), dấu câu full-width kiểu Trung/Nhật, biến thể ASCII full-width.
const CJK_PATTERN = new RegExp(
  '[' +
    '\\u{4E00}-\\u{9FFF}' +
    '\\u{3400}-\\u{4DBF}' +
    '\\u{3000}-\\u{303F}' +
    '\\u{FF00}-\\u{FFEF}' +
    ']+',
  'gu',
);

export function stripCJK(text: string): string {
  if (!text) return text;
  return text.replace(CJK_PATTERN, '').replace(/[ \t]{2,}/g, ' ');
}
