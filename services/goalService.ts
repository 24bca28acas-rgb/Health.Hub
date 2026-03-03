import { ActivityData } from "../types";

/**
 * intelligently adjusts user goals based on their recent history and current streak.
 * 
 * Rules:
 * 1. If Streak > 3 and average steps > 95% of goal -> Increase goal by 5%.
 * 2. If Streak > 7 and average steps > 110% of goal -> Increase goal by 10%.
 * 3. Max Step Goal Cap: 25,000 steps.
 * 4. We do not automatically decrease goals to maintain positive psychology, 
 *    unless explicitly requested (logic can be added here).
 */
export const calculateAdaptiveGoals = (currentData: ActivityData, currentStreak: number): Partial<ActivityData> | null => {
  const { history, stepGoal, calorieGoal } = currentData;
  
  if (!history || history.length < 3) return null; // Need some data

  // Calculate Average of non-zero days in history
  const validDays = history.filter(d => d.steps > 0);
  if (validDays.length === 0) return null;

  const totalSteps = validDays.reduce((acc, curr) => acc + curr.steps, 0);
  const avgSteps = totalSteps / validDays.length;

  let newStepGoal = stepGoal;
  let newCalorieGoal = calorieGoal;
  let changed = false;

  // Adaptive Logic
  if (currentStreak >= 7) {
     if (avgSteps > stepGoal * 1.1) {
         newStepGoal = Math.min(25000, Math.ceil((stepGoal * 1.1) / 500) * 500); // +10%
         newCalorieGoal = Math.min(4000, Math.ceil((calorieGoal * 1.05) / 50) * 50); // +5%
         changed = true;
     }
  } else if (currentStreak >= 3) {
     if (avgSteps > stepGoal * 0.95) {
         newStepGoal = Math.min(25000, Math.ceil((stepGoal * 1.05) / 500) * 500); // +5%
         changed = true;
     }
  }

  if (changed && newStepGoal > stepGoal) {
      console.log(`Adaptive Goals Triggered: Steps ${stepGoal} -> ${newStepGoal}`);
      return {
          stepGoal: newStepGoal,
          calorieGoal: newCalorieGoal
      };
  }

  return null;
};