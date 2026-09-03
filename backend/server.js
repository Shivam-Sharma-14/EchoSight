import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const port = process.env.PORT || 10000;

function languageInstruction(language) {
  const isHindi = String(language || '').toLowerCase().startsWith('hi');
  return isHindi
    ? 'Respond only in Hindi written in Devanagari script. Do not use English words or Roman Hindi.'
    : 'Respond only in clear English.';
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/read-file', upload.single('file'), async (request, response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return response.status(500).json({ error: 'The Gemini API key is not configured.' });
    }

    if (!request.file || !request.file.buffer) {
      return response.status(400).json({ error: 'Please send an image using the file field.' });
    }

    if (!request.file.mimetype.startsWith('image/')) {
      return response.status(400).json({ error: 'Only image files can be analyzed.' });
    }

    const outputLanguage = languageInstruction(request.body.language);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const requestBody = {
      model: 'gemini-2.5-flash-lite',
      contents: [
        {
          inlineData: {
            mimeType: request.file.mimetype,
            data: request.file.buffer.toString('base64'),
          },
        },
        {
          text: `You are EchoSight, a helpful visual assistant for a blind or low-vision user. ${outputLanguage} Give a concise, useful description. Mention only the most important objects, readable text, obstacles, positions, and immediate safety details. Do not invent details.`,
        },
      ],
    };

    const models = [...new Set([
      process.env.GEMINI_MODEL,
      'gemini-2.5-flash-lite',
      'gemini-3.1-flash-lite',
    ].filter(Boolean))];
    let result;
    let lastError;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          result = await ai.models.generateContent({ ...requestBody, model });
          break;
        } catch (error) {
          lastError = error;
          const status = error?.status || error?.error?.code;
          const canRetry = status === 429 || status === 500 || status === 503;
          if (!canRetry) {
            throw error;
          }
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
      }
      if (result) {
        break;
      }
    }

    if (!result) {
      throw lastError || new Error('Gemini did not return a response.');
    }

    const generatedText = result.text?.trim();
    if (!generatedText) {
      return response.status(502).json({ error: 'Gemini returned an empty description. Please try another image.' });
    }

    return response.json({ generatedText });
  } catch (error) {
    const status = error?.status || error?.error?.code;
    console.error('Image analysis failed:', error);
    if (status === 429 || status === 503) {
      return response.status(503).json({
        error: 'Gemini is busy right now. EchoSight will try again automatically; please retry this photo in a moment.',
      });
    }
    return response.status(502).json({
      error: 'Image analysis could not be completed. Please try again.',
    });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: 'The image is too large. Please take another photo.' });
  }
  console.error('Request failed:', error);
  return response.status(400).json({ error: 'The image upload could not be processed.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`EchoSight backend listening on port ${port}`);
});