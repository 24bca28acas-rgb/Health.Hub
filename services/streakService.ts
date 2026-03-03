import { StreakData } from "../types";

const STREAK_KEY = 'healthy_hub_streak';

export const getMotivationalMessage = (streak: number): string => {
  if (streak === 0) return "Let's start the journey today! 💪";
  if (streak < 3) return "You're warming up! Keep going. 🔥";
  if (streak < 7) return `You're on fire! 🔥 ${streak} days in a row!`;
  if (streak < 30) return `Unstoppable! ${streak} day streak! 🚀`;
  return `GOD MODE ENABLED. ${streak} DAYS. 👑`;
};

export const updateStreak = (): StreakData => {
  let stored: StreakData = { currentStreak: 0, lastLoginDate: '', milestoneReached: false };
  
  try {
    const item = localStorage.getItem(STREAK_KEY);
    if (item) stored = JSON.parse(item);
  } catch (e) {
    console.warn("Failed to parse streak", e);
  }

  const today = new Date().toISOString().split('T')[0];
  const lastDate = stored.lastLoginDate;

  // If already logged in today, return current state (no change)
  if (lastDate === today) {
    return { ...stored, milestoneReached: false }; // Milestone only triggers once per new day
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toISOString().split('T')[0];

  let newStreak = stored.currentStreak;
  let isMilestone = false;

  if (lastDate === yesterdayString) {
    // Streak continues
    newStreak += 1;
    // Check Milestones (3, 7, 30)
    if ([3, 7, 30, 100].includes(newStreak)) {
      isMilestone = true;
    }
  } else {
    // Streak broken (missed at least one day)
    // Exception: If this is the very first use (lastDate is empty), start at 1
    newStreak = 1; 
  }

  const newState: StreakData = {
    currentStreak: newStreak,
    lastLoginDate: today,
    milestoneReached: isMilestone
  };

  localStorage.setItem(STREAK_KEY, JSON.stringify(newState));
  return newState;
};