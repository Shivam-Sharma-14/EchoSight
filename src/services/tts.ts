import Tts from 'react-native-tts';

export type SpeechLanguage = 'en' | 'hi';

let readyPromise: Promise<void> | null = null;
let configuredLanguage: SpeechLanguage | null = null;

function ensureTtsReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = Tts.getInitStatus().then(() => undefined);
  }
  return readyPromise;
}

export async function prepareTts(language: SpeechLanguage): Promise<void> {
  await ensureTtsReady();

  if (configuredLanguage === language) {
    return;
  }

  const languageCode = language === 'hi' ? 'hi-IN' : 'en-IN';
  await Tts.setDefaultLanguage(languageCode);

  const voices = await Tts.voices();
  const bestVoice = voices
    .filter(voice => !voice.notInstalled && voice.language.toLowerCase().startsWith(language === 'hi' ? 'hi' : 'en'))
    .sort((left, right) => {
      if (right.quality !== left.quality) return right.quality - left.quality;
      if (left.latency !== right.latency) return left.latency - right.latency;
      return Number(right.networkConnectionRequired) - Number(left.networkConnectionRequired);
    })[0];

  if (bestVoice) {
    await Tts.setDefaultVoice(bestVoice.id);
  }

  await Tts.setDefaultRate(0.44);
  await Tts.setDefaultPitch(1.0);
  configuredLanguage = language;
}

export async function speakText(text: string, language: SpeechLanguage): Promise<void> {
  await prepareTts(language);
  await Tts.stop();
  Tts.speak(text);
}

export async function stopSpeaking(): Promise<void> {
  await Tts.stop();
}

// Begin warming the Android speech engine while the app bundle loads.
void ensureTtsReady();