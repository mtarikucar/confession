import { GameInterface } from './gameInterface.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Turkish words from JSON file
let TURKISH_WORDS = new Set();
try {
  const wordsData = fs.readFileSync(path.join(__dirname, '../data/turkish-words.json'), 'utf8');
  const wordsJson = JSON.parse(wordsData);
  TURKISH_WORDS = new Set(wordsJson.words);
  console.log(`Loaded ${TURKISH_WORDS.size} Turkish words from dictionary`);
} catch (error) {
  console.error('Error loading Turkish words dictionary:', error);
  // Fallback to a basic set of words
  TURKISH_WORDS = new Set([
  // 3 letter words
  'ada', 'ana', 'ara', 'art', 'aşk', 'ata', 'ayı', 'bal', 'baş', 'ben', 'bir', 'bit', 'boy', 'buz', 'cam',
  'can', 'cep', 'çam', 'çay', 'dal', 'dam', 'dar', 'den', 'der', 'dil', 'diş', 'don', 'doz', 'düş', 'ebe',
  'ece', 'eda', 'ege', 'eki', 'eli', 'eme', 'eni', 'eri', 'eşi', 'eti', 'eve', 'evi', 'eyi', 'fal', 'far',
  'fay', 'fen', 'fil', 'fon', 'gaz', 'gel', 'gen', 'gez', 'gir', 'git', 'göl', 'gön', 'gör', 'gül', 'gün',
  'hal', 'han', 'har', 'has', 'hat', 'hay', 'her', 'hiç', 'his', 'hoş', 'huy', 'iki', 'ile', 'ilk', 'ini',
  'ipi', 'iri', 'işi', 'iti', 'iyi', 'jak', 'jel', 'jet', 'jon', 'jöle', 'kaba', 'kaç', 'kal', 'kam', 'kan',
  'kap', 'kar', 'kaş', 'kat', 'kav', 'kay', 'kaz', 'kek', 'kel', 'ken', 'keş', 'kez', 'kış', 'kim', 'kin',
  'kir', 'kit', 'kol', 'kom', 'kon', 'kor', 'kot', 'köy', 'köz', 'kul', 'kum', 'kup', 'kur', 'kuş', 'kut',
  'küf', 'kül', 'küp', 'kür', 'laf', 'lak', 'led', 'lek', 'lem', 'len', 'leş', 'lif', 'lik', 'lin', 'lir',
  'lok', 'lop', 'lor', 'lot', 'löş', 'lüp', 'mac', 'maç', 'mad', 'mağ', 'mal', 'man', 'mar', 'maş', 'mat',
  'mum', 'muz', 'nam', 'nar', 'nem', 'net', 'not', 'nur', 'oda', 'oku', 'ola', 'ona', 'ora', 'ort', 'ota',
  'oya', 'oyun', 'öde', 'ödü', 'öke', 'ömr', 'öne', 'önü', 'öpü', 'örn', 'öte', 'öve', 'öyk', 'öze', 'pak',
  'pal', 'pan', 'par', 'pas', 'pay', 'paz', 'pel', 'pek', 'per', 'pes', 'pet', 'pik', 'pil', 'pis', 'pot',
  'poz', 'pul', 'pus', 'püf', 'raf', 'ram', 'ray', 'ren', 'ret', 'rey', 'rol', 'rom', 'ruh', 'rum', 'rüy',
  'sac', 'saf', 'sağ', 'sah', 'sal', 'san', 'sap', 'sar', 'sat', 'sav', 'say', 'saz', 'sel', 'sen', 'ser',
  'ses', 'set', 'sık', 'sil', 'sim', 'sin', 'sir', 'sis', 'sit', 'siz', 'sol', 'som', 'son', 'sor', 'söz',
  'sud', 'sun', 'sur', 'sus', 'süt', 'şad', 'şah', 'şak', 'şal', 'şan', 'şap', 'şar', 'şat', 'şek', 'şer',
  'şey', 'şık', 'şim', 'şok', 'şov', 'şua', 'şuh', 'şut', 'tab', 'tac', 'tak', 'tam', 'tan', 'tap', 'tar',
  'taş', 'tat', 'tav', 'tay', 'taz', 'tek', 'tel', 'tem', 'ten', 'tep', 'ter', 'tez', 'tık', 'tim', 'tip',
  'tir', 'ton', 'top', 'tor', 'toy', 'töz', 'toz', 'tul', 'tur', 'tut', 'tuy', 'tuz', 'tül', 'tün', 'tür',
  'tüm', 'tüp', 'tüs', 'tüy', 'ucu', 'ula', 'ulu', 'umu', 'una', 'ura', 'uyu', 'var', 'ver', 'vur', 'yağ',
  'yak', 'yan', 'yap', 'yar', 'yaş', 'yat', 'yay', 'yaz', 'yed', 'yel', 'yem', 'yen', 'yer', 'yet', 'yık',
  'yıl', 'yin', 'yiv', 'yol', 'yon', 'yor', 'yön', 'yoz', 'yön', 'yuf', 'yum', 'yun', 'yur', 'yut', 'yük',
  'yün', 'yür', 'yüz', 'zam', 'zan', 'zar', 'zat', 'zay', 'zer', 'zil', 'zin', 'zir', 'zit', 'zor', 'zül',
  
  // 4 letter words
  'abla', 'acil', 'adam', 'adım', 'ağaç', 'ağır', 'akıl', 'akış', 'alan', 'alım', 'altı', 'anne', 'araba',
  'para', 'kara', 'kale', 'kral', 'dost', 'kafa', 'masa', 'saat', 'sana', 'bana', 'kedi', 'köpek', 'fare',
  'kuyu', 'kuru', 'sulu', 'tatlı', 'acı', 'soğuk', 'sıcak', 'ılık', 'yeni', 'eski', 'genç', 'yaşlı', 'uzun',
  'kısa', 'geniş', 'dar', 'yüksek', 'alçak', 'hızlı', 'yavaş', 'güçlü', 'zayıf', 'zengin', 'fakir', 'temiz',
  'kirli', 'kuru', 'ıslak', 'boş', 'dolu', 'açık', 'kapalı', 'doğru', 'yanlış', 'kolay', 'zor', 'basit',
  'arka', 'asıl', 'aşık', 'ayak', 'ayna', 'azim', 'baba', 'bacak', 'bahçe', 'bakış', 'balık', 'bardak',
  'barış', 'başka', 'bayrak', 'bazı', 'bebek', 'beden', 'bekar', 'belki', 'benzer', 'beraber', 'beyaz',
  'bilgi', 'bilim', 'biraz', 'bitki', 'bıçak', 'böyle', 'bugün', 'bulut', 'burun', 'büyük', 'cadde', 'canlı',
  'cevap', 'çanta', 'çelik', 'çevre', 'çiçek', 'çocuk', 'çorba', 'dağlı', 'dakik', 'dalga', 'damat', 'damla',
  'dans', 'dava', 'davul', 'dayı', 'değer', 'delik', 'demir', 'deniz', 'derin', 'dernek', 'ders', 'devam',
  'dilek', 'dünya', 'düşük', 'ekmek', 'elma', 'emek', 'erkek', 'eşya', 'evlat', 'fakat', 'fazla', 'fikir',
  'fırın', 'geniş', 'gıda', 'gibi', 'giriş', 'gözlük', 'güneş', 'güzel', 'haber', 'hafta', 'halk', 'hamur',
  'hanım', 'hareket', 'hasta', 'hayat', 'hayal', 'hayvan', 'hazır', 'hemen', 'henüz', 'hepsi', 'herkes',
  
  // 5+ letter words
  'abide', 'abluka', 'acele', 'acemi', 'açılış', 'adalet', 'adres', 'ağabey', 'ahşap', 'aile', 'akraba',
  'aksam', 'aktör', 'albüm', 'alışveriş', 'altın', 'amele', 'anayasa', 'anlam', 'anlaşma', 'apartman',
  'arazi', 'araştırma', 'arkadaş', 'asker', 'aslında', 'ateş', 'avukat', 'ayakkabı', 'ayrıca', 'bakan',
  'bakkal', 'balkon', 'banyo', 'bardak', 'başarı', 'başkan', 'başlık', 'bayram', 'beceri', 'belediye',
  'belge', 'belki', 'benzer', 'berber', 'beyaz', 'bilgisayar', 'bilim', 'binbaşı', 'bina', 'biraz',
  'birçok', 'birlik', 'bisiklet', 'bıçak', 'böbrek', 'bölge', 'bölüm', 'boyun', 'bozmak', 'buhar',
  'bulaşık', 'bulvar', 'bunlar', 'burada', 'buraya', 'büro', 'büyük', 'cadde', 'camii', 'ceket',
  'cenaze', 'cevap', 'ceza', 'çamaşır', 'çamur', 'çarşı', 'çekmek', 'çelik', 'çeşit', 'çevre',
  'çiftçi', 'çikolata', 'çimen', 'çimento', 'çizgi', 'çorap', 'çörek', 'çözüm', 'çukur', 'daire',
  'dakika', 'dalga', 'damat', 'damla', 'davranış', 'dayanak', 'değer', 'değişik', 'delik', 'delil',
  'demir', 'deneme', 'denge', 'deniz', 'deprem', 'derece', 'dergi', 'derin', 'dernek', 'dershane'
  ]);
}

// Letter frequencies for Turkish
const TURKISH_LETTER_FREQ = {
  'a': 12, 'e': 9, 'i': 8, 'n': 7, 'r': 7, 'l': 6, 'ı': 5, 'k': 5, 'd': 5, 
  't': 4, 's': 4, 'm': 4, 'u': 3, 'o': 3, 'y': 3, 'b': 3, 'ü': 2, 'ş': 2, 
  'g': 2, 'z': 2, 'h': 2, 'ç': 2, 'c': 2, 'p': 2, 'v': 1, 'ğ': 1, 'ö': 1, 
  'f': 1, 'j': 0.5
};

export class WordBattleGame extends GameInterface {
  constructor(players) {
    const playerIds = players.slice(0, 8);
    super(...playerIds);
    
    this.players = playerIds;
    this.maxPlayers = 8;
    this.roundDuration = 90000; // 90 seconds per round
    this.rounds = 1; // Total rounds - single round game
    this.currentRound = 0; // Start from 0, will be incremented in startNextRound
    this.roundStartTime = null;
    this.roundTimer = null;
    this.letters = [];
    this.usedWords = new Set();
    
    // Points system
    this.pointsMap = {
      3: 1,
      4: 2,
      5: 3,
      6: 5,
      7: 7,
      8: 10
    };
    
    // Initialize player states
    const initialState = {
      players: {},
      letters: [],
      roundTimeLeft: this.roundDuration / 1000,
      round: 0, // Will be set to 1 in startNextRound
      totalRounds: this.rounds,
      usedWords: [],
      recentSubmissions: []
    };
    
    playerIds.forEach(playerId => {
      initialState.players[playerId] = {
        score: 0,
        wordsFound: [],
        lastSubmission: null
      };
    });
    
    this.state = initialState;
    this.startNextRound();
  }
  
  generateLetters() {
    const letters = [];
    const vowels = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'];
    const consonants = Object.keys(TURKISH_LETTER_FREQ).filter(l => !vowels.includes(l));
    
    // Ensure at least 3 vowels
    for (let i = 0; i < 3; i++) {
      letters.push(vowels[Math.floor(Math.random() * vowels.length)]);
    }
    
    // Add weighted random letters
    for (let i = 0; i < 9; i++) {
      letters.push(this.getWeightedRandomLetter());
    }
    
    // Shuffle the letters
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    
    return letters;
  }
  
  getWeightedRandomLetter() {
    const totalWeight = Object.values(TURKISH_LETTER_FREQ).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (const [letter, weight] of Object.entries(TURKISH_LETTER_FREQ)) {
      random -= weight;
      if (random <= 0) {
        return letter;
      }
    }
    
    return 'a'; // Fallback
  }
  
  startNextRound() {
    // Increment round at the beginning
    this.currentRound++;
    
    console.log(`Starting round ${this.currentRound} of ${this.rounds}`);
    
    if (this.currentRound > this.rounds) {
      this.endGame();
      return;
    }
    
    // Generate new letters
    this.letters = this.generateLetters();
    this.usedWords.clear();
    this.roundStartTime = Date.now();
    
    // Update state
    this.state.letters = this.letters;
    this.state.round = this.currentRound;
    this.state.roundTimeLeft = this.roundDuration / 1000;
    this.state.usedWords = [];
    this.state.recentSubmissions = [];
    
    // Reset player round states
    Object.keys(this.state.players).forEach(playerId => {
      this.state.players[playerId].wordsFound = [];
      this.state.players[playerId].lastSubmission = null;
    });
    
    // Start round timer
    this.startRoundTimer();
    
    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
  }
  
  startRoundTimer() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
    }
    
    this.roundTimer = setInterval(() => {
      const elapsed = Date.now() - this.roundStartTime;
      const timeLeft = Math.max(0, this.roundDuration - elapsed) / 1000;
      
      this.state.roundTimeLeft = Math.ceil(timeLeft);
      
      if (timeLeft <= 0) {
        this.endRound();
      } else if (this.onStateUpdate) {
        this.onStateUpdate(this.getState());
      }
    }, 1000);
  }
  
  endRound() {
    console.log(`Ending round ${this.currentRound}`);
    
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    
    // Add round summary
    this.state.recentSubmissions.unshift({
      type: 'roundEnd',
      message: `Round ${this.state.round} bitti!`,
      timestamp: Date.now()
    });
    
    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
    
    // Start next round after a delay (currentRound will be incremented in startNextRound)
    setTimeout(() => {
      this.startNextRound();
    }, 3000);
  }
  
  processAction(playerId, action) {
    if (this.finished) {
      return { success: false, error: 'Game is finished' };
    }
    
    switch (action.type) {
      case 'submitWord':
        return this.handleWordSubmission(playerId, action.word);
      
      default:
        return { success: false, error: 'Unknown action type' };
    }
  }
  
  handleWordSubmission(playerId, word) {
    console.log(`Player ${playerId} submitted word: ${word}`);
    
    // Normalize word
    const normalizedWord = word.toLowerCase().trim();
    
    // Validate word length
    if (normalizedWord.length < 3) {
      console.log(`Word too short: ${normalizedWord.length} chars`);
      return { success: false, error: 'Kelime en az 3 harf olmalı' };
    }
    
    // Check if word was already used
    if (this.usedWords.has(normalizedWord)) {
      console.log(`Word already used: ${normalizedWord}`);
      this.addSubmission(playerId, normalizedWord, false, 'Bu kelime zaten kullanıldı');
      return { success: false, error: 'Bu kelime zaten kullanıldı' };
    }
    
    // Check if word can be formed from available letters
    if (!this.canFormWord(normalizedWord)) {
      console.log(`Word cannot be formed from letters: ${normalizedWord}`);
      console.log(`Available letters: ${this.letters.join(', ')}`);
      this.addSubmission(playerId, normalizedWord, false, 'Bu kelime mevcut harflerden oluşturulamaz');
      return { success: false, error: 'Bu kelime mevcut harflerden oluşturulamaz' };
    }
    
    // Check if word exists in dictionary
    if (!this.isValidTurkishWord(normalizedWord)) {
      console.log(`Word not valid: ${normalizedWord}`);
      this.addSubmission(playerId, normalizedWord, false, 'Geçersiz kelime');
      return { success: false, error: 'Geçersiz kelime' };
    }
    
    // Calculate points
    const points = this.calculatePoints(normalizedWord);
    
    // Update player score
    this.state.players[playerId].score += points;
    this.state.players[playerId].wordsFound.push(normalizedWord);
    this.state.players[playerId].lastSubmission = {
      word: normalizedWord,
      points,
      timestamp: Date.now()
    };
    
    // Add to used words
    this.usedWords.add(normalizedWord);
    this.state.usedWords.push(normalizedWord);
    
    // Add submission to recent list
    this.addSubmission(playerId, normalizedWord, true, `+${points} puan`);
    
    console.log(`Word accepted! Player ${playerId} earned ${points} points for '${normalizedWord}'`);
    
    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
    
    return { success: true, points, word: normalizedWord };
  }
  
  canFormWord(word) {
    const letterCount = {};
    
    // Count available letters
    for (const letter of this.letters) {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    }
    
    // Check if word can be formed
    for (const letter of word) {
      if (!letterCount[letter] || letterCount[letter] === 0) {
        return false;
      }
      letterCount[letter]--;
    }
    
    return true;
  }
  
  isValidTurkishWord(word) {
    // console.log(`Checking word: ${word}`);
    
    // Check our local dictionary
    const isValid = TURKISH_WORDS.has(word);
    console.log(`Word ${word} ${isValid ? 'found' : 'not found'} in dictionary (${TURKISH_WORDS.size} words loaded)`);
    
    // Future enhancement: Add API call here for words not in local dictionary
    // Example: TDK API, Zemberek NLP, or custom word validation service
    
    return isValid;
  }
  
  calculatePoints(word) {
    const length = word.length;
    if (length >= 8) return 10;
    return this.pointsMap[length] || Math.max(1, length - 2);
  }
  
  addSubmission(playerId, word, success, message) {
    const submission = {
      type: success ? 'success' : 'error',
      playerId,
      word,
      message,
      timestamp: Date.now()
    };
    
    // Keep only last 10 submissions
    this.state.recentSubmissions = [submission, ...this.state.recentSubmissions].slice(0, 10);
  }
  
  endGame() {
    this.finished = true;
    
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    
    // Calculate rankings
    const rankings = Object.entries(this.state.players)
      .map(([playerId, data]) => ({
        playerId,
        score: data.score,
        wordsFound: data.wordsFound.length
      }))
      .sort((a, b) => b.score - a.score);
    
    this.winner = rankings[0]?.playerId || null;
    
    // Notify game end
    if (this.onGameEnd) {
      this.onGameEnd({
        winner: this.winner,
        rankings,
        finalScores: this.state.players
      });
    }
  }
  
  getState() {
    return this.state;
  }
  
  cleanup() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }
}