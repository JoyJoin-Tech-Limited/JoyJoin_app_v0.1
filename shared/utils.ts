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
 * Format age for display
 * @param birthdate - ISO date string (YYYY-MM-DD) or Date object
 * @param visibility - Age visibility setting
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
  
  if (visibility === "show_exact_age") {
    return `${age}岁`;
  }
  
  return null;
}
