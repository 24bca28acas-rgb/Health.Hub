
import { DailyRecord } from '../types';

const generateMockHistory = (): Record<string, DailyRecord> => {
  const history: Record<string, DailyRecord> = {};
  const today = new Date();
  
  // Populate past 45 days
  for (let i = 0; i <= 45; i++) {
    // Skip some random days to simulate "No records found" scenario (approx 15% chance)
    if (i > 0 && Math.random() > 0.85) continue;

    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    
    // Randomize stats for realistic feel
    const steps = Math.floor(Math.random() * 8000) + 3000; // 3000 - 11000
    const activeCals = Math.floor(steps * 0.055); 
    
    // Random protocols (food logs)
    const possibleFoods = [
        'Oatmeal & Berries', 'Scrambled Eggs & Avocado', 'Grilled Chicken Salad', 
        'Protein Shake', 'Salmon & Quinoa', 'Steak & Asparagus', 'Greek Yogurt', 
        'Almonds & Walnuts', 'Green Smoothie'
    ];
    
    const logsCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 logs
    const dailyLogs = [];
    for(let j=0; j<logsCount; j++) {
        dailyLogs.push(possibleFoods[Math.floor(Math.random() * possibleFoods.length)]);
    }

    history[dateKey] = {
      date: dateKey,
      steps: steps,
      caloriesBurned: activeCals,
      caloriesConsumed: Math.floor(Math.random() * 500) + 1800,
      foodLogs: dailyLogs
    };
  }
  return history;
};

export const MOCK_HISTORY = generateMockHistory();

export const getDayDetails = (dateStr: string): DailyRecord | null => {
  return MOCK_HISTORY[dateStr] || null;
};
