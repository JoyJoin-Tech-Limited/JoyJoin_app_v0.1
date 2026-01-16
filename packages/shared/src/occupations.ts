/**
 * Re-export occupations from the main shared directory
 * This ensures the @shared/occupations import alias works correctly
 */
export { 
  OCCUPATIONS, 
  INDUSTRIES,
  WORK_MODES,
  PINYIN_MAP,
  OCCUPATION_ID_TO_NAME,
  INDUSTRY_ID_TO_LABEL,
  OCCUPATION_STATS,
  WORK_MODE_TO_LABEL,
  getOccupationById,
  getIndustryById,
  getOccupationsByIndustry,
  getHotOccupations,
  searchOccupations,
  getOccupationGuidance,
  getOccupationDisplayLabel,
  getIndustryDisplayLabel,
  type Occupation,
  type Industry,
  type WorkMode,
  type WorkModeOption,
} from '../../../shared/occupations';