
import React from 'react';
import { Card, CARD_BACKS } from '../types';

interface MemoryCardProps {
  card: Card;
  onClick: () => void;
  disabled: boolean;
  cardBackId?: string;
  isHinted?: boolean;
}

const MemoryCard: React.FC<MemoryCardProps> = ({ card, onClick, disabled, cardBackId = 'classic', isHinted = false }) => {
  const isVisible = card.isFlipped || card.isMatched;
  const currentCardBack = CARD_BACKS.find(b => b.id === cardBackId) || CARD_BACKS[0];

  const getBackFaceStyles = () => {
    if (card.matchedBy === 1) return "bg-indigo-600/20 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)]";
    if (card.matchedBy === 2) return "bg-rose-600/20 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]";
    return "bg-slate-800/80 border-white/20 backdrop-blur-sm";
  };

  return (
    <div 
      className={`relative w-full aspect-square perspective-1000 transition-all duration-500 ease-in-out
        ${card.isMatched ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100 cursor-pointer'}
        ${isHinted ? 'scale-105 md:scale-110' : ''}
      `}
      onClick={() => !disabled && !isVisible && onClick()}
    >
      {isHinted && (
        <div className="absolute -inset-1 md:-inset-2 bg-yellow-400/30 blur-lg md:blur-xl rounded-full animate-pulse z-[-1]" />
      )}
      <div className={`relative w-full h-full duration-500 preserve-3d transition-transform ${isVisible ? 'rotate-y-180' : ''} ${isHinted ? 'animate-bounce' : ''}`}>
        {/* Mặt trước - Pattern tùy biến theo cardBack */}
        <div className={`absolute inset-0 w-full h-full backface-hidden rounded-lg md:rounded-xl bg-gradient-to-br ${currentCardBack.gradient} flex items-center justify-center border ${isHinted ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'border-white/10'} shadow-lg md:shadow-xl overflow-hidden`}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:12px_12px] md:bg-[length:16px_16px]"></div>
          <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full ${isHinted ? 'bg-yellow-400/20' : 'bg-white/5'} flex items-center justify-center border ${isHinted ? 'border-yellow-400/50' : 'border-white/10'} transition-transform`}>
            <span className={`${isHinted ? 'text-yellow-400' : 'text-white/30'} text-sm md:text-xl font-bold`}>?</span>
          </div>
        </div>

        {/* Mặt sau */}
        <div className={`absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-lg md:rounded-xl flex items-center justify-center border shadow-xl md:shadow-2xl ${getBackFaceStyles()}`}>
          <span className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl select-none drop-shadow-2xl animate-in zoom-in duration-300">
            {card.symbol}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MemoryCard;
