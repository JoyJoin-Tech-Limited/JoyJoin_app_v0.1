/**
 * Calculate age from birthdate
 * @param birthdate - ISO date string (YYYY-MM-DD) or Date object
 * @returns Age in years
 */
export function calculateAge(birthdate: string | Date): number {
  const birth = typeof birthdate === 'string' ? new Date(birthdate + 'T00:00:00') : birthdate;
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
 * Get age range bracket for display (e.g., "25-29岁")
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
 * Get generation label from birthdate (e.g., "95后", "00后")
 * @param birthdate - ISO date string (YYYY-MM-DD) or Date object
 * @returns Generation label or null if invalid
 */
export function getGenerationLabel(birthdate: string | Date | null | undefined): string | null {
  if (!birthdate) return null;
  
  const birth = typeof birthdate === 'string' ? new Date(birthdate + 'T00:00:00') : birthdate;
  const birthYear = birth.getFullYear();
  
  // Generation labels based on birth year
  if (birthYear >= 2005) return "05后";
  if (birthYear >= 2000) return "00后";
  if (birthYear >= 1995) return "95后";
  if (birthYear >= 1990) return "90后";
  if (birthYear >= 1985) return "85后";
  if (birthYear >= 1980) return "80后";
  if (birthYear >= 1975) return "75后";
  return "70后";
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
