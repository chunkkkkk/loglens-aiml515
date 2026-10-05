// Offline fallback used when no ANTHROPIC_API_KEY is set or the AI call fails.
// It recognizes common 3GPP failure signatures with regular expressions.

const SIGNATURES = [
  {
    category: 'DEVICE_CRASH', defectType: 'DEVICE_DEFECT', step: 'Device / modem stability',
    re: /FATAL EXCEPTION|modem (crash|restart)|\bSSR\b|subsystem restart|tombstone|kernel panic/i,
    cause: 'The device or its modem crashed or restarted during the test, so the procedure could not complete.',
    next: ['Pull the full bugreport and modem crash dump from the device.', 'Check if the crash reproduces on the same build with a different SIM/cell config.'],
  },
  {
    category: 'TEST_SETUP_ISSUE', defectType: 'TEST_SETUP', step: 'Test station setup',
    re: /adb.*(offline|unauthorized|not found)|device not found|connection refused|license (error|expired)|emulator.*(not responding|error)|script error|cell (is )?not (configured|found)/i,
    cause: 'The failure comes from the test station (ADB, emulator, license, or script), not from the device under test.',
    next: ['Verify the ADB connection and test-equipment license, then rerun.', 'Do not file a device bug until the case fails on a healthy station.'],
  },
  {
    category: 'NAS_REGISTRATION_REJECT', defectType: 'NETWORK_CONFIG', step: 'NAS Attach / Registration',
    re: /(attach|registration|tracking area update|TAU|service) reject/i,
    cause: 'The network rejected the device at the NAS layer. The cause code tells whether this is a subscription/network configuration problem or a device behavior issue.',
    next: ['Compare the reject cause code with the expected behavior in the test spec.', 'Confirm the SIM profile and PLMN settings on the emulator.'],
  },
  {
    category: 'RRC_CONNECTION_FAILURE', defectType: 'INCONCLUSIVE', step: 'RRC Connection Setup',
    re: /rrc ?(connection ?)?(reject|setup ?fail|establishment ?fail)|RRCReject|T300\b.*expir/i,
    cause: 'The RRC connection could not be established (reject or T300 expiry), so the device never reached connected mode.',
    next: ['Check the RACH procedure and uplink power before the RRC request.', 'Verify cell barring / access class settings on the emulator.'],
  },
  {
    category: 'HANDOVER_FAILURE', defectType: 'DEVICE_DEFECT', step: 'Handover execution',
    re: /handover ?fail|HO ?fail|T304\b.*expir|reconfiguration ?with ?sync ?fail/i,
    cause: 'The device received a handover command but did not complete access on the target cell before T304 expired.',
    next: ['Check target cell measurements and RACH attempts after the handover command.', 'Rerun with the same neighbor configuration to confirm reproducibility.'],
  },
  {
    category: 'RADIO_LINK_FAILURE', defectType: 'INCONCLUSIVE', step: 'Connected-mode radio link',
    re: /radio link failure|\bRLF\b|T310\b.*expir|re-?establishment/i,
    cause: 'The radio link failed in connected mode (T310 expiry / RLF), followed by a re-establishment attempt.',
    next: ['Review RSRP/SINR trend before the RLF.', 'Check whether the emulator power profile matches the test spec.'],
  },
  {
    category: 'PDU_SESSION_FAILURE', defectType: 'NETWORK_CONFIG', step: 'PDU / PDN session establishment',
    re: /(pdu session|pdn connectivity|bearer resource|default bearer).*(reject|fail)/i,
    cause: 'The data session could not be established, so no user-plane connection was available.',
    next: ['Check the APN/DNN and S-NSSAI configuration.', 'Compare the 5GSM/ESM cause code with the spec.'],
  },
  {
    category: 'PERFORMANCE_THRESHOLD', defectType: 'DEVICE_DEFECT', step: 'Throughput / KPI check',
    re: /(throughput|latency|kpi|bler).*(below|above|exceed|threshold|limit)/i,
    cause: 'A measured KPI (such as throughput or latency) missed the pass threshold.',
    next: ['Compare the KPI against the previous passing build.', 'Check RF conditions and scheduler settings on the emulator.'],
  },
];

const CAUSE_CODE_RE = /((?:EMM|5GMM|ESM|5GSM)\s*cause\s*#?\s*\d+[^,;\n]{0,40})|(cause\s*[:=]\s*[A-Za-z_-]+(?:\s*\(\d+\))?)|(\bT3\d{2}\b\s*expir\w*)/gi;
// Non-global copy for .test() so lastIndex state never leaks between calls.
const CAUSE_CODE_TEST = new RegExp(CAUSE_CODE_RE.source, 'i');

export function analyzeWithRules(excerpt) {
  const lines = excerpt.lines;
  const sig = SIGNATURES.find((s) => lines.some((l) => s.re.test(l.text)));

  const causeCodes = [...new Set(lines.flatMap((l) => (l.text.match(CAUSE_CODE_RE) || []).map((c) => c.trim())))].filter((c) => !/cause\s*[:=]\s*(mo|mt)-/i.test(c)).slice(0, 6);

  if (!sig) {
    const evidence = excerpt.failureLine ? [excerpt.failureLine] : [];
    return {
      category: 'UNKNOWN',
      defectType: 'INCONCLUSIVE',
      failingStep: 'Not identified',
      rootCause: 'No known 3GPP failure signature was found in the log window. An engineer should review this log manually.',
      confidence: 0.2,
      evidenceLines: evidence,
      causeCodes,
      suggestedNextSteps: ['Review the full log around the failure line.', 'Add this pattern to LogLens once the root cause is known.'],
    };
  }

  const evidenceLines = lines.filter((l) => sig.re.test(l.text) || (CAUSE_CODE_TEST.test(l.text) && !/cause\s*[:=]\s*(mo|mt)-/i.test(l.text))).map((l) => l.n).slice(0, 8);
  const rootCause = causeCodes.length ? `${sig.cause} Observed: ${causeCodes.join(', ')}.` : sig.cause;

  return {
    category: sig.category,
    defectType: sig.defectType,
    failingStep: sig.step,
    rootCause,
    confidence: 0.6,
    evidenceLines,
    causeCodes,
    suggestedNextSteps: sig.next,
  };
}
