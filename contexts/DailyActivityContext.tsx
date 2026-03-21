import React, { createContext, useContext } from 'react';
import useStepTracker from '../hooks/useStepTracker';

type DailyActivityContextType = ReturnType<typeof useStepTracker>;

const DailyActivityContext = createContext<DailyActivityContextType | undefined>(undefined);

export const DailyActivityProvider: React.FC<{ children: React.ReactNode, userId: string | null, stepGoal: number }> = ({ children, userId, stepGoal }) => {
  const tracker = useStepTracker(userId, stepGoal);

  return (
    <DailyActivityContext.Provider value={tracker}>
      {children}
    </DailyActivityContext.Provider>
  );
};

export const useDailyActivityData = () => {
  const context = useContext(DailyActivityContext);
  if (context === undefined) {
    throw new Error('useDailyActivityData must be used within a DailyActivityProvider');
  }
  return context;
};
