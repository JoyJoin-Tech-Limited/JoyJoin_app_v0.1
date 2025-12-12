/**
 * Calculate age from birthdate
 * @param birthdate - ISO date string (YYYY-MM-DD) or Date object
 * @returns Age in years
 */
export function calculateAge(birthdate: string | Date): number {
  const birth = typeof birthdate === 'string' ? new Date(birthdate) : birthdate;
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  // Adjust age if birthday hasn't occurred this year yet
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Get age range bracket for display (e.g., "25-30岁")
 */
export function getAgeRange(age: number): string {
  if (age < 20) return "20岁以下";
  if (age < 25) return "20-24岁";
  if (age < 30) return "25-29岁";
  if (age < 35) return "30-34岁";
  if (age < 40) return "35-39岁";
  if (age < 45) return "40-44岁";
  if (age < 50) return "45-49岁";
  return "50岁以上";
}

/**
 * Format age for display
 * @param birthdate - ISO date string (YYYY-MM-DD) or Date object
 * @param visibility - Age visibility setting (hide_all, show_age_range, or legacy values)
 * @returns Formatted age string or null if hidden
 */
export function formatAge(
  birthdate: string | Date | null | undefined,
  visibility: string = "hide_all"
): string | null {
  if (!birthdate || visibility === "hide_all") {
    return null;
  }
  
  const age = calculateAge(birthdate);
  
  // New simplified visibility: show_age_range (default)
  if (visibility === "show_age_range") {
    return getAgeRange(age);
  }
  
  // Legacy support: show_exact_age still shows exact age
  if (visibility === "show_exact_age") {
    return `${age}岁`;
  }
  
  // Legacy support: show_generation maps to age range
  if (visibility === "show_generation") {
    return getAgeRange(age);
  }
  
  return null;
}
