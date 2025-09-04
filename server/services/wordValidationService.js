import fetch from 'node-fetch';
import { wordCache } from '../config/redis.js';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests (10 req/sec max)

// Common Turkish words to pre-cache
const COMMON_WORDS = new Set([
  'masa', 'sandalye', 'kitap', 'kalem', 'defter', 'bilgisayar', 'telefon', 'araba',
  'ev', 'okul', 'anne', 'baba', 'çocuk', 'arkadaş', 'öğretmen', 'öğrenci', 'doktor',
  'hasta', 'yemek', 'su', 'ekmek', 'süt', 'çay', 'kahve', 'şeker', 'tuz', 'yağ',
  'sabah', 'akşam', 'gece', 'gün', 'hafta', 'ay', 'yıl', 'saat', 'dakika', 'saniye',
  'büyük', 'küçük', 'uzun', 'kısa', 'yeni', 'eski', 'güzel', 'çirkin', 'iyi', 'kötü',
  'sıcak', 'soğuk', 'hızlı', 'yavaş', 'kolay', 'zor', 'yakın', 'uzak', 'açık', 'kapalı'
]);

// Fallback words (basic dictionary) for when API is unavailable
const FALLBACK_WORDS = new Set([
  // 3 letter words
  'ada', 'ana', 'ara', 'art', 'aşk', 'ata', 'ayı', 'bal', 'baş', 'ben', 'bir', 'bit', 'boy', 'buz', 'cam',
  'can', 'cep', 'çam', 'çay', 'dal', 'dam', 'dar', 'den', 'der', 'dil', 'diş', 'don', 'doz', 'düş', 'ebe',
  'gel', 'git', 'göl', 'gör', 'gül', 'gün', 'hal', 'han', 'her', 'hiç', 'hoş', 'huy', 'ile', 'ilk',
  'jak', 'jel', 'jet', 'jon', 'kaç', 'kal', 'kan', 'kar', 'kaş', 'kat', 'kay', 'kaz', 'kek', 'kel', 'kim',
  'kır', 'kış', 'kol', 'köy', 'kul', 'kum', 'kuş', 'küp', 'laf', 'mum', 'muz', 'nar', 'net', 'not', 'nur',
  'oda', 'oku', 'ora', 'oya', 'öte', 'pak', 'par', 'pas', 'pay', 'pek', 'pil', 'pis', 'pul', 'rol', 'ruh',
  'sac', 'saf', 'sağ', 'sal', 'san', 'sap', 'sar', 'sat', 'say', 'saz', 'sel', 'sen', 'ser', 'ses', 'set',
  'sık', 'sil', 'sim', 'sin', 'sis', 'sol', 'son', 'sor', 'söz', 'sun', 'sus', 'süt', 'şah', 'şal', 'şan',
  'tak', 'tam', 'tan', 'taş', 'tat', 'tay', 'tek', 'tel', 'ten', 'tez', 'top', 'toy', 'toz', 'tul', 'tur',
  'tut', 'tuz', 'tüm', 'tüp', 'tüy', 'ulu', 'var', 'ver', 'vur', 'yağ', 'yak', 'yan', 'yap', 'yar', 'yaş',
  'yat', 'yay', 'yaz', 'yel', 'yem', 'yen', 'yer', 'yet', 'yık', 'yıl', 'yol', 'yor', 'yön', 'yum', 'yut',
  'yük', 'yün', 'yür', 'yüz', 'zam', 'zan', 'zar', 'zil', 'zor',
  
  // 4+ letter words
  'abla', 'adam', 'ağaç', 'akıl', 'alan', 'altı', 'para', 'kara', 'kale', 'kral', 'dost', 'kafa',
  'kedi', 'köpek', 'fare', 'kuyu', 'kuru', 'sulu', 'tatlı', 'acı', 'genç', 'yaşlı', 'geniş', 'zengin', 'fakir',
  'temiz', 'kirli', 'ıslak', 'boş', 'dolu', 'doğru', 'yanlış', 'basit', 'arka', 'asıl', 'aşık', 'ayak', 'ayna',
  'azim', 'bacak', 'bahçe', 'bakış', 'balık', 'bardak', 'barış', 'başka', 'bayrak', 'bazı', 'bebek', 'beden',
  'bekar', 'belki', 'benzer', 'beraber', 'beyaz', 'bilgi', 'bilim', 'biraz', 'bitki', 'bıçak', 'böyle', 'bugün',
  'bulut', 'burun', 'cadde', 'canlı', 'cevap', 'çanta', 'çelik', 'çevre', 'çiçek', 'çorba', 'dakik', 'dalga',
  'damat', 'damla', 'dans', 'dava', 'davul', 'dayı', 'değer', 'delik', 'demir', 'deniz', 'derin', 'dernek',
  'ders', 'devam', 'dilek', 'dünya', 'düşük', 'elma', 'emek', 'erkek', 'eşya', 'evlat', 'fakat', 'fazla',
  'fikir', 'fırın', 'gıda', 'gibi', 'giriş', 'gözlük', 'güneş', 'haber', 'hanım', 'hareket', 'hayat', 'hayal',
  'hayvan', 'hazır', 'hemen', 'henüz', 'hepsi', 'herkes'
]);

// Pre-cache common words on startup
(async () => {
  const wordsToCache = {};
  COMMON_WORDS.forEach(word => {
    wordsToCache[word] = true;
  });
  await wordCache.setMultiple(wordsToCache);
  console.log(`Pre-cached ${COMMON_WORDS.size} common Turkish words`);
})();

/**
 * Validates a Turkish word using TDK API with fallback
 * @param {string} word - The word to validate
 * @returns {Promise<boolean>} - True if word is valid
 */
export async function validateTurkishWord(word) {
  if (!word || typeof word !== 'string') {
    return false;
  }
  
  const normalizedWord = word.toLowerCase().trim();
  
  // Check Redis cache first
  const cached = await wordCache.get(normalizedWord);
  if (cached !== undefined) {
    console.log(`Word "${normalizedWord}" found in Redis cache: ${cached}`);
    return cached;
  }
  
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
  
  try {
    // Call TDK API
    console.log(`Checking word "${normalizedWord}" with TDK API...`);
    const response = await fetch(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(normalizedWord)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 3000 // 3 second timeout
    });
    
    const data = await response.json();
    
    // Check if word exists
    const isValid = !data.error && Array.isArray(data) && data.length > 0;
    
    // Cache the result in Redis
    await wordCache.set(normalizedWord, isValid);
    
    console.log(`TDK API result for "${normalizedWord}": ${isValid}`);
    return isValid;
    
  } catch (error) {
    console.error(`TDK API error for word "${normalizedWord}":`, error.message);
    
    // Fallback to basic dictionary
    const inFallback = FALLBACK_WORDS.has(normalizedWord) || COMMON_WORDS.has(normalizedWord);
    
    // Cache fallback result in Redis with shorter TTL (1 hour)
    await wordCache.set(normalizedWord, inFallback, 3600);
    
    console.log(`Using fallback dictionary for "${normalizedWord}": ${inFallback}`);
    return inFallback;
  }
}

/**
 * Pre-validate a list of words (for warming up cache)
 * @param {string[]} words - Array of words to validate
 */
export async function preValidateWords(words) {
  console.log(`Pre-validating ${words.length} words...`);
  
  for (const word of words) {
    const exists = await wordCache.exists(word);
    if (!exists) {
      await validateTurkishWord(word);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  
  console.log('Pre-validation complete');
}

/**
 * Get cache statistics from Redis
 * @returns {Promise<object>} Cache statistics
 */
export async function getCacheStats() {
  return await wordCache.getStats();
}

export default {
  validateTurkishWord,
  preValidateWords,
  getCacheStats
};