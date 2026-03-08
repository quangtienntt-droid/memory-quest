
export interface Card {
  id: string;
  symbol: string;
  isFlipped: boolean;
  isMatched: boolean;
  matchedBy?: 1 | 2;
}

export type GameState = 'intro' | 'setup' | 'online_lobby' | 'stage_select' | 'idle' | 'loading' | 'playing' | 'won' | 'collection';
export type GameMode = 'single' | 'multi' | 'online';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master' | 'legend';

export interface GameTheme {
  name: string;
  description: string;
  emojiPrompt: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  stageId: number;
}

export interface CardBack {
  id: string;
  name: string;
  levelRequired: number;
  gradient: string;
}

export interface Background {
  id: string;
  name: string;
  description: string;
  levelRequired: number;
  previewClass: string;
}

export interface GameStage {
  id: number;
  name: string;
  theme: GameTheme;
  difficulty: Difficulty;
  rewardXp: number;
  requiredLevel: number;
  badge?: Badge;
}

export const BACKGROUNDS: Background[] = [
  { id: 'classic', name: 'Mặc định', description: 'Giao diện cổ điển mượt mà', levelRequired: 1, previewClass: 'bg-gradient-to-br from-indigo-900 to-slate-900' },
  { id: 'space', name: 'Vũ trụ lấp lánh', description: 'Những vì sao chuyển động trong bóng tối', levelRequired: 3, previewClass: 'bg-slate-950' },
  { id: 'forest', name: 'Khu rừng huyền bí', description: 'Sắc xanh của thiên nhiên và đom đóm', levelRequired: 5, previewClass: 'bg-emerald-950' },
  { id: 'neon', name: 'Thành phố neon', description: 'Sự sôi động của ánh sáng tương lai', levelRequired: 7, previewClass: 'bg-purple-950' },
];

export const CARD_BACKS: CardBack[] = [
  { id: 'classic', name: 'Cổ Điển', levelRequired: 1, gradient: 'from-slate-700 via-indigo-900 to-slate-900' },
  { id: 'nature', name: 'Rừng Xanh', levelRequired: 2, gradient: 'from-emerald-800 via-teal-900 to-slate-900' },
  { id: 'space', name: 'Vũ Trụ', levelRequired: 4, gradient: 'from-purple-900 via-slate-900 to-black' },
  { id: 'gold', name: 'Hoàng Gia', levelRequired: 6, gradient: 'from-amber-600 via-yellow-900 to-slate-900' },
  { id: 'cyber', name: 'Cyberpunk', levelRequired: 8, gradient: 'from-rose-600 via-indigo-900 to-slate-900' },
];

export const THEMES: GameTheme[] = [
  {
    name: 'Thiên Nhiên',
    description: 'Cây cỏ và động vật hoang dã',
    emojiPrompt: 'Provide unique nature, plant, and animal related emojis.'
  },
  {
    name: 'Công Nghệ',
    description: 'Thiết bị và biểu tượng số',
    emojiPrompt: 'Provide unique technology, computer, and electronics emojis.'
  },
  {
    name: 'Vũ Trụ',
    description: 'Sao, hành tinh và thiên hà',
    emojiPrompt: 'Provide unique space, galaxy, and astronomy emojis.'
  },
  {
    name: 'Ẩm Thực',
    description: 'Món ăn ngon và tráng miệng',
    emojiPrompt: 'Provide unique tasty food, fruit, and dessert emojis.'
  }
];

export const DIFFICULTY_CONFIG = {
  easy: { label: 'Dễ (12 ô)', pairs: 6, cols: 4, timeLimit: 45 },
  medium: { label: 'Vừa (16 ô)', pairs: 8, cols: 4, timeLimit: 60 },
  hard: { label: 'Khó (20 ô)', pairs: 10, cols: 5, timeLimit: 90 },
  expert: { label: 'Siêu Khó (24 ô)', pairs: 12, cols: 6, timeLimit: 120 },
  master: { label: 'Cao Thủ (30 ô)', pairs: 15, cols: 6, timeLimit: 150 },
  legend: { label: 'Thần Thánh (40 ô)', pairs: 20, cols: 8, timeLimit: 200 }
};

export const STAGES: GameStage[] = [
  { id: 1, name: 'Khởi Đầu', theme: THEMES[0], difficulty: 'easy', rewardXp: 100, requiredLevel: 1, badge: { id: 'b1', name: 'Mầm Non Ký Ức', icon: '🌱', description: 'Hoàn thành ải đầu tiên', stageId: 1 } },
  { id: 2, name: 'Thung Lũng Xanh', theme: THEMES[0], difficulty: 'medium', rewardXp: 150, requiredLevel: 1 },
  { id: 3, name: 'Mạch Điện Tử', theme: THEMES[1], difficulty: 'medium', rewardXp: 200, requiredLevel: 2, badge: { id: 'b2', name: 'Kỹ Sư Tập Sự', icon: '⚙️', description: 'Chiến thắng ải Công nghệ', stageId: 3 } },
  { id: 4, name: 'Siêu Máy Tính', theme: THEMES[1], difficulty: 'hard', rewardXp: 300, requiredLevel: 3 },
  { id: 5, name: 'Bụi Sao', theme: THEMES[2], difficulty: 'hard', rewardXp: 400, requiredLevel: 4, badge: { id: 'b3', name: 'Nhà Du Hành', icon: '👩‍🚀', description: 'Khám phá ải Vũ trụ', stageId: 5 } },
  { id: 6, name: 'Hố Đen Tử Thần', theme: THEMES[2], difficulty: 'expert', rewardXp: 600, requiredLevel: 5 },
  { id: 7, name: 'Đại Tiệc Buffet', theme: THEMES[3], difficulty: 'master', rewardXp: 800, requiredLevel: 6, badge: { id: 'b4', name: 'Vua Đầu Bếp', icon: '👨‍🍳', description: 'Thắng ải Ẩm thực khó nhất', stageId: 7 } },
  { id: 8, name: 'Thần Thoại Ký Ức', theme: THEMES[2], difficulty: 'legend', rewardXp: 1500, requiredLevel: 8, badge: { id: 'b5', name: 'Huyền Thoại', icon: '👑', description: 'Vượt qua thử thách Thần Thánh', stageId: 8 } },
];
