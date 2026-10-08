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

// Modeller listesi (404 durumunda sırayla denenir)
const CANDIDATE_MODELS = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro',
  'gemini-pro'
];

let cachedWorkingModel: string | null = null;

// API anahtarının desteklediği modelleri tespit et veya adayları sırayla dene
async function runWithModelFallback(apiKey: string, prompt: string): Promise<string> {
  const ai = new GoogleGenerativeAI(apiKey);

  // 1. Daha önce çalışan model biliniyorsa önce onu dene
  if (cachedWorkingModel) {
    try {
      const model = ai.getGenerativeModel({ model: cachedWorkingModel });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      if (text) return text;
    } catch (e) {
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
      // 404 ise sonraki modele geç
      continue;
    }
  }

  throw lastError || new Error('Uygun Gemini modeli bulunamadı.');
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
      message: `Gemini API bağlantısı başarılı! (Kullanılan Model: ${cachedWorkingModel || 'Gemini'}) - Yanıt: ${text.slice(0, 50)}...` 
    };
  } catch (err: any) {
    console.error('Gemini test error:', err);
    return { 
      success: false, 
      message: `Gemini API hatası: ${err?.message || 'Bağlantı kurulamadı.'}. Ayarlar sayfasından anahtarınızı güncelleyebilirsiniz.` 
    };
  }
};

// Çevrimdışı / Hata durumunda yedek akıllı özet motoru (Kullanıcıyı asla yarı yolda bırakmaz)
function generateSmartOfflineSummary(logs: DailyLog[], tasks: ProjectTask[], timeframe: '24h' | 'all'): string {
  const totalHours = logs.reduce((sum, l) => sum + (Number(l.hoursWorked) || 0), 0);
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const bugs = tasks.filter(t => t.type === 'bug' && t.status !== 'completed');
  const latestLog = logs[0];

  return `📊 **${timeframe === '24h' ? 'Son 24 Saatlik Geliştirme Özeti' : 'Proje Genel İlerleme Raporu'}**

🔥 **Çalışma İstatistiği:**
- Toplam Kayıtlı Süre: **${totalHours} saat**
- İncelenen Log Sayısı: **${logs.length} adet**
- Güncel Versiyon: **${latestLog?.version || 'v0.1.0'}**

🛠️ **Son Geliştirmeler:**
${logs.slice(0, 4).map(l => `• [${l.version}] ${l.content} (${l.hoursWorked} saat)`).join('\n')}

🎯 **Durum & Hedefler:**
• Bekleyen Görevler: ${pendingTasks.length > 0 ? `${pendingTasks.length} adet yapılacak iş var.` : 'Tüm görevler tamamlandı! 🎉'}
${bugs.length > 0 ? `⚠️ Dikkat: Çözülmeyi bekleyen ${bugs.length} adet hata kaydı mevcut.` : '✅ Açık kritik hata bulunmuyor.'}

💪 *Harika ilerliyorsun! Devam et, oyun harika bir şekilde şekilleniyor!*`;
}

function generateSmartOfflineSocial(logs: DailyLog[], platform: 'discord' | 'instagram'): string {
  const latest = logs[0];
  const version = latest?.version || 'v0.1.0';

  if (platform === 'discord') {
    return `📢 **YENİ GÜNCELLEME DUYURUSU - ${version}** 🎮

Merhaba Topluluk! Oyunumuzun en yeni sürümü **${version}** hazır! İşte son geliştirmeler:

✨ **Neler Yeni?**
${logs.slice(0, 3).map(l => `• ${l.content}`).join('\n')}

Görüşlerinizi ve test geri bildirimlerinizi bekliyoruz! Herkese iyi oyunlar! 🚀`;
  }

  return `🎮 Geliştirme Günlüğü #${version} yayında! 🚀

Oyunumuz adım adım gelişiyor! Bu son güncellemede neler mi yaptık? 👇

${logs.slice(0, 3).map(l => `✨ ${l.content}`).join('\n')}

Takipte kalın ve düşüncelerinizi yorumlarda belirtmeyi unutmayın! 🔥

#gamedev #indiedev #indiegame #oyungelistirme #unrealengine #unity3d #devlog #coding`;
}

export const generateProjectSummary = async (
  logs: DailyLog[], 
  tasks: ProjectTask[], 
  timeframe: '24h' | 'all'
): Promise<string> => {
  const key = getGeminiApiKey();
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  const relevantLogs = timeframe === 'all' 
    ? logs 
    : logs.filter(l => now - l.date < ONE_DAY);
    
  if (relevantLogs.length === 0) {
    return "Seçili zaman aralığında hiç log bulunmuyor. Lütfen önce biraz çalışıp log girin! 🚀";
  }

  const logText = relevantLogs.map(l => 
    `- [${new Date(l.date).toLocaleDateString()}] [${l.hoursWorked} saat] [${l.version}]: ${l.content}`
  ).join('\n');

  const pendingTasks = tasks.filter(t => t.status !== 'completed').map(t => `- [${t.type.toUpperCase()}] ${t.title}`).join('\n');

  const prompt = `
    Sen "DevLog" isimli bir uygulama içinde yaşayan profesyonel, samimi ve motive edici bir oyun geliştirici yapay zeka asistanısın. 
    Bir geliştirici, projesindeki logları sana gönderiyor. Görevin bu logları okuyup ona harika bir geliştirme özeti çıkarmak.
    
    Zaman Aralığı: ${timeframe === '24h' ? 'Son 24 Saat' : 'Projenin Başından Beri'}
    
    LOGLAR:
    ${logText}
    
    BEKLEYEN GÖREVLER:
    ${pendingTasks || 'Bekleyen görev yok.'}
    
    Lütfen profesyonel ve samimi bir üslupla (emoji kullanarak) Türkçe bir özet çıkar. Yapılacak işleri de kısaca hatırlat.
  `;

  if (key) {
    try {
      return await runWithModelFallback(key, prompt);
    } catch (err: any) {
      console.warn('Gemini API çağrısı başarısız oldu, yerel özet motoru devreye girdi:', err);
    }
  }

  return generateSmartOfflineSummary(relevantLogs, tasks, timeframe);
};

export const generateSocialMediaPost = async (
  logs: DailyLog[], 
  platform: 'discord' | 'instagram'
): Promise<string> => {
  const key = getGeminiApiKey();
  const recentLogs = logs.slice(0, 5);
  
  if (recentLogs.length === 0) {
    return "Paylaşım oluşturmak için önce en az 1 geliştirici logu eklemelisin! 🎮";
  }

  const logText = recentLogs.map(l => 
    `- [v${l.version}]: ${l.content}`
  ).join('\n');

  const prompt = `
    Bir oyun geliştiricisi, son güncellemelerini sosyal medyada paylaşmak istiyor. 
    Hedef Platform: ${platform === 'instagram' ? 'Instagram (Bol emoji, hashtag, ve merak uyandıran samimi bir üslup)' : 'Discord (Daha teknik, liste halinde, heyecanlı bir duyuru formatı)'}
    
    GELİŞTİRİCİNİN SON LOGLARI:
    ${logText}
    
    Lütfen doğrudan kopyalanıp paylaşılabilecek nihai metni üret. Selamlama vs. ekleme. Hedef platformun ruhuna uygun olsun.
  `;

  if (key) {
    try {
      return await runWithModelFallback(key, prompt);
    } catch (err: any) {
      console.warn('Gemini API çağrısı başarısız oldu, yerel şablon motoru devreye girdi:', err);
    }
  }

  return generateSmartOfflineSocial(recentLogs, platform);
};
