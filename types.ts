
export interface ActivityData {
  steps: number;
  calories: number;
  distance: number;
  hydration: number;
  caloriesConsumed: number;
  stepGoal: number;
  calorieGoal: number;
  distanceGoal: number;
  hydrationGoal: number;
  history: { day: string; steps: number }[];
}

// --- NEW DATABASE TYPES ---

export interface DailyActivityDB {
  id?: string;
  userId: string;
  activityDate: string; // YYYY-MM-DD
  steps: number;
  caloriesBurned: number;
  caloriesConsumed: number;
  distanceKm: number;
  hydration?: number;
  hydrationGoal?: number;
  isTargetMet: boolean;
  streakAwarded?: boolean; // New field to prevent double-counting streaks
  updatedAt: string;
}

export interface FoodLogDB {
  id: string;
  userId: string;
  foodName: string;
  calories: number;
  imageUrl?: string;
  createdAt: string;
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
  userId: string;
  message: string;
  isUserMessage: boolean;
  createdAt: string;
  planData?: any;
}

export interface SavedWorkoutDB {
  id: string;
  userId: string;
  planData: any;
  createdAt: string;
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
  ACTIVITY_LOG = 'ACTIVITY_LOG'
}

export interface ActivityLogDB {
  id: string;
  userId: string;
  activityType: string;
  durationMinutes: number;
  intensity: 'Low' | 'Medium' | 'High';
  caloriesBurned: number;
  notes?: string;
  createdAt: string;
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
  current_streak?: number; // Alias for DB compatibility
  currentPlanName?: string; 
  primary_goal?: string; // Added for routing evaluation
  lastActiveDate?: string;
  last_active_date?: string; // Alias for DB compatibility
  penaltySteps?: number;
  lastPenaltyCalculationDate?: string;
  updatedAt?: string;
  updated_at?: string; // Alias for DB compatibility
  avatar_url?: string; // Alias for DB compatibility
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
