
export interface ActivityData {
  steps: number;
  calories: number;
  distance: number;
  stepGoal: number;
  calorieGoal: number;
  distanceGoal: number;
  history: { day: string; steps: number }[];
}

// --- NEW DATABASE TYPES ---

export interface DailyActivityDB {
  id?: string;
  user_id: string;
  activity_date: string; // YYYY-MM-DD
  steps: number;
  calories_burned: number;
  distance_km: number;
  is_target_met: boolean;
  streak_awarded?: boolean; // New field to prevent double-counting streaks
  updated_at: string;
}

export interface FoodLogDB {
  id: string;
  user_id: string;
  food_name: string;
  calories: number;
  image_url?: string;
  created_at: string;
}

export interface FoodAnalysis {
  name: string;
  macros: FoodMacro;
  healthScore: number;
  verdict: 'Excellent' | 'Good' | 'Fair' | 'Avoid';
  advice: string;
  alternatives: string;
  colorCode: 'green' | 'yellow' | 'red';
  boundingBox?: number[];
}

export interface ChatHistoryDB {
  id: string;
  user_id: string;
  message: string;
  is_user_message: boolean;
  created_at: string;
  plan_data?: any;
}

export interface SavedWorkoutDB {
  id: string;
  user_id: string;
  plan_data: any;
  created_at: string;
}

// --------------------------

export interface DailyRecord {
  date: string;
  steps: number;
  caloriesBurned: number;
  caloriesConsumed: number;
  foodLogs: string[];
}

export interface FoodMacro {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface FoodHistoryItem {
  id: string;
  timestamp: number;
  analysis: FoodAnalysis;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  FOOD_LENS = 'FOOD_LENS',
  BMI_HUB = 'BMI_HUB',
  HEIGHT_CALIBRATION = 'HEIGHT_CALIBRATION',
  MAP_TRACKER = 'MAP_TRACKER',
  CHAT = 'CHAT',
  PROFILE = 'PROFILE',
  WORKOUT_LAB = 'WORKOUT_LAB'
}

export type Gender = 'Male' | 'Female' | 'Other';
export type FitnessGoal = 'Weight Loss' | 'Maintain' | 'Muscle Gain';
export type ActivityLevel = 'Sedentary' | 'Lightly Active' | 'Moderately Active' | 'Very Active';

export interface UserMetrics {
  height: number;
  weight: number;
  age?: number;
  gender?: Gender;
  dob?: string; // ISO Date String
  activityLevel?: ActivityLevel;
  fitnessGoal?: FitnessGoal;
  lastWeightUpdate?: number; // Timestamp
  lastHeightUpdate?: number; // Timestamp
}

/**
 * Added lastActiveDate to support synchronization of streak data from Supabase.
 */
export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  avatarUrl: string;
  metrics?: UserMetrics;
  goals?: {
    stepGoal: number;
    calorieGoal: number;
    distanceGoal: number;
    proteinGoal?: number;
  };
  currentStreak?: number; 
  currentPlanName?: string; 
  lastActiveDate?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface StreakData {
  currentStreak: number;
  lastLoginDate: string;
  milestoneReached: boolean;
}

export interface Exercise {
  name: string;
  sets: string;
  reps: string;
  notes: string;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  difficulty: string;
  duration: string;
  intensity?: string;
  equipment?: string;
  exercises: Exercise[];
  timestamp: number;
}
