/**
 * Context-Aware L3 (Niche) Inference Engine
 * 
 * Intelligently infers niche-level classification based on contextual keywords
 * in user input, particularly for finance and tech sectors.
 */

// Regex patterns for niche inference (compiled once for performance)
const FINANCE_IB_PATTERNS = {
  MA: /并购|m&a|merger|acquisition|一级并购|兼并|收购|重组/i,
  IPO: /ipo|上市|承销|首次公开|发行|股权承销|ecm|保荐/i,
  PRIMARY_MARKET: /一级市场|primary/i,
};

const FINANCE_PE_VC_PATTERNS = {
  PE: /私募|pe\b|股权投资|一级市场|lp|gp/i,
  VC: /风投|vc\b|创投|早期投资|天使/i,
};

const TECH_SOFTWARE_PATTERNS = {
  FRONTEND: /前端|frontend|react|vue|angular|web开发|h5/i,
  BACKEND: /后端|backend|java|python|go\b|node|服务端|api/i,
  FULLSTACK: /全栈|fullstack|full stack|前后端/i,
};

const TECH_AI_PATTERNS = {
  LLM: /大模型|llm|gpt|大语言模型|语言模型/i,
  MEDICAL_AI: /医疗ai|ai医疗|医学影像|healthcare ai/i,
  CV: /cv\b|计算机视觉|图像识别|视觉|computer vision/i,
  NLP: /nlp|自然语言|文本分析|语言处理/i,
};

/**
 * Infer niche from contextual keywords in user input
 */
export function inferNicheFromContext(
  userInput: string,
  category: string,
  segment: string
): NicheInference | null {
  const input = userInput.toLowerCase();
  
  // Finance - Investment Banking
  if (category === 'finance' && segment === 'investment_banking') {
    return inferFinanceInvestmentBankingNiche(input);
  }
  
  // Finance - PE/VC
  if (category === 'finance' && segment === 'pe_vc') {
    return inferFinancePEVCNiche(input);
  }
  
  // Tech - Software Development
  if (category === 'tech' && segment === 'software_dev') {
    return inferTechSoftwareDevNiche(input);
  }
  
  // Tech - AI/ML
  if (category === 'tech' && segment === 'ai_ml') {
    return inferTechAIMLNiche(input);
  }
  
  return null;
}

/**
 * Investment Banking niche inference
 */
function inferFinanceInvestmentBankingNiche(input: string): NicheInference | null {
  // M&A (Mergers & Acquisitions) detection
  if (FINANCE_IB_PATTERNS.MA.test(input)) {
    return {
      id: 'ma_advisory',
      label: '并购顾问',
      confidence: 0.92,
    };
  }
  
  // IPO/ECM detection
  if (FINANCE_IB_PATTERNS.IPO.test(input)) {
    return {
      id: 'ipo_ecm',
      label: 'IPO/股权承销',
      confidence: 0.90,
    };
  }
  
  // Primary market general (lower confidence)
  if (FINANCE_IB_PATTERNS.PRIMARY_MARKET.test(input)) {
    return {
      id: 'ma_advisory',
      label: '并购顾问',
      confidence: 0.75,
    };
  }
  
  return null;
}

/**
 * PE/VC niche inference
 */
function inferFinancePEVCNiche(input: string): NicheInference | null {
  // Private Equity detection
  if (FINANCE_PE_VC_PATTERNS.PE.test(input)) {
    return {
      id: 'private_equity',
      label: '私募股权',
      confidence: 0.88,
    };
  }
  
  // Venture Capital detection
  if (FINANCE_PE_VC_PATTERNS.VC.test(input)) {
    return {
      id: 'venture_capital',
      label: '风险投资',
      confidence: 0.88,
    };
  }
  
  return null;
}

/**
 * Software Development niche inference
 */
function inferTechSoftwareDevNiche(input: string): NicheInference | null {
  // Frontend detection
  if (TECH_SOFTWARE_PATTERNS.FRONTEND.test(input)) {
    return {
      id: 'frontend',
      label: '前端工程师',
      confidence: 0.90,
    };
  }
  
  // Backend detection
  if (TECH_SOFTWARE_PATTERNS.BACKEND.test(input)) {
    return {
      id: 'backend',
      label: '后端工程师',
      confidence: 0.90,
    };
  }
  
  // Fullstack detection
  if (TECH_SOFTWARE_PATTERNS.FULLSTACK.test(input)) {
    return {
      id: 'fullstack',
      label: '全栈工程师',
      confidence: 0.88,
    };
  }
  
  return null;
}

/**
 * AI/ML niche inference
 */
function inferTechAIMLNiche(input: string): NicheInference | null {
  // LLM/Large Language Model detection
  if (TECH_AI_PATTERNS.LLM.test(input)) {
    return {
      id: 'llm_research',
      label: '大模型研发',
      confidence: 0.90,
    };
  }
  
  // Medical AI detection
  if (TECH_AI_PATTERNS.MEDICAL_AI.test(input)) {
    return {
      id: 'medical_ai',
      label: '医疗AI',
      confidence: 0.88,
    };
  }
  
  // Computer Vision detection
  if (TECH_AI_PATTERNS.CV.test(input)) {
    return {
      id: 'cv',
      label: '计算机视觉',
      confidence: 0.88,
    };
  }
  
  // NLP detection
  if (TECH_AI_PATTERNS.NLP.test(input)) {
    return {
      id: 'nlp',
      label: '自然语言处理',
      confidence: 0.88,
    };
  }
  
  return null;
}
