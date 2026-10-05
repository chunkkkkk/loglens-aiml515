import { z } from 'zod';

export const CATEGORIES = [
  'RRC_CONNECTION_FAILURE',
  'NAS_REGISTRATION_REJECT',
  'HANDOVER_FAILURE',
  'RADIO_LINK_FAILURE',
  'PDU_SESSION_FAILURE',
  'DEVICE_CRASH',
  'TEST_SETUP_ISSUE',
  'PERFORMANCE_THRESHOLD',
  'UNKNOWN',
];

export const DEFECT_TYPES = ['DEVICE_DEFECT', 'TEST_SETUP', 'NETWORK_CONFIG', 'INCONCLUSIVE'];

export const CATEGORY_LABELS = {
  RRC_CONNECTION_FAILURE: 'RRC connection failure',
  NAS_REGISTRATION_REJECT: 'NAS attach / registration reject',
  HANDOVER_FAILURE: 'Handover failure',
  RADIO_LINK_FAILURE: 'Radio link failure',
  PDU_SESSION_FAILURE: 'PDU / PDN session failure',
  DEVICE_CRASH: 'Device or modem crash',
  TEST_SETUP_ISSUE: 'Test setup issue',
  PERFORMANCE_THRESHOLD: 'Performance threshold miss',
  UNKNOWN: 'Unknown',
};

// The exact shape every analysis (AI or rules) must match before it is saved.
export const TriageSchema = z.object({
  category: z.enum(CATEGORIES),
  defectType: z.enum(DEFECT_TYPES),
  failingStep: z.string().min(1).max(200),
  rootCause: z.string().min(1).max(1200),
  confidence: z.number().min(0).max(1),
  evidenceLines: z.array(z.number().int().positive()).max(15),
  causeCodes: z.array(z.string().max(80)).max(10),
  suggestedNextSteps: z.array(z.string().max(300)).max(5),
});

// JSON Schema version handed to Claude as a tool definition.
export const triageToolSchema = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    defectType: { type: 'string', enum: DEFECT_TYPES },
    failingStep: { type: 'string', description: 'The protocol procedure or test step that failed, e.g. "RRC Connection Setup" or "Inter-frequency handover".' },
    rootCause: { type: 'string', description: 'Plain-English explanation (2-4 sentences) of why the test failed, citing the log evidence.' },
    confidence: { type: 'number', minimum: 0, maximum: 1, description: 'How sure you are, 0 to 1. Use below 0.5 when evidence is weak.' },
    evidenceLines: { type: 'array', items: { type: 'integer' }, description: 'Up to 8 line numbers from the excerpt that prove the failure.' },
    causeCodes: { type: 'array', items: { type: 'string' }, description: 'Protocol cause codes or timers seen, e.g. "EMM cause #15", "T304 expiry".' },
    suggestedNextSteps: { type: 'array', items: { type: 'string' }, description: 'Up to 3 concrete next steps for the QA engineer.' },
  },
  required: ['category', 'defectType', 'failingStep', 'rootCause', 'confidence', 'evidenceLines', 'causeCodes', 'suggestedNextSteps'],
};
