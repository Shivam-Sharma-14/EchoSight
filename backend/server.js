import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const port = process.env.PORT || 10000;

function languageName(language) {
  return language === 'hi' ? 'Hindi' : 'English';
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

    const language = languageName(request.body.language);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
      contents: [
        {
          inlineData: {
            mimeType: request.file.mimetype,
            data: request.file.buffer.toString('base64'),
          },
        },
        {
          text: `You are EchoSight, a helpful visual assistant for a blind or low-vision user. Describe the image clearly and accurately in ${language}. Mention important objects, text, obstacles, positions, and safety-relevant details. Do not invent details. Keep the response natural and concise enough to speak aloud.`,
        },
      ],
    });

    const generatedText = result.text?.trim();
    if (!generatedText) {
      return response.status(502).json({ error: 'Gemini returned an empty description. Please try another image.' });
    }

    return response.json({ generatedText });
  } catch (error) {
    console.error('Image analysis failed:', error);
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