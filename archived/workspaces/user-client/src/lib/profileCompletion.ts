export interface ProfileCompletionResult {
  percentage: number;
  stars: number;
  missingFields: string[];
}

interface FieldCheck {
  key: string;
  label: string;
  isArray?: boolean;
  isBool?: boolean;
}

export function calculateProfileCompletion(user: any): ProfileCompletionResult {
  if (!user) return { percentage: 0, stars: 0, missingFields: [] };
  
  const fieldsToCheck: FieldCheck[] = [
    { key: 'displayName', label: '昵称' },
    { key: 'gender', label: '性别' },
    { key: 'birthdate', label: '出生日期' },
    { key: 'currentCity', label: '城市' },
    { key: 'occupationId', label: '职业' },
    { key: 'hasCompletedPersonalityTest', label: '人格测试', isBool: true },
    { key: 'educationLevel', label: '学历' },
    { key: 'hasCompletedInterestsCarousel', label: '兴趣偏好', isBool: true },
    { key: 'intent', label: '社交意向', isArray: true },
  ];
  
  let filledCount = 0;
  const missingFields: string[] = [];
  
  fieldsToCheck.forEach(field => {
    const value = user[field.key];
    const isFilled = field.isArray 
      ? Array.isArray(value) && value.length > 0
      : field.isBool
        ? value === true
        : value !== undefined && value !== null && value !== '';
    
    if (isFilled) {
      filledCount++;
    } else {
      missingFields.push(field.label);
    }
  });
  
  const percentage = Math.round((filledCount / fieldsToCheck.length) * 100);
  
  let stars = 1;
  if (percentage >= 90) stars = 5;
  else if (percentage >= 70) stars = 4;
  else if (percentage >= 40) stars = 3;
  else if (percentage >= 20) stars = 2;
  
  return { percentage, stars, missingFields };
}

export function getMatchingBoostEstimate(currentPercentage: number): number {
  if (currentPercentage >= 90) return 0;
  if (currentPercentage >= 70) return 15;
  if (currentPercentage >= 50) return 25;
  if (currentPercentage >= 30) return 35;
  return 40;
}
