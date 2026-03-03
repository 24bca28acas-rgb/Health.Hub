
import { UserProfile, UserMetrics } from "../types";

export interface CheckInStatus {
  requiresCheckIn: boolean;
  openingMessage: string;
  pendingChecks: {
    tasks: boolean;
    weight: boolean;
    height: boolean;
  };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const SIXTY_DAYS_MS = 60 * ONE_DAY_MS;

/**
 * Determines if the user needs a check-in and what questions to ask.
 */
export const getDailyCheckInStatus = (profile: UserProfile): CheckInStatus => {
  const now = Date.now();
  const metrics = profile.metrics || { height: 0, weight: 0 };
  const lastWeight = metrics.lastWeightUpdate || 0;
  const lastHeight = metrics.lastHeightUpdate || 0;
  const age = metrics.age || 25;

  const checks = {
    tasks: true, // Priority 1: Always ask daily
    weight: false,
    height: false
  };

  const prompts: string[] = [];

  // 1. Daily Task Check
  // We rely on session logic in App.tsx to not ask this 10 times a day, 
  // but logically it is part of the "Daily" check-in sequence.
  prompts.push("Did you crush your tasks today?");

  // 2. Weekly Weight Check
  if ((now - lastWeight) > SEVEN_DAYS_MS) {
    checks.weight = true;
    prompts.push("It's been a week! What is your current weight today?");
  }

  // 3. Growth Spurt Height Check
  // Condition: Age < 21 AND > 60 days since last update
  if (age < 21 && (now - lastHeight) > SIXTY_DAYS_MS) {
    checks.height = true;
    prompts.push("You're in your growth phase! Have you grown taller? Let's check your height.");
  }

  // Construct the AI Persona Opening Message
  let openingMessage = `Good Morning ${profile.name.split(' ')[0]}! ☀️ `;
  
  if (checks.weight && checks.height) {
    openingMessage += "Big check-in day! Did you finish your tasks? Also, it's time to update your weight and height stats.";
  } else if (checks.weight) {
    openingMessage += "Did you finish your workout? Also, it's weigh-in day. What's the scale say?";
  } else if (checks.height) {
    openingMessage += "Quick check: Did you hit your goals? Also, let's see if you've grown taller recently.";
  } else {
    openingMessage += "Ready to dominate? Did you crush your daily tasks yet?";
  }

  return {
    requiresCheckIn: true, // In this logic, we always want at least the daily task check on first load
    openingMessage,
    pendingChecks: checks
  };
};
