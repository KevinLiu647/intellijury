// 加载 .env
import 'dotenv/config';

export const config = {
  // DeepSeek API
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },

  // Server
  port: process.env.PORT || 3450,
};
