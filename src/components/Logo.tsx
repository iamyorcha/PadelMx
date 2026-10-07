import React from 'react';

export function Logo() {
  return (
    <div className="flex flex-col items-center pb-2">
      <img src="/logo.png" alt="Machos Padel" className="h-[90px] sm:h-[110px] object-contain drop-shadow-xl" />
    </div>
  );
}
