import { GoogleGenerativeAI } from '@google/generative-ai';
import type { DailyLog, ProjectTask } from '../types';

export const getGeminiApiKey = (): string => {
  const custom = localStorage.getItem('devlog_gemini_api_key');
  if (custom && custom.trim().length > 0) {
    return custom.trim();
  }
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

export const setGeminiApiKey = (key: string) => {
  localStorage.setItem('devlog_gemini_api_key', key.trim());
};

// Modeller listesi (En hızlı ve en güncelden eskiye doğru denenir)
const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro'
];

let cachedWorkingModel: string | null = null;

export const getWorkingModelName = (): string => cachedWorkingModel || 'Gemini 2.0 / 1.5 Flash';

// API anahtarının desteklediği modelleri tespit et veya adayları sırayla dene
async function runWithModelFallback(apiKey: string, prompt: string): Promise<string> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('GEMINI_KEY_MISSING');
  }

  const ai = new GoogleGenerativeAI(cleanKey);

  // 1. Daha önce çalışan model biliniyorsa önce onu dene
  if (cachedWorkingModel) {
    try {
      const model = ai.getGenerativeModel({ model: cachedWorkingModel });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      if (text) return text;
    } catch (e: any) {
      if (isTerminalError(e)) {
        throw formatGeminiError(e);
      }
      cachedWorkingModel = null;
    }
  }

  // 2. Aday modelleri sırayla dene
  let lastError: any = null;
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = ai.getGenerativeModel({ model: modelName });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      if (text) {
        cachedWorkingModel = modelName;
        return text;
      }
    } catch (err: any) {
      lastError = err;
      if (isTerminalError(err)) {
        throw formatGeminiError(err);
      }
      // Model bulunamadıysa (404) sonraki modele geç
      continue;
    }
  }

  throw formatGeminiError(lastError);
}

function isTerminalError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('api_key_invalid') || 
    msg.includes('api key not valid') || 
    msg.includes('permission_denied') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  );
}

function formatGeminiError(err: any): Error {
  const msg = err?.message || 'Bilinmeyen hata';
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return new Error("Geçersiz Gemini API Anahtarı! Lütfen Google AI Studio (aistudio.google.com) üzerinden aldığınız 'AIzaSy...' formatındaki geçerli anahtarı girin.");
  }
  if (msg.includes('PERMISSION_DENIED')) {
    return new Error("Erişim Reddedildi (Permission Denied). Bu API anahtarının Generative Language API izni etkinleştirilmemiş olabilir.");
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return new Error("Gemini API Kotası Doldu (Resource Exhausted). Lütfen birkaç dakika sonra tekrar deneyin veya Google AI Studio'dan yeni bir anahtar oluşturun.");
  }
  return new Error(`Gemini Bağlantı Hatası: ${msg}`);
}

export const testGeminiConnection = async (testKey?: string): Promise<{ success: boolean; message: string }> => {
  const key = testKey || getGeminiApiKey();
  if (!key) {
    return { success: false, message: 'API anahtarı boş. Lütfen geçerli bir anahtar girin.' };
  }

  try {
    const text = await runWithModelFallback(key, "Merhaba! Test başarılı mı? Kısaca 'Bağlantı başarılı' yaz.");
    return { 
      success: true, 
      message: `Gemini API bağlantısı başarılı! (Model: ${cachedWorkingModel || 'Gemini Flash'}) - Yanıt: ${text.slice(0, 50)}...` 
    };
  } catch (err: any) {
    console.error('Gemini test error:', err);
    return { 
      success: false, 
      message: err?.message || 'Gemini API bağlantısı kurulamadı.' 
    };
  }
};

// Çevrimdışı / Manuel şablon özeti motoru (Yalnızca kullanıcı manuel isterse devreye girer)
export function generateSmartOfflineSummary(logs: DailyLog[], tasks: ProjectTask[], timeframe: '24h' | 'all'): string {
  const totalHours = logs.reduce((sum, l) => sum + (Number(l.hoursWorked) || 0), 0);
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const bugs = tasks.filter(t => t.type === 'bug' && t.status !== 'completed');
  const latestLog = logs[0];

  return `📊 **${timeframe === '24h' ? 'Son 24 Saatlik Geliştirme Özeti (Çevrimdışı Şablon)' : 'Proje Genel İlerleme Raporu (Çevrimdışı Şablon)'}**

🔥 **Çalışma İstatistiği:**
- Toplam Kayıtlı Süre: **${totalHours} saat**
- İncelenen Log Sayısı: **${logs.length} adet**
- Güncel Versiyon: **${latestLog?.version || 'v0.1.0'}**

🛠️ **Son Geliştirmeler:**
${logs.slice(0, 4).map(l => `• [${l.version}] ${l.content} (${l.hoursWorked} saat)`).join('\n')}

🎯 **Durum & Hedefler:**
• Bekleyen Görevler: ${pendingTasks.length > 0 ? `${pendingTasks.length} adet yapılacak iş var.` : 'Tüm görevler tamamlandı! 🎉'}
${bugs.length > 0 ? `⚠️ Dikkat: Çözülmeyi bekleyen ${bugs.length} adet hata kaydı mevcut.` : '✅ Açık kritik hata bulunmuyor.'}

💡 *Not: Gerçek yapay zeka analizleri ve oyun tasarım önerileri için yukarıdan Gemini API anahtarınızı ekleyin.*`;
}

export const generateProjectSummary = async (
  logs: DailyLog[], 
  tasks: ProjectTask[], 
  timeframe: '24h' | 'all',
  project?: { name: string; engine: string; type: string; version: string }
): Promise<string> => {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_KEY_MISSING');
  }

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  const relevantLogs = timeframe === 'all' 
    ? logs 
    : logs.filter(l => now - l.date < ONE_DAY);
    
  if (relevantLogs.length === 0) {
    return "Seçili zaman aralığında hiç geliştirici logu bulunmuyor. Lütfen önce 'Geliştirici Günlüğü' sekmesinden çalışma logu ekleyin! 🚀";
  }

  const logText = relevantLogs.map(l => 
    `- [Tarih: ${new Date(l.date).toLocaleDateString('tr-TR')}] [Süre: ${l.hoursWorked} saat] [Sürüm: ${l.version}]: ${l.content}`
  ).join('\n');

  const pendingTodos = tasks.filter(t => t.type === 'todo' && t.status !== 'completed');
  const completedTodos = tasks.filter(t => t.type === 'todo' && t.status === 'completed');
  const openBugs = tasks.filter(t => t.type === 'bug' && t.status !== 'completed');
  const fixedBugs = tasks.filter(t => t.type === 'bug' && t.status === 'completed');

  const prompt = `
Sen "DevLog" uygulamasına entegre, kıdemli bir Oyun Tasarımcısı ve Kıdemli Oyun Geliştirici Yapay Zeka Koçusun.
Geliştiricinin projesine dair verileri aşağıda paylaşıyorum:

PROJE BİLGİLERİ:
- Oyun Adı: ${project?.name || 'Oyun Projesi'}
- Oyun Motoru: ${project?.engine || 'Bilinmiyor'}
- Tür / Kategori: ${project?.type || 'Bilinmiyor'}
- Mevcut Sürüm: ${project?.version || 'v1.0.0'}

ZAMAN ARALIĞI: ${timeframe === '24h' ? 'Son 24 Saat' : 'Projenin Başlangıcından Bu Yana'}

GELİŞTİRİCİ ÇALIŞMA LOGLARI:
${logText}

GÖREVLER VE HATALAR DURUMU:
- Tamamlanan Görevler (${completedTodos.length}): ${completedTodos.slice(0, 5).map(t => t.title).join(', ') || 'Yok'}
- Bekleyen Görevler (${pendingTodos.length}): ${pendingTodos.slice(0, 8).map(t => `${t.title} [${t.category || 'Genel'}]`).join(' | ') || 'Yok'}
- Açık Hatalar (${openBugs.length}): ${openBugs.slice(0, 5).map(b => `${b.title} [${b.category || 'Genel'}]`).join(' | ') || 'Yok'}
- Çözülen Hata Sayısı: ${fixedBugs.length}

GÖREVİN:
Bu verileri derinlemesine analiz et ve geliştiriciye özel hazırlanmış, profesyonel bir Türkçe rapor üret.
Rapor şu başlıklardan oluşmalı:
1. 🌟 **Genel Değerlendirme & İlerleme Hızı** (Eklenen logların oyuna kattığı değer)
2. 🛠️ **Öne Çıkan Geliştirmeler** (Loglardaki spesifik mekaniklere, optimizasyonlara ve içeriklere atıf yap)
3. 🎯 **Sonraki Kritik Hedefler** (Bekleyen görevler ve açık hatalar arasından geliştiricinin ilk yapması gerekenler)
4. 💡 **Oyun Tasarımı & Teknik Tavsiye** (${project?.engine || 'Seçili motor'} ve ${project?.type || 'oyun'} türüne özel faydalı, uygulanabilir bir ipucu)
5. 🔥 **Günün Motive Edici Kapanış Notu**

Üslubun: Profesyonel, samimi, bir oyun stüdyosundaki kıdemli ekip arkadaşı gibi, yerinde emojilerle ve okuması keyifli Markdown formatında olsun. Kalıplaşmış şablonlar yerine doğrudan geliştiricinin yazdıklarına yanıt ver.
`;

  return await runWithModelFallback(key, prompt);
};

export const generateSocialMediaPost = async (
  logs: DailyLog[], 
  platform: 'discord' | 'instagram' | 'twitter',
  project?: { name: string; engine: string; type: string; version: string }
): Promise<string> => {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_KEY_MISSING');
  }

  const recentLogs = logs.slice(0, 6);
  if (recentLogs.length === 0) {
    return "Paylaşım oluşturmak için önce en az 1 geliştirici logu eklemelisin! 🎮";
  }

  const logText = recentLogs.map(l => `- [v${l.version}]: ${l.content}`).join('\n');

  const prompt = `
Sen profesyonel bir Bağımsız Oyun (Indie Game) Topluluk Yöneticisi ve Sosyal Medya Uzmanısın.
Oyun Adı: ${project?.name || 'Oyun'}
Oyun Motoru: ${project?.engine || 'Bilinmiyor'}
Tür: ${project?.type || 'İndie'}
Mevcut Sürüm: ${project?.version || 'v1.0.0'}

GELİŞTİRİCİNİN EN SON LOGLARI:
${logText}

HEDEF PLATFORM: ${
  platform === 'instagram' 
    ? 'Instagram & Threads (Merak uyandırıcı başlık, maddeler halinde görsel anlatım, takipçilere soru ile bitiş, bol emoji ve popüler #indiedev #gamedev #oyungelistirme hashtagleri)'
    : platform === 'twitter'
    ? 'X / Twitter (Kısa, vurucu, 280 karaktere uygun hook, maddeler, #indiedev #gamedev hashtagleri)'
    : 'Discord (Topluluk duyurusu formatında, @everyone heyecanı, sürüm başlığı, yenilikler, bilinen sorunlar, oyunculara teşekkür ve geri bildirim çağrısı)'
}

GÖREVİN:
Doğrudan kopyalanıp paylaşılabilecek nihai gönderi metnini üret. "Tabii ki işte metniniz:" gibi selamlama cümleleri ASLA ekleme, doğrudan gönderi metnini yaz.
`;

  return await runWithModelFallback(key, prompt);
};

export const generateDevAdvice = async (
  logs: DailyLog[],
  tasks: ProjectTask[],
  project?: { name: string; engine: string; type: string; version: string }
): Promise<string> => {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_KEY_MISSING');
  }

  const pendingTodos = tasks.filter(t => t.type === 'todo' && t.status !== 'completed');
  const openBugs = tasks.filter(t => t.type === 'bug' && t.status !== 'completed');
  const latestLogs = logs.slice(0, 5);

  const prompt = `
Sen kıdemli bir Baş Oyun Tasarımcısı (Lead Game Designer) ve Yazılım Mimarı Yapay Zekasısın.
Geliştiricinin projesi:
- Oyun: ${project?.name || 'Bilinmiyor'}
- Motor: ${project?.engine || 'Bilinmiyor'}
- Tür: ${project?.type || 'Bilinmiyor'}
- Sürüm: ${project?.version || 'v1.0.0'}

Son Yapılanlar:
${latestLogs.map(l => `- ${l.content}`).join('\n') || 'Henüz log yok.'}

Bekleyen Görevler:
${pendingTodos.slice(0, 6).map(t => `- ${t.title} (${t.category || 'Genel'})`).join('\n') || 'Yok'}

Açık Hatalar:
${openBugs.slice(0, 5).map(b => `- ${b.title} (${b.category || 'Genel'})`).join('\n') || 'Yok'}

GÖREVİN:
Geliştiriciye projesini bir üst seviyeye taşıyacak stratejik, mimari ve oyun deneyimi (Game Feel / Juiciness) odaklı 3 kritik tavsiye ver:
1. 🎮 **Oynanış & Game Feel Tavsiyesi** (Oyunu oyuncuya daha tatmin edici hissettirmek için)
2. ⚡ **Performans & Kod Mimarisi İpucu** (${project?.engine || 'Oyun motoru'} için özel optimizasyon)
3. 🎯 **Sonraki Sprint Önceliği** (Neye odaklanmalı, neyi ertelemeli?)

Samimi, doğrudan ve ilham verici ol.
`;

  return await runWithModelFallback(key, prompt);
};
