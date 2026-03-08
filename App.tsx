
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, GameState, THEMES, GameTheme, GameMode, Difficulty, DIFFICULTY_CONFIG, STAGES, GameStage, CARD_BACKS, Badge, BACKGROUNDS, Background } from './types';
import { fetchThemeEmojis } from './services/geminiService';
import { soundService } from './services/soundService';
import MemoryCard from './components/MemoryCard';
import { 
  Trophy, RotateCcw, BrainCircuit, Sparkles, User, Users, Volume2, VolumeX, Bot, 
  LayoutGrid, Zap, ArrowRight, ChevronLeft, MessageSquareQuote, Heart, Medal, 
  PartyPopper, Lock, Star, ChevronRight, TrendingUp, ShieldCheck, Palette, Package,
  Image as ImageIcon, Lightbulb, LogOut, Timer, FastForward, AlertCircle, Globe,
  Copy, Check, Share2, Radio, Wifi, Fingerprint
} from 'lucide-react';

const AI_PROVOCATIONS = [
  "Bạn định thắng tôi thật sao? Mơ đi! 😂",
  "Trí nhớ của máy móc là vô hạn!",
  "Cố lên, có vẻ bạn bắt đầu thấy mệt rồi nhỉ?",
  "Hãy xem ta thể hiện đây! ⚡",
  "Hmm, nước đi này... quá dễ đoán!",
  "Tôi đã nhớ hết vị trí các thẻ rồi đấy.",
  "Bạn chơi cũng được, nhưng chưa đủ đâu!",
  "Lượt của tôi, chuẩn bị chiêm ngưỡng nhé!"
];

const AI_PRAISES = [
  "Wow, trí nhớ tuyệt vời! 👏",
  "Cũng khá đấy, tôi bắt đầu thấy lo rồi...",
  "Một nước đi đẳng cấp!",
  "Bạn là thiên tài hay sao vậy?",
  "Ấn tượng thật! Bạn lật đúng rồi.",
  "Tôi phải nghiêm túc hơn mới được!",
  "Mắt bạn tinh đấy!"
];

const App: React.FC = () => {
  // Persistence & Progress
  const [xp, setXp] = useState<number>(() => Number(localStorage.getItem('mq_xp') || 0));
  const [unlockedStage, setUnlockedStage] = useState<number>(() => Number(localStorage.getItem('mq_stage') || 1));
  const [ownedBadges, setOwnedBadges] = useState<string[]>(() => JSON.parse(localStorage.getItem('mq_badges') || '[]'));
  const [activeCardBack, setActiveCardBack] = useState<string>(() => localStorage.getItem('mq_cardback') || 'classic');
  const [activeBackground, setActiveBackground] = useState<string>(() => localStorage.getItem('mq_background') || 'classic');
  const [collectionTab, setCollectionTab] = useState<'badges' | 'skins' | 'bg'>('badges');
  
  // Player Profile
  const [player1Name, setPlayer1Name] = useState(() => localStorage.getItem('mq_username') || '');
  const [player2Name, setPlayer2Name] = useState('Người chơi 2');
  const [aiName] = useState('Hệ thống AI');

  // Level derived from XP: level = floor(xp / 500) + 1
  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const xpPercentage = (xpInLevel / 500) * 100;

  // Game Configuration State
  const [gameState, setGameState] = useState<GameState>('intro');
  const [lastGameState, setLastGameState] = useState<GameState>('intro');
  const [gameMode, setGameMode] = useState<GameMode>('single');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [theme, setTheme] = useState<GameTheme>(THEMES[0]);
  const [selectedStage, setSelectedStage] = useState<GameStage | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [newBadgeEarned, setNewBadgeEarned] = useState<Badge | null>(null);
  
  // Online States
  const [roomCode, setRoomCode] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isOpponentReady, setIsOpponentReady] = useState(false);
  const [opponentName, setOpponentName] = useState('Đang chờ...');
  const socketRef = useRef<WebSocket | null>(null);

  // Match State
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
  const [scores, setScores] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });

  // Game Play State
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiMemory, setAiMemory] = useState<Map<number, string>>(new Map());
  const [aiMessage, setAiMessage] = useState<string>("");
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hintedIndices, setHintedIndices] = useState<number[]>([]);
  
  // Exit Confirmation State
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // Online Countdown
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);
  
  // Notification State
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [totalTime, setTotalTime] = useState<number>(0);

  const messageTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);

const [players, setPlayers] = useState<{id:string,name:string}[]>([]);
const [opponentLeft, setOpponentLeft] = useState(false);
  // Sync Data
  useEffect(() => {
    localStorage.setItem('mq_xp', xp.toString());
    localStorage.setItem('mq_stage', unlockedStage.toString());
    localStorage.setItem('mq_badges', JSON.stringify(ownedBadges));
    localStorage.setItem('mq_cardback', activeCardBack);
    localStorage.setItem('mq_background', activeBackground);
    localStorage.setItem('mq_sound', isSoundEnabled.toString());
    localStorage.setItem('mq_username', player1Name);
  }, [xp, unlockedStage, ownedBadges, activeCardBack, activeBackground, isSoundEnabled, player1Name]);

  useEffect(() => {
  if (gameMode === 'online' && !socketRef.current) {
// kết nối WebSocket tới server Render
const socket = new WebSocket("wss://memory-quest-2.onrender.com");

socket.onopen = () => {
  console.log("Đã kết nối tới server");
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Nhận dữ liệu:", data);
};

socket.onerror = (error) => {
  console.error("Lỗi WebSocket:", error);
};

socket.onclose = () => {
  console.log("Kết nối đã đóng");
};
    socket.onopen = () => {
      console.log("Connected to server");
    };

    socket.onmessage = (event) => {

      console.log("Server message:", event.data);

      const message = JSON.parse(event.data);

      switch (message.type) {

  case "ROOM_UPDATE": {

  const { players, isHost } = message.payload;

  setIsHost(isHost);

  if (players.length === 1) {
    setPlayer1Name(players[0].name);
    setOpponentName("Đang chờ...");
    setIsOpponentReady(false);
  }

  if (players.length === 2) {
    setPlayer1Name(players[0].name);
    setOpponentName(players[1].name);
    setIsOpponentReady(true);
  }

  break;




}

        case "GAME_STARTED":

          const { theme: t, difficulty: d, cards: c } = message.payload;

          setTheme(t);
          setDifficulty(d);
          setCards(c);

          setGameState('playing');
          setScores({ 1: 0, 2: 0 });
          setActivePlayer(1);

          setFlippedIndices([]);
          setIsProcessing(false);

          if (isSoundEnabled) soundService.playFlip();

          break;

        case "GAME_ACTION":

          if (message.action === "FLIP") {

            const index = message.payload.index;

            setCards(prev => {

              const newCards = [...prev];
              newCards[index].isFlipped = true;

              return newCards;

            });

            setFlippedIndices(prev => [...prev, index]);

            if (isSoundEnabled) soundService.playFlip();

          }

          break;
case "OPPONENT_LEFT":

  setOpponentLeft(true);

  setOpponentName("Đang chờ...");
  setIsOpponentReady(false);

  break;
      }

    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      socketRef.current = null;
    };

    socketRef.current = socket;
  }

  return () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

}, [gameMode]);

  // Online Lobby Countdown
  useEffect(() => {
    if (gameState === 'online_lobby' && isOpponentReady && isHost) {
      if (lobbyCountdown === null) {
        setLobbyCountdown(5);
      } else if (lobbyCountdown > 0) {
        const timer = window.setTimeout(() => setLobbyCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
        return () => window.clearTimeout(timer);
      } else if (lobbyCountdown === 0) {
        // Host triggers game start for everyone
        handleStartOnlineGame();
        setLobbyCountdown(null);
      }
    } else {
      if (lobbyCountdown !== null) setLobbyCountdown(null);
    }
  }, [gameState, isOpponentReady, lobbyCountdown, isHost]);

  // Handle Timer Countdown
  useEffect(() => {
    if (gameState === 'playing' && gameMode === 'single' && timeLeft > 0 && !showExitConfirm) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setGameState('won');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState, gameMode, timeLeft, showExitConfirm]);

  const showLockNotice = (msg: string) => {
    if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current);
    setLockNotice(msg);
    noticeTimeoutRef.current = window.setTimeout(() => setLockNotice(null), 3000);
    if (isSoundEnabled) soundService.playMismatch();
  };

  const showAiMessage = useCallback((msg: string, duration: number = 2500) => {
    if (gameMode !== 'single') return;
    if (messageTimeoutRef.current) window.clearTimeout(messageTimeoutRef.current);
    setAiMessage(msg);
    messageTimeoutRef.current = window.setTimeout(() => setAiMessage(""), duration);
  }, [gameMode]);

  const toggleSound = () => {
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    soundService.toggle(newState);
    if (newState) soundService.playFlip();
  };
const handleExitGame = () => {
  if (socketRef.current && gameMode === "online") {
    socketRef.current.send(
      JSON.stringify({
        type: "PLAYER_EXIT"
      })
    );
  }

  setGameState("setup");
};
  const startWithSound = () => {
    soundService.toggle(true);
    setIsSoundEnabled(true);
    setGameState('setup');
  };

  const generateRoomCode = () => {
    if (!player1Name.trim()) {
      showLockNotice("Bạn cần nhập tên hồ sơ trước!");
      return;
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setGameState('online_lobby');
    
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "JOIN_ROOM",
        payload: { roomCode: code, playerName: player1Name }
      }));
    }
  };

  const joinRoom = (code: string) => {
    if (!player1Name.trim()) {
      showLockNotice("Bạn cần nhập tên hồ sơ trước!");
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 6) {
      showLockNotice("Mã PIN phải đủ 6 ký tự!");
      return;
    }
    setRoomCode(cleanCode);
    setGameState('online_lobby');

    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "JOIN_ROOM",
        payload: { roomCode: cleanCode, playerName: player1Name }
      }));
    }
  };

  const handleStartOnlineGame = () => {
    setGameState('idle'); // Go to theme selection
  };

  const openCollection = () => {
    if (gameState !== 'collection') {
        setLastGameState(gameState);
        setGameState('collection');
    }
  };

  const closeCollection = () => {
    setGameState(lastGameState);
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const initGame = async (selectedTheme: GameTheme, diff: Difficulty = difficulty) => {
    setIsSoundEnabled(true);
    soundService.toggle(true);
    
    setGameState('loading');
    setTheme(selectedTheme);
    setDifficulty(diff);
    setFlippedIndices([]);
    setScores({ 1: 0, 2: 0 });
    setActivePlayer(1);
    setAiMemory(new Map());
    setAiMessage("");
    setIsProcessing(false);
    setNewBadgeEarned(null);
    setHintsLeft(3);
    setHintedIndices([]);

    const config = DIFFICULTY_CONFIG[diff];
    setTotalTime(config.timeLimit);
    setTimeLeft(config.timeLimit);

    const emojis = await fetchThemeEmojis(selectedTheme.emojiPrompt, config.pairs);
    const gameCards: Card[] = [];
    
    emojis.forEach((emoji) => {
      const pairId = Math.random().toString(36).substring(2, 11);
      gameCards.push({ id: `${pairId}-1`, symbol: emoji, isFlipped: false, isMatched: false });
      gameCards.push({ id: `${pairId}-2`, symbol: emoji, isFlipped: false, isMatched: false });
    });

    const shuffled = shuffleArray(gameCards);

    if (gameMode === 'online' && isHost && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "START_GAME",
        payload: { theme: selectedTheme, difficulty: diff, cards: shuffled }
      }));
    }

    setCards(shuffled);
    setGameState('playing');
    soundService.playFlip();
  };

  const handleCardClick = (index: number) => {
    if (isProcessing || cards[index].isFlipped || cards[index].isMatched) return;
    
    // Turn validation
    if (gameMode === 'single' && activePlayer === 2) return;
    if (gameMode === 'online') {
      const myPlayerNum = isHost ? 1 : 2;
      if (activePlayer !== myPlayerNum) return;
    }

    if (flippedIndices.length >= 2) return;

    if (hintedIndices.length > 0) setHintedIndices([]);

    soundService.playFlip();
    
    if (gameMode === 'online' && socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "GAME_ACTION",
        action: "FLIP",
        payload: { index }
      }));
    }

    if (gameMode === 'single') {
      setAiMemory(prev => new Map(prev).set(index, cards[index].symbol));
    }

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);
    setFlippedIndices(prev => [...prev, index]);
  };

  const handleUseHint = () => {
    if (hintsLeft <= 0 || isProcessing || activePlayer !== 1 || gameMode !== 'single') return;
    const symbolMap = new Map<string, number[]>();
    cards.forEach((c, idx) => {
      if (!c.isMatched) {
        const indices = symbolMap.get(c.symbol) || [];
        indices.push(idx);
        symbolMap.set(c.symbol, indices);
      }
    });
    let foundPair: number[] | null = null;
    for (const indices of Array.from(symbolMap.values())) {
      if (indices.length >= 2) {
        foundPair = [indices[0], indices[1]];
        break;
      }
    }
    if (foundPair) {
      setHintedIndices(foundPair);
      setHintsLeft(prev => prev - 1);
      soundService.playFlip();
      setTimeout(() => setHintedIndices([]), 1500);
    }
  };

  useEffect(() => {
    if (gameState === 'playing' && gameMode === 'single' && activePlayer === 2 && !isProcessing && flippedIndices.length === 0) {
      const runAiTurn = async () => {
        if (Math.random() > 0.4) showAiMessage(AI_PROVOCATIONS[Math.floor(Math.random() * AI_PROVOCATIONS.length)]);
        await new Promise(r => setTimeout(r, 1200)); 
        const available = cards.map((c, i) => (c.isMatched || c.isFlipped ? -1 : i)).filter(i => i !== -1);
        if (available.length === 0) return;

        let first = -1, second = -1;
        const memoryEntries = Array.from(aiMemory.entries()).filter(([idx]) => !cards[idx].isMatched);
        for (let i = 0; i < memoryEntries.length; i++) {
          for (let j = i + 1; j < memoryEntries.length; j++) {
            if (memoryEntries[i][1] === memoryEntries[j][1]) {
              first = memoryEntries[i][0]; second = memoryEntries[j][0]; break;
            }
          }
          if (first !== -1) break;
        }

        if (first === -1) {
          first = available[Math.floor(Math.random() * available.length)];
          soundService.playFlip();
          setCards(prev => prev.map((c, i) => i === first ? { ...c, isFlipped: true } : c));
          setAiMemory(prev => new Map(prev).set(first, cards[first].symbol));
          setFlippedIndices([first]);
          await new Promise(r => setTimeout(r, 1000));
          const matchIdx = Array.from(aiMemory.entries()).find(([idx, sym]) => sym === cards[first].symbol && idx !== first && !cards[idx].isMatched);
          second = (matchIdx && !cards[matchIdx[0]].isFlipped) ? matchIdx[0] : available.filter(i => i !== first)[Math.floor(Math.random() * (available.length - 1))];
          soundService.playFlip();
          setCards(prev => prev.map((c, i) => i === second ? { ...c, isFlipped: true } : c));
          setAiMemory(prev => new Map(prev).set(second, cards[second].symbol));
          setFlippedIndices([first, second]);
        } else {
          soundService.playFlip();
          setCards(prev => prev.map((c, i) => i === first ? { ...c, isFlipped: true } : c));
          setFlippedIndices([first]);
          await new Promise(r => setTimeout(r, 1000));
          soundService.playFlip();
          setCards(prev => prev.map((c, i) => i === second ? { ...c, isFlipped: true } : c));
          setFlippedIndices([first, second]);
        }
      };
      runAiTurn();
    }
  }, [activePlayer, gameState, gameMode, isProcessing, cards, aiMemory, flippedIndices.length, showAiMessage]);

  useEffect(() => {
    if (flippedIndices.length === 2) {
      setIsProcessing(true);
      const [f, s] = flippedIndices;
      if (cards[f].symbol === cards[s].symbol) {
        setTimeout(() => {
          soundService.playMatch();
          setCards(prev => prev.map((c, i) => (i === f || i === s) ? { ...c, isMatched: true, isFlipped: true, matchedBy: activePlayer } : c));
          setScores(prev => ({ ...prev, [activePlayer]: prev[activePlayer] + 1 }));
          if (gameMode === 'single' && activePlayer === 1) showAiMessage(AI_PRAISES[Math.floor(Math.random() * AI_PRAISES.length)]);
          setFlippedIndices([]); setIsProcessing(false);
        }, 800);
      } else {
        setTimeout(() => {
          soundService.playMismatch();
          setCards(prev => prev.map((c, i) => (i === f || i === s) ? { ...c, isFlipped: false } : c));
          setActivePlayer(prev => prev === 1 ? 2 : 1);
          setFlippedIndices([]); setIsProcessing(false);
        }, 1200);
      }
    }
  }, [flippedIndices, cards, activePlayer, gameMode, showAiMessage]);

  useEffect(() => {
    if (gameState === 'playing' && cards.length > 0 && cards.every(c => c.isMatched)) {
      setGameState('won');
      soundService.playWin();

      if (gameMode === 'single' && scores[1] > scores[2] && selectedStage) {
        setXp(prev => prev + selectedStage.rewardXp);
        if (selectedStage.id === unlockedStage) setUnlockedStage(prev => prev + 1);
        if (selectedStage.badge && !ownedBadges.includes(selectedStage.badge.id)) {
          setOwnedBadges(prev => [...prev, selectedStage.badge!.id]);
          setNewBadgeEarned(selectedStage.badge);
        }
      }
    }
  }, [cards, gameState, gameMode, scores, selectedStage, unlockedStage, ownedBadges]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getEncouragementMessage = () => {
    if (gameMode === 'single' && timeLeft === 0) return "Hết giờ rồi! AI đã chiến thắng nhờ sự bền bỉ. Hãy nhanh tay hơn ở lần sau nhé!";
    if (scores[1] === scores[2]) return "Kẻ tám lạng người nửa cân! Một trận đấu thật sự kịch tính.";
    if (scores[1] > scores[2]) return gameMode === 'single' ? "Quá xuất sắc! Trí nhớ của bạn đã vượt xa hệ thống AI." : `Chúc mừng ${player1Name || 'Người chơi 1'}! Một chiến thắng hoàn toàn xứng đáng.`;
    return gameMode === 'single' ? "Đừng nản lòng nhé! Luyện tập thêm một chút bạn sẽ đánh bại được AI." : `Chúc mừng ${gameMode === 'online' ? opponentName : player2Name}! ${player1Name || 'Người chơi 1'} hãy cố gắng phục thù nhé.`;
  };

  const getGridClass = () => {
    const count = cards.length;
    if (count >= 40) return 'grid-cols-4 xs:grid-cols-5 sm:grid-cols-8'; 
    if (count >= 30) return 'grid-cols-4 xs:grid-cols-5 sm:grid-cols-6';
    if (count >= 24) return 'grid-cols-4 sm:grid-cols-6';
    if (count >= 20) return 'grid-cols-4 sm:grid-cols-5';
    return 'grid-cols-4';
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleWonScreenAction = () => {
    if (gameMode !== 'single') {
      initGame(theme, difficulty);
      return;
    }
    const userWon = scores[1] > scores[2] && timeLeft > 0;
    if (userWon) {
      const nextStage = STAGES.find(s => s.id === (selectedStage?.id || 0) + 1);
      if (nextStage) {
        if (level >= nextStage.requiredLevel) {
           setSelectedStage(nextStage);
           initGame(nextStage.theme, nextStage.difficulty);
        } else {
           showLockNotice(`Cấp độ quá thấp! Bạn cần đạt cấp ${nextStage.requiredLevel} để vào ${nextStage.name}.`);
           setGameState('stage_select');
        }
      } else {
        setGameState('stage_select');
      }
    } else {
      if (selectedStage) {
        initGame(selectedStage.theme, selectedStage.difficulty);
      } else {
        initGame(theme, difficulty);
      }
    }
  };

  const handleStageClick = (s: GameStage) => {
    const isUnlocked = unlockedStage >= s.id;
    const isLevelLocked = level < s.requiredLevel;
    if (!isUnlocked) {
      showLockNotice("Ải này đang bị khóa! Hãy hoàn thành các ải trước đó.");
      return;
    }
    if (isLevelLocked) {
      showLockNotice(`Yêu cầu cấp độ ${s.requiredLevel}! Hãy chơi các ải khác để tích lũy thêm XP.`);
      return;
    }
    setSelectedStage(s);
    initGame(s.theme, s.difficulty);
  };

  return (
    <div className="relative flex flex-col items-center min-h-screen w-full py-4 px-3 md:py-12">
      <div className={`bg-layer bg-${activeBackground}`} />

      {lockNotice && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="bg-rose-600/90 backdrop-blur-xl border border-rose-400/30 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 min-w-[300px] max-w-md">
              <div className="p-2 bg-white/20 rounded-xl">
                 <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-bold leading-tight text-white">{lockNotice}</p>
           </div>
        </div>
      )}

      <header className="w-full max-w-4xl flex flex-row items-center justify-between gap-2 mb-4 md:mb-10 relative">
        <div className="flex items-center gap-2 md:gap-4 group cursor-pointer" onClick={openCollection}>
          <div className="p-2 md:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl md:rounded-2xl shadow-lg shadow-indigo-500/20 group-hover:rotate-12 transition-transform">
            <BrainCircuit className="w-5 h-5 md:w-7 md:h-7 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-lg md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 leading-none">
              Memory Quest
            </h1>
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 shadow-sm">
                  <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 animate-pulse" />
                  <span className="text-[10px] font-black text-indigo-300">Cấp {level}</span>
                </div>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{xpInLevel}/500 XP</span>
              </div>
              <div className="w-24 md:w-40 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-1000 ease-out" style={{ width: `${xpPercentage}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={openCollection} className="p-2 md:p-3 rounded-xl bg-slate-900/50 border border-white/5 text-slate-400 hover:text-white transition-all">
            <Package className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button onClick={toggleSound} className={`p-2 md:p-3 rounded-xl border transition-all ${isSoundEnabled ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-900/50 border-white/5 text-slate-500'}`}>
            {isSoundEnabled ? <Volume2 className="w-4 h-4 md:w-5 md:h-5" /> : <VolumeX className="w-4 h-4 md:w-5 md:h-5" />}
          </button>

          {gameState !== 'idle' && gameState !== 'intro' && gameState !== 'setup' && gameState !== 'stage_select' && gameState !== 'collection' && gameState !== 'online_lobby' && (
            <div className="flex items-center bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl p-0.5 md:p-1 shadow-2xl overflow-hidden relative">
              <div className={`flex flex-col items-center px-2 md:px-4 py-0.5 md:py-1 rounded-lg md:rounded-xl transition-all ${activePlayer === 1 ? 'bg-indigo-600 shadow-lg scale-105' : 'opacity-40'}`}>
                <span className="text-[7px] md:text-[8px] font-bold uppercase text-indigo-200 truncate max-w-[40px] md:max-w-none">{player1Name || 'Bạn'}</span>
                <span className="text-sm md:text-xl font-black leading-none">{scores[1]}</span>
              </div>
              <div className="w-px h-4 md:h-6 bg-white/10 mx-0.5 md:mx-1" />
              <div className={`flex flex-col items-center px-2 md:px-4 py-0.5 md:py-1 rounded-lg md:rounded-xl transition-all ${activePlayer === 2 ? (gameMode === 'single' ? 'bg-emerald-600' : 'bg-rose-600') + ' shadow-lg scale-105' : 'opacity-40'}`}>
                <span className="text-[7px] md:text-[8px] font-bold uppercase text-white/70 truncate max-w-[40px] md:max-w-none">{gameMode === 'single' ? aiName : (gameMode === 'online' ? opponentName : player2Name)}</span>
                <span className="text-sm md:text-xl font-black leading-none">{scores[2]}</span>
              </div>
              {aiMessage && gameMode === 'single' && (
                <div className="absolute top-[110%] right-0 w-[140px] md:w-[180px] z-[60] animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-white text-slate-900 p-2 md:p-3 rounded-xl md:rounded-2xl rounded-tr-none shadow-2xl border-2 border-indigo-500 flex items-start gap-1 md:gap-2 relative">
                    <div className="absolute -top-2 right-4 w-2 h-2 md:w-3 md:h-3 bg-white border-l-2 border-t-2 border-indigo-500 rotate-45"></div>
                    <Bot className="w-3 h-3 md:w-4 md:h-4 text-indigo-500 flex-shrink-0 mt-0.5 md:mt-1" />
                    <p className="text-[9px] md:text-[11px] font-bold leading-tight">{aiMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="w-full max-w-5xl flex-1 flex flex-col items-center justify-center relative">
        {gameState === 'playing' && gameMode === 'single' && (
          <div className="w-full max-w-4xl mb-4 md:mb-6 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-1.5">
               <div className="flex items-center gap-1.5 text-white/60">
                 <Timer className={`w-3.5 h-3.5 ${timeLeft < 10 ? 'text-rose-500 animate-pulse' : ''}`} />
                 <span className={`text-[10px] font-black uppercase tracking-widest ${timeLeft < 10 ? 'text-rose-500' : ''}`}>Thời gian</span>
               </div>
               <span className={`text-lg md:text-xl font-black tabular-nums ${timeLeft < 10 ? 'text-rose-500 scale-110' : 'text-white'} transition-all`}>{formatTime(timeLeft)}</span>
            </div>
            <div className="w-full h-1.5 md:h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
               <div 
                 className={`h-full transition-all duration-1000 ease-linear rounded-full ${timeLeft < 10 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : timeLeft < (totalTime / 2) ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                 style={{ width: `${(timeLeft / totalTime) * 100}%` }}
               />
            </div>
          </div>
        )}

        {gameState === 'intro' && (
          <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-500 text-center">
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] md:rounded-[3rem] p-5 md:p-16 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
              <Sparkles className="w-10 h-10 md:w-16 md:h-16 text-indigo-400 mx-auto mb-4 md:mb-8 animate-pulse" />
              <h2 className="text-3xl md:text-6xl font-black mb-4 md:mb-6 tracking-tighter text-white leading-tight">
                Ký Ức <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Huyền Thoại</span>
              </h2>
              <p className="text-slate-400 text-sm md:text-lg mb-8 md:mb-12 max-w-md mx-auto leading-relaxed">
                Rèn luyện trí nhớ qua các ải thử thách, thu thập huy hiệu và kết nối với người chơi khác toàn cầu.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
                <button onClick={startWithSound} className="w-full sm:w-auto group px-8 md:px-10 py-4 md:py-5 bg-white text-slate-900 rounded-full font-black text-lg md:text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                  Bắt Đầu <ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={() => { soundService.toggle(true); setIsSoundEnabled(true); openCollection(); }} className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-white/5 border border-white/10 rounded-full font-bold text-base md:text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <Medal className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" /> Thành Tích
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'setup' && (
          <div className="w-full max-w-2xl animate-in slide-in-from-right-8 duration-500">
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-5 md:p-12 shadow-2xl relative">
              <button onClick={() => setGameState('intro')} className="absolute top-4 left-4 md:top-6 md:left-6 p-2 text-slate-500 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <h2 className="text-2xl md:text-3xl font-black mb-1 md:mb-2 text-center">Cài Đặt Trận Đấu</h2>
              <p className="text-slate-400 text-xs md:text-sm mb-6 md:mb-10 text-center">Xác định danh tính và chọn chế độ chơi.</p>
              
              {/* Player Profile Section */}
              <div className="mb-6 md:mb-10 p-4 md:p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl md:rounded-3xl animate-in slide-in-from-top-4">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                   <div className="p-1.5 bg-indigo-500 rounded-lg">
                      <Fingerprint className="w-3 h-3 md:w-4 md:h-4 text-white" />
                   </div>
                   <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-indigo-400">Hồ sơ người chơi</h3>
                </div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-indigo-500/50" />
                  <input 
                    type="text" 
                    value={player1Name} 
                    onChange={(e) => setPlayer1Name(e.target.value)} 
                    placeholder="Nhập tên của bạn..." 
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl focus:border-indigo-500 focus:outline-none transition-all font-bold text-base md:text-lg" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-10">
                <button onClick={() => setGameMode('single')} className={`flex flex-col items-center gap-2 md:gap-3 p-3 md:p-6 rounded-xl md:rounded-3xl border-2 transition-all ${gameMode === 'single' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5 opacity-60'}`}>
                  <Bot className={`w-6 h-6 md:w-8 md:h-8 ${gameMode === 'single' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="font-bold text-[9px] md:text-xs uppercase tracking-wider text-center">Ải Boss AI</span>
                </button>
                <button onClick={() => setGameMode('multi')} className={`flex flex-col items-center gap-2 md:gap-3 p-3 md:p-6 rounded-xl md:rounded-3xl border-2 transition-all ${gameMode === 'multi' ? 'border-rose-500 bg-rose-500/10' : 'border-white/5 bg-white/5 opacity-60'}`}>
                  <Users className={`w-6 h-6 md:w-8 md:h-8 ${gameMode === 'multi' ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span className="font-bold text-[9px] md:text-xs uppercase tracking-wider text-center">Đối Kháng</span>
                </button>
                <button onClick={() => setGameMode('online')} className={`flex flex-col items-center gap-2 md:gap-3 p-3 md:p-6 rounded-xl md:rounded-3xl border-2 transition-all ${gameMode === 'online' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-white/5 opacity-60'}`}>
                  <Globe className={`w-6 h-6 md:w-8 md:h-8 ${gameMode === 'online' ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="font-bold text-[9px] md:text-xs uppercase tracking-wider text-center">Trực Tuyến</span>
                </button>
              </div>

              {gameMode === 'online' ? (
                <div className="space-y-3 md:space-y-4 animate-in fade-in slide-in-from-bottom-4">
                   <div className="p-4 md:p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl md:rounded-3xl text-center">
                      <div className="flex flex-col gap-2 md:gap-3">
                        <button 
                          onClick={generateRoomCode} 
                          className={`w-full py-3 md:py-4 rounded-xl md:rounded-2xl font-black flex items-center justify-center gap-2 md:gap-3 transition-all ${player1Name.trim() ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                        >
                           <Radio className={`w-4 h-4 md:w-5 md:h-5 ${player1Name.trim() ? 'animate-pulse' : ''}`} /> Tạo Phòng Mới
                        </button>
                        <div className="flex gap-1.5 md:gap-2">
                          <input 
                            id="room-input"
                            type="text" 
                            placeholder="Mã PIN..." 
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-2 md:px-4 py-3 md:py-4 text-center font-black tracking-widest focus:outline-none focus:border-emerald-500 transition-all uppercase text-xs md:text-base"
                            maxLength={6}
                          />
                          <button 
                            onClick={() => joinRoom((document.getElementById('room-input') as HTMLInputElement).value)} 
                            className={`px-3 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold transition-all text-sm md:text-base ${player1Name.trim() ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                          >
                            Vào
                          </button>
                        </div>
                        {!player1Name.trim() && <p className="text-[9px] font-bold text-rose-400 italic mt-1 animate-pulse">Hãy nhập tên của bạn ở trên để mở khóa các tính năng Trực Tuyến</p>}
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4 animate-in fade-in">
                  {gameMode === 'multi' && (
                    <div className="relative animate-in fade-in slide-in-from-top-2 mb-4 md:mb-6">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-rose-500/50" />
                      <input 
                        type="text" 
                        value={player2Name} 
                        onChange={(e) => setPlayer2Name(e.target.value)} 
                        placeholder="Tên Người chơi 2" 
                        className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl focus:border-rose-500 focus:outline-none transition-all font-bold text-sm md:text-base" 
                      />
                    </div>
                  )}
                  <button 
                    onClick={() => {
                        if (!player1Name.trim()) {
                            showLockNotice("Đừng quên đặt biệt danh cho mình nhé!");
                            return;
                        }
                        gameMode === 'single' ? setGameState('stage_select') : setGameState('idle');
                    }} 
                    className="w-full py-4 md:py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl md:rounded-2xl font-black text-base md:text-lg shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3"
                  >
                    Tiếp Theo <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === 'online_lobby' && (
          <div className="w-full max-w-xl animate-in zoom-in duration-500">
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] md:rounded-[3rem] p-5 md:p-10 shadow-2xl relative text-center">
              <button onClick={handleExitGame} className="absolute top-4 left-4 md:top-8 md:left-8 p-2 text-slate-500 hover:text-white">
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              
              <div className="mb-6 md:mb-10">
                <div className="relative w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6">
                  <div className={`absolute inset-0 bg-emerald-500/20 rounded-full ${isOpponentReady ? '' : 'animate-ping'}`}></div>
                  <div className="relative w-full h-full bg-emerald-600 rounded-full flex items-center justify-center border-4 border-emerald-500/30">
                    <Globe className="w-6 h-6 md:w-10 md:h-10 text-white animate-pulse" />
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-black mb-1 md:mb-2">Sảnh Trực Tuyến</h2>
                <p className="text-slate-400 text-[10px] md:text-sm">Chia sẻ mã PIN để mời bạn bè</p>
              </div>

              {isOpponentReady && lobbyCountdown !== null && (
                <div className="mb-6 md:mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl animate-bounce">
                  <div className="flex items-center justify-center gap-3">
                    <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <p className="text-emerald-400 font-black text-lg md:text-xl uppercase tracking-tighter">Bắt đầu sau {lobbyCountdown}s...</p>
                  </div>
                </div>
              )}

              <div className="mb-6 md:mb-10 p-4 md:p-6 bg-white/5 border border-white/10 rounded-2xl md:rounded-[2rem]">
                <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 mb-1 md:mb-2 tracking-widest">Mã PIN Phòng</p>
                <div className="flex items-center justify-center gap-3 md:gap-4">
                  <span className="text-3xl md:text-5xl font-black tracking-[0.1em] md:tracking-[0.2em] text-emerald-400 font-mono">{roomCode}</span>
                  <button onClick={copyToClipboard} className={`p-2 md:p-3 rounded-xl transition-all ${isCopied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                    {isCopied ? <Check className="w-5 h-5 md:w-6 md:h-6" /> : <Copy className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-10">
                <div className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10 flex flex-col items-center gap-1.5 md:gap-2">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-indigo-600 flex items-center justify-center border-2 border-indigo-400">
                    <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <span className="text-[10px] md:text-xs font-bold truncate max-w-full px-1">{player1Name || 'Bạn'}</span>
                  {isHost && (
  <div className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[8px] md:text-[10px] font-black rounded-full uppercase">
    Chủ Phòng
  </div>
)}
                </div>
                <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all flex flex-col items-center gap-1.5 md:gap-2 ${isOpponentReady ? 'bg-white/5 border-emerald-500/30' : 'bg-black/20 border-white/5 border-dashed opacity-50'}`}>
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 ${isOpponentReady ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-800 border-slate-700'}`}>
                    {isOpponentReady ? <User className="w-5 h-5 md:w-6 md:h-6 text-white" /> : <Wifi className="w-5 h-5 md:w-6 md:h-6 text-slate-500 animate-pulse" />}
                  </div>
                  <span className="text-[10px] md:text-xs font-bold truncate max-w-full px-1">{opponentName}</span>
                  {isOpponentReady && <div className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[8px] md:text-[10px] font-black rounded-full uppercase">Đã tham gia</div>}
                  {!isOpponentReady && (
                    <div className="flex gap-1 mt-0.5">
                        {[0, 1, 2].map(i => <div key={i} className="w-0.5 h-0.5 md:w-1 md:h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => isOpponentReady ? setGameState('idle') : showLockNotice("Đang chờ đối thủ tham gia!")}
                className={`w-full py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-base md:text-lg transition-all flex items-center justify-center gap-2 md:gap-3 ${isOpponentReady ? 'bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
              >
                Bắt Đầu <Zap className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        )}

        {gameState === 'stage_select' && (
          <div className="w-full max-w-2xl animate-in slide-in-from-bottom-8 duration-500">
             <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-12 shadow-2xl relative">
               <button onClick={handleExitGame}className="absolute top-4 left-4 md:top-6 md:left-6 p-2 text-slate-500 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <h2 className="text-2xl md:text-3xl font-black mb-1 md:mb-2 text-center">Bản Đồ Ải</h2>
              <p className="text-slate-400 text-[10px] md:text-sm mb-6 md:mb-10 text-center">Mỗi ải có huy hiệu và phần thưởng XP riêng.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-h-[50vh] md:max-h-[60vh] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                {STAGES.map((s) => {
                  const isUnlocked = unlockedStage >= s.id;
                  const isLevelLocked = level < s.requiredLevel;
                  const canPlay = isUnlocked && !isLevelLocked;
                  const isOwned = s.badge && ownedBadges.includes(s.badge.id);

                  return (
                    <button key={s.id} onClick={() => handleStageClick(s)}
                      className={`group relative p-4 md:p-5 rounded-xl md:rounded-2xl border-2 text-left transition-all ${canPlay ? 'bg-indigo-500/5 border-white/5 hover:border-indigo-500 hover:bg-indigo-500/10 cursor-pointer' : 'bg-black/20 border-white/5 opacity-50 cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${canPlay ? 'text-indigo-400' : 'text-slate-500'}`}>Ải {s.id}</span>
                        {!canPlay ? <Lock className="w-3 h-3 md:w-4 md:h-4 text-slate-600" /> : isOwned ? <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 text-emerald-400" /> : <Zap className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />}
                      </div>
                      <h3 className="text-base md:text-lg font-bold mb-1 group-hover:text-indigo-400 transition-colors">{s.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">
                        <span>{s.theme.name}</span>
                        <span className="w-1 h-1 bg-slate-700 rounded-full" />
                        <span>{DIFFICULTY_CONFIG[s.difficulty].label.split(' ')[0]}</span>
                      </div>
                      <div className="mt-3 md:mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-1 md:gap-1.5 text-emerald-400">
                          <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" />
                          <span className="text-[9px] md:text-[10px] font-black">+{s.rewardXp} XP</span>
                        </div>
                        {isLevelLocked && <span className="text-[8px] md:text-[9px] text-rose-400 font-bold uppercase italic animate-pulse">Cần Cấp {s.requiredLevel}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {gameState === 'collection' && (
          <div className="w-full max-w-4xl animate-in zoom-in duration-500">
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] md:rounded-[3rem] p-4 md:p-12 shadow-2xl relative overflow-hidden">
              <button onClick={closeCollection} className="absolute top-4 left-4 md:top-8 md:left-8 p-2 md:p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full">
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              
              <div className="text-center mb-6 md:mb-8">
                <Medal className="w-8 h-8 md:w-10 md:h-10 text-indigo-400 mx-auto mb-2 md:mb-4" />
                <h2 className="text-2xl md:text-3xl font-black">Bộ Sưu Tập</h2>
              </div>

              <div className="flex items-center justify-center gap-1.5 md:gap-2 mb-6 md:mb-10">
                <button onClick={() => setCollectionTab('badges')} className={`px-4 md:px-6 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${collectionTab === 'badges' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>Huy Hiệu</button>
                <button onClick={() => setCollectionTab('skins')} className={`px-4 md:px-6 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${collectionTab === 'skins' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>Thẻ Bài</button>
                <button onClick={() => setCollectionTab('bg')} className={`px-4 md:px-6 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${collectionTab === 'bg' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>Nền</button>
              </div>

              <div className="min-h-[40vh] max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                {collectionTab === 'badges' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 animate-in fade-in slide-in-from-bottom-4">
                    {STAGES.filter(s => s.badge).map(s => {
                      const badge = s.badge!;
                      const isOwned = ownedBadges.includes(badge.id);
                      return (
                        <div key={badge.id} className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center text-center transition-all ${isOwned ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-black/20 border-white/5 grayscale opacity-40'}`}>
                          <span className="text-2xl md:text-4xl mb-1 md:mb-2">{badge.icon}</span>
                          <span className="text-[8px] md:text-[10px] font-black uppercase leading-tight truncate w-full">{badge.name}</span>
                          <p className="text-[7px] md:text-[8px] text-slate-500 font-bold mt-1">Ải {s.id}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {collectionTab === 'skins' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-4">
                    {CARD_BACKS.map(cb => {
                      const isUnlocked = level >= cb.levelRequired;
                      const isActive = activeCardBack === cb.id;
                      return (
                        <button key={cb.id} disabled={!isUnlocked} onClick={() => setActiveCardBack(cb.id)} className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex items-center gap-3 md:gap-4 transition-all ${isUnlocked ? (isActive ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/5 bg-white/5 hover:bg-white/10') : 'border-white/5 opacity-40 grayscale cursor-not-allowed'}`}>
                          <div className={`w-10 h-14 md:w-12 md:h-16 rounded-lg bg-gradient-to-br ${cb.gradient} border border-white/10 flex-shrink-0`} />
                          <div className="text-left flex-1">
                            <p className="font-bold text-xs md:text-sm">{cb.name}</p>
                            {!isUnlocked ? (
                              <p className="text-[8px] md:text-[9px] text-rose-400 font-black uppercase">Cấp {cb.levelRequired}</p>
                            ) : (
                              <p className="text-[8px] md:text-[9px] text-indigo-400 font-black uppercase">{isActive ? 'Đang dùng' : 'Sẵn sàng'}</p>
                            )}
                          </div>
                          {isUnlocked && isActive && <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {collectionTab === 'bg' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-4">
                    {BACKGROUNDS.map(bg => {
                      const isUnlocked = level >= bg.levelRequired;
                      const isActive = activeBackground === bg.id;
                      return (
                        <button key={bg.id} disabled={!isUnlocked} onClick={() => setActiveBackground(bg.id)} className={`w-full p-4 md:p-5 rounded-xl md:rounded-2xl border-2 flex flex-col gap-2 md:gap-3 transition-all ${isUnlocked ? (isActive ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/5 bg-white/5 hover:bg-white/10') : 'border-white/5 opacity-40 grayscale cursor-not-allowed'}`}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2 md:gap-3">
                              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl ${bg.previewClass} border border-white/10`} />
                              <div className="text-left">
                                <p className="font-bold text-xs md:text-sm">{bg.name}</p>
                                <p className="text-[8px] md:text-[10px] text-slate-500 leading-tight">{bg.description}</p>
                              </div>
                            </div>
                            {isUnlocked ? (isActive ? <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" /> : <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />) : <Lock className="w-4 h-4 md:w-5 md:h-5 text-slate-700" />}
                          </div>
                          {!isUnlocked && (
                            <p className="text-[8px] md:text-[9px] text-rose-400 font-black uppercase text-center mt-1">Mở khóa ở Cấp {bg.levelRequired}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {gameState === 'idle' && (
          <div className="w-full max-w-xl animate-in fade-in zoom-in duration-500">
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-12 shadow-2xl relative text-center">
              <button onClick={handleExitGame} className="absolute top-4 left-4 md:top-6 md:left-6 p-2 text-slate-500 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <LayoutGrid className="w-8 h-8 md:w-10 md:h-10 text-indigo-400 mx-auto mb-4 md:mb-6" />
              <h2 className="text-2xl md:text-3xl font-black mb-6 md:mb-8">Chọn Chủ Đề</h2>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {THEMES.map((t) => (
                  <button key={t.name} onClick={() => initGame(t)} className="group relative p-4 md:p-6 rounded-2xl md:rounded-3xl bg-white/5 border border-white/5 hover:border-indigo-500/40 hover:bg-white/10 transition-all text-left overflow-hidden h-24 md:h-32 flex flex-col justify-center">
                    <span className="absolute -right-2 -bottom-2 text-3xl md:text-5xl opacity-10 group-hover:scale-125 transition-transform duration-500">
                      {t.name === 'Thiên Nhiên' ? '🌳' : t.name === 'Vũ Trụ' ? '🌌' : t.name === 'Ẩm Thực' ? '🥘' : '💻'}
                    </span>
                    <h3 className="font-bold text-white text-base md:text-lg mb-0.5 md:mb-1 group-hover:text-indigo-400 transition-colors">{t.name}</h3>
                    <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 md:mt-10 flex flex-wrap justify-center gap-1.5 md:gap-2">
                {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((key) => (
                  <button key={key} onClick={() => setDifficulty(key)} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest border-2 transition-all ${difficulty === key ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-white/5 bg-white/5 text-slate-500'}`}>
                    {DIFFICULTY_CONFIG[key].label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {gameState === 'loading' && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <Zap className="absolute inset-0 m-auto w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-indigo-300 tracking-[0.3em] uppercase animate-pulse">Đang kết nối server</p>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="w-full max-w-4xl animate-in slide-in-from-bottom-8 duration-700">
            <div className={`grid gap-1.5 sm:gap-4 game-grid ${getGridClass()}`}>
              {cards.map((card, idx) => (
                <MemoryCard 
                  key={card.id} 
                  card={card} 
                  onClick={() => handleCardClick(idx)} 
                  disabled={isProcessing || (gameMode === 'single' && activePlayer === 2)} 
                  cardBackId={activeCardBack} 
                  isHinted={hintedIndices.includes(idx)}
                />
              ))}
            </div>
            
            <div className="mt-4 md:mt-12 flex flex-col items-center gap-4 md:gap-6">
              <div className={`mx-auto w-max px-6 md:px-8 py-2 md:py-3 rounded-full border border-white/20 backdrop-blur-xl shadow-2xl flex items-center gap-2 md:gap-3 font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all duration-500 animate-bounce ${activePlayer === 1 ? 'bg-indigo-600/90' : (gameMode === 'single' ? 'bg-emerald-600/90' : 'bg-rose-600/90')}`}>
                 {gameMode === 'online' ? (
                   activePlayer === (isHost ? 1 : 2) ? (
                     <><Zap className="w-3 h-3 md:w-4 md:h-4 text-yellow-400 animate-pulse" /> Lượt Của Bạn</>
                   ) : (
                     <><Wifi className="w-3 h-3 md:w-4 md:h-4 text-white/50 animate-pulse" /> Lượt Đối Thủ</>
                   )
                 ) : (
                   activePlayer === 1 ? <><User className="w-3 h-3 md:w-4 md:h-4" /> Lượt {player1Name || 'Bạn'}</> : (gameMode === 'single' ? <><Bot className="w-3 h-3 md:w-4 md:h-4 animate-pulse" /> {aiName}</> : <><User className="w-3 h-3 md:w-4 md:h-4" /> Lượt {gameMode === 'online' ? opponentName : player2Name}</>)
                 )}
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                {gameMode === 'single' && activePlayer === 1 && (
                  <button 
                    onClick={handleUseHint}
                    disabled={hintsLeft <= 0 || isProcessing}
                    className={`group flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 transition-all ${hintsLeft > 0 ? 'bg-yellow-400/10 border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/20 shadow-lg shadow-yellow-400/10' : 'bg-slate-900/50 border-white/5 text-slate-600 cursor-not-allowed opacity-50'}`}
                  >
                    <Lightbulb className={`w-4 h-4 md:w-5 md:h-5 ${hintsLeft > 0 ? 'animate-pulse' : ''}`} />
                    <span className="font-black text-xs md:text-sm uppercase">Gợi Ý ({hintsLeft})</span>
                  </button>
                )}
                
                <button 
                  onClick={() => setShowExitConfirm(true)} 
                  className="group flex items-center gap-2 md:gap-3 text-slate-500 hover:text-rose-400 transition-all uppercase text-[9px] md:text-[10px] font-black tracking-widest px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-white/5 border border-white/5 hover:border-rose-500/30 hover:bg-rose-500/10 shadow-lg"
                >
                  <LogOut className="w-3 h-3 md:w-4 md:h-4 group-hover:scale-110 transition-transform" /> Thoát
                </button>
              </div>
            </div>
          </div>
        )}

        {showExitConfirm && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 p-6 md:p-10 rounded-[2rem] text-center shadow-2xl max-w-sm w-full animate-in zoom-in duration-300">
              <h3 className="text-xl md:text-2xl font-black mb-2">Tạm Dừng</h3>
              <p className="text-slate-400 text-xs md:text-sm mb-8">Bạn muốn tiếp tục hay thoát trận đấu?</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm md:text-base shadow-lg hover:bg-indigo-500 transition-all"
                >
                  Tiếp Tục Chơi
                </button>
                <button 
                  onClick={() => {
                    setShowExitConfirm(false);
                    initGame(theme, difficulty);
                  }}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-sm md:text-base hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Chơi Lại
                </button>
                <button 
                   onClick={() => {
    setShowExitConfirm(false);
    handleExitGame();
  }}
                  className="w-full py-4 bg-rose-600/10 border border-rose-500/20 text-rose-400 rounded-2xl font-black text-sm md:text-base hover:bg-rose-600/20 transition-all"
                >
                  Thoát Về Màn Hình Chính
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState === 'won' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 backdrop-blur-xl bg-black/80 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/20 p-5 md:p-14 rounded-[2.5rem] md:rounded-[3rem] text-center shadow-[0_0_100px_rgba(0,0,0,0.5)] max-w-lg w-full animate-in zoom-in duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
              
              <div className="relative w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 md:mb-8">
                <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-30 animate-pulse"></div>
                <div className="relative w-full h-full bg-gradient-to-br from-yellow-400 to-amber-600 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl rotate-3">
                  {(gameMode === 'single' && (timeLeft === 0 || scores[1] <= scores[2])) ? <RotateCcw className="w-8 h-8 md:w-12 md:h-12 text-white" /> : (scores[1] >= scores[2] ? <Medal className="w-8 h-8 md:w-12 md:h-12 text-white" /> : <PartyPopper className="w-8 h-8 md:w-12 md:h-12 text-white" />)}
                </div>
              </div>

              <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-1 md:mb-2">
                {gameMode === 'single' && timeLeft === 0 ? "HẾT GIỜ!" : (scores[1] === scores[2] ? "HÒA NHAU!" : scores[1] > scores[2] ? "CHIẾN THẮNG!" : "KẾT THÚC!")}
              </h2>
              <p className="text-slate-400 text-xs md:text-sm font-medium mb-6 md:mb-8 leading-relaxed max-w-xs mx-auto">{getEncouragementMessage()}</p>

              <div className="flex gap-2 md:gap-4 mb-4 md:mb-6">
                <div className={`flex-1 p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 ${scores[1] >= scores[2] && (gameMode !== 'single' || timeLeft > 0) ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 opacity-50'}`}>
                   <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase mb-1 md:mb-2 truncate px-1">{player1Name || 'Bạn'}</p>
                   <p className="text-2xl md:text-4xl font-black">{scores[1]}</p>
                </div>
                <div className={`flex-1 p-3 md:p-5 rounded-2xl md:rounded-3xl border-2 ${scores[2] >= scores[1] || (gameMode === 'single' && timeLeft === 0) ? (gameMode === 'single' ? 'border-emerald-500 bg-emerald-500/10' : 'border-rose-500 bg-rose-500/10') : 'border-white/5 opacity-50'}`}>
                   <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase mb-1 md:mb-2 truncate px-1">{gameMode === 'single' ? aiName : (gameMode === 'online' ? opponentName : player2Name)}</p>
                   <p className="text-2xl md:text-4xl font-black">{scores[2]}</p>
                </div>
              </div>

              <div className="mb-8 p-4 bg-white/5 border border-white/5 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-black text-indigo-300 uppercase">Cấp {level}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{xpInLevel}/500 XP</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-1000 ease-out" style={{ width: `${xpPercentage}%` }} />
                </div>
              </div>

              <div className="flex gap-2 md:gap-3">
               <button onClick={handleExitGame}className="flex-1 py-3 md:py-5 bg-white/5 hover:bg-white/10 text-white rounded-xl md:rounded-2xl font-black text-xs md:text-sm border border-white/10 transition-all">Cài Đặt</button>
                <button onClick={handleWonScreenAction} className="flex-[2] py-3 md:py-5 bg-white text-slate-900 rounded-xl md:rounded-2xl font-black text-base md:text-lg shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 md:gap-3">
                  {gameMode !== 'single' ? (
                    <><RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> Chơi Lại</>
                  ) : (scores[1] > scores[2] && timeLeft > 0) ? (
                    <><FastForward className="w-4 h-4 md:w-5 md:h-5" /> Tiếp Tục</>
                  ) : (
                    <><RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> Chơi Lại</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
      {opponentLeft  && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-xl bg-black/60">
    <div className="bg-slate-900 border border-white/10 p-8 rounded-[2rem] text-center shadow-2xl max-w-sm w-full">

      <h3 className="text-2xl font-black text-rose-400 mb-2">
        Đối thủ đã rời trận
      </h3>

      <p className="text-slate-400 text-sm mb-6">
        Trận đấu đã kết thúc vì đối thủ thoát.
      </p>

      <button
        onClick={() => {
          setOpponentLeft(false);
          setGameState("intro");
        }}
        className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all"
      >
        Về màn hình chính
      </button>

    </div>
  </div>
)}

      <footer className="mt-auto pt-6 text-slate-700 text-[9px] font-bold tracking-[0.5em] uppercase">
        Memory Quest Pro • 2025 Experience
      </footer>
    </div>
  );
};

export default App;
