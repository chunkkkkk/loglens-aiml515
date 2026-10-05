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

export const CATEGORY_COLORS = {
  RRC_CONNECTION_FAILURE: '#7c3aed',
  NAS_REGISTRATION_REJECT: '#c2410c',
  HANDOVER_FAILURE: '#0e7490',
  RADIO_LINK_FAILURE: '#b91c1c',
  PDU_SESSION_FAILURE: '#4d7c0f',
  DEVICE_CRASH: '#be123c',
  TEST_SETUP_ISSUE: '#64748b',
  PERFORMANCE_THRESHOLD: '#a16207',
  UNKNOWN: '#94a3b8',
};

export const DEFECT_LABELS = {
  DEVICE_DEFECT: 'Device defect',
  TEST_SETUP: 'Test setup',
  NETWORK_CONFIG: 'Network config',
  INCONCLUSIVE: 'Inconclusive',
};

export function formatDate(sqliteDate) {
  if (!sqliteDate) return '';
  const d = new Date(sqliteDate.replace(' ', 'T') + 'Z');
  return d.toLocaleString();
}
