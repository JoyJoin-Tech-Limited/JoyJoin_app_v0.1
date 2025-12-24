export interface ProfileCompletionResult {
  percentage: number;
  stars: number;
  missingFields: string[];
}

export function calculateProfileCompletion(user: any): ProfileCompletionResult {
  if (!user) return { percentage: 0, stars: 0, missingFields: [] };
  
  const fieldsToCheck = [
    { key: 'displayName', label: '昵称' },
    { key: 'gender', label: '性别' },
    { key: 'birthdate', label: '出生日期' },
    { key: 'currentCity', label: '城市' },
    { key: 'occupation', label: '职业' },
    { key: 'topInterests', label: '兴趣爱好', isArray: true },
    { key: 'educationLevel', label: '学历' },
    { key: 'relationshipStatus', label: '感情状态' },
    { key: 'intent', label: '社交意向' },
    { key: 'hometownCountry', label: '家乡' },
    { key: 'languagesComfort', label: '语言', isArray: true },
    { key: 'socialStyle', label: '社交风格' },
  ];
  
  let filledCount = 0;
  const missingFields: string[] = [];
  
  fieldsToCheck.forEach(field => {
    const value = user[field.key];
    const isFilled = field.isArray 
      ? Array.isArray(value) && value.length > 0
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
